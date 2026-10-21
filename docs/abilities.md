# Способности покемонов

Справочник способностей хранится в таблице `ability`. Покемон ссылается на свои способности массивом имён `pokemon_info.abilities`: имя способности уникально в пределах источника и служит ключом связи. Отдельной таблицы связей нет. Данные приходят из PokeAPI (`GET https://pokeapi.co/api/v2/ability/{id или name}/`) и загружаются очередью `npm run ability:info`, устроенной так же, как [очередь покемонов](pokemon-info.md). Отдать клиенту все способности разом можно через [`GET /api/pokemon/abilities`](api.md#get-apipokemonabilities).

## Быстрый старт

```bash
npm run pokemon:info -- --missing     # сначала покемоны: из них берётся список способностей
npm run ability:info -- --missing     # затем все способности, которых ещё нет в таблице
```

Порядок загрузки на данные не влияет: имена способностей приходят прямо в ответе о покемоне, так что покемона можно сохранить раньше, чем его способности. Но `--all` / `--missing` берут список из `pokemon_info.abilities`, поэтому без загруженных покемонов им нечего обрабатывать.

## Аргументы

| Аргументы | Что делает |
| --- | --- |
| `static lightning-rod 9` | Загружает перечисленные способности по имени или ID PokeAPI |
| `--all` | Все способности из `pokemon_info.abilities` (повторно загружает и уже сохранённые) |
| `--missing` | Только способности, которых ещё нет в `ability` |
| `--concurrency=N` | Сколько запросов идёт параллельно, по умолчанию `4` |

Вывод, код возврата, `Ctrl+C` и повторы при ошибках такие же, как у `pokemon:info` (см. [Данные из PokeAPI](pokemon-info.md#повторы-и-ошибки)). Несуществующая способность сразу попадает в ошибки:

```text
[1/2] static saved
[2/2] no-such-ability failed: PokeAPI has no ability "no-such-ability"
Done: 1 saved, 1 failed
Failed: no-such-ability
```

## Таблица `ability`

Одна строка на способность в каждом источнике. Уникальность — `(source_id, external_id)` и `(source_id, name)`. Повторная загрузка обновляет строку.

| Колонка | Тип | Поле PokeAPI |
| --- | --- | --- |
| `id` | `uuid` | PK, наружу не отдаётся |
| `source_id` | `integer` | Источник, коды из `INFO_SOURCES` (`0` — PokeAPI), как в `pokemon_info` |
| `external_id` | `integer` | `id` (`9`) |
| `name` | `text` | `name` (`static`) — ключ связи: значение, которое лежит в `pokemon_info.abilities` |
| `display_name` | `text`, nullable | `names[]` на английском (`Static`) |
| `effect` | `text`, nullable | `effect_entries[].effect` на английском — полное описание |
| `short_effect` | `text`, nullable | `effect_entries[].short_effect` на английском |
| `flavor_text` | `text`, nullable | Последняя по версии игры запись `flavor_text_entries[]` на английском |
| `generation` | `text` | `generation.name` (`generation-iii`) |
| `is_main_series` | `boolean` | `is_main_series` |
| `fetched_at` | `timestamptz` | Время последней успешной загрузки |

Тексты сохраняются только на английском, переносы строк схлопываются в пробелы. Русского языка в PokeAPI для способностей нет. У способностей не из основной серии игр (`is_main_series = false`) английских текстов часто нет — тогда колонки `NULL`.

## Связь с покемонами: `pokemon_info.abilities`

`abilities text[]` — имена способностей покемона (`abilities[].ability.name` из PokeAPI) в порядке слотов. Скрытая способность, если есть, идёт последней. Способность находится по паре `(pokemon_info.source_id, имя)` = `(ability.source_id, ability.name)`; эта пара уникальна (`ability_source_name_unique`).

У Пикачу `abilities = {static, lightning-rod}`.

Ограничения такого хранения:

- внешнего ключа у массива нет: имя может указывать на способность, которая ещё не загружена (её покажет `npm run ability:info -- --missing`);
- если источник когда-нибудь переименует способность, старое имя в `pokemon_info` перестанет находиться до повторной загрузки покемона;
- связи в Drizzle тоже нет, `with: { abilities: … }` не работает — способности подбираются отдельным запросом или на клиенте.

## Запросы

На клиенте: загрузить справочник один раз через `usePokemonAbilities()` (`GET /api/pokemon/abilities`) и сопоставлять по `name`:

```ts
const { data } = usePokemonAbilities()
const byName = new Map(data?.data.map(ability => [ability.name, ability]))

const abilities = info.abilities.map(name => byName.get(name))   // undefined — если ещё не загружена
```

На сервере, способности одного покемона по порядку:

```ts
import { and, eq, inArray } from "drizzle-orm"
import { abilitySchema, db } from "@db"

const rows = await db.select().from(abilitySchema).where(and(
  eq(abilitySchema.sourceId, info.sourceId),
  inArray(abilitySchema.name, info.abilities)
))
const abilities = info.abilities.map(name => rows.find(row => row.name === name))
```

В SQL с сохранением порядка:

```sql
select i.name, a.name as ability, x.position
from pokemon_info i
cross join lateral unnest(i.abilities) with ordinality as x(name, position)
join ability a on a.source_id = i.source_id and a.name = x.name
where i.external_id = 25
order by x.position;
```

## Устройство

| Файл | Роль |
| --- | --- |
| `src/server/scripts/fetchAbilityInfo.ts` | CLI `npm run ability:info` |
| `src/server/scripts/utils/runQueueCli.ts` | Общие для обоих CLI разбор флагов, прогресс, `Ctrl+C`, итог |
| `src/server/pokemon-info/abilityQueue.ts` | Очередь способностей поверх `createQueue` |
| `src/server/pokemon-info/pokeapi.ts` | `fetchAbilityInfo`: запрос, Zod-проверка, выбор английских текстов |
| `src/server/pokemon-info/sources.ts` | Тип `AbilityInfo`, поле `abilities` в `PokemonInfo` |
| `src/server/db/schema/abilitySchema.ts` | Таблица `ability` |
| `src/server/db/queries/saveAbility.ts` | `saveAbility` (upsert), `listAbilityNames` для `--all` / `--missing` |
| `src/server/db/queries/listAbilities.ts` | Список для `GET /api/pokemon/abilities` |
| `src/app/api/pokemon/abilities/route.ts` | Route handler |
| `src/shared/api/schema/pokemon/abilities.ts` | Zod-схема ответа и типы |
| `src/client/api/hooks/usePokemonAbilities.ts` | SWR-хук |

Тесты: `tests/unit/pokeapi.test.ts` (`fetchAbilityInfo`), `tests/unit/abilitiesRouteErrors.test.ts`, `tests/integration/abilities.test.ts`.
