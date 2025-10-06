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
  createUniversalEmbed,
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
// Embed loader (lazy loading SDK с privacy protection)
export { initEmbedLoaders, initializeEmbedLazy } from './previewLoader'
// Embed metadata (Open Graph / oEmbed для preview)
export { clearMetadataCache, createMetadataPreview, type EmbedMetadata, getEmbedMetadata } from './previewMetadata'
// Типы
export type {
  ContentType,
  EmbedContent,
  EmbedOptions,
  EmbedPlatform,
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
  cleanUrl,
  detectEmbedPlatform,
  detectVideoPlatform,
  extractVideoId,
  isValidUrl,
  normalizeUrl,
  recognizeCommand,
  recognizeContentType,
  URL_PATTERNS,
  validateVideoUrl
} from './validation'
