/**
 * @module lib/positionUtils
 * @description Утилиты для вычисления позиций элементов (DRY consolidation)
 * Объединяет функциональность из positioning.ts и positionUtils.ts
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
 * Опции для вычисления позиции формы
 */
export interface FormPositionOptions {
  /** Смещение по вертикали от базовой позиции */
  offsetY?: number
  /** Смещение по горизонтали от базовой позиции */
  offsetX?: number
  /** Учитывать ли прокрутку страницы */
  includeScroll?: boolean
}

/**
 * Определяет, является ли устройство сенсорным
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Вычисляет позицию для inline формы на основе текущего выделения
 * Консолидирует логику из handlers/forms.ts
 *
 * @param editor - DOM элемент редактора
 * @param cursorPosition - Текущая позиция курсора (опционально)
 * @param options - Опции позиционирования
 * @returns Position объект с координатами или null
 */
export const calculateFormPosition = (
  editor: HTMLElement | null | undefined,
  cursorPosition?: Position | null,
  options: FormPositionOptions = {}
): Position | null => {
  const { offsetY = 5, offsetX = 0, includeScroll = true } = options

  // 1. Пытаемся получить позицию из текущего выделения
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    return {
      top: rect.bottom + (includeScroll ? window.scrollY : 0) + offsetY,
      left: rect.left + (includeScroll ? window.scrollX : 0) + offsetX
    }
  }

  // 2. Используем переданную позицию курсора
  if (cursorPosition) {
    return {
      top: cursorPosition.top + (includeScroll ? window.scrollY : 0) + offsetY,
      left: cursorPosition.left + (includeScroll ? window.scrollX : 0) + offsetX
    }
  }

  // 3. Fallback - центр редактора
  if (editor) {
    const editorRect = editor.getBoundingClientRect()
    return {
      top: editorRect.top + (includeScroll ? window.scrollY : 0) + editorRect.height / 2,
      left: editorRect.left + (includeScroll ? window.scrollX : 0) + editorRect.width / 2
    }
  }

  return null
}

/**
 * Вычисляет позицию для Plus-меню (на строке ниже курсора)
 * Консолидирует логику из handlers/ui.ts
 *
 * @param editor - DOM элемент редактора
 * @returns Координата top для Plus-меню
 */
export const calculatePlusMenuTop = (editor: HTMLElement | null | undefined): number => {
  if (!editor) return 0

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    const editorRect = editor.getBoundingClientRect()
    return editorRect.top + 10
  }

  const range = selection.getRangeAt(0)

  // Находим родительский элемент-строку текущей позиции курсора
  const container = range.startContainer
  let currentLine: Element | null = null

  let node: Node | null = container
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName

      // Проверяем блочные элементы
      if (tagName === 'DIV' || tagName === 'P' || tagName === 'H1' || tagName === 'H2' || tagName === 'H3') {
        currentLine = element
        break
      }
    }
    node = node.parentNode
  }

  if (!currentLine) {
    const editorRect = editor.getBoundingClientRect()
    return editorRect.top + 10
  }

  // Получаем координаты текущей строки и показываем плюс на следующей строке
  const lineRect = currentLine.getBoundingClientRect()
  const lineHeight = lineRect.height || 24

  // Плюс на строке ниже = верх текущей строки + высота строки + отступ для центрирования
  return lineRect.top + lineHeight + lineHeight / 2 - 16
}

/**
 * Вычисляет left позицию для Plus-меню (слева от редактора)
 *
 * @param editor - DOM элемент редактора
 * @param offset - Смещение влево от края редактора (по умолчанию 34px)
 * @returns Координата left для Plus-меню
 */
export const calculatePlusMenuLeft = (editor: HTMLElement | null | undefined, offset = 34): number => {
  if (!editor) return 0

  const editorRect = editor.getBoundingClientRect()
  return editorRect.left - offset
}

/**
 * Вычисляет позицию для меню подвёрстки (incut menu)
 * Центрирует меню по горизонтали редактора, размещает над блоком
 *
 * @param incutElement - Элемент подвёрстки
 * @param editor - DOM элемент редактора
 * @param offsetY - Дополнительное смещение по вертикали (по умолчанию 24px)
 * @returns Position объект с координатами
 */
export const calculateIncutMenuPosition = (
  incutElement: HTMLElement,
  editor: HTMLElement | null | undefined,
  offsetY = 24
): Position => {
  const rect = incutElement.getBoundingClientRect()
  const editorRect = editor?.getBoundingClientRect()

  if (!editorRect) {
    return { top: 50, left: 50 }
  }

  // Позиционируем меню по центру РЕДАКТОРА (не блока), над блоком подвёрстки
  // Поднимаем тулбар выше на полстроки дополнительно к transform: translate(-50%, -100%)
  return {
    top: rect.top - editorRect.top - offsetY,
    left: editorRect.width / 2 // Центр редактора по горизонтали
  }
}

/**
 * Получает координаты элемента относительно viewport
 *
 * @param element - DOM элемент
 * @returns Position объект с координатами или null
 */
export const getElementPosition = (element: HTMLElement | null | undefined): Position | null => {
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    top: rect.top,
    left: rect.left
  }
}

/**
 * Получает координаты элемента относительно документа (с учетом прокрутки)
 *
 * @param element - DOM элемент
 * @returns Position объект с координатами или null
 */
export const getElementAbsolutePosition = (element: HTMLElement | null | undefined): Position | null => {
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX
  }
}

/**
 * Проверяет, находится ли точка внутри элемента
 *
 * @param point - Координаты точки
 * @param element - DOM элемент
 * @returns true если точка внутри элемента
 */
export const isPointInsideElement = (point: Position, element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect()
  return point.left >= rect.left && point.left <= rect.right && point.top >= rect.top && point.top <= rect.bottom
}

/**
 * Получает позицию для элементов интерфейса редактора
 * Универсальная функция для позиционирования различных типов меню
 *
 * @param editor - Элемент редактора
 * @param options - Параметры позиционирования
 * @returns Position объект с координатами
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
 *
 * @param editorRef - Ref на DOM-элемент редактора
 * @returns Position объект с координатами тулбара
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
 *
 * @param editorRef - Ref на DOM-элемент редактора
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
 *
 * @param editorRef - Ссылка на DOM-элемент редактора
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
