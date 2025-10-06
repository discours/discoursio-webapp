# Changelog

## [Unreleased]

### Fixed
- **[SimpleRichEditor]** Полностью переработана логика drag-and-drop для изображений и URL:
  - ✅ Добавлен обязательный `onDragOver` с `preventDefault()` - без этого браузер блокирует drop
  - ✅ Добавлена визуальная индикация при перетаскивании (подсветка границ редактора)
  - ✅ Исправлено восстановление selection после drop через `cloneRange()` вместо прямого `addRange()`
  - ✅ **Добавлена поддержка URL** - распознавание 20+ платформ при drag & drop
  - ✅ Автоматическая вставка как embed (YouTube, Vimeo, Twitter, etc.) или обычная ссылка
  - ✅ Реализована параллельная загрузка до 3 файлов одновременно
  - ✅ Добавлен прогресс-индикатор с отображением "N/M файлов загружено"
  - ✅ Добавлены обработчики `dragenter`/`dragleave` для корректного UI состояния
  - ✅ Улучшена обработка ошибок с детальными уведомлениями

### Technical Details
- `handlers/events.ts`:
  - Новые обработчики: `handleDragOver`, `handleDragEnter`, `handleDragLeave`
  - Улучшен `handleDropFiles` с управлением CSS классами
- `media/upload.ts`:
  - **Добавлена обработка URL при drop** - проверка `text/plain` dataTransfer
  - Интеграция с `detectEmbedPlatform()` для распознавания платформ
  - Автоматическая вставка через `createUniversalEmbed()` или как обычная ссылка
  - Исправлен `restoreSelection()` - теперь клонирует Range перед добавлением
  - Реализована очередь загрузки с ограничением параллельности (3 файла)
  - Добавлен динамический прогресс-индикатор в toast уведомлениях
- `media/validation.ts`:
  - Поддержка 20+ платформ: YouTube, Vimeo, Twitch, TED, SoundCloud, Bandcamp
  - Социальные сети: Twitter/X, Instagram, Facebook, Telegram, Reddit, TikTok
  - Медиа хостинги: Imgur, Flickr, SlideShare, Wikipedia, Discours.io
- `SimpleRichEditor.module.scss`:
  - Добавлены стили для `.drag-over` класса (подсветка области drop)
- `SimpleRichEditor.tsx`:
  - Подключены все drag-обработчики к contentEditable элементу

### Documentation
- Обновлен `README.md` с детальным описанием drag & drop функциональности
- Добавлена техническая документация по архитектуре медиа-системы