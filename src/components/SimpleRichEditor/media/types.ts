/**
 * @module lib/media/types
 * @description Единые типы для работы с медиа-контентом
 */

/**
 * Типы поддерживаемых медиа
 */
export type MediaType = 'image' | 'video' | 'audio'

/**
 * Типы контента для встраивания
 */
export type ContentType = 'link' | 'image' | 'video' | 'audio'

/**
 * Типы поддерживаемых видеоплатформ
 */
export type VideoPlatform = 'youtube' | 'vimeo'

/**
 * Типы поддерживаемых preview платформ
 */
export type PreviewPlatform =
  | 'youtube'
  | 'vimeo'
  | 'twitch'
  | 'ted'
  | 'soundcloud'
  | 'bandcamp'
  | 'facebook'
  | 'x'
  | 'instagram'
  | 'telegram'
  | 'reddit'
  | 'tiktok'
  | 'wikipedia'
  | 'slideshare'
  | 'imgur'
  | 'flickr'
  | 'discours'
  | 'unknown'

/**
 * Единый интерфейс для параметров вставки медиа
 */
export interface MediaInsertParams {
  /** Тип медиа-контента */
  type: MediaType
  /** URL медиа-ресурса */
  url: string
  /** Заголовок или альтернативный текст */
  title?: string
  /** Описание контента */
  description?: string
  /** URL превью изображения */
  image?: string
  /** ID видео (для YouTube/Vimeo) */
  videoId?: string
  /** Ширина элемента */
  width?: number
  /** Высота элемента */
  height?: number
  /** Дополнительные атрибуты */
  attributes?: Record<string, string>
}

/**
 * Интерфейс для контента встраивания
 */
export interface PreviewContent {
  /** Тип контента для встраивания */
  type: ContentType
  /** URL медиа-ресурса */
  url: string
  /** Заголовок или альтернативный текст */
  title?: string
  /** Описание контента */
  description?: string
  /** URL превью изображения */
  image?: string
  /** ID видео (для YouTube/Vimeo) */
  videoId?: string
  /** Ширина элемента */
  width?: number
  /** Высота элемента */
  height?: number
  /** Дополнительные атрибуты */
  attributes?: Record<string, string>
}

/**
 * Опции для обработки встраивания
 */
export interface PreviewOptions {
  /** Показать индикатор загрузки */
  showLoading?: () => void
  /** Вставить текст */
  insertText: (text: string) => void
  /** Вставить HTML */
  insertHtml: (html: string) => void
  /** Пропустить автоматическое распознавание */
  skipRecognition?: boolean
}

/**
 * Результат загрузки файла
 */
export interface UploadResult {
  /** Успешность загрузки */
  success: boolean
  /** URL загруженного файла */
  url?: string
  /** Сообщение об ошибке */
  error?: string
  /** Дополнительные данные */
  data?: unknown
}
