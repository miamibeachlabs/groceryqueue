import { useState } from 'preact/hooks';
import type { Grocery } from '../domain/Grocery.ts';
import { InventoryTracker } from '../domain/InventoryTracker.ts';
import type { Store, StoreCatalog } from '../domain/Store.ts';
import { StorePicker } from './StorePicker.tsx';

type TimeUnit = 'day' | 'week';

type Props = Readonly<{
  grocery?: Grocery;
  stores: StoreCatalog;
  onSave: (grocery: Grocery) => string | undefined;
  onRemove: (id: string) => string | undefined;
  onAddStore: (store: Store) => string | undefined;
  onRenameStore: (id: string, name: string) => string | undefined;
  onCancel: () => void;
}>;

const valueOf = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

const numberOf = (form: FormData, name: string): number =>
  Number(valueOf(form, name));

export const GroceryForm = ({
  grocery,
  stores,
  onSave,
  onRemove,
  onAddStore,
  onRenameStore,
  onCancel,
}: Props) => {
  const [unit, setUnit] = useState<TimeUnit>('week');
  const [storeIds, setStoreIds] = useState<readonly string[]>(grocery?.storeIds ?? []);
  const [error, setError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const name = valueOf(form, 'name').trim();
    const usualRestock = numberOf(form, 'usualRestock');
    if (!name || !Number.isFinite(usualRestock) || usualRestock <= 0) {
      setError('Enter a name and positive amounts of time and groceries.');
      return;
    }

    if (grocery) {
      const saveError = onSave({ ...grocery, name, storeIds, usualRestock });
      if (saveError) setError(saveError);
      return;
    }

    const amount = numberOf(form, 'amount');
    const interval = numberOf(form, 'interval');
    if (!Number.isFinite(amount) || amount < 0
      || !Number.isFinite(interval) || interval <= 0) {
      setError('Enter a name and positive amounts of time and groceries.');
      return;
    }

    const saveError = onSave({
      id: crypto.randomUUID(),
      name,
      storeIds,
      usualRestock,
      tracker: InventoryTracker.start(
        amount,
        interval * (unit === 'week' ? 7 : 1),
        Date.now(),
      ),
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
      <h2 id="editor-title">{grocery ? `Edit ${grocery.name}` : 'Add an item'}</h2>
      <form onSubmit={submit}>
        <label class="field">
          <span>Item</span>
          <input name="name" defaultValue={grocery?.name} placeholder="Eggs" required maxLength={100} />
        </label>
        {!grocery && <>
          <label class="field stock-field">
            <span>How much do you have?</span>
            <input name="amount" type="number" inputMode="decimal" min="0" step="any" placeholder="8" required />
          </label>
          <fieldset class="usage-fields">
            <legend>About how long until it runs out?</legend>
            <input aria-label="Time until it runs out" name="interval" type="number"
              inputMode="decimal" min="0.01" step="any" placeholder="1" required />
            <select aria-label="Time unit" value={unit}
              onInput={event => setUnit(event.currentTarget.value === 'day' ? 'day' : 'week')}>
              <option value="day">days</option>
              <option value="week">weeks</option>
            </select>
          </fieldset>
        </>}
        <label class="field stock-field">
          <span>How much do you usually buy?</span>
          <input name="usualRestock" type="number" inputMode="decimal" min="0.01"
            step="any" defaultValue={grocery?.usualRestock} placeholder="12" required />
        </label>
        <StorePicker stores={stores} selected={storeIds} onSelect={setStoreIds}
          onAdd={onAddStore} onRename={onRenameStore} />
        {error && <p class="error" role="alert">{error}</p>}
        <div class="form-actions">
          <button class="primary" type="submit">{grocery ? 'Save details' : 'Add item'}</button>
          <button type="button" onClick={onCancel}>Cancel</button>
          {grocery &&
            <button class="danger-link" type="button" onClick={() => setConfirmingRemoval(true)}>
              Remove
            </button>}
        </div>
        {confirmingRemoval && grocery &&
          <fieldset class="remove-confirm">
            <legend>Remove {grocery.name} and its learned inventory?</legend>
            <button class="danger" type="button" onClick={remove}>Yes, remove</button>
            <button type="button" onClick={() => setConfirmingRemoval(false)}>Keep item</button>
          </fieldset>}
      </form>
    </section>
  );
};
