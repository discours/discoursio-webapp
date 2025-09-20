/**
 * @module lib/media/html
 * @description Генерация HTML для различных типов медиа-контента
 */

import styles from './styles.module.scss'
import { EmbedContent, MediaInsertParams } from './types'
import { detectVideoPlatform, extractVideoId } from './validation'

/**
 * Создает HTML элемент с заданными атрибутами
 * @param tag Тег элемента
 * @param attrs Атрибуты элемента
 * @param content Текстовое содержимое
 * @returns HTML элемент
 */
const createElement = (tag: string, attrs: Record<string, string> = {}, content?: string): HTMLElement => {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
  if (content) el.textContent = content
  return el
}

/**
 * Создает HTML-код для встраивания видео
 * @param url URL видео
 * @returns HTML-код или null если не удалось создать
 */
export const createVideoEmbed = (url: string): string | null => {
  const platform = detectVideoPlatform(url)
  const videoId = extractVideoId(url)

  if (!platform || !videoId) return null

  // Создаем обертку для iframe
  const wrapper = document.createElement('div')
  wrapper.className = 'video-embed'
  wrapper.style.position = 'relative'
  wrapper.style.paddingBottom = '56.25%' // 16:9 соотношение сторон
  wrapper.style.height = '0'
  wrapper.style.overflow = 'hidden'
  wrapper.style.maxWidth = '100%'

  // Создаем iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('allowfullscreen', 'true')

  // Устанавливаем URL в зависимости от платформы
  if (platform === 'youtube') {
    iframe.src = `https://www.youtube.com/embed/${videoId}`
  } else if (platform === 'vimeo') {
    iframe.src = `https://player.vimeo.com/video/${videoId}`
  }

  wrapper.appendChild(iframe)
  return wrapper.outerHTML
}

/**
 * Создает HTML разметку для аудио-плеера
 * @param url URL аудио-файла
 * @returns HTML строка для аудио-элемента
 */
export const createAudioHTML = (url: string): string => {
  return `<div class="audio-embed" data-audio-src="${url}">
    <audio src="${url}" controls></audio>
  </div>`
}

/**
 * Создает HTML разметку для встраивания изображения
 * @param content Параметры изображения
 * @returns HTML строка
 */
export const createImageEmbed = (content: EmbedContent): string => {
  const figure = createElement('figure')
  const img = createElement('img', {
    src: content.url,
    alt: content.title || '',
    ...(content.width ? { width: content.width.toString() } : {}),
    ...(content.height ? { height: content.height.toString() } : {})
  })
  figure.appendChild(img)
  if (content.title) {
    const caption = createElement('figcaption', {}, content.title)
    figure.appendChild(caption)
  }
  return figure.outerHTML
}

/**
 * Создает HTML разметку для встраивания ссылки с превью
 * @param content Параметры ссылки
 * @returns HTML строка
 */
export const createLinkPreview = (content: EmbedContent): string => {
  const preview = createElement('div', { class: styles.preview })

  if (content.image) {
    const img = createElement('img', {
      src: content.image,
      alt: content.title || ''
    })
    preview.appendChild(img)
  }

  const previewContent = createElement('div', { class: styles.previewContent })
  const link = createElement(
    'a',
    {
      href: content.url,
      target: '_blank',
      rel: 'noopener noreferrer'
    },
    content.title || content.url
  )
  previewContent.appendChild(link)

  if (content.description) {
    const desc = createElement('p', {}, content.description)
    previewContent.appendChild(desc)
  }

  preview.appendChild(previewContent)
  return preview.outerHTML
}

/**
 * Создает HTML для вставки медиа в редактор (универсальная функция)
 * @param params Параметры медиа
 * @returns HTML строка для вставки
 */
export const createMediaHTML = (params: MediaInsertParams): string => {
  const { type, url, title = '', attributes = {} } = params

  // Собираем строку атрибутов
  const attributesStr = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  switch (type) {
    case 'image':
      return `<img src="${url}" alt="${title}" ${attributesStr} />`
    case 'video': {
      // Для видео используем embed если это поддерживаемая платформа
      const embedHtml = createVideoEmbed(url)
      if (embedHtml) return embedHtml
      // Иначе обычный video тег
      return `<video src="${url}" controls title="${title}" ${attributesStr}></video>`
    }
    case 'audio':
      return createAudioHTML(url)
    default:
      return ''
  }
}
