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

## Сгенерированные покемоны: `/api/pokemon/generated`

Генератор новых покемонов по [модели](pokemon-model.md). Контракт — Zod-схемы в `src/shared/api/schema/pokemon/generated.ts`. Как и в остальных роутах, запрос проверяется `safeParse` (400 с `details`), собственный ответ валидируется перед отправкой (500), ошибки БД уходят только в серверный лог.

### `POST /api/pokemon/generated/preview` и `POST /api/pokemon/generated`

Тело одинаковое. `preview` только генерирует, второй маршрут генерирует и сохраняет. При одном и том же `seed` результат совпадает, поэтому показанный предпросмотр можно сохранить без изменений.

```json
{ "mode": "single", "request": { "types": ["fire"], "class": "stage", "stage": { "index": 3, "of": 3 } }, "seed": 42 }
```

| `mode` | Остальные поля | Результат |
| --- | --- | --- |
| `single` (по умолчанию) | `request: GenerateRequest` (по умолчанию `{}`) | Один покемон |
| `line` | `request: { length: 2 \| 3, types?, archetype?, abilities? }` | Цепочка эволюции; при сохранении у каждой стадии `parentId` указывает на предыдущую |
| `mega` | `baseId` — id сохранённого покемона | Mega-форма; `parentId` = `baseId` |
| `custom` | `pokemon: { class, stage?, types, abilities, stats, name?, archetype? }` | Покемон со статами, распределёнными вручную (страница `/generate`). Статы сохраняются как есть; рост, вес, опыт, архетип (ближайший к статам) и имя добавляет модель. Неправдоподобные статы — 400 с `violations` от валидатора |

Поля `GenerateRequest` (все необязательные): `class` (`stage` / `single` / `semiLegendary` / `pseudoLegendary` / `legendary`), `stage` (`{ index, of }`, только при `class: "stage"`), `types` (1–2 из 18), `archetype` (`physical` / `special` / `tank` / `fast` / `hpWall` / `balanced`), `bst` (175–720), `abilities` (1–3 имени из `ability`), `name` (`[a-z0-9-]`, до 40 символов). `seed` — целое 0…2³²−1; без него сервер выбирает случайный и возвращает его в каждом покемоне.

Ответ — `{ "data": [покемон, …] }`, `200` у предпросмотра и `201` у сохранения:

```json
{
  "data": [{
    "id": "…", "parentId": null,
    "name": "drionan", "types": ["grass"], "abilities": ["overgrow"],
    "heightDm": 33, "weightHg": 5184, "baseExperience": 223,
    "stats": { "hp": 60, "attack": 55, "defense": 95, "specialAttack": 70, "specialDefense": 80, "speed": 135 },
    "class": "stage", "stage": { "index": 3, "of": 3 }, "archetype": "fast", "form": null,
    "seed": 42, "modelVersion": 1, "input": { "mode": "single", "request": {} },
    "explain": ["class stage 3/3", "bst 495: class stage 3/3, type grass -6", "…"]
  }]
}
```

`id` и `parentId` есть только у сохранённых. `input` — то, из чего покемон сгенерирован, хранится в колонке `request`. `explain` — решения генератора; он возвращается при генерации, но в БД не хранится.

| Статус | Когда | Тело |
| --- | --- | --- |
| 400 | Тело не JSON или не проходит схему | `{ "error": "Invalid request body", "details": … }` |
| 400 | Противоречивый запрос (`class: "legendary"` и `bst: 300`, неизвестная способность, BST в запрещённом окне, mega от первой стадии) | `{ "error": "Invalid generation request", "violations": [...] }` |
| 404 | `mode: "mega"` с несуществующим `baseId` | `{ "error": "Base pokemon not found" }` |
| 409 | Имя уже занято сгенерированным покемоном или есть в `pokemon_info.name` | `{ "error": "Pokemon name already taken", "names": [...] }` |
| 500 | Ошибка БД или генератор забраковал собственный результат | `{ "error": "Error when trying to …" }` |

```bash
curl -X POST localhost:3000/api/pokemon/generated/preview -H 'content-type: application/json' \
  -d '{"mode":"line","request":{"length":3,"types":["dragon"]},"seed":7}'
```

### `GET /api/pokemon/generated`

Сохранённые покемоны, от старых к новым (`created_at, id`); `order=desc` — от новых к старым. Пагинация как у ленты: `page` (с 0) и `limit` обязательны. `types` — повторяющиеся ключи с семантикой И (`?types=fire&types=flying` — только fire/flying), пустые значения отбрасываются, максимум два типа. `class` — один из классов. Ответ: `{ "data": [...], "pagination": { "count", "total" } }`, `total` считается с тем же фильтром. Неизвестный тип или класс — 400.

### `GET /api/pokemon/generated/model`

Часть модели, по которой страница `/generate` строит ограничения: `classes` (ярус BST, диапазон стата, распределение числа способностей), `forbiddenBst`, `profileMean`, сдвиги профиля по `types`, `abilities` (носители по типам, сдвиг профиля, `universal`, `formOnly`) и `compensation` — правила сильных способностей (`maxShare`, `fixedStats`, `equalStats`, `bstFactor`, `statMultiplier`). Схема `generatorModelResponseSchema`, около 60 КБ, меняется только с `model.json`.

### `GET` и `DELETE /api/pokemon/generated/[id]`

`GET` — `{ "data": покемон }` или 404. `DELETE` — 204 или 404. Потомки удалённого (следующие стадии, формы) остаются, их `parentId` становится `null`. Не-UUID в `id` даёт 404.

## Сгенерированные персонажи: `/api/character/generated`

Генератор персонажей по [модели персонажа](character-model.md): редкость, уровень, навыки с рангами и классы Fire Emblem: Fortune's Weave. Контракт — `src/shared/api/schema/character/generated.ts`. Маршруты устроены как у покемонов: `safeParse` запроса (400 с `details`), проверка собственного ответа (500), детерминизм по `seed`.

### `POST /api/character/generated/preview` и `POST /api/character/generated`

```json
{ "mode": "single", "request": { "rarity": 4, "class": "bow-knight" }, "seed": 42 }
```

| `mode` | Остальные поля | Результат |
| --- | --- | --- |
| `single` (по умолчанию) | `request` (по умолчанию `{}`): `rarity` (1–5), `archetype`, `budget` (сумма собственных статов на 80-м уровне), `talents` (1–3 навыка), `level` (1–80), `class` (id класса), `name` — всё необязательно | Персонаж от модели. При `class` без `talents` модель сама выбирает нужные таланты, без `level` — первый уровень, на котором класс открыт |
| `custom` | `character: { rarity, talents, weaknesses?, maxStats, level, class, name?, archetype? }` | Персонаж, собранный вручную (страница `/characters`). Модель добавляет статы 1-го уровня, рост, вес, опыт, архетип и имя. Закрытый на этом уровне класс и прочие нарушения — 400 с `violations` |

Навыки: `sword`, `axe`, `spear`, `bow`, `gauntlet`, `whiteMagic`, `blackMagic`, `riding`, `flying`, `heavyArmor`. Ответ — `{ "data": [персонаж] }`, `200` у предпросмотра и `201` у сохранения:

```json
{
  "data": [{
    "id": "…", "name": "drypaen", "rarity": 4,
    "aptitudes": { "sword": "normal", "axe": "normal", "spear": "talent", "bow": "normal", "gauntlet": "normal",
                   "whiteMagic": "weak", "blackMagic": "weak", "riding": "talent", "flying": "normal", "heavyArmor": "normal" },
    "heightDm": 21, "weightHg": 473, "baseExperience": 260,
    "baseStats": { "hp": 49, "attack": 71, "defense": 74, "specialAttack": 23, "specialDefense": 36, "speed": 45 },
    "maxStats": { "hp": 85, "attack": 125, "defense": 130, "specialAttack": 40, "specialDefense": 65, "speed": 75 },
    "level": 60, "class": "the-cavalier",
    "stats": { "hp": 93, "attack": 137, "defense": 130, "specialAttack": 33, "specialDefense": 63, "speed": 76 },
    "ranks": { "sword": "B", "axe": "B", "spear": "S", "bow": "B", "gauntlet": "B",
               "whiteMagic": "D", "blackMagic": "D", "riding": "S", "flying": "B", "heavyArmor": "B" },
    "archetype": "physical", "seed": 1, "modelVersion": 2,
    "input": { "mode": "single", "request": { "class": "the-cavalier" } },
    "explain": ["rarity 4★", "archetype physical", "budget 520: 5★ BST 540 × 0.9651 for 4★",
                "talents Spear, Riding; weak in White Magic, Black Magic", "level 60 (first level the class opens at)", "…"]
  }]
}
```

`stats` (статы на текущем уровне с бонусом класса) и `ranks` (ранги на текущем уровне) вычисляются, в БД не хранятся.

| Статус | Когда | Тело |
| --- | --- | --- |
| 400 | Тело не проходит схему или запрос противоречив (`rarity: 1` и `budget: 540`, класс ниже уровня своего яруса, таланты не открывают класс) | `{ "error": …, "violations": [...] }` или `{ "error": …, "details": … }` |
| 409 | Имя уже занято другим персонажем | `{ "error": "Character name already taken", "names": [...] }` |
| 409 | Divine-класс уже у другого персонажа | `{ "error": "Divine class already held by another character", "class": "the-blade" }` |
| 500 | Ошибка БД или генератор забраковал свой результат | `{ "error": "Error when trying to …" }` |

### `GET /api/character/generated`

Сохранённые персонажи. `page` и `limit` обязательны, `order=asc|desc`, фильтры `rarity` (1–5) и `class` (id). Ответ: `{ "data": [...], "pagination": { "count", "total" } }`.

### `GET /api/character/generated/model`

Редкости (ярус бюджета, диапазон стата, `budgetFactor`, `baseMultiplier`, `growthMultiplier`), `growth`, `profileMean`, `minLevel`, `maxLevel` и уровни ярусов классов (`tiers`). Навыки, ранги и каталог классов — константы `src/shared/character/`, страница импортирует их напрямую.

### `GET`, `PATCH` и `DELETE /api/character/generated/[id]`

`GET` — `{ "data": персонаж, "availableClasses": [id, …] }`: классы, открытые на текущем уровне. `PATCH` с телом `{ "level"?, "class"? }` повышает уровень и/или меняет класс и отвечает в том же виде. Уровень только растёт, класс должен быть открыт на новом уровне (иначе 400), занятый Divine-класс — 409. `DELETE` — 204 или 404. Не-UUID в `id` даёт 404.

## Клиентская сторона

- `src/shared/api/fetcher.ts` — `fetchFn`, тонкая обёртка над `fetch`: выбрасывает ошибку при `!response.ok` и возвращает разобранный JSON.
- `src/client/api/helpers/urlWithParams.ts` — собирает URL; массивы сериализуются повторяющимися ключами (`tags=a&tags=b`), пустой массив — отсутствием ключа.
- `src/client/api/hooks/usePokemonBank.ts` — `useSWRInfinite` для ленты (см. [Лента](feed.md#загрузка-данных)).
- `src/client/api/hooks/usePokemonTags.ts` — `useSWR` для списка тегов.
- `src/client/api/hooks/usePokemonAbilities.ts` — `useSWR` для списка способностей. Сейчас нигде не используется: лента пока не отдаёт способности покемонов.

## Неиспользуемый код

`paginationRequest`, `paginationResponse`, `MIN_PAGE_SIZE` и `MAX_PAGE_SIZE` в `src/shared/api/schema/pagination/` — заготовка под классическую постраничную навигацию, сейчас нигде не используется. Подключены только `infiniteRequest` и `infiniteResponse`.
