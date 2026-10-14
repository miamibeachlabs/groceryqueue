import { useEffect, useState } from 'preact/hooks';
import { Inventory, type Grocery } from '../domain/Grocery.ts';
import { InventoryTracker } from '../domain/InventoryTracker.ts';
import { GroceryForm } from './GroceryForm.tsx';
import { GroceryRow } from './GroceryRow.tsx';
import { InventoryActionForm } from './InventoryActionForm.tsx';
import { DataTransfer } from './DataTransfer.tsx';
import { MiamiBeachLabsBrand } from './MiamiBeachLabsBrand.tsx';
import { useInventory } from './useInventory.ts';

type Editor =
  | 'new'
  | Readonly<{ kind: 'details' | 'count' | 'restock' | 'rate'; id: string }>
  | undefined;

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
  const finish = (error?: string): string | undefined => {
    if (!error) {
      setEditor(undefined);
      setNow(Date.now());
    }
    return error;
  };

  const detailsForm = (grocery?: Grocery) =>
    <GroceryForm
      key={grocery?.id ?? 'new'}
      grocery={grocery}
      stores={stores}
      onSave={grocery => finish(inventory.save(grocery))}
      onRemove={id => finish(inventory.remove(id))}
      onAddStore={inventory.addStore}
      onRenameStore={inventory.renameStore}
      onCancel={() => setEditor(undefined)}
    />;

  const actionForm = (grocery: Grocery, kind: 'count' | 'restock' | 'rate') =>
    <InventoryActionForm
      action={kind}
      name={grocery.name}
      suggestedAmount={kind === 'rate'
        ? InventoryTracker.estimateAt(grocery.tracker, now).dailyUse
        : grocery.usualRestock}
      onSubmit={amount => finish(kind === 'count' ? inventory.count(grocery.id, amount)
        : kind === 'rate' ? inventory.setDailyUse(grocery.id, amount)
        : inventory.restock(grocery.id, amount))}
      onCancel={() => setEditor(undefined)}
    />;

  const estimates = queue.toArray();
  const move = (from: number, by: -1 | 1) => {
    const to = from + by;
    if (to < 0 || to >= estimates.length) return;
    const reordered = [...estimates];
    const [item] = reordered.splice(from, 1);
    if (!item) return;
    reordered.splice(to, 0, item);
    inventory.reorder(reordered.map(estimate => estimate.grocery.id));
  };

  return (
    <main class="workspace">
      <header class="masthead">
        <div>
          <p class="eyebrow">YOUR PANTRY, IN ORDER</p>
          <h1>Grocery Queue<span>.</span></h1>
          <MiamiBeachLabsBrand />
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
      {editor === 'new' && detailsForm()}

      <nav class="store-filters" aria-label="Filter by store">
        {[undefined, ...stores].map(store =>
          <button class="filter" type="button" key={store?.id ?? 'all'}
            aria-pressed={selectedStore === store?.id} onClick={() => setStore(store?.id ?? '')}>
            {store?.name ?? 'All stores'}
          </button>)}
      </nav>

      <section class="queue" aria-label="Groceries by urgency">
        <div class="list-heading">
          <span>ITEM / ESTIMATED AMOUNT LEFT</span>
          <span>TIME LEFT</span>
        </div>
        {!inventory.error && queue.size === 0
          ? <div class="empty">
              <h2>Your list starts here.</h2>
              <p>Add an item and tell us roughly when it will run out. Future counts teach the estimate.</p>
              <button class="primary" type="button" onClick={() => setEditor('new')}>
                Add your first item
              </button>
            </div>
          : <ol>
              {estimates.map((estimate, index) => {
                const itemEditor = typeof editor === 'object' && editor.id === estimate.grocery.id
                  ? editor.kind
                  : undefined;

                return itemEditor
                  ? <li class="inline-editor" key={estimate.grocery.id}>
                      {itemEditor === 'details'
                        ? detailsForm(estimate.grocery)
                        : actionForm(estimate.grocery, itemEditor)}
                    </li>
                  : <GroceryRow
                      key={estimate.grocery.id}
                      estimate={estimate}
                      stores={stores}
                      onRestock={grocery => finish(inventory.restock(
                        grocery.id,
                        grocery.usualRestock,
                      ))}
                      onOtherRestock={grocery => setEditor({ kind: 'restock', id: grocery.id })}
                      onCount={grocery => setEditor({ kind: 'count', id: grocery.id })}
                      onRate={grocery => setEditor({ kind: 'rate', id: grocery.id })}
                      onEdit={grocery => setEditor({ kind: 'details', id: grocery.id })}
                      onMoveEarlier={() => move(index, -1)}
                      onMoveLater={() => move(index, 1)}
                      canMoveEarlier={index > 0}
                      canMoveLater={index < estimates.length - 1}
                    />;
              })}
            </ol>}
        {groceries.some(grocery => grocery.manualRank !== undefined) &&
          <button class="predicted-order" type="button" onClick={inventory.usePredictedOrder}>
            Use predicted order
          </button>}
      </section>

      <footer>
        <DataTransfer
          exportData={inventory.exportData}
          prepareImport={inventory.prepareImport}
          replaceInventory={inventory.replaceInventory}
        />
        <p>Counts teach the app how quickly each item is used.</p>
        <p>Saved in this browser only. Devices do not sync.</p>
      </footer>
    </main>
  );
};
