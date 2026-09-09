import { useState } from 'preact/hooks';
import { Stores, type Store, type StoreCatalog } from '../domain/Store.ts';

type Props = Readonly<{
  stores: StoreCatalog;
  selected: readonly string[];
  onSelect: (ids: readonly string[]) => void;
  onAdd: (store: Store) => string | undefined;
  onRename: (id: string, name: string) => string | undefined;
}>;

type RenameProps = Readonly<{
  store: Store;
  onRename: (name: string) => string | undefined;
}>;

const RenameStore = ({ store, onRename }: RenameProps) => {
  const [name, setName] = useState(store.name);
  const [error, setError] = useState('');

  const rename = () => {
    const next = name.trim();
    if (!next) return setError('Enter a store name.');
    setError(onRename(next) ?? '');
  };

  return (
    <li>
      <input aria-label={`Rename ${store.name}`} value={name} maxLength={100}
        onInput={event => setName(event.currentTarget.value)} />
      <button type="button" onClick={rename}>Save</button>
      {error && <span class="error">{error}</span>}
    </li>
  );
};

export const StorePicker = ({
  stores,
  selected,
  onSelect,
  onAdd,
  onRename,
}: Props) => {
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const toggle = (id: string) => onSelect(
    selected.includes(id) ? selected.filter(candidate => candidate !== id) : [...selected, id],
  );

  const add = () => {
    const name = newName.trim();
    if (!name) return setError('Enter a store name.');

    const existing = Stores.find(stores, name);
    if (existing) {
      if (!selected.includes(existing.id)) onSelect([...selected, existing.id]);
    } else {
      const store = { id: crypto.randomUUID(), name };
      const addError = onAdd(store);
      if (addError) return setError(addError);
      onSelect([...selected, store.id]);
    }

    setNewName('');
    setAdding(false);
    setError('');
  };

  const rename = (store: Store, name: string) => {
    const existing = Stores.find(stores, name);
    const renameError = onRename(store.id, name);
    if (!renameError && existing && existing.id !== store.id)
      onSelect([...new Set(selected.map(id => id === store.id ? existing.id : id))]);
    return renameError;
  };

  return (
    <fieldset class="store-picker">
      <legend>Stores</legend>
      <div class="store-choices">
        {stores.map(store =>
          <button type="button" key={store.id} aria-pressed={selected.includes(store.id)}
            onClick={() => toggle(store.id)}>
            {store.name}
          </button>)}
      </div>
      <div class="store-actions">
        <button type="button" onClick={() => setAdding(value => !value)}>+ New store</button>
        {stores.length > 0 &&
          <button type="button" onClick={() => setManaging(value => !value)}>Manage stores</button>}
      </div>
      {adding &&
        <div class="new-store">
          <input aria-label="New store name" value={newName} placeholder="Store name" maxLength={100}
            onInput={event => setNewName(event.currentTarget.value)} />
          <button type="button" onClick={add}>Add</button>
        </div>}
      {error && <p class="error" role="alert">{error}</p>}
      {managing &&
        <ul class="manage-stores">
          {stores.map(store =>
            <RenameStore key={store.id} store={store}
              onRename={name => rename(store, name)} />)}
        </ul>}
    </fieldset>
  );
};
