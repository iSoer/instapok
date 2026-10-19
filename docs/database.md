# База данных

PostgreSQL 17 (`docker-compose.yml`) и Drizzle ORM **0.45** с `drizzle-kit` 0.31.

## Схема

Каждая таблица описана в своём файле в `src/server/db/schema/`, все реэкспортируются из барреля `src/server/db/index.ts` (алиас `@db`).

### `pokemons`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `name` | `varchar(255)` | Имя файла без расширения: `25`, `25.shiny` |
| `width` | `integer` | Ширина спрайта в px |
| `height` | `integer` | Высота спрайта в px |
| `alt` | `text`, nullable | Номер покемона (числовая часть имени) |
| `created_at` | `timestamptz` | `now()`; задаёт порядок ленты |

### `tags`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `name` | `text` | `UNIQUE` |

### `pokemons_tags`

Связь многие-ко-многим. Составной PK `(pokemon_id, tag_id)`, оба внешних ключа с `ON DELETE CASCADE`.

## Связи и запросы

Используется **классический API v0.x**, не RQB v2 из Drizzle 1.0:

- связи объявлены через `relations(table, ({ one, many }) => …)` в `src/server/db/relations/` и вместе со схемой передаются в `drizzle(url, { schema })` в `connection/db.ts`. `defineRelations` не используется;
- ключ relational-запроса — **имя экспортируемой переменной**, а не имя таблицы в SQL: `db.query.pokemonsSchema`, `db.query.tagsSchema`, `db.query.pokemonsTagsSchema`;
- прямой связи многие-ко-многим нет. Теги загружаются через таблицу связи: `with: { tags: { with: { tag: true } } }`, и вызывающий код разворачивает результат в плоский массив.

Запрос ленты — `src/server/db/queries/listPokemons.ts` (описан в [API](api.md#семантика-фильтра)).

`connection/db.ts` также экспортирует `dbClear` — второй экземпляр без схемы. Сейчас он нигде не используется.

## Миграции

Файлов миграций нет. Схема применяется к базе напрямую через `drizzle-kit push`: его запускают `npm run init` и глобальная подготовка интеграционных тестов. Каталог `out` из `drizzle.config.ts` (`src/server/db/generated`) не создаётся.

## Заполнение данными

`npm run init` (`src/server/scripts/init.ts`) — **деструктивная** операция:

1. `npx drizzle-kit push` — применяет схему;
2. `TRUNCATE` всех трёх таблиц;
3. создаёт единственный тег `shiny`;
4. для каждого `*.webp` в `public/uploads/pokemon/images/` вставляет строку в `pokemons`: размеры читаются через `sharp`, `alt` — числовая часть имени файла. Файлы `N.shiny.webp` получают тег `shiny`.

Строки вставляются по одной в порядке `readdirSync`, поэтому `created_at` повторяет этот порядок — по нему и сортируется лента. Скрипт нужно перезапускать после изменения схемы или набора картинок.

## Подготовка картинок

`src/server/scripts/prepareWebpImages.ts` — одноразовый конвертер (его нет в `package.json`, запуск: `npx tsx src/server/scripts/prepareWebpImages.ts`). Он читает PNG из `src/server/tmp/pokemon{,/shiny}` и пишет webp и превью шириной 10px в `public/assets/pokemon/…`. Приложение же отдаёт картинки из `public/uploads/pokemon/…`, так что после повторной генерации результат нужно перенести туда.
