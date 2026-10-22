# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Instapoke": a Next.js 16 (App Router) take-home assignment — an Instagram-style vertical feed of Pokémon sprites with infinite scroll and tag search (full brief in `README.md`). Two constraints from the brief shape the code:

- **No third-party infinite-scroll / virtualization libraries.** The windowing and load-more logic is hand-written and must stay that way.
- The feed is judged by scrolling through thousands of items (~2955 seeded sprites), so list render performance matters more than visual design.

**Next 16 has breaking changes vs. older Next.js** (from `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code. `next dev` re-adds that block to `AGENTS.md`; leave it.

Longer topic docs (in Russian) live in `docs/` (index: `docs/README.md`): api, database, feed, pwa, testing, conventions, pokemon-info, abilities, pokemon-model (statistical model of stats/types/abilities and the generator built on it), character-model (characters derived from it: level 1-80, rarity 1-5★, Fortune's Weave weapon ranks and classes), game (the `/game` tactics game built on the character model). `TZ-pokemon-generator.md` in the root is the generator spec (fully implemented, UI is the `/generate` page).

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
npm test                  # Vitest: unit + integration (npm run test:watch for watch mode)
npm run test:unit         # no DB needed
npm run test:integration  # needs docker compose Postgres; uses database `instapoke_test`
npx vitest run tests/unit/urlWithParams.test.ts   # single file
npm run pokemon:info      # fetch PokeAPI data into pokemon_info (docs/pokemon-info.md)
npm run ability:info      # fetch abilities into ability (docs/abilities.md)
npm run pokemon:model     # refit src/server/pokemon-model/model.json from pokemon_info
npm run pokemon:generate -- --line=3 --mega --dry-run   # generate new pokemon (omit --dry-run to save)
npm run character:generate -- --rarity=4 --level=40 --dry-run   # generate characters (docs/character-model.md)
npm run icons             # regenerate PWA icons (docs/pwa.md)
```

### Tests (Vitest 5, `vitest.config.mts`)

- Two projects: `unit` (`tests/unit/**`, node env; DOM tests opt in with `// @vitest-environment jsdom`) and `integration` (`tests/integration/**`).
- Integration tests run against a **separate database**, `TEST_DATABASE_URL` (default `.../instapoke_test`), which the config injects as `DATABASE_URL` before `@db` is imported (dotenv doesn't override it). `globalSetup` creates the DB from `template0` if missing and runs `drizzle-kit push --force` against it. Every entry point asserts the DB name ends in `_test`, so they refuse to touch the dev DB.
- Use `seed()` from `tests/integration/utils/fixtures.ts` (truncates, then inserts tags/pokemon one by one so `created_at` follows array order). Don't use `src/server/scripts/init.ts` in tests.
- Integration files run serially (`fileParallelism: false`) because they share one DB. Route handlers are tested by calling the exported `GET` with a `NextRequest`.
- The local docker volume's `template1` has a glibc collation-version mismatch (2.36 vs 2.41), so `CREATE DATABASE` without `TEMPLATE template0` fails there.
- `next build` type-checks `tests/` too (tsconfig includes `**/*.ts`).

**Toolchain versions:** Next 16, React 19.3, Zod 4, TypeScript ~6.0 (capped: typescript-eslint supports <6.1), ESLint 9 (ESLint 10 is blocked by `eslint-plugin-react` / `-import` / `-jsx-a11y` peer ranges), Vitest 5, Serwist 9.5 (`serwist` + `@serwist/turbopack`, esbuild ~0.28 as its native bundler). Node **>= 22.13** for development (Vitest 5 / jsdom 29); the app itself needs Node >= 20.9.

`DATABASE_URL` comes from `.env` (committed, points at the docker-compose Postgres). Both `drizzle.config.ts` and the runtime connection load it via `dotenv/config`.


### What `npm run init` does

`src/server/scripts/init.ts` runs `npx drizzle-kit push` (schema is pushed directly; there are no migration files), **TRUNCATEs `pokemon`, `pokemon_tags` and `tags`** (not `pokemon_info`; sprites are relinked to it at the end), creates the single `shiny` tag, then inserts one `pokemon` row per `*.webp` in `public/uploads/pokemon/images/`, reading width/height with `sharp`. Files named `N.shiny.webp` get the `shiny` tag; `alt` is the numeric part of the filename. Insertion order is `readdirSync` order, which matters because the list API orders by `created_at, id` (see below). Re-run after any schema or image-set change.

`src/server/scripts/prepareWebpImages.ts` (not in `package.json`; run with `npx tsx`) is the one-off PNG→webp converter that produced the assets and the 10px-wide blur thumbnails. It reads PNGs from `src/server/tmp/pokemon{,/shiny}` and writes to `public/assets/pokemon/...`, whereas the app serves from `public/uploads/pokemon/...` — move the output if you ever regenerate images.

## Architecture

### Directory split mirrors the runtime boundary

- `src/app/` — Next routes. `page.tsx` is the feed and `generate/page.tsx` the pokemon generator, both `"use client"`; `app/api/pokemon/*/route.ts` are the server route handlers.
- `src/client/` — browser-only: `components/`, `api/` (SWR hooks + URL helper — **not** the route handlers), `lib/` (virtualized list, tailwind-merge wrapper).
- `src/server/` — Node-only: Drizzle `db/` (schema, relations, connection) and `scripts/`.
- `src/shared/` — Zod schemas and the `fetchFn` wrapper imported by both sides.
- `src/client/game/` — the "Пушистая Резня" tactics game at `/game` (ported from the separate Vite/Preact repo `my-fe`), see "Game" below.
- `src/sw/sw.ts` — Serwist service worker (own `tsconfig.sw.json`, excluded from the root one). It is bundled and served by
  `src/app/serwist/[path]/route.ts` as `/serwist/sw.js`; registration via `SerwistProvider` in `layout.tsx`. Details: `docs/pwa.md`.

Path aliases (`tsconfig.json`): `@components/*`, `@lib/*`, `@api/*` → `src/client/...`; `@db` → `src/server/db/index.ts` barrel (db instance + every table); `@schema/*` → `src/server/db/schema/*`; `@shared/*`; `@game/*` → `src/client/game/*`; `@/*` → `src/*`. Remember `@api` is the *client* API layer.

### The API contract lives in `src/shared/api/schema/`

Zod schemas are the single source of truth. The list route `safeParse`s incoming query params with `listRequestSchema` (uses `z.coerce` because values arrive as strings, 400 on failure) and **validates its own response** with `listResponseSchema` before returning (500 on mismatch). Client hooks consume the inferred `*Type` exports. To add or change an API field: edit the shared schema first, then the route, then the consumer.

API surface:
- `GET /api/pokemon/list?page=<0-based>&limit=<n>&tags=<uuid>&tags=<uuid>` → `{ data: ListItem[], pagination: { count, total } }`. `count` = items in this page, `total` = all items matching the filter.
- `GET /api/pokemon/tags` → `{ data: { id, name }[] }`. Plain `db.select()`, no response validation.
- `GET /api/pokemon/abilities` → `{ data: { name, sourceId, externalId, displayName, effect, shortEffect, flavorText, generation, isMainSeries }[] }`, every downloaded ability; `name` is the key (the values in `pokemon_info.abilities`). Response validated with `abilitiesResponseSchema`.
- `/api/pokemon/generated`: `POST /preview` (generate only), `POST` (generate + save, 201, 409 on a taken name), `GET ?page&limit&types&class` (types AND via array containment), `GET|DELETE /[id]`, `GET /model` (public part of the model for the UI). Body `{ mode: single|line|mega|custom, request | baseId | pokemon, seed? }`; `custom` = stats chosen by hand, validated by the same validator; contract in `src/shared/api/schema/pokemon/generated.ts`. Details in `docs/api.md`.

**List route** (`app/api/pokemon/list/route.ts` → `src/server/db/queries/listPokemon.ts`):
- `tags` is read with `searchParams.getAll` (repeated keys; `urlWithParams` serializes arrays that way). The shared `tagsParam` preprocess drops empty values (the client sends `tags=` when nothing is selected → no filter), dedupes, then requires UUIDs, max `MAX_TAGS` (50). A non-UUID value is a 400, never "no filter".
- Filtering is in Postgres with **AND semantics**: `pokemon.id IN (SELECT pokemon_id FROM pokemon_tags WHERE tag_id IN (...) GROUP BY pokemon_id HAVING count(DISTINCT tag_id) = <n distinct>)`. With no tags the condition is omitted (never an empty `IN ()`).
- Rows come from one `db.query.pokemonSchema.findMany` (Drizzle builds the tag join as a lateral `json_agg`, no N+1) with `ORDER BY created_at, id` + `LIMIT/OFFSET`; `total` from `db.$count` with the **same** `where`. Both run in parallel.
- DB errors → logged, generic 500 body. Tests: `tests/integration/listPokemonFilter.test.ts`, `tests/unit/listRequestTags.test.ts`, `tests/unit/listRouteErrors.test.ts`.

`paginationRequest` / `paginationResponse` / `MIN_PAGE_SIZE` / `MAX_PAGE_SIZE` in `shared/api/schema/pagination/` are unused scaffolding; only `infiniteRequest` / `infiniteResponse` are wired up.

Image URLs are **not** returned by the API. `page.tsx` derives them from `name`: `/uploads/pokemon/images/{name}.webp` and `/uploads/pokemon/thumbnails/{name}.thumbnail.webp` (blur-up placeholder consumed by `ui/Img.tsx`).

### Data fetching

`usePokemonBank({ limit, tags: string[] })` wraps `useSWRInfinite`; the `page` field `page.tsx` passes in is ignored — SWR's `pageIndex` is the page. End-of-list is detected in `getKey` (returns `null` once the previous page had fewer than `limit` items); `revalidateFirstPage` is off.

**Feed reset is indirect.** Any sidebar change, including tag selection, calls `setSize(0)`. That empties the list, which makes the slider's `endIndex >= itemsCount - 1` check true immediately, which fires `onLastItemShowed`, which calls `setSize(s => s + 1)` and refetches page 0 with the new key. If you change the slider's end-of-list logic, make sure this path still works.

### Infinite scroll + virtualization (hand-rolled)

- `src/client/lib/virtualized-list/useVirtualizedList.ts` — fixed-size windowing. The visible range lives in a `useRef`; a forced rerender (`useReducer` bump) fires **only** when `endIndex` crosses an overscan-derived threshold, or when `itemSize` / `totalSize` change — not on every scroll event. `itemSize` passed in must already include any gap (`InstagramSlider` passes `itemSize + slideGap`). The hook also attaches a `resize` listener to the scroll element, but element `resize` events never fire, so container size changes are only picked up on the next scroll.
- `components/instagram-slider/InstagramSlider.tsx` — the renderer: a spacer `div` of `totalSize` height, an inner `div` translated by `startIndex * itemSize`, only the virtual items mounted. Calls `onLastItemShowed` from an effect when `endIndex >= itemsCount - 1`, which bumps the SWR page count. Optional CSS scroll-snap (`snap-y snap-mandatory`) and full-screen (`h-dvh`) modes; non-fullscreen height is `itemSize + 2 * containerPaddingY`.
- `components/instagram-Infinite-scroll/InstagramInfiniteScrollSlider.tsx` — alternative non-virtualized implementation (IntersectionObserver on the last item, every item mounted). Kept for comparison; not imported anywhere.
- `components/layout/Sidebar.tsx` is a live tuning panel for the slider props (item width/height, gap, container padding, overscan, snap, fullscreen) plus the tag checkbox list (`ui/CheckboxGroup.tsx`, emits sorted ids so the same set gives the same SWR key; `[]` clears the filter). Numeric inputs only propagate values `> 0` (overscan `>= 2`) and `page.tsx` only merges truthy values, so gap/padding can't be set to 0 from the UI.

### Database: Drizzle ORM 0.45 (classic relational-query API)

`drizzle-orm@^0.45` + `drizzle-kit@^0.31`. This is the **v0.x API**, not the 1.0 / RQB v2 API (moving to 1.0 is a separate migration: `defineRelations`, RQB v2):

- Relations are declared per table with `relations(table, ({ one, many }) => ({ ... }))` in `src/server/db/relations/` and spread into the `schema` object passed to `drizzle(url, { schema: { ...schema, ...relations } })` in `connection/db.ts`. There is no `defineRelations`.
- The relational-query accessor is keyed by the **exported variable name**, not the SQL table name: `db.query.pokemonSchema`, `db.query.tagsSchema`, `db.query.pokemonTagsSchema`.
- Many-to-many goes through the join-table relation: `with: { tags: { with: { tag: true } } }`, flattened by the caller. There is no direct many-to-many relation.
- `connection/db.ts` also exports `dbClear` (a second instance with no schema); nothing uses it.
- `drizzle.config.ts` sets `out: ./src/server/db/generated`, but that directory does not exist — schema changes reach the DB only through `drizzle-kit push` (via `npm run init`).

Tables: `pokemon` (uuid pk, `name`, `width`, `height`, nullable `alt`, `created_at`, nullable `info_id` FK → `pokemon_info`, set null), `tags` (unique `name`), `pokemon_tags` (composite PK, cascade deletes), `pokemon_info` (data from an external service, unique `(source_id, external_id)`; `source_id` codes are `INFO_SOURCES` in `src/server/pokemon-info/sources.ts`, `0` = PokeAPI; filled by `npm run pokemon:info`, see `docs/pokemon-info.md`), `ability` (unique `(source_id, external_id)` and `(source_id, name)`; filled by `npm run ability:info`, see `docs/abilities.md`). There is no ability join table: `pokemon_info.abilities text[]` holds ability names in slot order, and `(source_id, name)` is the link key into `ability` (no FK, no Drizzle relation); `GET /api/pokemon/abilities` returns them all keyed by `name`. `generated_pokemon` holds generator output (same stat columns as `pokemon_info` plus class/stage/archetype/seed/model_version/request jsonb; self-FK `parent_id` → previous stage or mega base, set null; not truncated by `npm run init`). One schema file per table in `src/server/db/schema/`, re-exported from the barrel.

### Pokemon generator (`src/server/pokemon-model/`)

- `fit.ts` is a pure fit over `pokemon_info` rows; `npm run pokemon:model` writes the result to `model.json`, which is **committed** and imported by `loadModel()`. The generator never touches the DB.
- `tests/unit/pokemonModelFit.test.ts` refits from `tests/fixtures/pokemon-info.json` and expects exactly the committed `model.json`. After refitting from new data, regenerate that fixture too. Bump `MODEL_VERSION` in `schema.ts` when the format changes.
- Generation is deterministic: all randomness goes through `createRng(seed)` (`random.ts`); no `Math.random`/`Date` in `generate.ts`. Preview and save with the same seed must give the same pokemon (integration test relies on it).
- Every result is checked by `validate.ts`; a failure throws `GenerationError` (a generator bug → 500), while request contradictions throw `GenerateRequestError` with `violations` (→ 400). Keep the generator's noise truncation tighter than the validator bands.
- Hand-written rules (not fitted) live in `compensation.ts`: budget-bending abilities (huge-power, wonder-guard, truant…) and form-mechanic abilities never picked at random.
- `/generate` page: all budget logic is the pure reducer `src/client/lib/pokemon-generator/generatorState.ts` (sliders spend a BST budget, raising is blocked at 0 remaining; compensation rules from `GET /model` narrow/lock sliders). Its limits must agree with `validate.ts`: `tests/unit/generatorState.test.ts` fuzzes editing sessions against `buildCustomPokemon`.
- `generateMegaForm` builds the result field by field: a base read from the DB carries `id`/`parentId`, and spreading it once made the insert reuse the base's primary key.

### Character generator (`src/server/character-model/`)

- Stats come from the pokemon model; pokemon types and abilities are not used. The pure `buildCharacterModel(loadModel())` derives budgets and growth (no second `model.json`): a 5★ character at level 80 is a `stage3of3` pokemon, level 1 its first stage (×1.75). Rarity 1-5★ scales the level-80 budget FEH-style; constants are hand-set in `model.ts`.
- Weapon/movement skills, ranks E-S and the Fire Emblem: Fortune's Weave class catalog are constants in `src/shared/character/` (`skills.ts`, `classes.ts`), shared by server and client. Ranks grow with the level by aptitude (talent/normal/weak); a class is open when the level reaches its tier (1/5/20/35/45/60) and the ranks meet its `all` + one-of-`any` requirements. The class adds a flat stat bonus.
- Stored: own stats at level 1 and 80, aptitudes, current level and class (`generated_character`). `stats` (level + class bonus) and `ranks` are derived (`derivedOf`) and checked by the validator. Divine classes are unique across characters via a partial unique index (409).
- The generator reuses pokemon generator steps exported from `pokemon-model/generate.ts` with an empty type list (`combineByTypes([])` is 0); changing those steps changes characters too.
- API `/api/character/generated` mirrors `/api/pokemon/generated` (modes `single` and `custom`) plus `PATCH [id]` for level up / reclass. The `/characters` page reuses the `/generate` budget reducer through `toGeneratorModel` (one "class" per rarity) and adds skills, level and class on top (`characterState.ts`). Docs: `docs/character-model.md`.

### Game (`src/client/game/`, docs: `docs/game.md`)

- A FEH-like tactics game (cats, dogs, mice; Phaser battle and village scenes, React screens, nanostores, hash routes like `/game#/village`). `src/app/game/GameClient.tsx` loads `@game/GameRoot` with `next/dynamic` + `ssr: false` because the game reads `window`/`localStorage`/`location.hash` at import time. Save = `localStorage` key `pawfield:save:local`, schema v6 (zod in `core/save`); v4 and v5 migrate, v1-v3 saves are rejected.
- Units are character-model characters: `generateUnit` calls `generateCharacter` from `src/server/character-model/` **in the browser** (it is pure; `model.json` ships in the `/game` bundle), so keep that generator free of Node-only imports. The unit stores `rarity`, `aptitudes`, `baseStats`/`maxStats` (model scale), FW `classId`, `weaponSkill` (a model `WEAPON_SKILLS` value — there is no separate game weapon type) and an optional talisman `accessory`; cats/dogs flavour (species, breed, name, trait, appearance) stays.
- Weapons are inventory items, not SP skills: any unit can wield any weapon (`equipWeapon` sets `weaponSkill` to the weapon's skill), the skill's rank adds Mt and below the weapon's `requiredRank` it loses `COMBAT.rankShortMt` per step. New units start with a free Wooden weapon (`<skill>_wood`); `<skill>_basic` is Iron. Grade labels come from the model (`WEAPON_GRADE_LABELS`). Reclass keeps the weapon.
- Combat still uses 5 FEH stats: `combatStats` maps model stats in the class through `MODEL_SCALE` (`content/balance.ts`); Atk = Str or Mag by weapon, Mt adds `floor(rank index / 3)`. Weapon combat rules (triangle colour, range, Mt, variants) are keyed by the model weapon skill in `content/weapons.ts`.
- **All names come from the model** (`src/shared/character`): class names (`CharacterClass.name`), weapons/skills (`SKILL_LABELS`, variants like "Brave Sword"), tiers (`TIER_LABELS`), ranks, movement (`mountOf ?? movementOf`, like `/characters`), stat labels (`CHARACTER_STAT_LABELS`; combat Atk is labelled Str or Mag). `MoveType` = model `Movement`. Don't add game-side name dictionaries; if a label is missing, add it to the model. Only the art keeps animal props: `ART_WEAPON` (`art/index.ts`) maps a weapon skill to a drawing / attack-fx id. Dancer gets the `as_dance` assist.
- Loop: main menu («Продолжить» only when `profile.startedAt` is set; «Новая игра» = `newGame`, keeps settings) → village hub `#/village` (free-roam hero, three NPCs: Казарма `#/army` with roster, squad and the `shelter` recruit window; Лавка `#/store` with weapon / consumable / talisman tabs from `generateStore`; Вылазки `#/battle/setup`) → `scoutBattle` (map + enemies from `rosterLevel`, seed pinned in `pendingBattle`) → squad of up to 4 + pack of up to `ITEMS.packSize` consumables (`setPackAction`, taken from `inventory` on `startBattle`) → enemies drop treats (`lootFor`) → `finishBattle`: victory keeps all loot + map bonus, defeat `REWARDS.defeatLootShare`, retreat `REWARDS.retreatLootShare` (`lootShare`); leftover pack returns, store and shelter refresh, `rewardChoice` (pick 1 of 3 free); back to the village.
- Village: map data `content/village.ts`, movement/collision/A* pure in `core/village`, Phaser scene `scene/village/` (own lazy chunk, weather in an overlay scene), hero art `art/hero.ts`, village art `art/village.ts`, React state `state/village.ts` (`npcAlerts`, open dialog pauses the scene). `svgToImage` replaces any width/height on the SVG root.
- Reclass (`reclassUnit`, `reclassAction`) only into classes open at the unit's level; one divine class per army. Enemies come from `loadoutsAt(level)` (class + weapon pairs the model can generate at that level).
- Game CSS (`ui/styles.css`, `ui/battle.css`, `ui/village.css`) is plain global CSS scoped under the `.pawfield` root class — Next does not unload global CSS between routes, so never add bare `:root`/`body`/element selectors there. `max-len` is off for `src/client/game/art/**` (SVG markup in template literals).
- Tests: `tests/unit/game/` (`helpers.ts` builds units from keys like `infantry_sword` / `armored_spear` / `dancer_sword` and pins combat stats by inverting `MODEL_SCALE`).

## Conventions and gotchas

- **Tailwind v4 with `--spacing: 1px`** (`src/app/style/style.css`). Spacing utilities are pixel-literal: `px-5` = 5px, `gap-12` = 12px, `w-30` = 30px. Do not assume the default 0.25rem scale.
- Merge classes through `twMerge` from `@lib/tailwind-merge` (an `extendTailwindMerge` wrapper), not from `tailwind-merge` directly. (`ui/Toggle.tsx` is the one existing exception; don't add more.)
- Style is enforced by ESLint `@stylistic`: double quotes, no semicolons, no trailing commas, max line length 130. Run `npm run lint+fix` before finishing.
- `eslint-config-next` 16 ships `eslint-plugin-react-hooks` 7 with React Compiler rules, e.g. `react-hooks/refs` (no `ref.current` reads during render). `useVirtualizedList` therefore keeps a working copy in a ref (read by scroll handlers) and a state snapshot for render, replaced only when the threshold is crossed. Keep that split rather than disabling the rule.
- `@next/next/no-img-element` is disabled on purpose — the feed uses a plain `<img loading="lazy">` inside `ui/Img.tsx` (blur-up thumbnail, fade-in, error fallback) rather than `next/image`.
- Components are wrapped in `memo(function Name() { ... })` and every callback handed to the slider is `useCallback`-stable. Keep it that way; the list is rerender-sensitive.
- `public/assets/pokeball.webp` is the spinner background used by `ui/Loader.tsx`; everything else under `public/` is the sprite set.
