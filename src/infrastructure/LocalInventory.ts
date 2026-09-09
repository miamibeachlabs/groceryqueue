import type { Grocery, Inventory } from '../domain/Grocery.ts';
import type { Stock, TimeUnit } from '../domain/Stock.ts';

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

const isGrocery = (value: unknown): value is Grocery =>
  isRecord(value)
  && isText(value.id)
  && isText(value.name)
  && Array.isArray(value.stores)
  && value.stores.every(isText)
  && isStock(value.stock);

const hasUniqueIds = (groceries: readonly Grocery[]): boolean =>
  new Set(groceries.map(grocery => grocery.id)).size === groceries.length;

const decodeCurrent = (value: Record<string, unknown>): Inventory | undefined => {
  if (value.version !== 3
    || !Array.isArray(value.groceries)
    || !value.groceries.every(isGrocery)
    || !hasUniqueIds(value.groceries)) return undefined;

  return value.groceries;
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

const decodeLegacy = (value: Record<string, unknown>): Inventory | undefined => {
  const items = value.version === 1 ? value.items : value.groceries;
  const rateName = value.version === 1 ? 'perDay' : 'usedPerDay';
  if ((value.version !== 1 && value.version !== 2) || !Array.isArray(items)) return undefined;

  const groceries: Grocery[] = [];
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.stock)) return undefined;

    const usage = usageFromDailyRate(item.stock[rateName]);
    if (!usage) return undefined;

    const grocery = {
      id: item.id,
      name: item.name,
      stores: item.stores,
      stock: {
        amount: item.stock.amount,
        usage,
        observedAt: item.stock.observedAt,
      },
    };
    if (!isGrocery(grocery)) return undefined;
    groceries.push(grocery);
  }

  if (!hasUniqueIds(groceries)) return undefined;
  return groceries;
};

const decode = (text: string): Inventory => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error(invalidData);

  const inventory = decodeCurrent(value) ?? decodeLegacy(value);
  if (!inventory) throw new Error(invalidData);
  return inventory;
};

/** The single effectful boundary for persisted grocery inventory. */
export class LocalInventory {
  constructor(private readonly storage: StoragePort) {}

  load(): Inventory {
    let text: string | null;
    try {
      text = this.storage.getItem(key);
    } catch {
      throw new Error('Browser storage is unavailable. Allow local storage, then reload.');
    }

    if (text === null) return [];
    try {
      return decode(text);
    } catch {
      throw new Error(invalidData);
    }
  }

  save(inventory: Inventory): void {
    try {
      this.storage.setItem(key, JSON.stringify({ version: 3, groceries: inventory }));
    } catch {
      throw new Error('Could not save. Your changes have not been applied.');
    }
  }
}
