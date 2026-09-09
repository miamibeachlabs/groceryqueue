# Grocery queue

A small personal grocery list ordered by estimated days remaining. Its domain is pure TypeScript; its interface uses Preact and TSX.

## Commands

```sh
bun install
bun run dev
bun run test
bun run check
bun run build
```

Preact is the sole application dependency. Bun installs it, serves the HTML entry point, runs the tests, invokes the pinned TypeScript compiler from its cache, and produces the static build. There is no Vite, Astro, Tailwind, Node runtime, server framework, or component library.

The production build consists only of static browser files in `dist`. Cloudflare Pages can build it with the command above and publish that directory. No server, database, account, paid service, Node runtime, or Cloudflare Function is involved. Deployment has not been configured or performed.

## Read the code

1. `src/data/PriorityQueue.ts` — the abstract queue interface and one private-representation implementation.
2. `src/domain/Stock.ts` — pure depletion calculations with explicit time.
3. `src/domain/Grocery.ts` — the grocery model, inventory changes, and grocery-specific priority policy.
4. `src/infrastructure/LocalInventory.ts` — validation, legacy-data migration, and browser-storage effects.
5. `src/ui/useInventory.ts` — the narrow bridge between storage and Preact state.
6. `src/ui/App.tsx`, `GroceryForm.tsx`, and `GroceryRow.tsx` — focused declarative views.
7. `src/main.tsx` — the browser entry point.

The reusable queue has no UI, runtime, browser, or grocery dependencies. `PriorityQueue<T>` states the abstract behavior; `SortedPriorityQueue<T>` is one immutable implementation. Its sorted-array representation is private, so callers cannot create an invalid queue and another implementation can replace it without changing grocery code.

## Model

Stock is an observation: amount, a human-scale usage interval, and the time recorded. A usage interval can say “1 every 3 weeks”; the daily rate is derived internally. Remaining stock is also derived, never written on a timer. Stock and usage share a unit chosen by the user. Include that unit in the name when useful, such as `Beef (lb)`.

Each item includes a depletion bar on the same fixed seven-day scale. The lighter width represents time left today and the darker overlay represents tomorrow. Values beyond seven days stop at the right edge, keeping attention on items that need action soon without distorting comparisons.

The queue sorts by days remaining. Empty items come first; positive stock with zero consumption comes last. Equal priorities retain inventory order. This predicts depletion, not food spoilage. No weighting, learning, or shopping optimization is included.

After a purchase, update the item with your new total stock. Changing only the name or stores preserves the original stock observation. Changing stock or consumption establishes a new observation.

## Persistence and limits

Data is saved only in the current browser and origin. It does not sync across devices; clearing site data removes it. Invalid saved data is left untouched and blocks edits rather than being silently overwritten. Writes reload the latest inventory first, though simultaneous writes from multiple tabs are not transactional.
