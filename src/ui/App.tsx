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

  const stores = Inventory.stores(inventory.groceries);
  const selectedStore = stores.includes(store) ? store : undefined;
  const queue = Inventory.shoppingQueue(inventory.groceries, now, selectedStore);
  const editedGrocery = typeof editor === 'object'
    ? inventory.groceries.find(grocery => grocery.id === editor.id)
    : undefined;

  const edit = (grocery: Grocery) => setEditor({ id: grocery.id });

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
        <span>{inventory.groceries.length} {inventory.groceries.length === 1 ? 'item' : 'items'}</span>
      </div>

      {inventory.error && <p class="notice error" role="alert">{inventory.error}</p>}

      {editor &&
        <GroceryForm
          key={editor === 'new' ? 'new' : editor.id}
          grocery={editedGrocery}
          inventory={inventory.groceries}
          now={now}
          onSave={grocery => {
            const error = inventory.save(grocery);
            if (!error) setEditor(undefined);
            return error;
          }}
          onRemove={id => {
            const error = inventory.remove(id);
            if (!error) setEditor(undefined);
            return error;
          }}
          onCancel={() => setEditor(undefined)}
        />}

      <nav class="store-filters" aria-label="Filter by store">
        {[undefined, ...stores].map(name =>
          <button class="filter" type="button"
            aria-pressed={selectedStore === name} onClick={() => setStore(name ?? '')}>
            {name ?? 'All stores'}
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
              <p>Add an item, how much you have, and how much you use each day.</p>
              <button class="primary" type="button" onClick={() => setEditor('new')}>
                Add your first item
              </button>
            </div>
          : <ol>
              {queue.toArray().map(estimate =>
                <GroceryRow key={estimate.grocery.id} estimate={estimate} onEdit={edit} />)}
            </ol>}
      </section>

      <footer>
        <p>Estimates count down from your last stock update.</p>
        <p>Saved in this browser only. Devices do not sync.</p>
      </footer>
    </main>
  );
};
