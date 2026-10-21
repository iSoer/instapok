# Архитектура

## Структура каталогов

Каталоги повторяют границу среды выполнения: что работает в браузере, что на сервере, что общее.

```
src/
├── app/                      # Маршруты Next.js (App Router)
│   ├── page.tsx              # Единственная страница, "use client"
│   ├── layout.tsx            # Корневой layout: метаданные, viewport, PWA-компоненты
│   ├── manifest.ts           # Web App Manifest → /manifest.webmanifest
│   ├── style/style.css       # Tailwind v4 и глобальные стили
│   └── api/pokemon/
│       ├── list/route.ts     # GET /api/pokemon/list
│       └── tags/route.ts     # GET /api/pokemon/tags
├── client/                   # Только браузер
│   ├── api/                  # SWR-хуки и помощник для URL (не route handlers!)
│   ├── components/           # React-компоненты
│   └── lib/                  # Виртуализированный список, обёртка tailwind-merge
├── server/                   # Только Node
│   ├── db/                   # Drizzle: schema, relations, connection, queries
│   └── scripts/              # init, генерация иконок, сборка service worker, конвертация картинок
├── shared/                   # Общий код клиента и сервера
│   └── api/                  # Zod-схемы контракта API, fetch-обёртка
└── sw/
    └── sw.ts                 # Исходник service worker (отдельный tsconfig)
```

Статика лежит в `public/`:

- `uploads/pokemon/images/` — спрайты в webp (`<номер>.webp`, `<номер>.shiny.webp`);
- `uploads/pokemon/thumbnails/` — размытые превью шириной 10px (`<имя>.thumbnail.webp`);
- `assets/pokeball.webp` — фон спиннера `ui/Loader.tsx`;
- `icons/` — PWA-иконки;
- `sw.js` — собранный service worker (артефакт сборки, не в git).

## Алиасы путей

Заданы в `tsconfig.json`, Vitest подхватывает их через `resolve.tsconfigPaths`.

| Алиас | Путь |
| --- | --- |
| `@/*` | `src/*` |
| `@components/*` | `src/client/components/*` |
| `@lib/*` | `src/client/lib/*` |
| `@api/*` | `src/client/api/*` — **клиентский** слой API, не route handlers |
| `@db` | `src/server/db/index.ts` — экземпляр БД и все таблицы |
| `@schema/*` | `src/server/db/schema/*` |
| `@shared/*` | `src/shared/*` |

## Поток данных

```
Sidebar (теги, настройки слайдера)
   │ onChange
   ▼
page.tsx ── form state ──► usePokemonBank({ limit: 20, tags })   (useSWRInfinite)
   │                          │ GET /api/pokemon/list?page=N&limit=20&tags=...
   │                          ▼
   │                    route.ts ── Zod-валидация запроса ──► listPokemon() ──► PostgreSQL
   │                          │ ◄── Zod-валидация ответа
   │ itemList (страницы склеены, к каждому элементу добавлены URL картинок)
   ▼
InstagramSlider ── useVirtualizedList ──► в DOM только видимые карточки
   │ onLastItemShowed
   └──► setSize(s => s + 1) ──► SWR загружает следующую страницу
```

1. `page.tsx` хранит состояние формы (выбранные теги и параметры слайдера) и передаёт `tags` в `usePokemonBank`.
2. `usePokemonBank` строит ключи страниц через `urlWithParams`. Номер страницы — это `pageIndex` из SWR.
3. Route handler проверяет query-параметры Zod-схемой, выполняет запрос через Drizzle, затем проверяет **свой собственный ответ** той же общей схемой.
4. `page.tsx` склеивает страницы в плоский список и вычисляет URL картинки и превью по полю `name`. API URL не возвращает.
5. `InstagramSlider` монтирует только видимое окно элементов. Когда в окно попадает последний элемент, вызывается `onLastItemShowed`, и SWR загружает следующую страницу.

Подробнее — в [Лента](feed.md) и [API](api.md).

## Единый источник правды для контракта

Zod-схемы в `src/shared/api/schema/` используются с обеих сторон: сервер валидирует по ним запрос и ответ, клиент берёт выведенные типы (`ListResponseType`, `ListRequestType`). Порядок изменения поля API:

1. общая схема в `src/shared/api/schema/`;
2. route handler / запрос в `src/server/db/queries/`;
3. потребитель на клиенте.
