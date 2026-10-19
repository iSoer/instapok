# Лента

Главная часть проекта: вертикальный слайдер с ручной виртуализацией и бесконечной подгрузкой. Библиотеки для infinite scroll и виртуализации запрещены условием задачи.

## Компоненты

| Файл | Роль |
| --- | --- |
| `src/app/page.tsx` | Состояние формы, загрузка данных, склейка страниц, `renderItem` |
| `src/client/lib/virtualized-list/useVirtualizedList.ts` | Хук окна видимых элементов фиксированного размера |
| `src/client/components/instagram-slider/InstagramSlider.tsx` | Рендер виртуального списка и сигнал «дошли до конца» |
| `src/client/components/InstagramCardSlide.tsx` | Карточка: номер, теги, картинка |
| `src/client/components/ui/Img.tsx` | Картинка с размытым превью, плавным появлением и заглушкой при ошибке |
| `src/client/components/layout/Sidebar.tsx` | Фильтр по тегам и панель настройки слайдера |
| `src/client/components/instagram-Infinite-scroll/InstagramInfiniteScrollSlider.tsx` | Альтернатива без виртуализации (для сравнения, не рендерится) |

## Виртуализация: `useVirtualizedList`

Все элементы имеют одинаковый размер `itemSize`. Переданный `itemSize` уже **включает отступ** между слайдами: `InstagramSlider` передаёт `itemSize + slideGap`.

При прокрутке хук вычисляет:

```
startIndex = max(0, floor(scroll / itemSize) - overScan)
endIndex   = min(itemsCount, floor((scroll + containerSize) / itemSize) + overScan)
totalSize  = itemSize * itemsCount
```

`overScan` — минимум 2 (`DEFAULT_OVERSCAN`).

**Главная оптимизация — компонент не перерисовывается на каждое событие scroll.** В хуке две копии конфигурации:

- `useRef` — рабочая копия, её читают и обновляют обработчики прокрутки;
- `useState` — снимок для рендера.

Снимок заменяется (и вызывает ререндер), только когда:

- `endIndex` сдвинулся на порог, вычисленный из `overScan` и числа помещающихся в контейнер элементов. Порог уменьшается у конца списка, чтобы последний элемент точно попал в окно;
- изменился `itemSize`;
- изменился `totalSize` (догрузились элементы).

Такое разделение нужно и из-за правила `react-hooks/refs` (React Compiler): читать `ref.current` во время рендера нельзя.

**Известное ограничение:** хук подписывается на событие `resize` элемента, но у элементов оно не срабатывает. Изменение размера контейнера учитывается только при следующей прокрутке.

## Рендер: `InstagramSlider`

```
div (скролл-контейнер, overflow-y-auto)
└── div  height = totalSize            ← «распорка», задаёт полную высоту прокрутки
    └── div  translateY(startIndex * itemSize)
        └── только элементы окна [startIndex, endIndex)
```

- **Scroll-snap:** по умолчанию `snap-y snap-mandatory`, у каждого слайда `snap-start snap-always`. Отключается в панели настроек.
- **Высота:** в обычном режиме `itemSize + 2 * containerPaddingY` (виден один слайд), в полноэкранном — `h-dvh`.
- Пока грузится первая страница (`initialLoading`), вместо списка показывается спиннер.

## Загрузка данных

`usePokemonBank({ limit, tags })` — обёртка над `useSWRInfinite`:

- номер страницы — это `pageIndex` из SWR. Поле `page`, которое передаёт `page.tsx`, игнорируется;
- `getKey` возвращает `null` (конец списка), если предыдущая страница вернула меньше `limit` элементов. Если число элементов кратно `limit`, последним будет один запрос, вернувший пустую страницу;
- `revalidateFirstPage: false` — при загрузке следующих страниц первая не перезапрашивается.

Подгрузка: эффект в `InstagramSlider` вызывает `onLastItemShowed`, когда `endIndex >= itemsCount - 1`. `page.tsx` в ответ вызывает `setSize(s => s + 1)` (если нет загрузки и ошибки).

## Сброс ленты при смене фильтра

Сброс происходит **косвенно**, и об этом нужно помнить, если меняете логику конца списка:

1. любое изменение в панели (включая выбор тегов) вызывает `setSize(0)`;
2. список становится пустым → условие `endIndex >= itemsCount - 1` сразу выполняется;
3. срабатывает `onLastItemShowed` → `setSize(s => s + 1)`;
4. SWR загружает страницу 0 уже с новым ключом (новыми тегами).

## Фильтр по тегам

`ui/CheckboxGroup.tsx` хранит выбранные id в `Set` и отдаёт их **отсортированными**: один и тот же набор всегда даёт один и тот же ключ SWR. Пустой массив `[]` снимает фильтр: ключ `tags` в запрос не попадает. На сервере фильтр работает по И — см. [API](api.md#семантика-фильтра).

## Панель настроек

`Sidebar` — живая панель для подбора параметров слайдера:

| Поле | Проп слайдера | По умолчанию |
| --- | --- | --- |
| Slide width | ширина карточки | 350 |
| Slider item height | `itemSize` | 500 |
| Slider slide gap y | `slideGap` | 20 |
| Slider container padding y | `containerPaddingY` | 40 |
| Slider overscan | `overScan` | 10 |
| Disable snap mandatory | `disableSnapMandatory` | выкл. |
| Enable full screen | `fullScreen` | выкл. |

Поля неконтролируемые (получают только начальные значения). Числовые поля передают значение, только если оно `> 0` (overscan — `>= 2`), а `page.tsx` применяет только истинные значения. Поэтому установить отступ или padding в 0 из интерфейса нельзя.

## Картинки

API не возвращает URL; `page.tsx` вычисляет их по `name`:

- картинка: `/uploads/pokemon/images/{name}.webp`;
- превью: `/uploads/pokemon/thumbnails/{name}.thumbnail.webp`.

`ui/Img.tsx` использует обычный `<img loading="lazy">` вместо `next/image` (правило `@next/next/no-img-element` отключено намеренно):

- пока картинка грузится, под ней показывается размытое увеличенное превью и пульсирующая подложка;
- после загрузки картинка плавно появляется (`transition-opacity`);
- при ошибке — заглушка «Ops, image not found».

## Производительность: правила

- Все компоненты обёрнуты в `memo(function Name() { … })`.
- Все колбэки, которые получает слайдер (`renderItem`, `onLastItemShowed`, `onChange`), стабилизированы через `useCallback`.
- `itemList` вычисляется через `useMemo` от `data`.
- В DOM находится только окно `[startIndex, endIndex)`, а не вся лента.
