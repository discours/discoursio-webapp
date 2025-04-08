/**
 * @module audio
 * @description Модуль для работы с аудио в редакторе
 */

import { MediaItem } from '~/graphql/schema/core.gen'
import { replaceSelection } from './utils'

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
 * Вставляет аудио в редактор
 * @param url URL аудио-файла
 * @param editor Редактор для вставки
 * @returns true если вставка успешна
 */
export const insertAudio = (url: string, editor: HTMLElement | null): boolean => {
  if (!editor || !url) return false

  // Создаем HTML для аудио
  const audioHtml = createAudioHTML(url)

  // Вставляем в текущую позицию курсора
  return replaceSelection(audioHtml, editor)
}

/**
 * Обрабатывает вставку аудио из загрузчика
 * @param audioItems Загруженные аудио элементы
 * @param editor Редактор
 * @returns true если вставка успешна
 */
export const handleAudioUploaderResult = (audioItems: MediaItem[], editor: HTMLElement | null): boolean => {
  if (!editor || !audioItems.length) return false

  // Вставляем каждый аудио-файл
  let success = true
  audioItems.forEach((audio) => {
    if (audio.url) {
      const result = insertAudio(audio.url, editor)
      if (!result) success = false
    }
  })

  return success
}

/**
 * Валидирует URL аудио-файла
 * @param url URL для проверки
 * @returns true если URL валиден
 */
export const isUrl = (url: string): boolean => {
  // Проверяем, является ли строка URL
  try {
    const urlObj = new URL(url)
    // Дополнительная проверка, например, что протокол HTTP или HTTPS
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch (_e) {
    // Если конструктор URL выбрасывает исключение, значит строка не является URL
    return false
  }
}
