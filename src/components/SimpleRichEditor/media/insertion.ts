/**
 * @module lib/media/insertion
 * @description Функции для вставки медиа-контента в редактор
 */

import { MediaItem } from '~/graphql/generated/graphql'
import { replaceSelection } from '../lib/utils'
// Используем require() для избежания циклических зависимостей
import { createMediaHTML } from './html'
import { EmbedContent, EmbedOptions, MediaInsertParams } from './types'
import { recognizeContentType, validateVideoUrl } from './validation'

/**
 * Получает все медиа элементы из редактора
 * @param editor Элемент редактора
 * @returns Массив медиа элементов
 */
export const getMediaElements = (editor: HTMLElement | null): HTMLElement[] => {
  if (!editor) return []
  return Array.from(editor.querySelectorAll('img, video, audio, iframe'))
}

/**
 * Вставляет медиа в редактор
 * @param params Параметры медиа
 * @param editor Редактор для вставки
 * @returns true если вставка успешна
 */
export const insertMedia = (params: MediaInsertParams, editor: HTMLElement | null): boolean => {
  if (!editor || !params.url) return false

  const mediaHtml = createMediaHTML(params)
  if (!mediaHtml) return false

  return replaceSelection(mediaHtml, editor)
}

/**
 * Вставляет изображение в редактор
 * @param url URL изображения
 * @param editor Элемент редактора
 * @param alt Альтернативный текст
 * @returns true если вставка успешна
 */
export const insertImage = (url: string, editor: HTMLElement | null, alt?: string): boolean => {
  return insertMedia({ type: 'image', url, title: alt }, editor)
}

/**
 * Вставляет видео в редактор
 * @param url URL видео
 * @param editor Элемент редактора
 * @returns true если вставка успешна
 */
export const insertVideo = (url: string, editor: HTMLElement | null): boolean => {
  if (!validateVideoUrl(url)) return false
  return insertMedia({ type: 'video', url }, editor)
}

/**
 * Вставляет аудио в редактор
 * @param url URL аудио-файла
 * @param editor Редактор для вставки
 * @returns true если вставка успешна
 */
export const insertAudio = (url: string, editor: HTMLElement | null): boolean => {
  return insertMedia({ type: 'audio', url }, editor)
}

/**
 * Обрабатывает вставку аудио из загрузчика
 * @param audioItems Загруженные аудио элементы
 * @param editor Редактор
 * @returns true если вставка успешна
 */
export const handleAudioUploaderResult = (audioItems: MediaItem[], editor: HTMLElement | null): boolean => {
  if (!editor || !audioItems.length) return false

  let success = true
  for (const audio of audioItems) {
    if (audio.url) {
      const result = insertAudio(audio.url, editor)
      if (!result) success = false
    }
  }

  return success
}

/**
 * Обрабатывает вставку контента с распознаванием URL
 * @param text Текст для обработки
 * @param options Опции обработки
 * @returns true если контент был обработан специальным образом
 */
export const handleContentPaste = async (text: string, options: EmbedOptions): Promise<boolean> => {
  const { showLoading, insertText, insertHtml } = options

  try {
    const contentType = recognizeContentType(text)
    if (!contentType) {
      return false // Не распознали специальный тип контента
    }

    showLoading?.()

    const embedContent: EmbedContent = {
      type: contentType,
      url: text
    }

    switch (contentType) {
      case 'video': {
        const { createVideoEmbed } = await import('./html')
        const embedHtml = createVideoEmbed(text)
        if (embedHtml) {
          insertHtml(embedHtml)
          return true
        }
        break
      }
      case 'image': {
        const { createImageEmbed } = await import('./html')
        const embedHtml = createImageEmbed(embedContent)
        insertHtml(embedHtml)
        return true
      }
      case 'audio': {
        const { createAudioHTML } = await import('./html')
        const embedHtml = createAudioHTML(text)
        insertHtml(embedHtml)
        return true
      }
      case 'link': {
        // Вставляем ссылку как текст
        insertText(text)
        return true
      }
    }
  } catch (error) {
    console.error('Error handling paste:', error)
  }

  return false
}

/**
 * Обрабатывает событие вставки из буфера обмена в редактор
 * @param event Событие ClipboardEvent
 * @param editor DOM-элемент редактора
 * @returns true если вставка была обработана специальным образом
 */
export const handleContentPasteEvent = async (event: ClipboardEvent, editor: HTMLElement): Promise<boolean> => {
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
    return await handleContentPaste(text, {
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
