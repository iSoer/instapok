# API

Три route handler'а в `src/app/api/pokemon/`. Контракт описан Zod-схемами в `src/shared/api/schema/` (см. [Архитектура](architecture.md#единый-источник-правды-для-контракта)).

## `GET /api/pokemon/list`

Страница ленты с необязательным фильтром по тегам.

### Параметры запроса

| Параметр | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| `page` | целое `>= 0` | да | Номер страницы, **с нуля**. |
| `limit` | целое `>= 1` | да | Размер страницы. Клиент передаёт 20; верхней границы схема не задаёт. |
| `tags` | UUID, повторяемый ключ | нет | `?tags=<uuid>&tags=<uuid>`. Не больше `MAX_TAGS` (50) различных значений. |

Параметры приходят строками, поэтому `page` и `limit` разбираются через `z.coerce.number()`.

Обработка `tags` (`tagsParam` в `src/shared/api/schema/pokemon/list.ts`):

1. значения читаются через `searchParams.getAll("tags")`;
2. пустые строки отбрасываются: `?tags=` означает «без фильтра». Клиент при пустом выборе ключ `tags` не отправляет вовсе;
3. дубликаты удаляются;
4. каждое оставшееся значение обязано быть UUID. Значение не-UUID — это ошибка 400, а **не** «без фильтра».

### Семантика фильтра

Фильтр работает по **И**: в выдачу попадают покемоны, у которых есть **все** выбранные теги (лишние теги не мешают). Фильтрация выполняется в PostgreSQL:

```sql
pokemon.id IN (
  SELECT pokemon_id FROM pokemon_tags
  WHERE tag_id IN (...)
  GROUP BY pokemon_id
  HAVING count(DISTINCT tag_id) = <число различных тегов>
)
```

Без тегов условие не добавляется вовсе — пустой `IN ()` в запрос не попадает.

Строки сортируются по `created_at, id` (порядок заполнения базы; `id` делает порядок однозначным, поэтому страницы не пересекаются), затем применяются `LIMIT`/`OFFSET = page * limit`. Теги подтягиваются одним запросом (Drizzle строит lateral `json_agg`, без N+1). `total` считается отдельным `count` с тем же `where`; оба запроса выполняются параллельно.

### Ответ 200

```json
{
  "data": [
    {
      "id": "0b6c…",
      "name": "25.shiny",
      "width": 96,
      "height": 96,
      "alt": "25",
      "tags": [{ "id": "6f1e…", "name": "shiny" }]
    }
  ],
  "pagination": {
    "count": 20,
    "total": 2955
  }
}
```

- `count` — число элементов в этой странице;
- `total` — число всех элементов, подходящих под фильтр.

URL картинок API не возвращает: клиент вычисляет их по `name` (см. [Лента](feed.md#картинки)).

### Ошибки

| Статус | Когда | Тело |
| --- | --- | --- |
| 400 | Невалидные query-параметры | `{ "error": "Invalid query parameters", "details": <z.flattenError> }` |
| 500 | Ответ не прошёл собственную валидацию | `{ "error": "Internal Server Error: Invalid response format", "details": … }` |
| 500 | Ошибка БД (подробности только в серверном логе) | `{ "error": "Error when collecting pokemon" }` |

### Примеры

```bash
curl 'localhost:3000/api/pokemon/list?page=0&limit=20'
curl 'localhost:3000/api/pokemon/list?page=2&limit=20&tags=<uuid>'
curl 'localhost:3000/api/pokemon/list?page=0&limit=20&tags=not-a-uuid'   # 400
```

## `GET /api/pokemon/tags`

Все теги, без пагинации.

```json
{ "data": [{ "id": "6f1e…", "name": "shiny" }] }
```

Обычный `db.select()` без валидации ответа. При ошибке БД — 500 `{ "error": "Error when collecting tags" }`.

## `GET /api/pokemon/abilities`

Все загруженные способности покемонов одним списком, без пагинации и параметров. Отсортированы по `sourceId`, затем по `name`. Схема — `abilitiesResponseSchema` в `src/shared/api/schema/pokemon/abilities.ts`; ответ валидируется перед отправкой, как в `list`.

```json
{
  "data": [
    {
      "name": "static",
      "sourceId": 0,
      "externalId": 9,
      "displayName": "Static",
      "effect": "Whenever a move makes contact with this Pokémon, …",
      "shortEffect": "Has a 30% chance of paralyzing attacking Pokémon on contact.",
      "flavorText": "The Pokémon is charged with static electricity …",
      "generation": "generation-iii",
      "isMainSeries": true
    }
  ]
}
```

- `name` — ключ: те же строки, что лежат в `pokemon_info.abilities`. Уникален внутри источника, поэтому способность покемона ищется по паре `(sourceId, name)`.
- `sourceId` — источник, `0` — PokeAPI.
- `externalId` — ID способности в источнике, справочно. UUID строки таблицы наружу не отдаётся.
- `displayName`, `effect`, `shortEffect`, `flavorText` — английские тексты, могут быть `null`.

Список содержит только то, что загружено в таблицу `ability` (`npm run ability:info`, см. [Способности](abilities.md)). Пустая таблица — `{ "data": [] }`.

| Статус | Когда | Тело |
| --- | --- | --- |
| 500 | Ответ не прошёл собственную валидацию | `{ "error": "Internal Server Error: Invalid response format", "details": … }` |
| 500 | Ошибка БД (подробности только в серверном логе) | `{ "error": "Error when collecting abilities" }` |

```bash
curl 'localhost:3000/api/pokemon/abilities'
```

## Клиентская сторона

- `src/shared/api/fetcher.ts` — `fetchFn`, тонкая обёртка над `fetch`: выбрасывает ошибку при `!response.ok` и возвращает разобранный JSON.
- `src/client/api/helpers/urlWithParams.ts` — собирает URL; массивы сериализуются повторяющимися ключами (`tags=a&tags=b`), пустой массив — отсутствием ключа.
- `src/client/api/hooks/usePokemonBank.ts` — `useSWRInfinite` для ленты (см. [Лента](feed.md#загрузка-данных)).
- `src/client/api/hooks/usePokemonTags.ts` — `useSWR` для списка тегов.
- `src/client/api/hooks/usePokemonAbilities.ts` — `useSWR` для списка способностей. Сейчас нигде не используется: лента пока не отдаёт способности покемонов.

## Неиспользуемый код

`paginationRequest`, `paginationResponse`, `MIN_PAGE_SIZE` и `MAX_PAGE_SIZE` в `src/shared/api/schema/pagination/` — заготовка под классическую постраничную навигацию, сейчас нигде не используется. Подключены только `infiniteRequest` и `infiniteResponse`.
