import { CommandType } from './commands'
import styles from './embed.module.scss'

/**
 * @module embed
 * @description Модуль для встраивания внешнего контента
 *
 * Поддерживает:
 * - Видео (YouTube, Vimeo)
 * - Изображения
 * - Ссылки
 * - Форматированный текст
 *
 * @example
 * ```ts
 * handleContentPaste(text, {
 *   insertText: (text) => execCommand('insertText', text),
 *   insertHtml: (html) => execCommand('insertHTML', html)
 * })
 * ```
 */

// Регулярные выражения для определения типа контента по ссылке
export const CONTENT_REGEX = {
  IMAGE: /\.(jpe?g|png|gif|webp|avif)$/i,
  VIMEO: /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)$/,
  YOUTUBE:
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/,
  URL: /^(https?:\/\/)?(www\.)?[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
  AUDIO: /\.(mp3|wav|ogg|m4a)$/i
} as const

export type ContentType = 'link' | 'image' | 'video' | 'audio'

export interface EmbedContent {
  type: ContentType
  url: string
  title?: string
  description?: string
  image?: string
  videoId?: string
  width?: number
  height?: number
}

export interface EmbedOptions {
  showLoading?: () => void
  insertText: (text: string) => void
  insertHtml: (html: string) => void
  skipRecognition?: boolean
}

/**
 * Создает HTML элемент с заданными атрибутами
 */
const createElement = (tag: string, attrs: Record<string, string> = {}, content?: string): HTMLElement => {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  if (content) el.textContent = content
  return el
}

/**
 * Нормализует URL, добавляя протокол если отсутствует
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return url
  return url.startsWith('http') ? url : `https://${url}`
}

/**
 * Создает HTML разметку для встраивания видео
 */
export const createVideoEmbed = (videoId: string, platform: 'youtube' | 'vimeo'): string => {
  const wrapper = createElement('div', { class: styles['video-embed'] })
  const iframe = createElement('iframe', {
    src:
      platform === 'youtube'
        ? `https://www.youtube.com/embed/${videoId}`
        : `https://player.vimeo.com/video/${videoId}`,
    frameborder: '0',
    allowfullscreen: 'true'
  })
  wrapper.appendChild(iframe)
  return wrapper.outerHTML
}

/**
 * Создает HTML разметку для встраивания изображения
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
 * Создает HTML разметку для встраивания аудио
 */
export const createAudioEmbed = (url: string): string => {
  const audio = createElement('audio', { controls: 'true' })
  const source = createElement('source', {
    src: url,
    type: `audio/${url.split('.').pop()}`
  })
  audio.appendChild(source)
  return audio.outerHTML
}

export const detectVideoPlatform = (url: string): 'youtube' | 'vimeo' => {
  if (CONTENT_REGEX.VIMEO.test(url)) {
    return 'vimeo'
  }
  if (CONTENT_REGEX.YOUTUBE.test(url)) {
    return 'youtube'
  }
  throw new Error('Unsupported video platform')
}

/**
 * Создает HTML разметку для встраивания ссылки с превью
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
 * Определяет тип контента по URL и создает объект EmbedContent
 */
export const recognizeCommand = (url: string): CommandType | undefined => {
  let action: CommandType | undefined
  for (const [type, regex] of [
    ['video', CONTENT_REGEX.VIMEO],
    ['video', CONTENT_REGEX.YOUTUBE],
    ['image', CONTENT_REGEX.IMAGE],
    // ['audio', CONTENT_REGEX.AUDIO],
    ['link', CONTENT_REGEX.URL]
  ]) {
    const match = url.match(regex)
    if (match) {
      action = type as CommandType
      break
    }
  }
  return action
}

/**
 * Обрабатывает вставку контента с распознаванием URL
 */
export const handleContentPaste = (
  text: string,
  options: {
    showLoading?: () => void
    insertText: (text: string) => void
    insertHtml: (html: string) => void
  }
) => {
  const { showLoading, insertText, insertHtml } = options

  try {
    const action = recognizeCommand(text)
    if (!action) {
      insertText(text)
      return
    }
    let embedHtml = ''
    showLoading?.()
    if (action === 'video') {
      if (CONTENT_REGEX.VIMEO.test(text)) {
        embedHtml = createVideoEmbed(text, 'vimeo')
      } else if (CONTENT_REGEX.YOUTUBE.test(text)) {
        embedHtml = createVideoEmbed(text, 'youtube')
      }
    } else if (action === 'image') {
      embedHtml = createImageEmbed({ url: text, type: 'image' })
    } else if (action === 'link') {
      embedHtml = createLinkPreview({ url: text, type: 'link' })
    }
    insertHtml(embedHtml)
  } catch {
    insertText(text)
  }
}
