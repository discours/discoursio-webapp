/**
 * @module lib/media/validation
 * @description Валидация URL и определение типов медиа-контента
 */

import { CommandType } from '../lib/types'
import { ContentType, VideoPlatform } from './types'

/**
 * Регулярные выражения для различных типов контента
 */
export const URL_PATTERNS = {
  // Видео платформы
  YOUTUBE: /^(https?:\/\/)?(www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/,
  VIMEO: /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)$/,

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
 * Определяет тип контента по URL
 * @param url URL для анализа
 * @returns Тип контента или undefined если не распознан
 */
export const recognizeContentType = (url: string): ContentType | undefined => {
  if (URL_PATTERNS.YOUTUBE.test(url) || URL_PATTERNS.VIMEO.test(url)) {
    return 'video'
  }
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
