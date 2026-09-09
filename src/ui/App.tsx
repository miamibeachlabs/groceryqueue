import { useEffect, useState } from 'preact/hooks';
import { Inventory, type Grocery } from '../domain/Grocery.ts';
import { GroceryForm } from './GroceryForm.tsx';
import { GroceryRow } from './GroceryRow.tsx';
import { useInventory } from './useInventory.ts';

type Editor = 'new' | Readonly<{ id: string }> | undefined;

export const App = () => {
  const inventory = useInventory();
  const [store, setStore] = useState('');
  const [editor, setEditor] = useState<Editor>();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (editor) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [editor]);

  const { groceries, stores } = inventory.inventory;
  const selectedStore = stores.some(candidate => candidate.id === store) ? store : undefined;
  const queue = Inventory.shoppingQueue(inventory.inventory, now, selectedStore);
  const edit = (grocery: Grocery) => setEditor({ id: grocery.id });
  const finish = (error?: string): string | undefined => {
    if (!error) setEditor(undefined);
    return error;
  };

  const formFor = (grocery?: Grocery) =>
    <GroceryForm
      key={grocery?.id ?? 'new'}
      grocery={grocery}
      stores={stores}
      now={now}
      onSave={grocery => finish(inventory.save(grocery))}
      onRemove={id => finish(inventory.remove(id))}
      onAddStore={inventory.addStore}
      onRenameStore={inventory.renameStore}
      onCancel={() => setEditor(undefined)}
    />;

  return (
    <main class="workspace">
      <header class="masthead">
        <div>
          <p class="eyebrow">YOUR PANTRY, IN ORDER</p>
          <h1>Grocery queue<span>.</span></h1>
        </div>
        <button class="primary add-button" type="button"
          disabled={Boolean(inventory.error)} onClick={() => setEditor('new')}>
          + Add item
        </button>
      </header>

      <div class="intro">
        <p>What will run out first?</p>
        <span>{groceries.length} {groceries.length === 1 ? 'item' : 'items'}</span>
      </div>

      {inventory.error && <p class="notice error" role="alert">{inventory.error}</p>}

      {editor === 'new' && formFor()}

      <nav class="store-filters" aria-label="Filter by store">
        {[undefined, ...stores].map(store =>
          <button class="filter" type="button" key={store?.id ?? 'all'}
            aria-pressed={selectedStore === store?.id} onClick={() => setStore(store?.id ?? '')}>
            {store?.name ?? 'All stores'}
          </button>)}
      </nav>

      <section class="queue" aria-label="Groceries by urgency">
        <div class="list-heading">
          <span>ITEM / ESTIMATED STOCK</span>
          <span>TIME LEFT</span>
        </div>
        {!inventory.error && queue.size === 0
          ? <div class="empty">
              <h2>Your list starts here.</h2>
              <p>Add an item, how much you have, and how often you use it.</p>
              <button class="primary" type="button" onClick={() => setEditor('new')}>
                Add your first item
              </button>
            </div>
          : <ol>
              {queue.toArray().map(estimate =>
                typeof editor === 'object' && editor.id === estimate.grocery.id
                  ? <li class="inline-editor" key={estimate.grocery.id}>
                      {formFor(estimate.grocery)}
                    </li>
                  : <GroceryRow key={estimate.grocery.id} estimate={estimate}
                      stores={stores} onEdit={edit} />)}
            </ol>}
      </section>

      <footer>
        <p>Estimates count down from your last stock update.</p>
        <p>Saved in this browser only. Devices do not sync.</p>
      </footer>
    </main>
  );
};
