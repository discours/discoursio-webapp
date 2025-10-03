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

// Embed loader (lazy loading SDK с privacy protection)
export { initEmbedLoaders, initializeEmbedLazy } from './embedLoader'
// Embed metadata (Open Graph / oEmbed для preview)
export { clearMetadataCache, createMetadataPreview, type EmbedMetadata, getEmbedMetadata } from './embedMetadata'
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
