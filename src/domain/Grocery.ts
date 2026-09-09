import {
  SortedPriorityQueue,
  type Comparator,
  type PriorityQueue,
} from '../data/PriorityQueue.ts';
import {
  Stock,
  type Stock as StockObservation,
  type StockEstimate,
} from './Stock.ts';

export type Grocery = Readonly<{
  id: string;
  name: string;
  stores: readonly string[];
  stock: StockObservation;
}>;

export type GroceryEstimate = Readonly<{
  grocery: Grocery;
  today: StockEstimate;
  tomorrow: StockEstimate;
}>;

export type Inventory = readonly Grocery[];

export type InventoryChange =
  | Readonly<{ kind: 'save'; grocery: Grocery }>
  | Readonly<{ kind: 'remove'; id: string }>;

const estimateAt = (now: number, grocery: Grocery): GroceryEstimate => ({
  grocery,
  today: Stock.estimateAt(grocery.stock, now),
  tomorrow: Stock.estimateAfter(grocery.stock, now, 1),
});

const byUrgency: Comparator<GroceryEstimate> = (left, right) =>
  left.today.daysLeft < right.today.daysLeft ? -1
  : left.today.daysLeft > right.today.daysLeft ? 1
  : 0;

const change = (
  inventory: Inventory,
  change: InventoryChange,
): Inventory => {
  if (change.kind === 'remove')
    return inventory.filter(grocery => grocery.id !== change.id);

  const exists = inventory.some(grocery => grocery.id === change.grocery.id);
  return exists
    ? inventory.map(grocery =>
        grocery.id === change.grocery.id ? change.grocery : grocery)
    : [...inventory, change.grocery];
};

const shoppingQueue = (
  inventory: Inventory,
  now: number,
  store?: string,
): PriorityQueue<GroceryEstimate> => {
  const visible = store
    ? inventory.filter(grocery => grocery.stores.includes(store))
    : inventory;

  return SortedPriorityQueue.from(
    byUrgency,
    visible.map(grocery => estimateAt(now, grocery)),
  );
};

const stores = (inventory: Inventory): readonly string[] =>
  [...new Set(inventory.flatMap(grocery => grocery.stores))].sort();

const parseStoreNames = (text: string): readonly string[] => {
  const names = text
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

  return names.filter((name, index) =>
    names.findIndex(candidate =>
      candidate.toLowerCase() === name.toLowerCase()) === index);
};

/** Operations over the grocery inventory. */
export const Inventory = {
  change,
  shoppingQueue,
  stores,
} as const;

/** Parsing at the boundary between form text and domain values. */
export const StoreNames = {
  parse: parseStoreNames,
} as const;
