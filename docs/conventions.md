# Соглашения

## Стиль кода

Стиль проверяет ESLint (flat config в `eslint.config.mjs`: `eslint-config-next` core-web-vitals + typescript, `@stylistic`):

- двойные кавычки;
- без точек с запятой;
- без висячих запятых;
- длина строки не больше 130 символов.

Перед завершением работы: `npm run lint+fix`. `next build` в Next 16 линтер не запускает — запускайте его отдельно.

ESLint игнорирует `.next/`, `out/`, `build/`, `next-env.d.ts`, `docker/` и собранный `public/sw.js`.

## Правила React

- **Компоненты оборачиваются в `memo(function Name() { … })`**, а все колбэки, передаваемые слайдеру, стабилизируются через `useCallback`. Список чувствителен к ререндерам.
- `eslint-plugin-react-hooks` 7 включает правила React Compiler, например `react-hooks/refs` (нельзя читать `ref.current` во время рендера). Не отключайте правило — разделяйте данные на рабочую копию в `ref` и снимок в `state`, как в `useVirtualizedList`.
- Для картинок ленты используется `<img>` (через `ui/Img.tsx`), а не `next/image`; правило `@next/next/no-img-element` отключено намеренно.

## Tailwind CSS v4

- В `src/app/style/style.css` задано **`--spacing: 1px`**: утилиты отступов и размеров считаются в пикселях. `px-5` = 5px, `gap-12` = 12px, `w-30` = 30px. Стандартная шкала 0.25rem здесь **не действует**.
- Классы объединяйте через `twMerge` из `@lib/tailwind-merge` (обёртка `extendTailwindMerge`), а не напрямую из `tailwind-merge`. Единственное существующее исключение — `ui/Toggle.tsx`; новых не добавляйте.

## Где размещать код

- Браузерный код — в `src/client/`, серверный — в `src/server/`, общий — в `src/shared/`.
- Изменение API начинается с Zod-схемы в `src/shared/api/schema/`.
- Код service worker — только в `src/sw/` (у него свой tsconfig, см. [PWA](pwa.md#изоляция-типов)).

## Версии инструментов

| Инструмент | Версия | Ограничение |
| --- | --- | --- |
| TypeScript | ~6.0 | typescript-eslint поддерживает < 6.1 |
| ESLint | 9 | ESLint 10 блокируют peer-зависимости `eslint-plugin-react`, `-import`, `-jsx-a11y` |
| Node.js | >= 22.13 (разработка) | Vitest 5 и jsdom 29 |
| Drizzle ORM | 0.45 | переход на 1.0 (`defineRelations`, RQB v2) — отдельная миграция |
| esbuild | ~0.28 | только для сборки service worker |
