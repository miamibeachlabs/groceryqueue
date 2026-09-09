import { Inventory, type Grocery, type Inventory as GroceryInventory } from '../domain/Grocery.ts';
import type { Stock, TimeUnit } from '../domain/Stock.ts';
import { Stores, type Store } from '../domain/Store.ts';

const key = 'grocery-queue.v1';
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
const isTimeUnit = (value: unknown): value is TimeUnit =>
  value === 'day' || value === 'week';

const isStock = (value: unknown): value is Stock =>
  isRecord(value)
  && isNonnegative(value.amount)
  && isNonnegative(value.observedAt)
  && isRecord(value.usage)
  && isNonnegative(value.usage.amount)
  && isPositive(value.usage.every)
  && isTimeUnit(value.usage.unit);

const isStore = (value: unknown): value is Store =>
  isRecord(value) && isText(value.id) && isText(value.name);

const isGrocery = (value: unknown): value is Grocery =>
  isRecord(value)
  && isText(value.id)
  && isText(value.name)
  && Array.isArray(value.storeIds)
  && value.storeIds.every(isText)
  && isStock(value.stock);

const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const inventoryFrom = (
  groceries: unknown,
  stores: unknown,
): GroceryInventory | undefined => {
  if (!Array.isArray(groceries) || !groceries.every(isGrocery)
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

const usageFromDailyRate = (value: unknown) => {
  if (!isNonnegative(value)) return undefined;
  if (value === 0) return { amount: 0, every: 1, unit: 'week' as const };
  if (value >= 1) return { amount: value, every: 1, unit: 'day' as const };

  const intervalInDays = 1 / value;
  return intervalInDays >= 7
    ? { amount: 1, every: intervalInDays / 7, unit: 'week' as const }
    : { amount: 1, every: intervalInDays, unit: 'day' as const };
};

const legacyGroceries = (
  items: unknown,
  rateName?: 'perDay' | 'usedPerDay',
): readonly Record<string, unknown>[] | undefined => {
  if (!Array.isArray(items)) return undefined;

  const groceries: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!isRecord(item) || !isText(item.id) || !isText(item.name)
      || !Array.isArray(item.stores) || !item.stores.every(isText)
      || !isRecord(item.stock)) return undefined;

    const stock = rateName
      ? {
          amount: item.stock.amount,
          usage: usageFromDailyRate(item.stock[rateName]),
          observedAt: item.stock.observedAt,
        }
      : item.stock;
    if (!isStock(stock)) return undefined;
    groceries.push({ id: item.id, name: item.name, stores: item.stores, stock });
  }

  return unique(groceries.map(grocery => grocery.id as string)) ? groceries : undefined;
};

const migrate = (legacy: readonly Record<string, unknown>[]): GroceryInventory => {
  if (legacy.length === 0) return Inventory.empty();

  const names = legacy
    .flatMap(grocery => grocery.stores as readonly string[])
    .filter((name, index, all) =>
      all.findIndex(candidate => Stores.normalize(candidate) === Stores.normalize(name)) === index);
  const stores = names.map((name, index) => ({ id: `migrated-store-${index + 1}`, name }));
  const groceries = legacy.map(grocery => ({
    id: grocery.id as string,
    name: grocery.name as string,
    storeIds: [...new Set((grocery.stores as readonly string[])
      .map(name => Stores.find(stores, name)!.id))],
    stock: grocery.stock as Stock,
  }));

  return { groceries, stores };
};

const inventoryByVersion = (value: Record<string, unknown>): GroceryInventory | undefined => {
  switch (value.version) {
    case 1: {
      const groceries = legacyGroceries(value.items, 'perDay');
      return groceries && migrate(groceries);
    }
    case 2: {
      const groceries = legacyGroceries(value.groceries, 'usedPerDay');
      return groceries && migrate(groceries);
    }
    case 3: {
      const groceries = legacyGroceries(value.groceries);
      return groceries && migrate(groceries);
    }
    case 4: return inventoryFrom(value.groceries, value.stores);
    default: return undefined;
  }
};

const decode = (text: string): GroceryInventory => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error(invalidData);

  const inventory = inventoryByVersion(value);
  if (!inventory) throw new Error(invalidData);
  return inventory;
};

/** The single effectful boundary for persisted grocery inventory. */
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
      this.storage.setItem(key, JSON.stringify({ version: 4, ...inventory }));
    } catch {
      throw new Error('Could not save. Your changes have not been applied.');
    }
  }
}
