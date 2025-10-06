/**
 * @module lib/dom-utils
 * @description Утилиты для работы с DOM в редакторе (объединяет dom.ts и dom-utils.ts)
 */

/**
 * Получает HTMLElement из узла (текстового или элемента)
 * Консолидирует паттерн из detection.ts и других модулей
 *
 * @param node - Узел для преобразования
 * @returns HTMLElement или null
 */
export const getElementFromNode = (node: Node | null): HTMLElement | null => {
  if (!node) return null
  return node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
}

/**
 * Универсальная функция поиска родительского элемента
 * Консолидирует логику из старого dom-utils и других модулей
 *
 * @param element - Начальный элемент
 * @param predicate - Функция проверки или строка селектора
 * @param rootNode - Корневой узел (опционально)
 * @returns Найденный элемент или null
 */
export const findAncestor = (
  element: Element | null,
  predicate: string | ((el: Element) => boolean),
  rootNode?: HTMLElement
): Element | null => {
  if (!element) return null

  let current: Element | null = element

  while (current && current !== rootNode) {
    // Если предикат - строка, используем closest
    if (typeof predicate === 'string') {
      const found = current.closest(predicate)
      if (found) return found
      break
    }

    // Если предикат - функция, проверяем каждый элемент
    if (predicate(current)) {
      return current
    }

    if (!current.parentElement || current.parentElement === document.body) {
      break
    }

    current = current.parentElement
  }

  return null
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
