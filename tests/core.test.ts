import { expect, test } from 'bun:test';
import { SortedPriorityQueue, type PriorityQueue } from '../src/data/PriorityQueue.ts';
import { Inventory, type Grocery } from '../src/domain/Grocery.ts';
import { Stock, Usage } from '../src/domain/Stock.ts';
import { Stores } from '../src/domain/Store.ts';
import { LocalInventory } from '../src/infrastructure/LocalInventory.ts';

const day = 86_400_000;
const wholeFoods = { id: 'whole-foods', name: 'Whole Foods' };
const traderJoes = { id: 'trader-joes', name: 'Trader Joe’s' };
const milk: Grocery = {
  id: 'milk',
  name: 'Milk',
  storeIds: [wholeFoods.id],
  stock: { amount: 1, usage: { amount: 1, every: 1, unit: 'week' }, observedAt: day },
};

test('stock is derived from an observation without changing it', () => {
  expect(Usage.perDay({ amount: 1, every: 3, unit: 'week' })).toBeCloseTo(1 / 21);
  expect(Stock.estimateAt(milk.stock, 4.5 * day).remaining).toBe(0.5);
  expect(Stock.estimateAt(milk.stock, 20 * day).remaining).toBe(0);
  expect(Stock.estimateAt(milk.stock, 0).remaining).toBe(1);
  const unused = { ...milk.stock, usage: { ...milk.stock.usage, amount: 0 } };
  expect(Stock.estimateAt(unused, 4 * day).daysLeft).toBe(Infinity);
  expect(Stock.estimateAt({ ...unused, amount: 0 }, 4 * day).daysLeft).toBe(0);
  expect(milk.stock.amount).toBe(1);
});

test('the priority queue presents behavior without exposing its representation', () => {
  const initial: PriorityQueue<number> = SortedPriorityQueue.empty((a, b) => a - b);
  const queue = initial.insert(3).insert(1).insert(2);

  expect(initial.toArray()).toEqual([]);
  expect(queue.toArray()).toEqual([1, 2, 3]);
  expect(queue.peek()).toBe(1);
  expect(queue.pop()?.[1].toArray()).toEqual([2, 3]);
  expect(initial.pop()).toBeUndefined();
});

test('equal priorities remain in input order', () => {
  const values = Object.freeze([
    { id: 'a', score: Infinity },
    { id: 'b', score: 0 },
    { id: 'c', score: Infinity },
  ]);
  const queue = SortedPriorityQueue.from((a, b) => a.score - b.score, values);

  expect(queue.toArray().map(value => value.id)).toEqual(['b', 'a', 'c']);
  expect(values.map(value => value.id)).toEqual(['a', 'b', 'c']);
});

test('inventory changes are immutable and shopping order is derived at a given time', () => {
  const beef: Grocery = {
    id: 'beef',
    name: 'Beef',
    storeIds: [traderJoes.id],
    stock: { amount: 2, usage: { amount: 1, every: 1, unit: 'day' }, observedAt: day },
  };
  const inventory = { groceries: [milk, beef], stores: [wholeFoods, traderJoes] };
  const updated = { ...milk, stock: { ...milk.stock, amount: 2 } };

  expect(Inventory.shoppingQueue(inventory, day).toArray().map(x => x.grocery.id))
    .toEqual(['beef', 'milk']);
  expect(Inventory.shoppingQueue(inventory, 3 * day, wholeFoods.id).peek()?.grocery.id)
    .toBe('milk');
  expect(Inventory.change(inventory, { kind: 'save', grocery: updated }).groceries)
    .toEqual([updated, beef]);
  expect(Inventory.change(inventory, { kind: 'remove', id: milk.id }).groceries)
    .toEqual([beef]);
  expect(inventory.groceries[0]?.stock.amount).toBe(1);
});

test('store names are unique and a rename can merge duplicate stores', () => {
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

test('fresh storage has defaults and current storage round-trips', () => {
  let stored: string | null = null;
  const repository = new LocalInventory({
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
  });

  expect(repository.load()).toEqual(Inventory.empty());
  const inventory = { groceries: [milk], stores: [wholeFoods] };
  repository.save(inventory);
  expect(repository.load()).toEqual(inventory);
  expect(JSON.parse(stored ?? '').version).toBe(4);
});

test('existing data migrates stores without injecting defaults or losing text', () => {
  const legacyMilk = {
    ...milk,
    stores: ['Whole Fooods', 'Publix', 'whole fooods'],
    storeIds: undefined,
  };
  const stored = JSON.stringify({ version: 3, groceries: [legacyMilk] });
  const inventory = new LocalInventory({ getItem: () => stored, setItem: () => {} }).load();

  expect(inventory.stores.map(store => store.name)).toEqual(['Whole Fooods', 'Publix']);
  expect(inventory.groceries[0]?.storeIds).toEqual(['migrated-store-1', 'migrated-store-2']);
  expect(inventory.groceries[0]?.name).toBe('Milk');
});

test('the oldest saved formats still migrate', () => {
  const legacy = { ...milk, stores: ['Whole Foods'], storeIds: undefined };
  for (const saved of [
    { version: 1, items: [{ ...legacy, stock: { amount: 1, perDay: 1 / 7, observedAt: day } }] },
    { version: 2, groceries: [{ ...legacy, stock: { amount: 1, usedPerDay: 1 / 7, observedAt: day } }] },
  ]) {
    const inventory = new LocalInventory({
      getItem: () => JSON.stringify(saved),
      setItem: () => {},
    }).load();
    expect(inventory.groceries[0]?.stock).toEqual(milk.stock);
    expect(inventory.stores[0]?.name).toBe('Whole Foods');
  }
});

test('local inventory rejects invalid data and reports unavailable storage', () => {
  for (const stored of [
    'broken',
    JSON.stringify({ version: 4, groceries: [milk, milk], stores: [wholeFoods] }),
    JSON.stringify({ version: 4, groceries: [{ ...milk, storeIds: ['missing'] }], stores: [] }),
  ]) {
    expect(() => new LocalInventory({ getItem: () => stored, setItem: () => {} }).load())
      .toThrow('Saved groceries could not be read');
  }

  expect(() => new LocalInventory({
    getItem: () => { throw new Error('denied'); },
    setItem: () => {},
  }).load()).toThrow('Browser storage is unavailable');

  expect(() => new LocalInventory({
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  }).save(Inventory.empty())).toThrow('Could not save');
});
