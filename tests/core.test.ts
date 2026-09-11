import { expect, test } from 'bun:test';
import { SortedPriorityQueue, type PriorityQueue } from '../src/data/PriorityQueue.ts';
import { Inventory, type Grocery } from '../src/domain/Grocery.ts';
import { InventoryHistory } from '../src/domain/InventoryHistory.ts';
import { Stores } from '../src/domain/Store.ts';
import { LocalInventory } from '../src/infrastructure/LocalInventory.ts';

const day = 86_400_000;
const wholeFoods = { id: 'whole-foods', name: 'Whole Foods' };
const traderJoes = { id: 'trader-joes', name: 'Trader Joe’s' };
const milk: Grocery = {
  id: 'milk',
  name: 'Milk',
  storeIds: [wholeFoods.id],
  usualRestock: 1,
  history: InventoryHistory.start(1, 7, day),
};

test('inventory history starts from a human estimate', () => {
  const history = InventoryHistory.start(8, 4, day);

  expect(InventoryHistory.estimateAt(history, day).dailyUse).toBe(2);
  expect(InventoryHistory.estimateAt(history, 3 * day).amount).toBe(4);
  expect(InventoryHistory.estimateAt(history, 5 * day).daysLeft).toBe(0);
});

test('counts and variable restocks telescope into consumption evidence', () => {
  let history = InventoryHistory.start(12, 6, 0);
  history = InventoryHistory.restock(history, 7, day);
  history = InventoryHistory.restock(history, 5, 2 * day);
  const observation = InventoryHistory.observe(history, 18, 3 * day);
  expect(observation.kind).toBe('recorded');
  if (observation.kind !== 'recorded') return;

  const estimate = InventoryHistory.estimateAt(observation.history, 3 * day);
  expect(estimate.dailyUse).toBeCloseTo(2);
  expect(estimate.amount).toBe(18);
  expect(estimate.daysLeft).toBeCloseTo(9);
  expect(estimate.observations).toBe(2);
});

test('restock cadence determines the item learning timescale', () => {
  let history = InventoryHistory.start(12, 30, 0);
  for (const when of [6, 14, 20])
    history = InventoryHistory.restock(history, 12, when * day);

  expect(InventoryHistory.estimateAt(history, 20 * day).restockCycleDays).toBe(7);
});

test('several purchases in one shopping episode do not collapse the learning timescale', () => {
  let history = InventoryHistory.start(8, 28, 0);
  history = InventoryHistory.restock(history, 12, day);
  history = InventoryHistory.restock(history, 6, day + 1_000);

  const tomorrow = InventoryHistory.estimateAt(history, 2 * day);
  expect(tomorrow.restockCycleDays).toBe(28);
  expect(tomorrow.dailyUse).toBeCloseTo(8 / 28);
  expect(tomorrow.daysLeft).toBeGreaterThan(80);
});

test('a count cannot silently imply an unrecorded purchase', () => {
  const history = InventoryHistory.start(8, 4, 0);
  const result = InventoryHistory.observe(history, 11, day);

  expect(result).toEqual({ kind: 'missingRestock', amount: 3 });
  expect(history.events).toHaveLength(1);
});

test('the priority queue presents behavior without exposing its representation', () => {
  const initial: PriorityQueue<number> = SortedPriorityQueue.empty((a, b) => a - b);
  const queue = initial.insert(3).insert(1).insert(2);

  expect(initial.toArray()).toEqual([]);
  expect(queue.toArray()).toEqual([1, 2, 3]);
  expect(queue.peek()).toBe(1);
  expect(queue.pop()?.[1].toArray()).toEqual([2, 3]);
});

test('purchases and counts update inventory immutably', () => {
  const beef: Grocery = {
    id: 'beef',
    name: 'Beef',
    storeIds: [traderJoes.id],
    usualRestock: 3,
    history: InventoryHistory.start(2, 2, day),
  };
  const inventory = { groceries: [milk, beef], stores: [wholeFoods, traderJoes] };
  const purchased = Inventory.restock(inventory, beef.id, 4, 2 * day);
  const counted = Inventory.count(purchased, beef.id, 4, 3 * day);

  expect(purchased.groceries[1]?.usualRestock).toBe(4);
  expect(purchased.groceries[1]?.history.events).toHaveLength(2);
  expect(counted.kind).toBe('recorded');
  expect(inventory.groceries[1]?.usualRestock).toBe(3);
  expect(Inventory.shoppingQueue(inventory, day).peek()?.grocery.id).toBe('beef');
});

test('store names remain unique and renaming can merge them', () => {
  const typo = { id: 'typo', name: 'Whole Fooods' };
  const inventory = { groceries: [{ ...milk, storeIds: [typo.id] }], stores: [wholeFoods, typo] };
  const merged = Inventory.change(inventory, {
    kind: 'renameStore',
    id: typo.id,
    name: ' whole foods ',
  });

  expect(Stores.add([wholeFoods], { id: 'duplicate', name: 'whole foods' }))
    .toEqual([wholeFoods]);
  expect(merged.stores).toEqual([wholeFoods]);
  expect(merged.groceries[0]?.storeIds).toEqual([wholeFoods.id]);
});

test('learned inventory has independent storage and round-trips', () => {
  let stored: string | null = null;
  const repository = new LocalInventory({
    getItem: key => key === 'grocery-queue.learned.v1' ? stored : 'old data',
    setItem: (_key, value) => { stored = value; },
  });

  expect(repository.load()).toEqual(Inventory.empty());
  const inventory = { groceries: [milk], stores: [wholeFoods] };
  repository.save(inventory);
  expect(repository.load()).toEqual(inventory);
  expect(JSON.parse(stored ?? '').version).toBe(1);
});

test('local inventory rejects invalid data and unavailable storage', () => {
  for (const stored of [
    'broken',
    JSON.stringify({ version: 1, groceries: [{ ...milk, usualRestock: 0 }], stores: [wholeFoods] }),
    JSON.stringify({ version: 1, groceries: [{ ...milk, history: { ...milk.history, events: [] } }], stores: [wholeFoods] }),
  ])
    expect(() => new LocalInventory({ getItem: () => stored, setItem: () => {} }).load())
      .toThrow('left untouched');

  expect(() => new LocalInventory({
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  }).save(Inventory.empty())).toThrow('Could not save');
});
