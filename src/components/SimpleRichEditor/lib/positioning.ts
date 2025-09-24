/**
 * @module lib/positioning
 * @description Функции позиционирования элементов интерфейса редактора
 */

import { Position } from './types'

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
 * Определяет, является ли устройство сенсорным
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Получает позицию для элементов интерфейса редактора
 * @param editor Элемент редактора
 * @param options Параметры позиционирования
 * @returns Позиция элемента
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
      top: Math.max(10, rect.top - 60), // Увеличиваем отступ до 60px от верха
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
 * Расчет позиции плавающего тулбара
 * @param editorRef Ref на DOM-элемент редактора
 * @returns Объект с позицией тулбара
 */
export const getFloatingToolbarPosition = (editorRef: () => HTMLDivElement | undefined): Position => {
  return getEditorPosition(editorRef() || null, {
    type: 'float',
    placement: 'top',
    offset: 40,
    centerHorizontally: true
  })
}

/**
 * Расчет позиции плюс-меню
 * @param editorRef Ref на DOM-элемент редактора
 * @returns Объект с позицией меню
 */
export const getPlusMenuPosition = (
  editorRef: () => HTMLDivElement | undefined
): {
  top: number
  left: number
  isVisible?: boolean
} => {
  return getEditorPosition(editorRef() || null, {
    type: 'plus',
    placement: 'left',
    offset: 30
  })
}

/**
 * Получает позицию для плавающего меню редактора
 * @param editorRef Ссылка на DOM-элемент редактора
 * @returns Объект с позиционированием: {top, left, isVisible}
 */
export const getEditorFloatingMenuPosition = (
  editorRef: () => HTMLDivElement | undefined
): {
  top: number
  left: number
  isVisible?: boolean
} => {
  return getEditorPosition(editorRef() || null, {
    type: 'float',
    placement: 'bottom',
    offset: 10,
    centerHorizontally: true
  })
}
