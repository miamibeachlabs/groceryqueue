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
import { Stores, type Store, type StoreCatalog } from './Store.ts';

export type Grocery = Readonly<{
  id: string;
  name: string;
  storeIds: readonly string[];
  stock: StockObservation;
}>;

export type GroceryEstimate = Readonly<{
  grocery: Grocery;
  today: StockEstimate;
  tomorrow: StockEstimate;
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

const empty = (): Inventory => ({ groceries: [], stores: Stores.defaults });

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
  shoppingQueue,
} as const;
