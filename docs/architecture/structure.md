# 🏛️ Структура проекта

## 📋 Оглавление

- [📁 Организация файлов](#-организация-файлов)
- [🧩 Компонентная архитектура](#-компонентная-архитектура)
- [🔗 Связи между компонентами](#-связи-между-компонентами)
- [📋 Принципы организации](#-принципы-организации)

```
discoursio-webapp/
 src/
│ ├── assets/            # ассеты
│ │ └── images/
│ │     ├── auth-page.jpg
│ │     ├── discours-banner.jpg
│ │     ├── placeholder-join.webp
│ │     ├── placeholder-feed.webp
│ │     ├── placeholder-experts.webp
│ │     └── placeholder-discussions.webp
│ │
│ ├── intl/              # i18n переводы
│ │ └── locales/         # Локализации
│ │     ├── ru/          # Русский
│ │     └── en/          # Английский
│ │     ...
│ │
│ ├── context/            # Состояние приложения, контексты
│ │ ├── authors.tsx       # Контекст авторов
│ │ ├── connect.tsx       # Контекст подключений
│ │ ├── editor.tsx        # Контекст редактора
│ │ ├── featured.tsx      # Контекст отобранных статей
│ │ ├── feed.tsx          # Контекст ленты
│ │ ├── following.tsx     # Контекст механики подписок
│ │ ├── inbox.tsx         # Контекст мессенджера
│ │ ├── localize.tsx      # Контекст локализации
│ │ ├── notifications.tsx # Контекст уведомлений
│ │ ├── profile.tsx       # Контекст профиля
│ │ ├── reactions.tsx     # Контекст реакций
│ │ ├── session.tsx       # Контекст сессии
│ │ ├── topics.tsx        # Контекст тем
│ │ └── ui.tsx            # Контекст UI
│ │
│ ├── components/           # Компоненты SolidJS
│ │ ├── Article/            # Компоненты статей
│ │ │ ├── AudioHeader/       # Аудио-заголовок
│ │ │ │ ├── AudioHeader.tsx
│ │ │ │ └── AudioHeader.module.scss
│ │ │ ├── AudioPlayer/      # Аудио-плеер
│ │ │ │ ├── AudioPlayer.tsx
│ │ │ │ ├── PlayerHeader.tsx
│ │ │ │ ├── PlayerPlaylist.tsx
│ │ │ │ └── AudioPlayer.module.scss
│ │ │ ├── CoverImage/    # Обложки статей
│ │ │ │ ├── CoverImage.tsx
│ │ │ │ ├── types.ts
│ │ │ │ └── images/     # SVG шаблоны (1-12)
│ │ │ └── SharePopup/    # Попап шаринга
│ │ │ ...
│ │ │
│ │ ├── Feed/           # Компоненты ленты
│ │ │ ├── Beside.tsx    # Боковые блоки
│ │ │ ├── Row1.tsx      # Строки ленты (1-5 + Short)
│ │ │ ├── Row2.tsx      # Разные варианты раскладки
│ │ │ ├── Row3.tsx      # для разных типов контента
│ │ │ ├── Row5.tsx      # и разных размеров экрана
│ │ │ └── RowShort.tsx  # Компактный вариант
│ │ │ ...
│ │ │
│ │ ├── Views/          # Страницы приложения
│ │ │ ├── FeedView.tsx     # Лента материалов
│ │ │ ├── HomeView.tsx     # Главная страница
│ │ │ ├── TopicView.tsx    # Страница темы
│ │ │ ├── AuthorView.tsx   # Профиль автора
│ │ │ ├── ExpoView.tsx     # Выставка материалов
│ │ │ ├── StaticView.tsx   # Статические страницы
│ │ │ └── FourOuFour.tsx   # Страница 404
│ │ │ ...
│ │ │
│ │ ├── _shared/        # Общие компоненты
│ │ │ ├── Button/       # Кнопки
│ │ │ │ ├── Button.tsx
│ │ │ │ └── Button.module.scss
│ │ │ ├── Modal/        # Модальные окна
│ │ │ ├── Icon/         # SVG иконки
│ │ │ ├── Image/        # Обработка изображений
│ │ │ ├── Loading/      # Индикаторы загрузки
│ │ │ ├── Lightbox/     # Просмотр изображений
│ │ │ ├── VideoPlayer/  # Видеоплеер
│ │ │ └── PageLayout/   # Базовый шаблон страниц
│ │ │ ...
│ │ │
│ │ └── Discours/           # Компоненты сайта
│ │     ├── Banner.tsx      # Баннер
│ │     ├── Donate.tsx      # Пожертвование
│ │     ├── Feedback.tsx    # Форма обратной связи
│ │     ├── Footer.tsx      # Подвал сайта
│ │     ├── Hero.tsx
│ │     └── Share.tsx       # Поделиться
│ │     ...
│ │
│ ├── routes/           # Маршруты приложения
│ │ ├── (static)/       # Статические страницы
│ │ │ ├── manifest.tsx  # О проекте
│ │ │ ├── guide.tsx     # Руководство
│ │ │ ├── principles.tsx # Принципы
│ │ │ ├── support.tsx   # Поддержка
│ │ │ ├── debate.tsx    # Правила дискуссий
│ │ │ ├── dogma.tsx     # Догмы проекта
│ │ │ └── terms.tsx     # Условия
│ │ │ ...
│ │ ├── (main).tsx      # Главный роут
│ │ ├── feed/           # Роуты ленты
│ │ │ └── [...mode].tsx # режимы ленты
│ │ ├── topic/          # Роуты тем
│ │ │ └── [...mode].tsx # режимы страницы темы
│ │ └── author/         # Роуты авторов
│ │   └── [...mode].tsx # режимы страницы автора
│ │   ...
│ │
│ ├── lib/                      # особенные случаи
│ │ ├── composeMediaItems.ts    # субматериалы поста
│ │ ├── editorExtensions.ts     # расширения редактора
│ │ ├── fromPeriod.ts           # конвертация периода
│ │ ├── getThumbUrl.ts          # ссылки на CDN с превью
│ │ ├── handleClipboardPaste.ts # обработка вставки в буфер
│ │ ├── handleFileUpload.ts     # обработка загрузки файлов
│ │ ├── mediaQuery.ts           # медиа-запросы
│ │ ├── profileSocialLinks.ts   # ссылки в профиле
│ │ ├── useEscKeyDownHandler.ts # обработка нажатия Esc
│ │ ├── useOutsideClickHandler.ts # обработка нажатия вне элемента
│ │ └── validateUploads.ts      # валидация загружаемых файлов
│ │ 
│ ├── utils/            # Утилиты
│ │ ├── ga.ts           # Google Analytics
│ │ ├── meta.ts         # Мета-теги
│ │ └── config.ts       # Конфигурация
│ │ ...
│ │
│ ├── styles/           # Глобальные стили
│ │ ├── _grid.scss      # Сетка
│ │ ├── _variables.scss # Переменные
│ │ └── app.scss        # Основные стили
│ │ ...
│ │
│ └── graphql/          # GraphQL
│   ├── api/            # API клиенты
│   └── schema/         # Схемы и типы
│   ...
│
├── public/
│ ├── fonts/                # Шрифты
│ ├── icons/                # Иконки
│ ├── favicon.ico           # иконка
│ ├── logo.svg              # логотип
│ ├── logo.png              # логотип
│ ├── logo_sign.png         # логотип
│ ├── robots.txt            # правила для роботов
│ └── sw.js                 # Service Worker кеширование
│ ...
│
├── docs/             # Документация
│ ├── features.md     # Функциональность
│ ├── structure.md    # Структура проекта
│ └── CHANGELOG.md    # История изменений
│ ...
│
├── app.config.ts   # SolidStart
├── vite.config.ts  # Vite
├── tsconfig.json   # TypeScript
├── biome.json      # Форматтер
├── package.json    # NPM
│   ...
├── README.md         # Описание на русском
├── README.en.md      # Описание на английском
├── CHANGELOG.md      # История изменений
└── LICENSE           # Лицензия
...
```

## Соглашения по именованию

- 📂 Компоненты: `PascalCase.tsx`
- 🎨 Стили: `PascalCase.module.scss`
- 📄 Утилиты: `camelCase.ts`
- 🧪 Тесты: `kebab-case.spec.ts`

## Основные концепции

- Компоненты разделены по функциональности (Article, Feed, Views)
- Переиспользуемые компоненты в _shared/
- Состояния приложения в контекстах (context/)
- Стили модульные, привязаны к компонентам
- Роутинг основан на файловой системе