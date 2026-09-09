import { useEffect, useState } from 'preact/hooks';
import {
  Inventory,
  type Grocery,
  type Inventory as GroceryInventory,
  type InventoryChange,
} from '../domain/Grocery.ts';
import type { Store } from '../domain/Store.ts';
import { LocalInventory } from '../infrastructure/LocalInventory.ts';

type State = Readonly<{
  inventory: GroceryInventory;
  error?: string;
}>;

const repository = new LocalInventory(localStorage);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong.';

const read = (): State => {
  try {
    return { inventory: repository.load() };
  } catch (error) {
    return { inventory: Inventory.empty(), error: errorMessage(error) };
  }
};

export const useInventory = () => {
  const [state, setState] = useState<State>(read);

  useEffect(() => {
    const refresh = () => setState(read());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const commit = (change: InventoryChange): string | undefined => {
    try {
      const inventory = Inventory.change(repository.load(), change);
      repository.save(inventory);
      setState({ inventory });
      return undefined;
    } catch (error) {
      const message = errorMessage(error);
      setState(current => ({ ...current, error: message }));
      return message;
    }
  };

  return {
    ...state,
    save: (grocery: Grocery) => commit({ kind: 'save', grocery }),
    remove: (id: string) => commit({ kind: 'remove', id }),
    addStore: (store: Store) => commit({ kind: 'addStore', store }),
    renameStore: (id: string, name: string) =>
      commit({ kind: 'renameStore', id, name }),
  } as const;
};
