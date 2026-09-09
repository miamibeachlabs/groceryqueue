export type Store = Readonly<{
  id: string;
  name: string;
}>;

export type StoreCatalog = readonly Store[];

const defaults: StoreCatalog = [
  { id: 'trader-joes', name: 'Trader Joe’s' },
  { id: 'whole-foods', name: 'Whole Foods' },
];

const normalize = (name: string): string => name.trim().toLowerCase();

const find = (catalog: StoreCatalog, name: string): Store | undefined =>
  catalog.find(store => normalize(store.name) === normalize(name));

const add = (catalog: StoreCatalog, store: Store): StoreCatalog =>
  !normalize(store.name) || find(catalog, store.name)
    ? catalog
    : [...catalog, { ...store, name: store.name.trim() }];

/** The reusable identity and naming rules for stores. */
export const Stores = {
  defaults,
  normalize,
  find,
  add,
} as const;
