/**
 * @module helpers
 * @description Вспомогательные функции для работы с медиа-контентом в редакторе
 */

import { Position } from './types'

// Уникальный идентификатор редактора врезки
export const squibId = 'squib-editor'

/**
 * Получает все медиа элементы из редактора
 * @param editor Элемент редактора
 * @returns Массив медиа элементов
 *
 * @example
 * ```ts
 * const mediaElements = getMedia(editorRef());
 * console.log(`В редакторе ${mediaElements.length} медиа-элементов`);
 * ```
 */
export const getMedia = (editor: HTMLElement | null): HTMLElement[] => {
  if (!editor) return []
  return Array.from(editor.querySelectorAll('img, video, audio, iframe'))
}

/**
 * Интерфейс для параметров вставки медиа в редактор
 */
export interface InsertMedia {
  /** Тип медиа-контента */
  type: 'image' | 'video' | 'audio'
  /** URL медиа-ресурса */
  url: string
  /** Заголовок или альтернативный текст */
  title?: string
  /** Дополнительные атрибуты */
  attributes?: Record<string, string>
}

/**
 * Создает HTML для вставки медиа в редактор
 * @param params Параметры медиа
 * @returns HTML строка для вставки
 *
 * @example
 * ```ts
 * const html = createMediaHtml({
 *   type: 'image',
 *   url: 'https://example.com/image.jpg',
 *   title: 'Описание изображения'
 * });
 * ```
 */
export const createMediaHtml = (params: InsertMedia): string => {
  const { type, url, title = '', attributes = {} } = params

  // Собираем строку атрибутов
  const attributesStr = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  switch (type) {
    case 'image':
      return `<img src="${url}" alt="${title}" ${attributesStr} />`
    case 'video':
      return `<video src="${url}" controls title="${title}" ${attributesStr}></video>`
    case 'audio':
      return `<audio src="${url}" controls title="${title}" ${attributesStr}></audio>`
    default:
      return ''
  }
}

/**
 * Варианты типов меню для позиционирования
 */
export type MenuType = 'toolbar' | 'float' | 'plus' | 'form'

/**
 * Варианты расположения меню
 */
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

/**
 * Параметры позиционирования меню
 */
export interface PositionOptions {
  /** Тип меню для позиционирования */
  type: MenuType
  /** Предпочтительное расположение меню */
  placement?: Placement
  /** Отступ от элемента в пикселях */
  offset?: number
  /** Нужно ли центрировать по горизонтали */
  centerHorizontally?: boolean
}

/**
 * Добавить или обновить функцию для определения типа устройства
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Обновляем функцию получения позиции для тулбара - используем фиксированную позицию
 * @param editor Элемент редактора
 * @param options Параметры позиционирования
 * @returns Позиция тулбара
 */
export const getEditorPosition = (
  editor: HTMLElement | null,
  options: {
    type: 'float' | 'plus'
    placement?: 'top' | 'bottom' | 'left' | 'right'
    offset?: number
    centerHorizontally?: boolean
  }
): Position => {
  if (!editor) return { top: 0, left: 0 }

  const { type, offset = 0 } = options
  const selection = window.getSelection()

  // Для плавающего тулбара при выделении текста
  if (type === 'float' && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Базовое позиционирование для всех устройств - над серединой выделения
    return {
      top: Math.max(10, rect.top - 40), // Минимум 10px от верха
      left: rect.left + rect.width / 2 // Центрируем над выделением
    }
  }

  // Для plus menu или запасной вариант
  if (editor) {
    const rect = editor.getBoundingClientRect()
    return {
      top: rect.top + offset,
      left: rect.left + (options.centerHorizontally ? rect.width / 2 : 20)
    }
  }

  return { top: 0, left: 0 }
}

/**
 * Получает все врезки из редактора
 * @param editor Элемент редактора
 * @returns Массив врезок с их идентификаторами и содержимым
 */
export const getAllSquibs = (
  editor: HTMLElement
): Array<{ id: string; content: string; element: HTMLElement }> => {
  if (!editor) return []

  // Находим все врезки в редакторе
  const squibElements = editor.querySelectorAll('[data-type="squib"]')
  if (!squibElements.length) return []

  // Собираем информацию о врезках
  const squibs = Array.from(squibElements).map((squib) => {
    const squibId = squib.getAttribute('data-squib-id')
    if (!squibId) return null

    return {
      id: squibId,
      content: squib.innerHTML,
      element: squib as HTMLElement
    }
  })

  // Фильтруем null значения
  return squibs.filter(Boolean) as Array<{ id: string; content: string; element: HTMLElement }>
}

/**
 * Находит конкретную врезку по идентификатору
 * @param editor Элемент редактора
 * @param squibId Идентификатор врезки
 * @returns Данные врезки или null, если не найдена
 */
export const getSquibById = (
  editor: HTMLElement,
  squibId: string
): { id: string; content: string; element: HTMLElement } | null => {
  if (!editor || !squibId) return null

  // Находим элемент врезки
  const squibElement = editor.querySelector(`[data-squib-id="${squibId}"]`)
  if (!squibElement) return null

  return {
    id: squibId,
    content: squibElement.innerHTML,
    element: squibElement as HTMLElement
  }
}

/**
 * Удаляет врезку из редактора
 * @param editor Элемент редактора
 * @param squibId ID врезки
 * @returns true если удаление успешно
 */
export const removeSquib = (editor: HTMLElement, squibId: string): boolean => {
  if (!editor || !squibId) return false

  // Находим врезку
  const squibElement = editor.querySelector(`[data-squib-id="${squibId}"]`)
  if (!squibElement) return false

  // Удаляем элемент
  squibElement.remove()
  return true
}
