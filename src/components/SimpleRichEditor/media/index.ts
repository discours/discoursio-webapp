/**
 * @module lib/media
 * @description Единый модуль для работы с медиа-контентом в редакторе
 *
 * Объединяет функциональность:
 * - Валидация URL и типов файлов
 * - Генерация HTML для медиа-элементов
 * - Вставка контента в редактор
 * - Загрузка файлов и drag & drop
 */

// Обработчики кликов
export {
  createMediaHandlers,
  type MediaHandlersContext
} from './handlers'
// HTML генерация
export {
  createAudioHTML,
  createImageEmbed,
  createLinkPreview,
  createMediaHTML,
  createVideoEmbed
} from './html'
// Вставка контента
export {
  getMediaElements,
  handleAudioUploaderResult,
  handleContentPaste,
  handleContentPasteEvent,
  insertAudio,
  insertImage,
  insertMedia,
  insertVideo
} from './insertion'
// Типы
export type {
  ContentType,
  EmbedContent,
  EmbedOptions,
  MediaInsertParams,
  MediaType,
  UploadResult,
  VideoPlatform
} from './types'

// Загрузка файлов
export {
  UPLOAD_LIMITS,
  uploadAudio,
  uploadFiles,
  uploadImages,
  useDropFiles,
  validateFiles
} from './upload'
// Валидация
export {
  detectVideoPlatform,
  extractVideoId,
  isValidUrl,
  normalizeUrl,
  recognizeCommand,
  recognizeContentType,
  URL_PATTERNS,
  validateVideoUrl
} from './validation'
