import { Inventory, type Grocery, type Inventory as GroceryInventory } from '../domain/Grocery.ts';
import type { InventoryEvent, InventoryHistory } from '../domain/InventoryHistory.ts';
import { InventoryTracker, type InventoryTracker as Tracker } from '../domain/InventoryTracker.ts';
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

const isTime = isNonnegative;

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

const isTracker = (value: unknown): value is Tracker => {
  if (!isRecord(value) || !isRecord(value.anchor)
    || !isNonnegative(value.anchor.amount) || !isTime(value.anchor.at)
    || !isNonnegative(value.anchor.boughtSince)
    || !isRecord(value.usage) || !isNonnegative(value.usage.amount)
    || !isPositive(value.usage.days) || !isTime(value.usage.at)
    || !isRecord(value.cadence) || !isPositive(value.cadence.priorDays)
    || !Array.isArray(value.cadence.intervals)
    || value.cadence.intervals.length > 5
    || !value.cadence.intervals.every(isPositive)
    || typeof value.observations !== 'number'
    || !Number.isInteger(value.observations) || value.observations < 1
    || !isTime(value.updatedAt)) return false;

  return (value.cadence.lastAt === undefined || isTime(value.cadence.lastAt))
    && value.anchor.at <= value.updatedAt
    && value.usage.at <= value.updatedAt;
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
  && isTracker(value.tracker);

type LegacyGrocery = Omit<Grocery, 'tracker'> & Readonly<{ history: InventoryHistory }>;

const isLegacyGrocery = (value: unknown): value is LegacyGrocery =>
  isRecord(value)
  && isText(value.id)
  && isText(value.name)
  && Array.isArray(value.storeIds)
  && value.storeIds.every(isText)
  && isPositive(value.usualRestock)
  && isHistory(value.history);

const trackerFrom = (history: InventoryHistory): Tracker => {
  const [first, ...events] = history.events;
  if (!first || first.kind !== 'observed') throw new Error(invalidData);
  let tracker = InventoryTracker.start(first.amount, history.prior.overDays, first.at);

  for (const event of events) {
    if (event.kind === 'restocked') {
      tracker = InventoryTracker.restock(tracker, event.amount, event.at);
      continue;
    }
    const result = InventoryTracker.observe(tracker, event.amount, event.at);
    if (result.kind !== 'recorded') throw new Error(invalidData);
    tracker = result.tracker;
  }
  return tracker;
};

const currentGrocery = ({ history, ...grocery }: LegacyGrocery): Grocery => ({
  ...grocery,
  tracker: trackerFrom(history),
});

const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const inventoryFrom = (value: Record<string, unknown>): GroceryInventory | undefined => {
  const { stores } = value;
  if (!Array.isArray(stores) || !stores.every(isStore)) return undefined;
  const groceries = value.groceries;
  if (!Array.isArray(groceries)) return undefined;
  const current = value.version === 2 && groceries.every(isGrocery)
    ? groceries
    : value.version === 1 && groceries.every(isLegacyGrocery)
      ? groceries.map(currentGrocery)
      : undefined;
  if (!current
    || !Array.isArray(stores) || !stores.every(isStore)) return undefined;

  const storeIds = stores.map(store => store.id);
  const validReferences = current.every(grocery =>
    unique(grocery.storeIds) && grocery.storeIds.every(id => storeIds.includes(id)));

  return unique(current.map(grocery => grocery.id))
    && unique(storeIds)
    && unique(stores.map(store => Stores.normalize(store.name)))
    && validReferences
    ? { groceries: current, stores }
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
      this.storage.setItem(key, JSON.stringify({ version: 2, ...inventory }));
    } catch {
      throw new Error('Could not save. Your changes have not been applied.');
    }
  }
}
