# Данные покемонов из PokeAPI

Параметры покемонов (типы, способности, рост, вес, базовые характеристики) хранятся в отдельной таблице `pokemon_info`, а спрайты из `pokemon` ссылаются на неё через `info_id`. Данные приходят из публичного [PokeAPI](https://pokeapi.co/docs/v2) (`GET https://pokeapi.co/api/v2/pokemon/{id}/`, ключ не нужен) и записываются очередью `npm run pokemon:info`.

`npm run init` не очищает `pokemon_info`: после пересоздания спрайтов он заново привязывает их к уже скачанным данным (`linkPokemonInfo`), так что повторно ходить в PokeAPI не нужно. Без связанной записи `info_id` равен `NULL`.

## Быстрый старт

```bash
docker compose up -d                  # Postgres должен быть запущен
npm run init                          # если база ещё пустая (удаляет данные!)
npm run pokemon:info -- --missing     # загрузить данные для всех покемонов, у которых их ещё нет
```

Полный проход по ~1280 номерам при параллельности по умолчанию занимает несколько минут.

## Какие покемоны обрабатываются

Скрипт принимает номера PokeAPI. Это та же числовая часть имени файла, что лежит в колонке `alt`: `25.webp` → `25`, `10277.webp` → `10277`. Одного номера достаточно для всех спрайтов этого покемона: обычный, `shiny` и альтернативные формы (`201-a` … `201-z`) ссылаются на одну строку `pokemon_info` покемона `201`.

| Аргументы | Что попадёт в очередь |
| --- | --- |
| `1 4 7` | Перечисленные номера |
| `1-151` | Диапазон включительно; можно смешивать с отдельными номерами: `1-9 25 150-151` |
| `--all` | Все номера, которые есть в таблице `pokemon` (повторно загружает и уже заполненные) |
| `--missing` | Номера, у которых спрайты ещё не привязаны к данным (`pokemon.info_id IS NULL`) |
| `--concurrency=N` | Сколько запросов к PokeAPI идёт параллельно, по умолчанию `4` |

Примеры:

```bash
npm run pokemon:info -- 25                      # один покемон
npm run pokemon:info -- 1-151                   # первое поколение
npm run pokemon:info -- --all --concurrency=8   # обновить всё
```

`--` после `npm run pokemon:info` обязателен: без него npm заберёт флаги себе.

## Вывод и код возврата

Скрипт печатает прогресс по каждому номеру и итог:

```text
[1/3] #0 failed: PokeAPI has no pokemon #0
[2/3] #25 saved
[3/3] #201 saved
Done: 2 saved, 1 failed
Failed ids: 0
```

Если хотя бы один номер не загрузился, код возврата будет `1`, а строка `Failed ids` содержит номера, которые можно передать в повторный запуск.

`Ctrl+C` останавливает очередь: необработанные номера отбрасываются, текущие запросы прерываются. Уже сохранённые данные остаются, так что продолжить можно через `--missing`.

## Повторы и ошибки

| Ситуация | Поведение |
| --- | --- |
| Сетевая ошибка, таймаут (10 с), ответ `429` или `5xx` | До 3 повторов с паузой 0,5 с → 1 с → 2 с |
| `404` (у PokeAPI нет такого номера, например `0`) | Сразу в ошибки, без повторов |
| Другой `4xx` или ответ не прошёл Zod-проверку | Сразу в ошибки, без повторов |
| PokeAPI ответил, но в таблице нет строки с таким `alt` | Сразу в ошибки (`No pokemon row with alt …`) |

Номер, который уже стоит в очереди или обрабатывается, повторно не добавляется.

Очередь хранится в памяти процесса, на диск и в базу её состояние не пишется. Если процесс упал, перезапустите его с `--missing`.

PokeAPI просит не нагружать его без необходимости: не поднимайте `--concurrency` сильно выше значения по умолчанию и не запускайте `--all` без причины, обычно хватает `--missing`.

## Что записывается в таблицу

Одна строка `pokemon_info` на пару (источник, номер), уникальность — `pokemon_info_source_external_unique (source_id, external_id)`. Повторная загрузка того же номера обновляет строку, а не добавляет новую.

| Колонка | Тип | Поле PokeAPI |
| --- | --- | --- |
| `id` | `uuid` | PK; на него ссылается `pokemon.info_id` (`ON DELETE SET NULL`) |
| `source_id` | `integer` | Сервис, из которого скачаны данные (см. ниже) |
| `external_id` | `integer` | `id` — номер покемона в этом сервисе |
| `name` | `text` | `name` (`pikachu`, `terapagos-stellar`) |
| `types` | `text[]` | `types[].type.name` в порядке `slot` |
| `abilities` | `text[]` | `abilities[].ability.name` в порядке `slot`; скрытая способность, если есть, последняя. Это ключ связи с `ability.name` того же источника, см. [Способности](abilities.md) |
| `height_dm` | `integer` | `height`, в дециметрах |
| `weight_hg` | `integer` | `weight`, в гектограммах |
| `base_experience` | `integer`, nullable | `base_experience` (у некоторых форм `null`) |
| `stats` | `jsonb` | `stats[]` → `{ hp, attack, defense, specialAttack, specialDefense, speed }` |
| `fetched_at` | `timestamptz` | Время последней успешной загрузки |

Рост и вес названы с единицами, чтобы не путать их с `width`/`height` в `pokemon` — это размеры спрайта в пикселях.

### Источники (`source_id`)

Коды сервисов заданы константой `INFO_SOURCES` в `src/server/pokemon-info/sources.ts`:

| Код | Сервис |
| --- | --- |
| `0` | PokeAPI (`INFO_SOURCES.pokeapi`) |

Коды хранятся в базе, поэтому существующие менять нельзя — новый сервис получает следующий номер. Сейчас все строки имеют `source_id = 0`.

Проверить результат:

```bash
docker compose exec postgres psql -U postgres -d my_database \
  -c "select p.name, i.source_id, i.name, i.types, i.stats->>'speed' as speed
      from pokemon p join pokemon_info i on i.id = p.info_id where i.external_id = 25"
```

Из кода связь доступна через relational-запрос: `db.query.pokemonSchema.findMany({ with: { info: true } })`; обратная связь — `pokemonInfoRelations.sprites`. API ленты (`GET /api/pokemon/list`) эти данные пока не отдаёт.

## Устройство

| Файл | Роль |
| --- | --- |
| `src/server/scripts/fetchPokemonInfo.ts` | CLI: разбирает аргументы, создаёт очередь, печатает прогресс |
| `src/server/pokemon-info/createQueue.ts` | Универсальная очередь в памяти: лимит параллельности, дедупликация, повторы с растущей паузой, `push` / `drain` / `stop` |
| `src/server/pokemon-info/pokemonInfoQueue.ts` | Очередь номеров: для каждого вызывает загрузку и сохранение |
| `src/server/pokemon-info/sources.ts` | Коды источников `INFO_SOURCES` и общий тип `PokemonInfo` |
| `src/server/pokemon-info/pokeapi.ts` | Клиент PokeAPI: запрос, Zod-проверка ответа, преобразование в `PokemonInfo` с `sourceId: INFO_SOURCES.pokeapi` |
| `src/server/pokemon-info/parseIds.ts` | Разбор `1 4-7` в список номеров |
| `src/server/db/schema/pokemonInfoSchema.ts` | Таблица `pokemon_info` |
| `src/server/db/queries/savePokemonInfo.ts` | `savePokemonInfo` (в транзакции: upsert в `pokemon_info` и привязка спрайтов по `split_part(alt, '-', 1)`), `linkPokemonInfo` для `npm run init`, `listPokemonNumbers` для `--all` / `--missing` |

Ошибка с полем `retryable = false` (`PokeapiPermanentError`, `NoMatchingRowsError`) очередь не повторяет; любую другую повторяет.

Очередь можно использовать и из кода, например в другом скрипте:

```ts
import { createPokemonInfoQueue } from "@/server/pokemon-info/pokemonInfoQueue"

const queue = createPokemonInfoQueue({ concurrency: 2 })

queue.push([1, 2, 3])

const { succeeded, failed } = await queue.drain()
```

В `createPokemonInfoQueue` можно передать свои `fetchInfo` и `saveInfo`: так сделаны тесты, чтобы не ходить в сеть.

Тесты: `tests/unit/createQueue.test.ts`, `tests/unit/pokeapi.test.ts`, `tests/integration/pokemonInfo.test.ts`.
