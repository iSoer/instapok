# PWA

Приложение устанавливается как PWA и кэширует статику и картинки через service worker на [Serwist](https://serwist.pages.dev)
(`serwist` + `@serwist/turbopack`).

## Состав

| Файл | Роль |
| --- | --- |
| `src/app/manifest.ts` | Web App Manifest → `/manifest.webmanifest` |
| `src/app/layout.tsx` | Метаданные (`appleWebApp`, `apple-touch-icon`), viewport (`themeColor`, `viewportFit: cover`), `SerwistProvider` |
| `public/icons/` | Иконки 192/512, maskable 512, `apple-touch-icon` 180 |
| `src/server/scripts/generatePwaIcons.ts` | Генерация иконок из векторного покебола (`npm run icons`) |
| `src/client/components/pwa/InstallPrompt.tsx` | Баннер установки |
| `src/client/components/pwa/ServiceWorkerDevCleanup.tsx` | Снятие регистрации воркера и очистка кэшей в dev |
| `src/sw/sw.ts` | Исходник service worker |
| `src/app/serwist/[path]/route.ts` | Сборка воркера (esbuild) и отдача `/serwist/sw.js` + `/serwist/sw.js.map` |
| `next.config.ts` | `withSerwist(...)` и заголовки для `/serwist/*` |
| `tsconfig.sw.json` | Проверка типов воркера |

## Баннер установки

- В Chromium перехватывается `beforeinstallprompt`, и вместо стандартной мини-панели браузера показывается своя кнопка «Install».
- iOS это событие не отправляет, поэтому там показывается подсказка «Поделиться → На экран „Домой“».
- В режиме standalone (уже установлено) баннер не показывается.

## Регистрация

- **production:** `SerwistProvider` (`@serwist/turbopack/react`) в `layout.tsx` регистрирует `/serwist/sw.js` с
  `options={{ scope: "/", updateViaCache: "none" }}` (тип воркера по умолчанию `module`). `reloadOnOnline` и `cacheOnNavigation`
  выключены: перезагрузка при выходе в онлайн сбросила бы ленту, а страница в приложении одна.
- **dev:** провайдер выключен (`disable`), но `disable` не снимает уже установленный воркер. Поэтому `ServiceWorkerDevCleanup`
  снимает регистрацию всех воркеров и удаляет все кэши. Иначе воркер, оставшийся после `npm start` на том же origin, отдавал бы
  устаревшие чанки из кэша и ломал HMR. На первой загрузке страница ещё контролируется старым воркером (снятие регистрации
  вступает в силу после закрытия страницы), начиная со следующей загрузки воркера и кэшей нет.

### Scope

Воркер лежит по адресу `/serwist/sw.js`, а по умолчанию его scope был бы `/serwist/`, и страницу он бы не контролировал.
Регистрация идёт со `scope: "/"`, а route handler отдаёт заголовок `Service-Worker-Allowed: /`, без которого такая регистрация
падает с `SecurityError`.

## Сборка

Отдельного шага сборки нет. `src/app/serwist/[path]/route.ts` создаёт route handler через `createSerwistRoute`:

- `next build` пререндерит `/serwist/sw.js` и `/serwist/sw.js.map` (`generateStaticParams`, `force-static`). Во время пререндера
  esbuild (`useNativeEsbuild: true`, пакет `esbuild` из devDependencies) собирает `src/sw/sw.ts` и подставляет
  precache-манифест вместо `self.__SW_MANIFEST`;
- `npm run dev` собирает воркер по запросу и пересобирает при изменении `src/sw/sw.ts`, precache-манифест в dev пустой.
  Браузер в dev воркер не запрашивает (провайдер выключен).

`withSerwist` в `next.config.ts` добавляет `esbuild` / `esbuild-wasm` в `serverExternalPackages`. В `public/` ничего не генерируется.

### Precache и версии

- `globPatterns: [".next/static/**/*"]` — в манифест попадают все файлы сборки (JS, CSS, шрифты `next/font`, favicon).
  У них хэш в имени, поэтому `revision: null`. Стандартный шаблон `@serwist/turbopack` включает ещё `public/**/*`, и он заменён
  намеренно: иначе в precache попали бы ~2950 спрайтов и миниатюр из `public/uploads/`.
- `additionalPrecacheEntries`: `/manifest.webmanifest`, `/assets/pokeball.webp`, `/icons/icon-192.png`, `/icons/icon-512.png`
  с ревизией `git rev-parse --short HEAD` (без git — `crypto.randomUUID()`).
- `/` в precache **нет**. Precache-маршрут Serwist срабатывает раньше `runtimeCaching`, поэтому закэшированная там `/` отдавалась бы
  cache-first. Вместо этого воркер на `install` кладёт `/` в кэш `pages`, который обслуживается network-first.
- `precacheOptions.cleanupOutdatedCaches: true` удаляет precache-кэши старых версий Serwist; файлы, пропавшие из манифеста,
  удаляются из precache при активации нового воркера. Отдельной «версии кэша» больше нет.

### Изоляция типов

Библиотека типов `webworker` конфликтует с `dom` (`self`, типы событий). Поэтому:

- `src/sw/**` исключён из корневого `tsconfig.json`;
- `tsconfig.sw.json` проверяет только `src/sw/**` с `lib: ["esnext", "webworker"]` и `types: []` (импорты из `serwist` это не блокирует);
- `npm run typecheck:sw` запускается как `prebuild` перед `npm run build`: `next build` воркер собирает, но типы не проверяет;
- route handler проверяется корневым `tsconfig.json` и типы `webworker` не тянет.

### Заголовки

Для `/serwist/sw.js`:

- `Content-Type: application/javascript` и `Service-Worker-Allowed: /` ставит route handler;
- `Cache-Control: no-cache, no-store, must-revalidate` и `Content-Security-Policy: default-src 'self'; script-src 'self'` —
  `headers()` в `next.config.ts` (`source: "/serwist/:path*"`). Без `no-cache` браузер может не увидеть обновление воркера.

## Стратегии кэширования

`defaultCache` из `@serwist/turbopack/worker` не используется: он кэширует `/api/*` и чужие origin'ы. Каждый matcher проверяет
same-origin, `GET` и исключает `/api/*`, поэтому такие запросы Serwist не перехватывает.

| Запросы | Стратегия | Кэш |
| --- | --- | --- |
| не-GET, чужой origin, `/api/*` | не перехватываются | — |
| навигации | `NetworkFirst`, таймаут 4 с, navigation preload | `pages` (одна запись `/`) |
| `/_next/static/*` | precache (cache-first) | `serwist-precache-v2-<scope>` |
| `/manifest.webmanifest`, `/assets/pokeball.webp`, `/icons/icon-{192,512}.png` | precache (cache-first) | `serwist-precache-v2-<scope>` |
| остальные `/uploads/*`, `/assets/*`, `/icons/*` | `CacheFirst`, до 500 записей | `images` |

### Навигации

- `navigationPreload: true`; `NetworkFirst` сам берёт `event.preloadResponse` для навигаций.
- Все навигации хранятся и ищутся под ключом `/` (`cacheKeyWillBeUsed`): query-строки вроде `?utm=…` не плодят записи.
- В кэш попадают только ответы `200` на путь `/` без флага `redirected` (браузеры отклоняют ответ с редиректом на навигацию).
- Если сеть не ответила за **4 секунды** и есть копия в кэше, отдаётся копия; сетевой запрос продолжает обновлять кэш.
- Если сети нет, отдаётся закэшированная `/`. Отдельной офлайн-страницы нет.

### Картинки

- `CacheFirst` + `CacheableResponsePlugin({ statuses: [200] })` + `ExpirationPlugin({ maxEntries: 500, purgeOnQuotaError: true })`.
- `ExpirationPlugin` хранит метаданные в IndexedDB и не читает все ключи кэша на каждый запрос.
- Запись в кэш идёт через `event.waitUntil` после того, как ответ уже отдан, поэтому ошибка вроде `QuotaExceededError` не ломает
  скачанный ресурс; при переполнении кэш `images` очищается целиком.

### Жизненный цикл

- `skipWaiting: true`, `clientsClaim: true`, `disableDevLogs: true`.
- **install:** precache по манифесту + `/` в кэш `pages`.
- **activate:** очистка устаревших precache-кэшей и удаление кэшей старого самописного воркера.

### Миграция со старого воркера

До Serwist воркер лежал в `/sw.js` и хранил кэши `pages-<версия>`, `static-<версия>`, `images-<версия>`.

- Новый воркер регистрируется с тем же scope `/`, поэтому регистрация `/sw.js` заменяется при первом визите;
  `/sw.js` теперь отдаёт 404.
- На `activate` удаляются кэши с именами `/^(pages|static|images)-/`. Новые имена (`pages`, `images`, `serwist-precache-v2-…`)
  под шаблон не попадают.

## Проверка

1. `npm run build` — в списке маршрутов есть `/serwist/[path]` (`/serwist/sw.js`, `/serwist/sw.js.map`).
2. `npm start`, затем `curl -sI localhost:3000/serwist/sw.js` — 200, `application/javascript`, `Cache-Control: no-cache, no-store,
   must-revalidate`, CSP, `Service-Worker-Allowed: /`.
3. Манифест: `curl -s localhost:3000/serwist/sw.js | grep -oE 'url:"[^"]+"'` — все файлы `.next/static/` и четыре доп. записи,
   ни одной `/uploads/`.
4. DevTools → Application → Service workers: активен `/serwist/sw.js` со scope `/`.
5. Cache Storage: `pages`, `images`, `serwist-precache-v2-…`; кэшей `pages-…`/`static-…`/`images-…` нет; записей `/api/*` нет.
6. Network → Offline + перезагрузка — страница открывается из кэша.
7. `npm run dev` на том же origin — воркер снят, Cache Storage пуст (со второй загрузки), HMR работает.

Офлайн-режим для `/api/*` и ленты, отдельная офлайн-страница, push-уведомления и background sync не реализованы.
