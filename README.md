# Grocery queue

A small personal grocery list that learns when each item will run out. Its domain is pure TypeScript; its interface uses Preact and TSX.

## Commands

```sh
bun install
bun run dev
bun run test
bun run check
bun run build
```

Preact is the sole application dependency. Bun installs it, serves the HTML entry point, runs the tests, invokes the pinned TypeScript compiler from its cache, and produces the static build. There is no Vite, Astro, Tailwind, Node runtime, server framework, or component library.

The production build consists only of static browser files in `dist`. `wrangler.jsonc` configures Cloudflare Workers Static Assets to publish that directory. It contains no Worker script and keeps `run_worker_first` disabled, so requests are served directly as static assets. A connected Cloudflare build should run `bun run build`, then `bunx wrangler deploy`.

No server, database, account, paid service, Node runtime, or Cloudflare Function is involved.

## Offline use

The app is an offline-first progressive web app. Visit it once while online so the browser can download the complete app. After that it launches from its installed files and remains fully usable in airplane mode; startup never waits for a network request. Grocery data stays in this browser's local storage.

When a connection happens to be available, the browser checks quietly for a newer build after the current app has loaded. It downloads an update as a complete new version and uses it after the old app windows have closed. A failed or interrupted download leaves the installed version intact.

On iPhone, open the deployed app in Safari and choose **Share → Add to Home Screen**. On Android, use the browser's **Install app** or **Add to Home screen** command. The installed app opens in its own window and uses the same local data as the browser that installed it.

The browser treats each device and browser separately, so groceries do not sync between them. Clearing the app's site data removes both the groceries and its downloaded offline files. Service workers require HTTPS on a deployed site; local development is allowed on `localhost`.

## Read the code

1. `src/data/PriorityQueue.ts` — the abstract queue interface and one private-representation implementation.
2. `src/domain/InventoryHistory.ts` — inventory facts and the pure estimator derived from them.
3. `src/domain/Store.ts` — store identity, naming, and catalog rules.
4. `src/domain/Grocery.ts` — the grocery model, inventory changes, and grocery-specific priority policy.
5. `src/infrastructure/LocalInventory.ts` — validation, legacy-data migration, and browser-storage effects.
6. `src/ui/useInventory.ts` — the narrow bridge between storage and Preact state.
7. `src/ui/App.tsx`, `GroceryForm.tsx`, `StorePicker.tsx`, and `GroceryRow.tsx` — focused declarative views.
8. `src/main.tsx` — the browser entry point.

The reusable queue has no UI, runtime, browser, or grocery dependencies. `PriorityQueue<T>` states the abstract behavior; `SortedPriorityQueue<T>` is one immutable implementation. Its sorted-array representation is private, so callers cannot create an invalid queue and another implementation can replace it without changing grocery code.

## Model

The authoritative facts are timestamped counts and purchases. “I have 8” observes the amount present; “Bought 12” records an addition. Between two counts, consumption is the earlier amount plus every purchase minus the later amount. Intermediate events therefore combine without averaging noisy interval rates.

A new item begins with a rough prediction of when its current amount will run out. That prediction acts as weak initial evidence. Actual counts gradually replace it with a weighted amount-over-time estimate. Recent evidence matters more, and each item's learning timescale follows its recent restock cadence: frequently purchased food adapts quickly while rarely purchased staples retain useful evidence longer.

The most recent or usual purchase amount is a one-tap default, not a constraint. Recording a different amount changes the next suggestion. Purchase events deliberately contain no store; stores describe where an item is available, and the existing filters provide the shopping view.

Stores have stable identities in a catalog; groceries refer to those identities. Renaming a store changes its name everywhere, and renaming it to an existing name merges the two entries. Fresh installations begin with Trader Joe’s and Whole Foods. Existing installations derive their catalog only from their saved groceries, preserving every name without injecting defaults.

Each item includes a depletion bar on the same fixed seven-day scale. The lighter width represents time left today and the darker overlay represents tomorrow. Values beyond seven days stop at the right edge, keeping attention on items that need action soon without distorting comparisons.

The queue sorts by predicted days remaining. Empty items come first; positive amounts with zero estimated consumption come last. Equal priorities retain inventory order. This predicts depletion, not food spoilage, expiration, or store trips.

Use **Bought** after adding groceries and **I have…** after counting what remains. Names, stores, and the suggested purchase amount are editable without changing inventory history. If a count would imply that unrecorded groceries appeared, the app asks for the missing purchase instead of learning from impossible evidence.

## Persistence and limits

The learned model uses a new storage key, leaving the currently deployed inventory untouched while this branch is evaluated. A deliberate importer will be designed only after the new model and interface are accepted.

Data is saved only in the current browser and origin. It does not sync across devices; clearing site data removes it. Invalid saved data is left untouched and blocks edits rather than being silently overwritten. Writes reload the latest inventory first, though simultaneous writes from multiple tabs are not transactional.
