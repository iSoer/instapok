# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Instapoke": a Next.js 16 (App Router) take-home assignment — an Instagram-style vertical feed of Pokémon sprites with infinite scroll and tag search (full brief in `README.md`). Two constraints from the brief shape the code:

- **No third-party infinite-scroll / virtualization libraries.** The windowing and load-more logic is hand-written and must stay that way.
- The feed is judged by scrolling through thousands of items (~2950 seeded sprites), so list render performance matters more than visual design.

## Commands

```bash
docker compose up -d      # Postgres 17 on localhost:5432 (data dir ./docker/, gitignored)
npm install
npm run init              # push schema + reseed DB (destructive, see below)
npm run dev               # next dev (Turbopack is the default in Next 16)
npm run build             # prebuild typecheck:sw, then production build + tsc; does NOT lint since Next 16
npm run lint              # eslint . (flat config: eslint-config-next core-web-vitals + typescript, @stylistic)
npm run lint+fix
npx tsc --noEmit          # typecheck only (src/sw/** is excluded)
npm run typecheck:sw      # typecheck the service worker (tsconfig.sw.json, webworker lib)
npm test                  # Vitest: unit + integration
npm run test:unit         # no DB needed
npm run test:integration  # needs docker compose Postgres; uses database `instapoke_test`
npx vitest run tests/unit/urlWithParams.test.ts   # single file
```

### Tests (Vitest 5, `vitest.config.mts`)

- Two projects: `unit` (`tests/unit/**`, node env; DOM tests opt in with `// @vitest-environment jsdom`) and `integration` (`tests/integration/**`).
- Integration tests run against a **separate database**, `TEST_DATABASE_URL` (default `.../instapoke_test`), which the config injects as `DATABASE_URL` before `@db` is imported (dotenv doesn't override it). `globalSetup` creates the DB from `template0` if missing and runs `drizzle-kit push --force` against it. Every entry point asserts the DB name ends in `_test`, so they refuse to touch the dev DB.
- Use `seed()` from `tests/integration/utils/fixtures.ts` (truncates, then inserts tags/pokemons one by one so `created_at` follows array order). Don't use `src/server/scripts/init.ts` in tests.
- Integration files run serially (`fileParallelism: false`) because they share one DB. Route handlers are tested by calling the exported `GET` with a `NextRequest`.
- The local docker volume's `template1` has a glibc collation-version mismatch (2.36 vs 2.41), so `CREATE DATABASE` without `TEMPLATE template0` fails there.
- `next build` type-checks `tests/` too (tsconfig includes `**/*.ts`).

**Toolchain versions:** Next 16, React 19.3, Zod 4, TypeScript ~6.0 (capped: typescript-eslint supports <6.1), ESLint 9 (ESLint 10 is blocked by `eslint-plugin-react` / `-import` / `-jsx-a11y` peer ranges), Vitest 5, Serwist 9.5 (`serwist` + `@serwist/turbopack`, esbuild ~0.28 as its native bundler). Node **>= 22.13** for development (Vitest 5 / jsdom 29); the app itself needs Node >= 20.9.

`DATABASE_URL` comes from `.env` (committed, points at the docker-compose Postgres). Both `drizzle.config.ts` and the runtime connection load it via `dotenv/config`.


### What `npm run init` does

`src/server/scripts/init.ts` runs `npx drizzle-kit push` (schema is pushed directly; there are no migration files), **TRUNCATEs all three tables**, creates the single `shiny` tag, then inserts one `pokemons` row per `*.webp` in `public/uploads/pokemon/images/`, reading width/height with `sharp`. Files named `N.shiny.webp` get the `shiny` tag; `alt` is the numeric part of the filename. Insertion order is `readdirSync` order, which matters because the list API has no `ORDER BY` (see below). Re-run after any schema or image-set change.

`src/server/scripts/prepareWebpImages.ts` (not in `package.json`; run with `npx tsx`) is the one-off PNG→webp converter that produced the assets and the 10px-wide blur thumbnails. It reads PNGs from `src/server/tmp/pokemon{,/shiny}` and writes to `public/assets/pokemon/...`, whereas the app serves from `public/uploads/pokemon/...` — move the output if you ever regenerate images.

## Architecture

### Directory split mirrors the runtime boundary

- `src/app/` — Next routes. `page.tsx` is the single `"use client"` page; `app/api/pokemon/*/route.ts` are the server route handlers.
- `src/client/` — browser-only: `components/`, `api/` (SWR hooks + URL helper — **not** the route handlers), `lib/` (virtualized list, tailwind-merge wrapper).
- `src/server/` — Node-only: Drizzle `db/` (schema, relations, connection) and `scripts/`.
- `src/shared/` — Zod schemas and the `fetchFn` wrapper imported by both sides.
- `src/sw/sw.ts` — Serwist service worker (own `tsconfig.sw.json`, excluded from the root one). It is bundled and served by
  `src/app/serwist/[path]/route.ts` as `/serwist/sw.js`; registration via `SerwistProvider` in `layout.tsx`. Details: `docs/pwa.md`.

Path aliases (`tsconfig.json`): `@components/*`, `@lib/*`, `@api/*` → `src/client/...`; `@db` → `src/server/db/index.ts` barrel (db instance + every table); `@schema/*` → `src/server/db/schema/*`; `@shared/*`; `@/*` → `src/*`. Remember `@api` is the *client* API layer.

### The API contract lives in `src/shared/api/schema/`

Zod schemas are the single source of truth. The list route `safeParse`s incoming query params with `listRequestSchema` (uses `z.coerce` because values arrive as strings, 400 on failure) and **validates its own response** with `listResponseSchema` before returning (500 on mismatch). Client hooks consume the inferred `*Type` exports. To add or change an API field: edit the shared schema first, then the route, then the consumer.

API surface:
- `GET /api/pokemon/list?page=<0-based>&limit=<n>&tags=<uuid>&tags=<uuid>` → `{ data: ListItem[], pagination: { count, total } }`. `count` = items in this page, `total` = all items matching the filter.
- `GET /api/pokemon/tags` → `{ data: { id, name }[] }`. Plain `db.select()`, no response validation.

**List route** (`app/api/pokemon/list/route.ts` → `src/server/db/queries/listPokemons.ts`):
- `tags` is read with `searchParams.getAll` (repeated keys; `urlWithParams` serializes arrays that way). The shared `tagsParam` preprocess drops empty values (the client sends `tags=` when nothing is selected → no filter), dedupes, then requires UUIDs, max `MAX_TAGS` (50). A non-UUID value is a 400, never "no filter".
- Filtering is in Postgres with **AND semantics**: `pokemons.id IN (SELECT pokemon_id FROM pokemons_tags WHERE tag_id IN (...) GROUP BY pokemon_id HAVING count(DISTINCT tag_id) = <n distinct>)`. With no tags the condition is omitted (never an empty `IN ()`).
- Rows come from one `db.query.pokemonsSchema.findMany` (Drizzle builds the tag join as a lateral `json_agg`, no N+1) with `ORDER BY created_at, id` + `LIMIT/OFFSET`; `total` from `db.$count` with the **same** `where`. Both run in parallel.
- DB errors → logged, generic 500 body. Tests: `tests/integration/listPokemonsFilter.test.ts`, `tests/unit/listRequestTags.test.ts`, `tests/unit/listRouteErrors.test.ts`.

`paginationRequest` / `paginationResponse` / `MIN_PAGE_SIZE` / `MAX_PAGE_SIZE` in `shared/api/schema/pagination/` are unused scaffolding; only `infiniteRequest` / `infiniteResponse` are wired up.

Image URLs are **not** returned by the API. `page.tsx` derives them from `name`: `/uploads/pokemon/images/{name}.webp` and `/uploads/pokemon/thumbnails/{name}.thumbnail.webp` (blur-up placeholder consumed by `ui/Img.tsx`).

### Data fetching

`usePokemonBank({ limit, tags: string[] })` wraps `useSWRInfinite`; the `page` field `page.tsx` passes in is ignored — SWR's `pageIndex` is the page. End-of-list is detected in `getKey` (returns `null` once the previous page had fewer than `limit` items); `revalidateFirstPage` is off.

**Feed reset is indirect.** Any sidebar change, including tag selection, calls `setSize(0)`. That empties the list, which makes the slider's `endIndex >= itemsCount - 1` check true immediately, which fires `onLastItemShowed`, which calls `setSize(s => s + 1)` and refetches page 0 with the new key. If you change the slider's end-of-list logic, make sure this path still works.

### Infinite scroll + virtualization (hand-rolled)

- `src/client/lib/virtualized-list/useVirtualizedList.ts` — fixed-size windowing. The visible range lives in a `useRef`; a forced rerender (`useReducer` bump) fires **only** when `endIndex` crosses an overscan-derived threshold, or when `itemSize` / `totalSize` change — not on every scroll event. `itemSize` passed in must already include any gap (`InstagramSlider` passes `itemSize + slideGap`). The hook also attaches a `resize` listener to the scroll element, but element `resize` events never fire, so container size changes are only picked up on the next scroll.
- `components/instagram-slider/InstagramSlider.tsx` — the renderer: a spacer `div` of `totalSize` height, an inner `div` translated by `startIndex * itemSize`, only the virtual items mounted. Calls `onLastItemShowed` from an effect when `endIndex >= itemsCount - 1`, which bumps the SWR page count. Optional CSS scroll-snap (`snap-y snap-mandatory`) and full-screen (`h-dvh`) modes; non-fullscreen height is `itemSize + 2 * containerPaddingY`.
- `components/instagram-Infinite-scroll/InstagramInfiniteScrollSlider.tsx` — alternative non-virtualized implementation (IntersectionObserver on the last item, every item mounted). Kept for comparison; currently imported but not rendered by `page.tsx` (that unused import is one of the lint errors above).
- `components/layout/Sidebar.tsx` is a live tuning panel for the slider props (item width/height, gap, container padding, overscan, snap, fullscreen) plus the tag checkbox list (`ui/CheckboxGroup.tsx`, emits sorted ids so the same set gives the same SWR key; `[]` clears the filter). Numeric inputs only propagate values `> 0` (overscan `>= 2`) and `page.tsx` only merges truthy values, so gap/padding can't be set to 0 from the UI.

### Database: Drizzle ORM 0.45 (classic relational-query API)

`drizzle-orm@^0.45` + `drizzle-kit@^0.31`. This is the **v0.x API**, not the 1.0 / RQB v2 API (moving to 1.0 is a separate migration: `defineRelations`, RQB v2):

- Relations are declared per table with `relations(table, ({ one, many }) => ({ ... }))` in `src/server/db/relations/` and spread into the `schema` object passed to `drizzle(url, { schema: { ...schema, ...relations } })` in `connection/db.ts`. There is no `defineRelations`.
- The relational-query accessor is keyed by the **exported variable name**, not the SQL table name: `db.query.pokemonsSchema`, `db.query.tagsSchema`, `db.query.pokemonsTagsSchema`.
- Many-to-many goes through the join-table relation: `with: { tags: { with: { tag: true } } }`, flattened by the caller. There is no direct many-to-many relation.
- `connection/db.ts` also exports `dbClear` (a second instance with no schema); nothing uses it.
- `drizzle.config.ts` sets `out: ./src/server/db/generated`, but that directory does not exist — schema changes reach the DB only through `drizzle-kit push` (via `npm run init`).

Tables: `pokemons` (uuid pk, `name`, `width`, `height`, nullable `alt`, `created_at`), `tags` (unique `name`), `pokemons_tags` (composite PK, cascade deletes). One schema file per table in `src/server/db/schema/`, re-exported from the barrel.

## Conventions and gotchas

- **Tailwind v4 with `--spacing: 1px`** (`src/app/style/style.css`). Spacing utilities are pixel-literal: `px-5` = 5px, `gap-12` = 12px, `w-30` = 30px. Do not assume the default 0.25rem scale.
- Merge classes through `twMerge` from `@lib/tailwind-merge` (an `extendTailwindMerge` wrapper), not from `tailwind-merge` directly. (`ui/Toggle.tsx` is the one existing exception; don't add more.)
- Style is enforced by ESLint `@stylistic`: double quotes, no semicolons, no trailing commas, max line length 130. Run `npm run lint+fix` before finishing.
- `eslint-config-next` 16 ships `eslint-plugin-react-hooks` 7 with React Compiler rules, e.g. `react-hooks/refs` (no `ref.current` reads during render). `useVirtualizedList` therefore keeps a working copy in a ref (read by scroll handlers) and a state snapshot for render, replaced only when the threshold is crossed. Keep that split rather than disabling the rule.
- `@next/next/no-img-element` is disabled on purpose — the feed uses a plain `<img loading="lazy">` inside `ui/Img.tsx` (blur-up thumbnail, fade-in, error fallback) rather than `next/image`.
- Components are wrapped in `memo(function Name() { ... })` and every callback handed to the slider is `useCallback`-stable. Keep it that way; the list is rerender-sensitive.
- `public/assets/pokeball.webp` is the spinner background used by `ui/Loader.tsx`; everything else under `public/` is the sprite set.
