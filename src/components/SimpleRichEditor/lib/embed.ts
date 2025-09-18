import styles from './embed.module.scss'
import { createVideoEmbed, VIMEO_URL_REGEX, YOUTUBE_URL_REGEX } from './media'
import { CommandType } from './types'
import { replaceSelection } from './utils'

export const IMAGE_URL_REGEX = /\.(jpe?g|png|gif|webp|avif)$/i
export const AUDIO_URL_REGEX = /\.(mp3|wav|ogg|m4a)$/i
export const LINK_URL_REGEX = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
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
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value)
  })
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

// createVideoEmbed перенесен в video.ts для избежания дублирования
export { createVideoEmbed } from './media'

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
  if (VIMEO_URL_REGEX.test(url)) {
    return 'vimeo'
  }
  if (YOUTUBE_URL_REGEX.test(url)) {
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
    ['video', VIMEO_URL_REGEX],
    ['video', YOUTUBE_URL_REGEX],
    ['image', IMAGE_URL_REGEX],
    ['audio', AUDIO_URL_REGEX],
    ['link', LINK_URL_REGEX]
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
 *
 * @returns true если контент был обработан специальным образом
 */
export const handleContentPaste = (
  text: string,
  options: {
    showLoading?: () => void
    insertText: (text: string) => void
    insertHtml: (html: string) => void
  }
): boolean => {
  const { showLoading, insertText, insertHtml } = options

  try {
    const action = recognizeCommand(text)
    if (!action) {
      return false // Не распознали специальный тип контента
    }

    let embedHtml: string | null = ''
    showLoading?.()

    if (action === 'video') {
      try {
        const platform = detectVideoPlatform(text)
        // Проверка на YouTube URL
        if (platform === 'youtube') {
          // Поддерживаемые форматы YouTube URL
          const regex = YOUTUBE_URL_REGEX
          const match = text.match(regex)

          if (match?.[1]) {
            const videoId = match[1]
            embedHtml = createVideoEmbed(videoId || '')
            embedHtml && insertHtml(embedHtml)
            return true
          }
        }

        // Проверка на Vimeo URL
        if (platform === 'vimeo') {
          // Поддерживаемые форматы Vimeo URL
          const regex = VIMEO_URL_REGEX
          const match = text.match(regex)

          if (match?.[1]) {
            const videoId = match[1]
            embedHtml = createVideoEmbed(videoId || '')
            embedHtml && insertHtml(embedHtml)
            return true
          }
        }
      } catch (e) {
        console.error('Error embedding video:', e)
      }
    } else if (action === 'image') {
      embedHtml = createImageEmbed({ url: text, type: 'image' })
      insertHtml(embedHtml)
      return true
    } else if (action === 'link') {
      // Вставляем ссылку как текст или превью
      insertText(text)
      return true
    }
  } catch (error) {
    console.error('Error handling paste:', error)
  }

  // Если не обработали специальным образом, возвращаем false
  return false
}

/**
 * Обрабатывает событие вставки из буфера обмена в редактор
 *
 * @param event Событие ClipboardEvent
 * @param editor DOM-элемент редактора
 * @returns true если вставка была обработана специальным образом
 */
export const handleContentPasteEvent = (event: ClipboardEvent, editor: HTMLElement): boolean => {
  // Получаем текст из буфера обмена
  const text = event.clipboardData?.getData('text/plain') || ''

  // Проверяем на медиаконтент в буфере обмена
  if (event.clipboardData?.items) {
    for (const item of Array.from(event.clipboardData.items)) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) {
          // Здесь можно обработать вставку изображения напрямую
          // Но для этого нужно вызывать API загрузки файлов
          console.log('Image pasted from clipboard, handling not implemented:', file)
          return true
        }
      }
    }
  }

  // Если это текст и похож на URL или медиа-ссылку, обрабатываем его
  if (text?.trim()) {
    return handleContentPaste(text, {
      insertText: (textContent) => {
        if (editor) {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            range.deleteContents()
            const textNode = document.createTextNode(textContent)
            range.insertNode(textNode)
            range.setStartAfter(textNode)
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        }
      },
      insertHtml: (html) => {
        if (editor) {
          replaceSelection(html, editor)
        }
      }
    })
  }

  return false
}
