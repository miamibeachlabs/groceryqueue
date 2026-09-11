import { expect, test } from 'bun:test';
import { monthSimulation, thousandCycleSimulation } from '../dev/MonthSimulation.ts';

test('a month of pantry activity is folded into constant-space state', () => {
  const [eggs, bananas, vanilla] = monthSimulation();
  if (!eggs || !bananas || !vanilla) throw new Error('Incomplete simulation');

  expect(eggs.actionsEntered).toBe(13);
  expect(eggs.tracker.cadence.intervals).toEqual([6, 6, 6, 6]);
  expect(eggs.estimate.dailyUse).toBe(2);

  expect(bananas.actionsEntered).toBe(14);
  expect(bananas.tracker.cadence.intervals).toEqual([4, 5, 4, 5, 5]);
  expect(bananas.estimate.dailyUse).toBeGreaterThan(1);
  expect(bananas.estimate.dailyUse).toBeLessThan(1.5);

  expect(vanilla.actionsEntered).toBe(2);
  expect(vanilla.tracker.cadence.intervals).toEqual([]);
  expect(vanilla.estimate.daysLeft).toBeGreaterThan(100);

  for (const simulation of [eggs, bananas, vanilla])
    expect(JSON.stringify(simulation.tracker).length).toBeLessThan(350);
});

test('even a thousand purchase cycles retain only five intervals', () => {
  const tracker = thousandCycleSimulation();

  expect(tracker.observations).toBe(1_001);
  expect(tracker.cadence.intervals).toEqual([1, 1, 1, 1, 1]);
  expect(JSON.stringify(tracker).length).toBeLessThan(350);
});
