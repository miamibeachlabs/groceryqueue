import { useState } from 'preact/hooks';
import {
  Inventory,
  StoreNames,
  type Grocery,
  type Inventory as GroceryInventory,
} from '../domain/Grocery.ts';
import { Stock, type TimeUnit } from '../domain/Stock.ts';

type Props = Readonly<{
  grocery?: Grocery;
  inventory: GroceryInventory;
  now: number;
  onSave: (grocery: Grocery) => string | undefined;
  onRemove: (id: string) => string | undefined;
  onCancel: () => void;
}>;

const formValue = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

const timeUnit = (value: string): TimeUnit =>
  value === 'week' ? 'week' : 'day';

const canonicalStores = (
  names: readonly string[],
  inventory: GroceryInventory,
): readonly string[] => {
  const known = Inventory.stores(inventory);
  return names.map(name =>
    known.find(store => store.toLowerCase() === name.toLowerCase()) ?? name);
};

export const GroceryForm = ({
  grocery,
  inventory,
  now,
  onSave,
  onRemove,
  onCancel,
}: Props) => {
  const initialAmount = grocery
    ? String(Number(Stock.remainingAt(grocery.stock, now).toFixed(4)))
    : '';
  const [error, setError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const name = formValue(form, 'name').trim();
    const amountText = formValue(form, 'amount');
    const amount = Number(amountText);
    const usedAmount = Number(formValue(form, 'usedAmount'));
    const every = Number(formValue(form, 'every'));
    const unit = timeUnit(formValue(form, 'unit'));

    if (!name || !Number.isFinite(amount) || !Number.isFinite(usedAmount)
      || !Number.isFinite(every) || amount < 0 || usedAmount < 0 || every <= 0) {
      setError('Enter an item name, nonnegative amounts, and a positive interval.');
      return;
    }

    const stores = canonicalStores(
      StoreNames.parse(formValue(form, 'stores')),
      inventory,
    );
    const stockChanged = !grocery
      || amountText !== initialAmount
      || usedAmount !== grocery.stock.usage.amount
      || every !== grocery.stock.usage.every
      || unit !== grocery.stock.usage.unit;

    const saveError = onSave({
      id: grocery?.id ?? crypto.randomUUID(),
      name,
      stores,
      stock: stockChanged
        ? { amount, usage: { amount: usedAmount, every, unit }, observedAt: Date.now() }
        : grocery.stock,
    });

    if (saveError) setError(saveError);
  };

  const remove = () => {
    if (!grocery) return;
    const removeError = onRemove(grocery.id);
    if (removeError) setError(removeError);
  };

  return (
    <section class="editor" aria-labelledby="editor-title">
      <h2 id="editor-title">{grocery ? `Update ${grocery.name}` : 'Add an item'}</h2>
      <form onSubmit={submit}>
        <label class="field">
          <span>Item</span>
          <input name="name" defaultValue={grocery?.name} placeholder="Milk" required maxLength={100} />
        </label>
        <label class="field stock-field">
          <span>Stock now</span>
          <input name="amount" type="number" inputMode="decimal" min="0" step="any" defaultValue={initialAmount} placeholder="1" required />
        </label>
        <fieldset class="usage-fields">
          <legend>Typical use</legend>
          <span>Use</span>
          <input aria-label="Amount used" name="usedAmount" type="number" inputMode="decimal" min="0" step="any" defaultValue={grocery?.stock.usage.amount ?? 1} required />
          <span>every</span>
          <input aria-label="Length of interval" name="every" type="number" inputMode="decimal" min="0.01" step="any" defaultValue={grocery?.stock.usage.every ?? 1} required />
          <select aria-label="Interval unit" name="unit" defaultValue={grocery?.stock.usage.unit ?? 'week'}>
            <option value="day">days</option>
            <option value="week">weeks</option>
          </select>
        </fieldset>
        <p class="field-help">
          Use the same unit for stock and use: for example, 4 bars in stock and
          use 1 every 3 weeks. After shopping, enter your new total stock.
        </p>
        <label class="field">
          <span>Stores</span>
          <input name="stores" defaultValue={grocery?.stores.join(', ')} placeholder="Whole Foods, Trader Joe’s" maxLength={300} />
        </label>
        <p class="field-help">Separate stores with commas.</p>
        {error && <p class="error" role="alert">{error}</p>}
        <div class="form-actions">
          <button class="primary" type="submit">Save item</button>
          <button type="button" onClick={onCancel}>Cancel</button>
          {grocery &&
            <button class="danger-link" type="button" onClick={() => setConfirmingRemoval(true)}>
              Remove
            </button>}
        </div>
        {confirmingRemoval && grocery &&
          <fieldset class="remove-confirm">
            <legend>Remove {grocery.name} from your list?</legend>
            <button class="danger" type="button" onClick={remove}>
              Yes, remove
            </button>
            <button type="button" onClick={() => setConfirmingRemoval(false)}>
              Keep item
            </button>
          </fieldset>}
      </form>
    </section>
  );
};
