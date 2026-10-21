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
- `Sidebar.test.tsx` — чекбоксы тегов: сортировка выбранных id, пустой выбор, начальное состояние;
- `pokemonModelFit.test.ts` — калибровка модели на маленьком наборе строк и на снимке PokeAPI (`tests/fixtures/pokemon-info.json`): воспроизводит закоммиченный `model.json` и коэффициенты из `docs/pokemon-model.md`;
- `pokemonGenerator.test.ts` — генератор: детерминизм, статистика 5000 покемонов, влияние типов и способностей, компенсация, цепочки, mega, ошибки запроса;
- `generatedRouteErrors.test.ts` — общий 500 у `/api/pokemon/generated` при ошибке БД, предпросмотр без БД, ответ `/model`;
- `generatorState.test.ts` — бюджет страницы `/generate`: блокировка роста при исчерпанном бюджете, сильные способности, стихии и пул способностей, случайные сессии против серверного валидатора;
- `characterGenerator.test.ts` — модель персонажа: вывод из модели покемона, бонус редкости, прокачка, кривые рангов, сдвиг профиля от талантов, открытие классов по уровню и рангам, генерация каждого класса, бонусы классов, 3000 случайных персонажей против валидатора, ошибки запроса, режим `custom`, повышение уровня и смена класса;
- `characterState.test.ts` — состояние страницы `/characters`: редкость как ярус бюджета, переключение навыков, закрытие класса, случайные сессии против серверного валидатора;
- `CharacterGenerator.test.tsx` — страница персонажей в jsdom: смена редкости, талант и уровень открывают класс, предпросмотр с настоящим ответом генератора;
- `PokemonGenerator.test.tsx` — страница генератора в jsdom с замоканным API: блокировка ползунка, пул способностей стихии, предпросмотр, huge-power.

**Integration:**

- `listRoute.test.ts` — smoke-тест `GET /api/pokemon/list`: страница с развёрнутыми тегами, 400 на невалидную пагинацию;
- `generatedPokemon.test.ts` — `/api/pokemon/generated`: предпросмотр не пишет в БД и совпадает с сохранением, 409 на занятое имя, цепочки с `parent_id`, mega, удаление, фильтр по типам и классу;
- `generatedCharacter.test.ts` — `/api/character/generated`: предпросмотр совпадает с сохранением, `custom` и 400 на закрытый класс, 409 на имя и на занятый Divine-класс, фильтры по редкости и классу, `availableClasses`, `PATCH` (уровень, смена класса, отказы), удаление, `/model`;
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
