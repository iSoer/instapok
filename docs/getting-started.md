# Быстрый старт

## Требования

- **Node.js >= 22.13** для разработки (этого требуют Vitest 5 и jsdom 29). Самому приложению достаточно Node >= 20.9.
- **Docker** с Compose — для PostgreSQL.

## Установка и запуск

```bash
docker compose up -d      # PostgreSQL 17 на localhost:5432, данные в ./docker/ (в .gitignore)
npm install
npm run init              # создать схему и заполнить БД (удаляет существующие данные!)
npm run dev               # dev-сервер на http://localhost:3000
```

Production-сборка:

```bash
npm run build             # prebuild собирает service worker, затем next build
npm start
```

## Переменные окружения

| Переменная | Где используется | Значение по умолчанию |
| --- | --- | --- |
| `DATABASE_URL` | приложение, `drizzle-kit`, `npm run init` | из `.env`: `postgres://postgres:postgres@localhost:5432/my_database` |
| `TEST_DATABASE_URL` | интеграционные тесты | `postgres://postgres:postgres@localhost:5432/instapoke_test` |

`.env` закоммичен и указывает на Postgres из `docker-compose.yml`. Оба места (`drizzle.config.ts` и подключение в `src/server/db/connection/db.ts`) читают его через `dotenv/config`.

## npm-скрипты

| Скрипт | Что делает |
| --- | --- |
| `dev` | `next dev` (Turbopack). Service worker в dev не регистрируется. |
| `build` | `next build`: сборка и проверка типов. ESLint в Next 16 при сборке не запускается. |
| `prebuild` | Автоматически перед `build`: `npm run sw:build`. |
| `start` | `next start` — запуск production-сборки. |
| `sw:build` | Проверка типов воркера (`typecheck:sw`) и сборка `src/sw/sw.ts` → `public/sw.js` через esbuild. |
| `typecheck:sw` | `tsc -p tsconfig.sw.json` — типы воркера с `lib: webworker`. |
| `lint` / `lint+fix` | `eslint .` / с автоисправлением. |
| `test` | Все тесты Vitest (unit + integration). |
| `test:unit` | Только unit-тесты, БД не нужна. |
| `test:integration` | Только интеграционные тесты, нужен запущенный Postgres. |
| `test:watch` | Vitest в режиме наблюдения. |
| `init` | Пересоздание данных в БД (см. [База данных](database.md#заполнение-данными)). |
| `pokemon:info` | Очередь загрузки данных покемонов из PokeAPI (см. [Данные из PokeAPI](pokemon-info.md)). |
| `ability:info` | Очередь загрузки способностей из PokeAPI и их связей с покемонами (см. [Способности](abilities.md)). |
| `icons` | Одноразовая генерация PWA-иконок в `public/icons/`. |

Проверка типов без сборки: `npx tsc --noEmit` (корневой проект) и `npm run typecheck:sw` (service worker).

Один тестовый файл: `npx vitest run tests/unit/urlWithParams.test.ts`.

## Частые проблемы

- **`CREATE DATABASE` падает с ошибкой версии collation.** В локальном volume шаблон `template1` создан с другой версией glibc (2.36 против 2.41). Создавайте базы с `TEMPLATE template0` — так делает `tests/integration/globalSetup.ts`.
- **В `npm run dev` грузятся устаревшие чанки.** Если на том же origin раньше запускался `npm start`, в браузере мог остаться production service worker. `ServiceWorkerRegister` в dev сам снимает регистрацию и очищает кэши; при необходимости обновите страницу ещё раз или удалите воркер в DevTools → Application.
- **Пустая лента.** Не выполнен `npm run init` или не запущен Postgres (`docker compose ps`).
