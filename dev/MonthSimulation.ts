import {
  InventoryTracker,
  type InventoryEstimate,
  type InventoryTracker as Tracker,
} from '../src/domain/InventoryTracker.ts';

const day = 86_400_000;
const at = (dayOfMonth: number): number => (dayOfMonth - 1) * day;

export type Action =
  | Readonly<{ day: number; count: number }>
  | Readonly<{ day: number; bought: number }>;

export type Simulation = Readonly<{
  name: string;
  estimate: InventoryEstimate;
  tracker: Tracker;
  actionsEntered: number;
}>;

type Scenario = Readonly<{
  name: string;
  initialAmount: number;
  expectedDays: number;
  actions: readonly Action[];
}>;

const scenarios: readonly Scenario[] = [
  {
    name: 'Eggs', initialAmount: 8, expectedDays: 4,
    actions: [
      { day: 3, count: 4 },
      { day: 5, count: 0 }, { day: 5, bought: 12 },
      { day: 10, count: 2 }, { day: 11, bought: 12 },
      { day: 16, count: 2 }, { day: 17, bought: 12 },
      { day: 22, count: 2 }, { day: 23, bought: 12 },
      { day: 28, count: 2 }, { day: 29, bought: 12 },
      { day: 31, count: 8 },
    ],
  },
  {
    name: 'Bananas', initialAmount: 6, expectedDays: 4,
    actions: [
      { day: 4, count: 1 }, { day: 5, bought: 5 },
      { day: 8, count: 1 }, { day: 9, bought: 7 },
      { day: 13, count: 2 }, { day: 14, bought: 4 },
      { day: 17, count: 1 }, { day: 18, bought: 6 },
      { day: 22, count: 2 }, { day: 23, bought: 5 },
      { day: 27, count: 1 }, { day: 28, bought: 7 },
      { day: 31, count: 3 },
    ],
  },
  {
    name: 'Vanilla', initialAmount: 1, expectedDays: 180,
    actions: [{ day: 31, count: 0.9 }],
  },
];

const run = ({ name, initialAmount, expectedDays, actions }: Scenario): Simulation => {
  let tracker = InventoryTracker.start(initialAmount, expectedDays, at(1));

  for (const action of actions) {
    if ('bought' in action) {
      tracker = InventoryTracker.restock(tracker, action.bought, at(action.day));
      continue;
    }

    const result = InventoryTracker.observe(tracker, action.count, at(action.day));
    if (result.kind === 'missingRestock')
      throw new Error(`${name}, day ${action.day}: missing purchase of ${result.amount}.`);
    tracker = result.tracker;
  }

  return {
    name,
    tracker,
    actionsEntered: actions.length + 1,
    estimate: InventoryTracker.estimateAt(tracker, at(31)),
  };
};

export const monthSimulation = (): readonly Simulation[] => scenarios.map(run);

export const thousandCycleSimulation = (): Tracker => {
  let tracker = InventoryTracker.start(1, 1, 0);

  for (let cycle = 1; cycle <= 1_000; cycle += 1) {
    tracker = InventoryTracker.restock(tracker, 1, cycle * day);
    const count = InventoryTracker.observe(tracker, 1, cycle * day);
    if (count.kind !== 'recorded') throw new Error('Invalid long-run simulation');
    tracker = count.tracker;
  }

  return tracker;
};
