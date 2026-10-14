export type InventoryAnchor = Readonly<{ amount: number; at: number; boughtSince: number }>;
export type UsageEvidence = Readonly<{ amount: number; days: number; at: number }>;
export type PurchaseCadence = Readonly<{
  priorDays: number;
  lastAt?: number;
  intervals: readonly number[];
}>;

export type InventoryTracker = Readonly<{
  anchor: InventoryAnchor;
  usage: UsageEvidence;
  cadence: PurchaseCadence;
  observations: number;
  updatedAt: number;
}>;

export type InventoryEstimate = Readonly<{
  amount: number;
  dailyUse: number;
  daysLeft: number;
  restockCycleDays: number;
  observations: number;
}>;

export type ObservationResult = Readonly<{
  tracker: InventoryTracker;
  learned: boolean;
}>;

const millisecondsPerDay = 86_400_000;
const learningCycles = 1;
const rememberedIntervals = 5;
const unknownPriorDays = 7;

const elapsedDays = (from: number, to: number): number =>
  Math.max(0, to - from) / millisecondsPerDay;

const median = (values: readonly number[]): number | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const cycleDays = (tracker: InventoryTracker): number =>
  median(tracker.cadence.intervals) ?? tracker.cadence.priorDays;

const start = (amount: number, expectedDays: number, at: number): InventoryTracker => {
  if (amount < 0 || expectedDays <= 0 || at < 0)
    throw new RangeError('Starting inventory and time must be valid.');
  return {
    anchor: { amount, at, boughtSince: 0 },
    usage: { amount, days: expectedDays, at },
    cadence: { priorDays: expectedDays, intervals: [] },
    observations: 1,
    updatedAt: at,
  };
};

const startUnknown = (amount: number, at: number): InventoryTracker =>
  start(amount, unknownPriorDays, at);

const restock = (tracker: InventoryTracker, amount: number, at: number): InventoryTracker => {
  if (amount <= 0 || at < tracker.updatedAt)
    throw new RangeError('A purchase must be positive and chronological.');
  const interval = tracker.cadence.lastAt === undefined
    ? undefined
    : elapsedDays(tracker.cadence.lastAt, at);
  const intervals = interval !== undefined && interval >= 1
    ? [...tracker.cadence.intervals, interval].slice(-rememberedIntervals)
    : tracker.cadence.intervals;
  return {
    ...tracker,
    anchor: { ...tracker.anchor, boughtSince: tracker.anchor.boughtSince + amount },
    cadence: { ...tracker.cadence, lastAt: at, intervals },
    updatedAt: at,
  };
};

const observe = (tracker: InventoryTracker, amount: number, at: number): ObservationResult => {
  if (amount < 0 || at < tracker.updatedAt)
    throw new RangeError('A count must be nonnegative and chronological.');
  const available = tracker.anchor.amount + tracker.anchor.boughtSince;
  const sampleDays = elapsedDays(tracker.anchor.at, at);
  const halfLife = learningCycles * cycleDays(tracker);
  const retained = 0.5 ** (elapsedDays(tracker.usage.at, at) / halfLife);
  const learned = amount <= available && sampleDays > 0;
  return {
    tracker: {
      anchor: { amount, at, boughtSince: 0 },
      usage: learned ? {
        amount: retained * tracker.usage.amount + available - amount,
        days: retained * tracker.usage.days + sampleDays,
        at,
      } : tracker.usage,
      cadence: tracker.cadence,
      observations: tracker.observations + 1,
      updatedAt: at,
    },
    learned,
  };
};

/**
 * Starts a new, one-cycle estimate at `dailyUse` without changing the
 * estimated amount on hand. Counts observed later remain the evidence that
 * refines this deliberate correction.
 */
const setDailyUse = (
  tracker: InventoryTracker,
  dailyUse: number,
  at: number,
): InventoryTracker => {
  if (dailyUse < 0 || !Number.isFinite(dailyUse) || at < tracker.updatedAt)
    throw new RangeError('Daily use must be nonnegative and chronological.');

  const amount = estimateAt(tracker, at).amount;
  const days = cycleDays(tracker);
  return {
    ...tracker,
    anchor: { amount, at, boughtSince: 0 },
    usage: { amount: dailyUse * days, days, at },
    updatedAt: at,
  };
};

const estimateAt = (tracker: InventoryTracker, now: number): InventoryEstimate => {
  const dailyUse = tracker.usage.amount / tracker.usage.days;
  const available = tracker.anchor.amount + tracker.anchor.boughtSince;
  const amount = Math.max(0, available - elapsedDays(tracker.anchor.at, now) * dailyUse);
  return {
    amount,
    dailyUse,
    daysLeft: amount === 0 ? 0 : dailyUse === 0 ? Infinity : amount / dailyUse,
    restockCycleDays: cycleDays(tracker),
    observations: tracker.observations,
  };
};

/** A constant-space inventory estimate learned from counts and purchases. */
export const InventoryTracker = {
  start,
  startUnknown,
  restock,
  observe,
  setDailyUse,
  estimateAt,
} as const;
