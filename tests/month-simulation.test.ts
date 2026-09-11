import { expect, test } from 'bun:test';
import { InventoryHistory, type InventoryEstimate } from '../src/domain/InventoryHistory.ts';

const day = 86_400_000;
const at = (dayOfMonth: number): number => (dayOfMonth - 1) * day;

type Action =
  | Readonly<{ day: number; count: number }>
  | Readonly<{ day: number; bought: number }>;

type Simulation = Readonly<{
  estimate: InventoryEstimate;
  retainedEvents: number;
  retainedCounts: number;
  retainedPurchases: number;
}>;

const simulate = (
  initialAmount: number,
  expectedDays: number,
  actions: readonly Action[],
): Simulation => {
  let history = InventoryHistory.start(initialAmount, expectedDays, at(1));

  for (const action of actions) {
    if ('bought' in action) {
      history = InventoryHistory.restock(history, action.bought, at(action.day));
      continue;
    }

    const result = InventoryHistory.observe(history, action.count, at(action.day));
    if (result.kind === 'missingRestock')
      throw new Error(`Day ${action.day} is missing a purchase of ${result.amount}.`);
    history = result.history;
  }

  return {
    estimate: InventoryHistory.estimateAt(history, at(31)),
    retainedEvents: history.events.length,
    retainedCounts: history.events.filter(event => event.kind === 'observed').length,
    retainedPurchases: history.events.filter(event => event.kind === 'restocked').length,
  };
};

const report = (simulation: Simulation) => ({
  amount: Number(simulation.estimate.amount.toFixed(2)),
  usedPerDay: Number(simulation.estimate.dailyUse.toFixed(2)),
  daysLeft: Number(simulation.estimate.daysLeft.toFixed(2)),
  restockEvery: simulation.estimate.restockCycleDays,
  counts: simulation.retainedCounts,
  purchases: simulation.retainedPurchases,
  events: simulation.retainedEvents,
});

test('a month of ordinary pantry activity produces compact, explainable histories', () => {
  const eggs = simulate(8, 4, [
    { day: 3, count: 4 },
    { day: 5, count: 0 }, { day: 5, bought: 12 },
    { day: 10, count: 2 }, { day: 11, bought: 12 },
    { day: 16, count: 2 }, { day: 17, bought: 12 },
    { day: 22, count: 2 }, { day: 23, bought: 12 },
    { day: 28, count: 2 }, { day: 29, bought: 12 },
    { day: 31, count: 8 },
  ]);

  const bananas = simulate(6, 4, [
    { day: 4, count: 1 }, { day: 5, bought: 5 },
    { day: 8, count: 1 }, { day: 9, bought: 7 },
    { day: 13, count: 2 }, { day: 14, bought: 4 },
    { day: 17, count: 1 }, { day: 18, bought: 6 },
    { day: 22, count: 2 }, { day: 23, bought: 5 },
    { day: 27, count: 1 }, { day: 28, bought: 7 },
    { day: 31, count: 3 },
  ]);

  const vanilla = simulate(1, 180, [
    { day: 31, count: 0.9 },
  ]);

  if (Bun.env.SHOW_SIMULATION)
    console.table({ eggs: report(eggs), bananas: report(bananas), vanilla: report(vanilla) });

  expect({
    eggs: [eggs.retainedCounts, eggs.retainedPurchases],
    bananas: [bananas.retainedCounts, bananas.retainedPurchases],
    vanilla: [vanilla.retainedCounts, vanilla.retainedPurchases],
  }).toEqual({
    eggs: [8, 5],
    bananas: [8, 6],
    vanilla: [2, 0],
  });

  expect(eggs.estimate.restockCycleDays).toBe(6);
  expect(eggs.estimate.dailyUse).toBeGreaterThan(1.7);
  expect(eggs.estimate.dailyUse).toBeLessThan(2.1);

  expect(bananas.estimate.restockCycleDays).toBe(5);
  expect(bananas.estimate.dailyUse).toBeGreaterThan(1);
  expect(bananas.estimate.dailyUse).toBeLessThan(1.5);

  expect(vanilla.estimate.restockCycleDays).toBe(180);
  expect(vanilla.estimate.dailyUse).toBeLessThan(0.01);
  expect(vanilla.estimate.daysLeft).toBeGreaterThan(100);
});
