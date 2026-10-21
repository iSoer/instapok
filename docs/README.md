# Документация Instapoke

Instapoke — лента спрайтов покемонов в стиле Instagram: вертикальный слайдер с бесконечной подгрузкой, виртуализацией и фильтром по тегам. Проект сделан как тестовое задание (условие — в корневом [`README.md`](../README.md)).

Стек: Next.js 16 (App Router), React 19, TypeScript 6, SWR, Zod 4, Drizzle ORM 0.45 + PostgreSQL 17, Tailwind CSS 4, Vitest 5.

## Разделы

| Документ | О чём |
| --- | --- |
| [Быстрый старт](getting-started.md) | Установка, запуск, переменные окружения, npm-скрипты |
| [Архитектура](architecture.md) | Структура каталогов, алиасы путей, поток данных |
| [API](api.md) | Контракт `GET /api/pokemon/list`, `GET /api/pokemon/tags`, `GET /api/pokemon/abilities`, `/api/pokemon/generated` и `/api/character/generated` |
| [База данных](database.md) | Схема таблиц, Drizzle, заполнение данными |
| [Данные из PokeAPI](pokemon-info.md) | Очередь `npm run pokemon:info`: загрузка типов, способностей и характеристик покемонов |
| [Способности](abilities.md) | Таблица `ability`, связь по имени через `pokemon_info.abilities`, очередь `npm run ability:info`, API `GET /api/pokemon/abilities` |
| [Модель покемона](pokemon-model.md) | Как связаны BST, профиль статов, типы, способности, рост, вес и опыт; генератор новых покемонов: `npm run pokemon:model`, `npm run pokemon:generate`, `/api/pokemon/generated`, страница `/generate` (ТЗ — [`TZ-pokemon-generator.md`](../TZ-pokemon-generator.md)) |
| [Модель персонажа](character-model.md) | Персонажи на основе модели покемона: уровни 1–80 с детерминированной прокачкой, редкость 1★–5★ как в Fire Emblem Heroes, навыки оружия с рангами E–S и классы Fire Emblem: Fortune's Weave; `npm run character:generate`, `/api/character/generated`, страница `/characters` |
| [Лента](feed.md) | Виртуализация, бесконечная подгрузка, фильтр по тегам, панель настроек |
| [PWA](pwa.md) | Манифест, иконки, баннер установки, service worker |
| [Тесты](testing.md) | Unit- и интеграционные тесты, тестовая БД |
| [Соглашения](conventions.md) | Стиль кода, ESLint, Tailwind, правила для компонентов |

## Ограничения из условия задачи

- **Без сторонних библиотек для infinite scroll и виртуализации.** Окно видимых элементов и подгрузка написаны вручную (`src/client/lib/virtualized-list/`).
- **Производительность важнее дизайна.** Ленту проверяют прокруткой тысяч элементов (в базе ~2955 спрайтов), поэтому код списка оптимизирован под минимум ререндеров.
