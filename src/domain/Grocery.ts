import {
  SortedPriorityQueue,
  type Comparator,
  type PriorityQueue,
} from '../data/PriorityQueue.ts';
import {
  InventoryTracker,
  type InventoryEstimate,
  type InventoryTracker as Tracker,
} from './InventoryTracker.ts';
import { Stores, type Store, type StoreCatalog } from './Store.ts';

export type Grocery = Readonly<{
  id: string;
  name: string;
  storeIds: readonly string[];
  usualRestock: number;
  tracker: Tracker;
}>;

export type GroceryEstimate = Readonly<{
  grocery: Grocery;
  today: InventoryEstimate;
  tomorrow: InventoryEstimate;
}>;

export type Inventory = Readonly<{
  groceries: readonly Grocery[];
  stores: StoreCatalog;
}>;

export type InventoryChange =
  | Readonly<{ kind: 'save'; grocery: Grocery }>
  | Readonly<{ kind: 'remove'; id: string }>
  | Readonly<{ kind: 'addStore'; store: Store }>
  | Readonly<{ kind: 'renameStore'; id: string; name: string }>;

export type StockCountResult =
  | Readonly<{ kind: 'recorded'; inventory: Inventory }>
  | Readonly<{ kind: 'missingRestock'; amount: number }>;

const day = 86_400_000;

const empty = (): Inventory => ({ groceries: [], stores: Stores.defaults });

const estimateAt = (now: number, grocery: Grocery): GroceryEstimate => ({
  grocery,
  today: InventoryTracker.estimateAt(grocery.tracker, now),
  tomorrow: InventoryTracker.estimateAt(grocery.tracker, now + day),
});

const byUrgency: Comparator<GroceryEstimate> = (left, right) =>
  left.today.daysLeft < right.today.daysLeft ? -1
  : left.today.daysLeft > right.today.daysLeft ? 1
  : 0;

const update = (
  inventory: Inventory,
  id: string,
  transform: (grocery: Grocery) => Grocery,
): Inventory => ({
  ...inventory,
  groceries: inventory.groceries.map(grocery =>
    grocery.id === id ? transform(grocery) : grocery),
});

const restock = (
  inventory: Inventory,
  id: string,
  amount: number,
  at: number,
): Inventory => update(inventory, id, grocery => ({
  ...grocery,
  usualRestock: amount,
  tracker: InventoryTracker.restock(grocery.tracker, amount, at),
}));

const count = (
  inventory: Inventory,
  id: string,
  amount: number,
  at: number,
): StockCountResult => {
  const grocery = inventory.groceries.find(candidate => candidate.id === id);
  if (!grocery) return { kind: 'recorded', inventory };
  const result = InventoryTracker.observe(grocery.tracker, amount, at);

  return result.kind === 'missingRestock'
    ? result
    : {
        kind: 'recorded',
        inventory: update(inventory, id, item => ({
          ...item,
          tracker: result.tracker,
        })),
      };
};

const change = (inventory: Inventory, change: InventoryChange): Inventory => {
  if (change.kind === 'remove')
    return {
      ...inventory,
      groceries: inventory.groceries.filter(grocery => grocery.id !== change.id),
    };

  if (change.kind === 'addStore')
    return { ...inventory, stores: Stores.add(inventory.stores, change.store) };

  if (change.kind === 'renameStore') {
    const name = change.name.trim();
    if (!name) return inventory;
    const existing = Stores.find(inventory.stores, name);

    if (existing && existing.id !== change.id)
      return {
        stores: inventory.stores.filter(store => store.id !== change.id),
        groceries: inventory.groceries.map(grocery => ({
          ...grocery,
          storeIds: [...new Set(grocery.storeIds.map(id =>
            id === change.id ? existing.id : id))],
        })),
      };

    return {
      ...inventory,
      stores: inventory.stores.map(store =>
        store.id === change.id ? { ...store, name } : store),
    };
  }

  const exists = inventory.groceries.some(grocery => grocery.id === change.grocery.id);
  const groceries = exists
    ? inventory.groceries.map(grocery =>
        grocery.id === change.grocery.id ? change.grocery : grocery)
    : [...inventory.groceries, change.grocery];
  return { ...inventory, groceries };
};

const shoppingQueue = (
  inventory: Inventory,
  now: number,
  storeId?: string,
): PriorityQueue<GroceryEstimate> => {
  const visible = storeId
    ? inventory.groceries.filter(grocery => grocery.storeIds.includes(storeId))
    : inventory.groceries;

  return SortedPriorityQueue.from(
    byUrgency,
    visible.map(grocery => estimateAt(now, grocery)),
  );
};

/** Operations over the grocery inventory. */
export const Inventory = {
  empty,
  change,
  restock,
  count,
  shoppingQueue,
} as const;
