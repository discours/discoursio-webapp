/**
 * @module lib/dom-utils
 * @description Утилиты для работы с DOM в редакторе
 */

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
