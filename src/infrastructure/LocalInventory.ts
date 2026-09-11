import { Inventory, type Grocery, type Inventory as GroceryInventory } from '../domain/Grocery.ts';
import type { InventoryEvent, InventoryHistory } from '../domain/InventoryHistory.ts';
import { Stores, type Store } from '../domain/Store.ts';

const key = 'grocery-queue.learned.v1';
const invalidData = 'Saved groceries could not be read. Your stored data has been left untouched.';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isNonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isEvent = (value: unknown): value is InventoryEvent =>
  isRecord(value)
  && (value.kind === 'observed' || value.kind === 'restocked')
  && isNonnegative(value.at)
  && (value.kind === 'observed' ? isNonnegative(value.amount) : isPositive(value.amount));

const isHistory = (value: unknown): value is InventoryHistory => {
  if (!isRecord(value) || !isRecord(value.prior)
    || !isNonnegative(value.prior.amount) || !isPositive(value.prior.overDays)
    || !Array.isArray(value.events) || !value.events.every(isEvent)
    || value.events[0]?.kind !== 'observed') return false;

  return value.events.every((event, index, events) =>
    index === 0 || event.at >= events[index - 1].at);
};

const isStore = (value: unknown): value is Store =>
  isRecord(value) && isText(value.id) && isText(value.name);

const isGrocery = (value: unknown): value is Grocery =>
  isRecord(value)
  && isText(value.id)
  && isText(value.name)
  && Array.isArray(value.storeIds)
  && value.storeIds.every(isText)
  && isPositive(value.usualRestock)
  && isHistory(value.history);

const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const inventoryFrom = (value: Record<string, unknown>): GroceryInventory | undefined => {
  const { groceries, stores } = value;
  if (value.version !== 1
    || !Array.isArray(groceries) || !groceries.every(isGrocery)
    || !Array.isArray(stores) || !stores.every(isStore)) return undefined;

  const storeIds = stores.map(store => store.id);
  const validReferences = groceries.every(grocery =>
    unique(grocery.storeIds) && grocery.storeIds.every(id => storeIds.includes(id)));

  return unique(groceries.map(grocery => grocery.id))
    && unique(storeIds)
    && unique(stores.map(store => Stores.normalize(store.name)))
    && validReferences
    ? { groceries, stores }
    : undefined;
};

const decode = (text: string): GroceryInventory => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error(invalidData);
  const inventory = inventoryFrom(value);
  if (!inventory) throw new Error(invalidData);
  return inventory;
};

/** The single effectful boundary for learned grocery inventory. */
export class LocalInventory {
  constructor(private readonly storage: StoragePort) {}

  load(): GroceryInventory {
    let text: string | null;
    try {
      text = this.storage.getItem(key);
    } catch {
      throw new Error('Browser storage is unavailable. Allow local storage, then reload.');
    }

    if (text === null) return Inventory.empty();
    try {
      return decode(text);
    } catch {
      throw new Error(invalidData);
    }
  }

  save(inventory: GroceryInventory): void {
    try {
      this.storage.setItem(key, JSON.stringify({ version: 1, ...inventory }));
    } catch {
      throw new Error('Could not save. Your changes have not been applied.');
    }
  }
}
