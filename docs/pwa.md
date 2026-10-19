# PWA

Приложение устанавливается как PWA и кэширует статику и картинки через собственный service worker. Библиотеки для service worker (Workbox, Serwist) не используются.

## Состав

| Файл | Роль |
| --- | --- |
| `src/app/manifest.ts` | Web App Manifest → `/manifest.webmanifest` |
| `src/app/layout.tsx` | Метаданные (`appleWebApp`, `apple-touch-icon`), viewport (`themeColor`, `viewportFit: cover`) |
| `public/icons/` | Иконки 192/512, maskable 512, `apple-touch-icon` 180 |
| `src/server/scripts/generatePwaIcons.ts` | Генерация иконок из векторного покебола (`npm run icons`) |
| `src/client/components/pwa/InstallPrompt.tsx` | Баннер установки |
| `src/client/components/pwa/ServiceWorkerRegister.tsx` | Регистрация / снятие регистрации воркера |
| `src/sw/sw.ts` | Исходник service worker |
| `src/server/scripts/buildServiceWorker.ts` | Сборка воркера в `public/sw.js` |
| `tsconfig.sw.json` | Проверка типов воркера |

## Баннер установки

- В Chromium перехватывается `beforeinstallprompt`, и вместо стандартной мини-панели браузера показывается своя кнопка «Install».
- iOS это событие не отправляет, поэтому там показывается подсказка «Поделиться → На экран „Домой“».
- В режиме standalone (уже установлено) баннер не показывается.

## Регистрация

`ServiceWorkerRegister`:

- **production:** регистрирует `/sw.js` со `scope: "/"` и `updateViaCache: "none"`;
- **dev:** снимает регистрацию всех воркеров и удаляет все кэши. Иначе воркер, оставшийся после `npm start` на том же origin, отдавал бы устаревшие чанки Turbopack из кэша и ломал HMR.

## Сборка

Next.js отдаёт `public/` как есть и service worker не компилирует, поэтому он собирается отдельно:

```bash
npm run sw:build   # = typecheck:sw + tsx src/server/scripts/buildServiceWorker
```

Скрипт запускается автоматически как `prebuild` перед `npm run build`. Для `npm run dev` он не нужен: в dev воркер не регистрируется.

esbuild собирает `src/sw/sw.ts` → `public/sw.js` с параметрами `bundle`, `minify`, `iife`, `es2020`. `public/sw.js` — артефакт сборки: он в `.gitignore` и в `globalIgnores` ESLint.

### Версия кэша

В бандл через `define` подставляется константа `__SW_VERSION__ = "<git short sha>-<время сборки в base36>"`, например `abdef20-mvf46pik`; без git вместо sha будет `nogit`. Build id Next.js до запуска `next build` ещё не существует, поэтому используется значение, которое можно вычислить заранее.

Каждая сборка получает новую версию. Новый воркер при `activate` удаляет кэши предыдущей версии, поэтому старые хэшированные чанки не накапливаются.

### Изоляция типов

Библиотека типов `webworker` конфликтует с `dom` (`self`, типы событий). Поэтому:

- `src/sw/**` исключён из корневого `tsconfig.json`;
- `tsconfig.sw.json` проверяет только `src/sw/**` с `lib: ["esnext", "webworker"]` и `types: []`;
- в `sw.ts` объявлено `declare const self: ServiceWorkerGlobalScope`, а `export {}` в конце делает файл модулем, чтобы это объявление перекрывало глобальное.

### Заголовки

`next.config.ts` отдаёт для `/sw.js`:

- `Content-Type: application/javascript; charset=utf-8`;
- `Cache-Control: no-cache, no-store, must-revalidate` — браузер всегда перепроверяет скрипт, иначе обновления «застревают»;
- `Content-Security-Policy: default-src 'self'; script-src 'self'`.

## Стратегии кэширования

| Запросы | Стратегия | Кэш |
| --- | --- | --- |
| не-GET, чужой origin, `/api/*` | не перехватываются | — |
| навигации | network-first с таймаутом | `pages-<версия>` |
| `/_next/static/*` | cache-first, до 300 записей | `static-<версия>` |
| `/uploads/*`, `/assets/*`, `/icons/*` | cache-first, до 500 записей | `images-<версия>` |

### Жизненный цикл

- **install:** предзагрузка `/`, `/manifest.webmanifest`, `/assets/pokeball.webp`, `/icons/icon-192.png`, `/icons/icon-512.png` в кэш страниц, затем `skipWaiting()`.
- **activate:** удаление кэшей других версий, включение navigation preload, `clients.claim()`.

### Навигации

- Ответ берётся из `event.preloadResponse` (navigation preload), иначе — `fetch`.
- Все навигации хранятся и ищутся под ключом `/`: страница одна, и query-строки вроде `?utm=…` не плодят записи. В кэш попадают только успешные ответы на путь `/`.
- Если сеть не ответила за **4 секунды** и есть закэшированная копия, отдаётся копия, а сетевой запрос в фоне продолжает обновлять кэш.
- Если сеть недоступна, отдаётся закэшированная `/`.
- У ответа из кэша снимается флаг `redirected`: браузеры отклоняют ответ с редиректом на навигацию.

### Cache-first

- При попадании в кэш ответ отдаётся сразу; иначе — сеть, и успешный ответ записывается в кэш.
- **Запись в кэш идёт в фоне** (`event.waitUntil`) и не влияет на ответ: ошибка вроде `QuotaExceededError` не ломает уже скачанный ресурс.
- **Обрезка кэша** (удаление самых старых записей в порядке вставки) запускается не чаще раза в 5 секунд на кэш: все записи за это время ждут одной общей обрезки, а не читают список ключей каждый раз.

## Проверка

1. `npm run build && npm start`.
2. DevTools → Application → Service workers: воркер активен.
3. Cache Storage: кэши `pages-…`, `static-…`, `images-…` с текущей версией.
4. `curl -sI localhost:3000/sw.js` — статус 200 и три заголовка из `next.config.ts`.

Офлайн-режим для `/api/*` и ленты, отдельная офлайн-страница, push-уведомления и background sync не реализованы.
