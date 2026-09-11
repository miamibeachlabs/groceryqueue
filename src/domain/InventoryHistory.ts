export type StockObservation = Readonly<{ kind: 'observed'; at: number; amount: number }>;
export type Restock = Readonly<{ kind: 'restocked'; at: number; amount: number }>;
export type InventoryEvent = StockObservation | Restock;

export type DepletionPrior = Readonly<{
  amount: number;
  overDays: number;
}>;

export type InventoryHistory = Readonly<{
  prior: DepletionPrior;
  events: readonly InventoryEvent[];
}>;

export type InventoryEstimate = Readonly<{
  amount: number;
  dailyUse: number;
  daysLeft: number;
  restockCycleDays: number;
  observations: number;
}>;

export type ObservationResult =
  | Readonly<{ kind: 'recorded'; history: InventoryHistory }>
  | Readonly<{ kind: 'missingRestock'; amount: number }>;

const millisecondsPerDay = 86_400_000;
const learningCycles = 4;
const minimumRestockIntervalDays = 1;

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

const start = (amount: number, expectedDays: number, at: number): InventoryHistory => {
  if (amount < 0 || expectedDays <= 0 || at < 0)
    throw new RangeError('Starting inventory and time must be valid.');
  return {
    prior: { amount, overDays: expectedDays },
    events: [{ kind: 'observed', amount, at }],
  };
};

const latestTime = (history: InventoryHistory): number =>
  history.events.at(-1)?.at ?? 0;

const restock = (history: InventoryHistory, amount: number, at: number): InventoryHistory => {
  if (amount <= 0 || at < latestTime(history))
    throw new RangeError('A restock must be positive and chronological.');
  return {
    ...history,
    events: [...history.events, { kind: 'restocked', amount, at }],
  };
};

const sinceLastObservation = (history: InventoryHistory): number => {
  let available = 0;
  for (let index = history.events.length - 1; index >= 0; index -= 1) {
    const event = history.events[index];
    if (event.kind === 'observed') return event.amount + available;
    available += event.amount;
  }
  return available;
};

const observe = (
  history: InventoryHistory,
  amount: number,
  at: number,
): ObservationResult => {
  if (amount < 0 || at < latestTime(history))
    throw new RangeError('A count must be nonnegative and chronological.');
  const available = sinceLastObservation(history);
  if (amount > available)
    return { kind: 'missingRestock', amount: amount - available };

  return {
    kind: 'recorded',
    history: {
      ...history,
      events: [...history.events, { kind: 'observed', amount, at }],
    },
  };
};

type Evidence = Readonly<{ amount: number; days: number; at: number }>;

const evidenceFrom = (history: InventoryHistory): readonly Evidence[] => {
  const [first, ...events] = history.events;
  if (!first || first.kind !== 'observed') return [];

  const evidence: Evidence[] = [{
    amount: history.prior.amount,
    days: history.prior.overDays,
    at: first.at,
  }];
  let observation = first;
  let added = 0;

  for (const event of events) {
    if (event.kind === 'restocked') {
      added += event.amount;
      continue;
    }

    const days = elapsedDays(observation.at, event.at);
    const consumed = observation.amount + added - event.amount;
    if (days > 0 && consumed >= 0)
      evidence.push({ amount: consumed, days, at: event.at });
    observation = event;
    added = 0;
  }

  return evidence;
};

const restockCycle = (history: InventoryHistory): number => {
  const times = history.events
    .filter((event): event is Restock => event.kind === 'restocked')
    .map(event => event.at);
  const intervals = times.slice(1).map((time, index) =>
    elapsedDays(times[index], time));
  return median(intervals
    .filter(days => days >= minimumRestockIntervalDays)
    .slice(-5)) ?? history.prior.overDays;
};

const latestInventory = (history: InventoryHistory): Readonly<{ amount: number; at: number }> => {
  let amount = 0;
  let at = history.events[0]?.at ?? 0;

  for (const event of history.events) {
    if (event.kind === 'observed') {
      amount = event.amount;
      at = event.at;
    } else {
      amount += event.amount;
    }
  }

  return { amount, at };
};

const estimateAt = (history: InventoryHistory, now: number): InventoryEstimate => {
  const restockCycleDays = restockCycle(history);
  const halfLife = learningCycles * restockCycleDays;
  const weighted = evidenceFrom(history).map(sample => ({
    ...sample,
    weight: 0.5 ** (elapsedDays(sample.at, now) / halfLife),
  }));
  const consumed = weighted.reduce((total, sample) =>
    total + sample.weight * sample.amount, 0);
  const days = weighted.reduce((total, sample) =>
    total + sample.weight * sample.days, 0);
  const dailyUse = days === 0 ? 0 : consumed / days;
  const inventory = latestInventory(history);
  const amount = Math.max(0,
    inventory.amount - elapsedDays(inventory.at, now) * dailyUse);
  const daysLeft = amount === 0 ? 0
    : dailyUse === 0 ? Infinity
    : amount / dailyUse;

  return {
    amount,
    dailyUse,
    daysLeft,
    restockCycleDays,
    observations: history.events.filter(event => event.kind === 'observed').length,
  };
};

/** Facts about inventory and the estimates that follow from them. */
export const InventoryHistory = { start, restock, observe, estimateAt } as const;
