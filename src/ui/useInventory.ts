import { useEffect, useState } from 'preact/hooks';
import {
  Inventory,
  type Grocery,
  type Inventory as GroceryInventory,
  type InventoryChange,
} from '../domain/Grocery.ts';
import { LocalInventory } from '../infrastructure/LocalInventory.ts';

type State = Readonly<{
  groceries: GroceryInventory;
  error?: string;
}>;

const repository = new LocalInventory(localStorage);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong.';

const read = (): State => {
  try {
    return { groceries: repository.load() };
  } catch (error) {
    return { groceries: [], error: errorMessage(error) };
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
      const groceries = Inventory.change(repository.load(), change);
      repository.save(groceries);
      setState({ groceries });
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
  } as const;
};
