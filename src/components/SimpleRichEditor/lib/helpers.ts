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
export const getAllSquibs = (editor: HTMLElement): Array<{ id: string; content: string; element: HTMLElement }> => {
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

/**
 * Ищет родительский элемент, соответствующий селектору или функции предиката
 *
 * @param element - Элемент, для которого ищем предка
 * @param selector - Строковый селектор (тег) или функция-предикат
 * @returns Найденный элемент или null
 *
 * @example
 * // Поиск по тегу
 * const blockquote = findAncestor(node, 'BLOCKQUOTE');
 *
 * // Поиск с предикатом
 * const punchline = findAncestor(node, el =>
 *   el.tagName === 'SPAN' && el.classList.contains('punchline')
 * );
 */
export function findAncestor(element: Node | null, selector: string | ((element: Element) => boolean)): Element | null {
  if (!element) return null

  // Если текущий элемент - текстовый узел, начинаем с родителя
  let current: Element | null = element.nodeType === Node.TEXT_NODE ? element.parentElement : (element as Element)

  // Определяем функцию проверки в зависимости от типа селектора
  const matchesSelector = typeof selector === 'function' ? selector : (el: Element) => el.tagName === selector

  // Поднимаемся по дереву DOM до корня документа
  while (current && !matchesSelector(current)) {
    current = current.parentElement
  }

  return current
}

/**
 * Возвращает все узлы в указанном диапазоне выделения.
 *
 * @param {Range} range - Диапазон выделения, для которого нужно получить узлы
 * @returns {Node[]} - Массив узлов, находящихся в диапазоне
 *
 * @example
 * // Получить все узлы в текущем выделении
 * const selection = window.getSelection();
 * if (selection && selection.rangeCount > 0) {
 *   const range = selection.getRangeAt(0);
 *   const nodes = getNodesInRange(range);
 *   // Работа с узлами...
 * }
 */
export function getNodesInRange(range: Range): Node[] {
  // Проверяем, есть ли выделение и не схлопнуто ли оно
  if (!range || range.collapsed) {
    return []
  }

  const nodes: Node[] = []

  try {
    // Используем TreeWalker для обхода узлов в диапазоне
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Проверяем, находится ли узел в диапазоне
          const nodeRange = document.createRange()

          try {
            nodeRange.selectNodeContents(node)
            // Полностью в диапазоне
            if (
              range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0 &&
              range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0
            ) {
              return NodeFilter.FILTER_ACCEPT
            }

            // Частично в диапазоне
            if (
              range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
              range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0
            ) {
              return NodeFilter.FILTER_ACCEPT
            }

            // Содержит границу диапазона
            if (range.commonAncestorContainer === node) {
              return NodeFilter.FILTER_ACCEPT
            }
          } catch (e) {
            console.error('Ошибка при проверке узла в диапазоне:', e)
          }

          return NodeFilter.FILTER_SKIP
        }
      }
    )

    // Собираем узлы из TreeWalker
    let currentNode: Node | null
    while ((currentNode = treeWalker.nextNode())) {
      try {
        nodes.push(currentNode)
      } catch (e) {
        console.error('Ошибка при добавлении узла:', e)
      }
    }
  } catch (e) {
    console.error('Ошибка при получении узлов в диапазоне:', e)
  }

  return nodes
}

// cursorPosition упрощенная версия - используем getCursorPosition из utils.ts
export { getCursorPosition as cursorPosition } from './utils'

/**
 * Пустой объект активных форматов
 * @returns Объект ActiveFormatsType со значениями false для всех свойств
 */
export function emptyActiveFormats(): ActiveFormatsType {
  return {
    bold: false,
    italic: false,
    link: false,
    blockquote: false,
    punchline: false,
    h1: false,
    h2: false,
    h3: false,
    highlight: false,
    p: false,
    bulletList: false,
    orderedList: false
  }
}

/**
 * Тип для активных форматов
 */
export type ActiveFormatsType = {
  bold: boolean
  italic: boolean
  link: boolean
  blockquote: boolean
  punchline: boolean
  h1: boolean
  h2: boolean
  h3: boolean
  highlight: boolean
  p: boolean
  bulletList: boolean
  orderedList: boolean
}
