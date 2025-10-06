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
  createImagePreview,
  createLinkPreview,
  createMediaHTML,
  createUniversalPreview,
  createVideoPreview
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
// Preview loader (lazy loading SDK с privacy protection)
export { initializePreviewLazy, initPreviewLoaders } from './previewLoader'
// Preview metadata (Open Graph / oEmbed для preview)
export { clearMetadataCache, createMetadataPreview, getPreviewMetadata, type PreviewMetadata } from './previewMetadata'
// Типы
export type {
  ContentType,
  MediaInsertParams,
  MediaType,
  PreviewContent,
  PreviewOptions,
  PreviewPlatform,
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
  detectPreviewPlatform,
  detectVideoPlatform,
  extractVideoId,
  isValidUrl,
  normalizeUrl,
  recognizeCommand,
  recognizeContentType,
  URL_PATTERNS,
  validateVideoUrl
} from './validation'
