import { expect, test } from 'bun:test';
import { SortedPriorityQueue, type PriorityQueue } from '../src/data/PriorityQueue.ts';
import { Inventory, StoreNames, type Grocery } from '../src/domain/Grocery.ts';
import { Stock, Usage } from '../src/domain/Stock.ts';
import { LocalInventory } from '../src/infrastructure/LocalInventory.ts';

const day = 86_400_000;

const milk: Grocery = {
  id: 'milk',
  name: 'Milk',
  stores: ['Whole Foods'],
  stock: { amount: 1, usage: { amount: 1, every: 1, unit: 'week' }, observedAt: day },
};

test('stock is derived from an observation without changing it', () => {
  expect(Usage.perDay({ amount: 1, every: 3, unit: 'week' })).toBeCloseTo(1 / 21);
  expect(Stock.remainingAt(milk.stock, 4.5 * day)).toBe(0.5);
  expect(Stock.remainingAt(milk.stock, 20 * day)).toBe(0);
  expect(Stock.remainingAt(milk.stock, 0)).toBe(1);
  const unused = { ...milk.stock, usage: { ...milk.stock.usage, amount: 0 } };
  expect(Stock.daysLeftAt(unused, 4 * day)).toBe(Infinity);
  expect(Stock.daysLeftAt({ ...unused, amount: 0 }, 4 * day)).toBe(0);
  expect(milk.stock.amount).toBe(1);
});

test('the priority queue presents behavior without exposing its representation', () => {
  const initial: PriorityQueue<number> = SortedPriorityQueue.empty((a, b) => a - b);
  const queue = initial.insert(3).insert(1).insert(2);

  expect(initial.toArray()).toEqual([]);
  expect(queue.toArray()).toEqual([1, 2, 3]);
  expect(queue.peek()).toBe(1);

  const popped = queue.pop();
  expect(popped?.[0]).toBe(1);
  expect(popped?.[1].toArray()).toEqual([2, 3]);
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
    stores: ['Trader Joe’s'],
    stock: { amount: 2, usage: { amount: 1, every: 1, unit: 'day' }, observedAt: day },
  };
  const groceries = Object.freeze([milk, beef]);
  const updated = { ...milk, stock: { ...milk.stock, amount: 2 } };

  expect(Inventory.shoppingQueue(groceries, day).toArray().map(x => x.grocery.id))
    .toEqual(['beef', 'milk']);
  expect(Inventory.shoppingQueue(groceries, 3 * day, 'Whole Foods').peek()?.grocery.id)
    .toBe('milk');
  expect(Inventory.shoppingQueue(groceries, day).peek()?.daysLeftTomorrow).toBe(1);
  expect(Inventory.change(groceries, { kind: 'save', grocery: updated })).toEqual([updated, beef]);
  expect(Inventory.change(groceries, { kind: 'remove', id: milk.id })).toEqual([beef]);
  expect(groceries[0]?.stock.amount).toBe(1);
});

test('store input trims and deduplicates names while preserving spelling', () => {
  expect(StoreNames.parse(' Whole Foods, ,whole foods, Publix '))
    .toEqual(['Whole Foods', 'Publix']);
});

test('local inventory round-trips the current format and migrates the old one', () => {
  let stored: string | null = null;
  const repository = new LocalInventory({
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
  });

  expect(repository.load()).toEqual([]);
  repository.save([milk]);
  expect(repository.load()).toEqual([milk]);
  expect(JSON.parse(stored ?? '').version).toBe(3);

  stored = JSON.stringify({
    version: 1,
    items: [{ ...milk, stock: { amount: 1, perDay: 1 / 7, observedAt: day } }],
  });
  expect(repository.load()).toEqual([milk]);

  stored = JSON.stringify({
    version: 2,
    groceries: [{ ...milk, stock: { amount: 1, usedPerDay: 1 / 7, observedAt: day } }],
  });
  expect(repository.load()).toEqual([milk]);
});

test('local inventory rejects invalid data and reports unavailable storage', () => {
  for (const stored of [
    'broken',
    JSON.stringify({ version: 3, groceries: [milk, milk] }),
    JSON.stringify({ version: 3, groceries: [{ ...milk, name: '  ' }] }),
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
  }).save([milk])).toThrow('Could not save');
});
