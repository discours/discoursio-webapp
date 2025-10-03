/**
 * @module lib/media/validation
 * @description Валидация URL и определение типов медиа-контента
 */

import { CommandType } from '../lib/types'
import { ContentType, EmbedPlatform, VideoPlatform } from './types'

/**
 * Регулярные выражения для различных типов контента
 */
export const URL_PATTERNS = {
  // Видео платформы
  YOUTUBE: /^(https?:\/\/)?(www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/,
  VIMEO: /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)$/,
  TWITCH: /^(https?:\/\/)?(www\.)?(twitch\.tv|m\.twitch\.tv)\/(videos\/\d+|[a-zA-Z0-9_]+)/,
  TED: /^(https?:\/\/)?(www\.|embed\.)?ted\.com\/talks\/(?:lang\/[a-z]{2}\/)?[a-zA-Z0-9_-]+/,

  // Социальные сети
  FACEBOOK: /^(https?:\/\/)?(www\.)?facebook\.com\/.+/,
  X_TWITTER: /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/.+/,
  INSTAGRAM: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/,
  TELEGRAM: /^(https?:\/\/)?(www\.)?t\.me\/.+/,
  REDDIT: /^(https?:\/\/)?(www\.)?reddit\.com\/r\/.+/,
  TIKTOK: /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)\/.+/,

  // Аудио платформы
  SOUNDCLOUD: /^(https?:\/\/)?(www\.)?soundcloud\.com\/.+/,
  BANDCAMP: /^(https?:\/\/)?([a-zA-Z0-9-]+\.)?bandcamp\.com\/(track|album)\/.+/,

  // Discours.io
  DISCOURS: /^(https?:\/\/)?(www\.)?(discours\.io|testing\.discours\.io)\/.+/,

  // Wikipedia
  WIKIPEDIA: /^(https?:\/\/)?([a-z]{2,3}\.)?wikipedia\.org\/wiki\/.+/,

  // Медиа хостинги
  SLIDESHARE: /^(https?:\/\/)?(www\.)?slideshare\.net\/.+/,
  IMGUR: /^(https?:\/\/)?(www\.)?(i\.)?imgur\.com\/.+/,
  FLICKR: /^(https?:\/\/)?(www\.)?flickr\.com\/(photos|gp)\/.+/,

  // Медиа файлы
  IMAGE: /\.(jpe?g|png|gif|webp|avif)$/i,
  AUDIO: /\.(mp3|wav|ogg|m4a)$/i,

  // Ссылки
  LINK: /^(https?:\/\/)?(www\.)?[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
  WEB_URL: /^(https|http)?:\/\//
} as const

/**
 * Валидирует URL
 * @param url URL для проверки
 * @returns true если URL валиден
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch (_e) {
    return false
  }
}

/**
 * Нормализует URL, добавляя протокол если отсутствует
 * @param url URL для нормализации
 * @returns Нормализованный URL
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return url
  return url.startsWith('http') ? url : `https://${url}`
}

/**
 * Валидирует URL видео
 * @param url URL для проверки
 * @returns true если URL валидный и поддерживается
 */
export const validateVideoUrl = (url: string): boolean => {
  if (!url) return false
  return URL_PATTERNS.YOUTUBE.test(url) || URL_PATTERNS.VIMEO.test(url)
}

/**
 * Определяет платформу видео по URL
 * @param url URL видео
 * @returns Тип платформы или null если не поддерживается
 */
export const detectVideoPlatform = (url: string): VideoPlatform | null => {
  if (URL_PATTERNS.YOUTUBE.test(url)) return 'youtube'
  if (URL_PATTERNS.VIMEO.test(url)) return 'vimeo'
  return null
}

/**
 * Извлекает ID видео из URL
 * @param url URL видео
 * @returns ID видео или null если не удалось извлечь
 */
export const extractVideoId = (url: string): string | null => {
  const platform = detectVideoPlatform(url)
  if (!platform) return null

  let match: RegExpMatchArray | null = null

  if (platform === 'youtube') {
    match = url.match(URL_PATTERNS.YOUTUBE)
    if (match?.[3]) return match[3]
  } else if (platform === 'vimeo') {
    match = url.match(URL_PATTERNS.VIMEO)
    if (match?.[3]) return match[3]
  }

  return null
}

/**
 * Определяет платформу embed по URL
 * @param url URL для анализа
 * @returns Платформа embed или 'unknown' если не распознана
 */
export const detectEmbedPlatform = (url: string): EmbedPlatform => {
  if (URL_PATTERNS.YOUTUBE.test(url)) return 'youtube'
  if (URL_PATTERNS.VIMEO.test(url)) return 'vimeo'
  if (URL_PATTERNS.TWITCH.test(url)) return 'twitch'
  if (URL_PATTERNS.TED.test(url)) return 'ted'
  if (URL_PATTERNS.SOUNDCLOUD.test(url)) return 'soundcloud'
  if (URL_PATTERNS.BANDCAMP.test(url)) return 'bandcamp'
  if (URL_PATTERNS.FACEBOOK.test(url)) return 'facebook'
  if (URL_PATTERNS.X_TWITTER.test(url)) return 'x'
  if (URL_PATTERNS.INSTAGRAM.test(url)) return 'instagram'
  if (URL_PATTERNS.TELEGRAM.test(url)) return 'telegram'
  if (URL_PATTERNS.REDDIT.test(url)) return 'reddit'
  if (URL_PATTERNS.TIKTOK.test(url)) return 'tiktok'
  if (URL_PATTERNS.WIKIPEDIA.test(url)) return 'wikipedia'
  if (URL_PATTERNS.SLIDESHARE.test(url)) return 'slideshare'
  if (URL_PATTERNS.IMGUR.test(url)) return 'imgur'
  if (URL_PATTERNS.FLICKR.test(url)) return 'flickr'
  if (URL_PATTERNS.DISCOURS.test(url)) return 'discours'
  return 'unknown'
}

/**
 * Определяет тип контента по URL
 * @param url URL для анализа
 * @returns Тип контента или undefined если не распознан
 */
export const recognizeContentType = (url: string): ContentType | undefined => {
  // Видео платформы
  if (
    URL_PATTERNS.YOUTUBE.test(url) ||
    URL_PATTERNS.VIMEO.test(url) ||
    URL_PATTERNS.TWITCH.test(url) ||
    URL_PATTERNS.TED.test(url) ||
    URL_PATTERNS.TIKTOK.test(url)
  ) {
    return 'video'
  }
  // Аудио платформы
  if (URL_PATTERNS.SOUNDCLOUD.test(url) || URL_PATTERNS.BANDCAMP.test(url)) {
    return 'audio'
  }
  // Медиа хостинги (изображения)
  if (URL_PATTERNS.IMGUR.test(url) || URL_PATTERNS.FLICKR.test(url)) {
    return 'image'
  }
  // Документы/презентации
  if (URL_PATTERNS.SLIDESHARE.test(url)) {
    return 'link'
  }
  // Wikipedia и другие
  if (URL_PATTERNS.WIKIPEDIA.test(url) || URL_PATTERNS.DISCOURS.test(url)) {
    return 'link'
  }
  // Социальные сети
  if (
    URL_PATTERNS.FACEBOOK.test(url) ||
    URL_PATTERNS.X_TWITTER.test(url) ||
    URL_PATTERNS.INSTAGRAM.test(url) ||
    URL_PATTERNS.TELEGRAM.test(url) ||
    URL_PATTERNS.REDDIT.test(url)
  ) {
    return 'link'
  }
  // Прямые медиа файлы
  if (URL_PATTERNS.IMAGE.test(url)) {
    return 'image'
  }
  if (URL_PATTERNS.AUDIO.test(url)) {
    return 'audio'
  }
  if (URL_PATTERNS.LINK.test(url)) {
    return 'link'
  }
  return undefined
}

/**
 * Определяет команду редактора по URL (для обратной совместимости)
 * @param url URL для анализа
 * @returns Команда редактора или undefined
 */
export const recognizeCommand = (url: string): CommandType | undefined => {
  const contentType = recognizeContentType(url)
  return contentType as CommandType
}
