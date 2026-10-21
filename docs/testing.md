# Тесты

Vitest 5, конфигурация в `vitest.config.mts`. Два проекта:

| Проект | Файлы | Окружение | Нужна БД |
| --- | --- | --- | --- |
| `unit` | `tests/unit/**/*.test.{ts,tsx}` | `node`; DOM-тесты включают jsdom комментарием `// @vitest-environment jsdom` | нет |
| `integration` | `tests/integration/**/*.test.ts` | `node` | да |

```bash
npm test                    # всё
npm run test:unit
npm run test:integration    # нужен docker compose up -d
npm run test:watch
npx vitest run tests/unit/urlWithParams.test.ts
```

## Что покрыто

**Unit:**

- `listSchema.test.ts` — схема запроса (приведение `page`/`limit` из строк) и схема ответа (обязательные поля, `total`);
- `listRequestTags.test.ts` — разбор `tags`: пустые значения, дубликаты, UUID, лимит `MAX_TAGS`;
- `listRouteErrors.test.ts` — при ошибке БД route handler отдаёт общий 500 без деталей драйвера;
- `urlWithParams.test.ts` — сериализация URL: скаляры, массивы повторяющимися ключами, пустой массив без ключа;
- `usePokemonBank.test.ts` — теги в URL запроса и их отсутствие при пустом выборе;
- `useVirtualizedList.test.ts` — начальное окно, позиции элементов, отсутствие ререндера ниже порога, сдвиг окна, конец списка, рост `totalSize`;
- `Sidebar.test.tsx` — чекбоксы тегов: сортировка выбранных id, пустой выбор, начальное состояние.

**Integration:**

- `listRoute.test.ts` — smoke-тест `GET /api/pokemon/list`: страница с развёрнутыми тегами, 400 на невалидную пагинацию;
- `listPokemonFilter.test.ts` — фильтр по тегам (семантика И, дубликаты, отсутствие дублей строк), пагинация с фильтром и без, соответствие ответа схеме, 400 на не-UUID, совпадение `listPokemon()` с ответом маршрута.

Route handler'ы тестируются прямым вызовом экспортированной функции `GET` с `NextRequest`.

## Тестовая база данных

Интеграционные тесты работают с **отдельной базой** `TEST_DATABASE_URL` (по умолчанию `postgres://postgres:postgres@localhost:5432/instapoke_test`) и никогда не трогают dev-базу из `.env`.

- `vitest.config.mts` подставляет `TEST_DATABASE_URL` в `DATABASE_URL` до импорта `@db`; dotenv уже заданные переменные не перезаписывает.
- `globalSetup.ts` создаёт базу из `template0`, если её нет, и выполняет `drizzle-kit push --force`. Если Postgres недоступен, тесты падают с подсказкой `docker compose up -d`.
- Каждая точка входа (`globalSetup`, `setup`, фикстуры) проверяет, что имя базы оканчивается на `_test`, и отказывается работать с любой другой.
- Файлы выполняются последовательно (`fileParallelism: false`): база общая.
- `setup.ts` закрывает пул соединений после тестов.

## Фикстуры

Используйте `seed()` из `tests/integration/utils/fixtures.ts`:

```ts
await seed({
  tags: ["shiny", "legendary"],
  pokemon: [
    { name: "1" },
    { name: "1.shiny", tags: ["shiny"] }
  ]
})
```

`seed()` очищает таблицы и вставляет теги и покемонов **по одному**, так что `created_at` повторяет порядок массива — как в настоящем скрипте заполнения. `src/server/scripts/init.ts` в тестах не используйте.

## Проверка типов

`next build` проверяет типы и в `tests/` (корневой `tsconfig.json` включает `**/*.ts`), поэтому ошибка типов в тесте ломает сборку.
