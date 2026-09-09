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

export type StockEstimate = Readonly<{
  remaining: number;
  daysLeft: number;
}>;

const millisecondsPerDay = 86_400_000;

const daysIn = (usage: Usage): number =>
  usage.every * (usage.unit === 'week' ? 7 : 1);

const perDay = (usage: Usage): number =>
  usage.amount / daysIn(usage);

const estimateAt = (stock: Stock, now: number): StockEstimate => {
  const dailyUse = perDay(stock.usage);
  const elapsedDays = Math.max(0, now - stock.observedAt) / millisecondsPerDay;
  const remaining = Math.max(0, stock.amount - elapsedDays * dailyUse);
  const daysLeft = remaining === 0 ? 0
    : dailyUse === 0 ? Infinity
    : remaining / dailyUse;

  return { remaining, daysLeft };
};

const estimateAfter = (stock: Stock, now: number, days: number): StockEstimate =>
  estimateAt(stock, now + days * millisecondsPerDay);

/** Calculations over a human-scale usage interval. */
export const Usage = { perDay } as const;

/** Calculations over a stock observation. */
export const Stock = {
  estimateAt,
  estimateAfter,
} as const;
