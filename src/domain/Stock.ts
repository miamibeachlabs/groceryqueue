export type TimeUnit = 'day' | 'week';

export type Usage = Readonly<{
  amount: number;
  every: number;
  unit: TimeUnit;
}>;

export type Stock = Readonly<{
  amount: number;
  usage: Usage;
  observedAt: number;
}>;

const millisecondsPerDay = 86_400_000;

const daysIn = (usage: Usage): number =>
  usage.every * (usage.unit === 'week' ? 7 : 1);

const perDay = (usage: Usage): number =>
  usage.amount / daysIn(usage);

const remainingAt = (stock: Stock, now: number): number => {
  const elapsedDays = Math.max(0, now - stock.observedAt) / millisecondsPerDay;
  return Math.max(0, stock.amount - elapsedDays * perDay(stock.usage));
};

const daysLeftAt = (stock: Stock, now: number): number => {
  const remaining = remainingAt(stock, now);

  if (remaining === 0) return 0;
  const dailyUse = perDay(stock.usage);
  if (dailyUse === 0) return Infinity;
  return remaining / dailyUse;
};

/** Calculations over a human-scale usage interval. */
export const Usage = { perDay } as const;

/** Calculations over a stock observation. */
export const Stock = {
  remainingAt,
  daysLeftAt,
} as const;
