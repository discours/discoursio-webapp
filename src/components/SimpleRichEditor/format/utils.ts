/**
 * @module format/utils
 * @description Общие утилиты для форматирования
 */

/**
 * Универсальная функция для восстановления выделения после операций форматирования
 */
export const restoreSelectionAfterFormat = (
  range: Range,
  target?: Node | null,
  offset?: number,
  expandToElement = false
): boolean => {
  try {
    if (!range) return false

    const selection = window.getSelection()
    if (!selection) return false

    const newRange = document.createRange()

    if (target) {
      const nodeOffset = offset !== undefined ? offset : 0
      try {
        newRange.setStart(target, nodeOffset)
        newRange.setEnd(target, nodeOffset)
      } catch (_e) {
        // Запасной вариант для текстовых узлов
        if (target.nodeType === Node.ELEMENT_NODE) {
          const firstTextNode = findFirstTextNode(target as HTMLElement)
          if (firstTextNode) {
            newRange.setStart(firstTextNode, 0)
            newRange.setEnd(firstTextNode, 0)
          } else {
            newRange.selectNodeContents(target)
            newRange.collapse(true)
          }
        }
      }

      if (expandToElement && target.nodeType === Node.ELEMENT_NODE) {
        newRange.selectNodeContents(target)
      }
    } else {
      newRange.setStart(range.startContainer, range.startOffset)
      newRange.setEnd(range.endContainer, range.endOffset)
    }

    selection.removeAllRanges()
    selection.addRange(newRange)
    return true
  } catch (error) {
    console.error('[restoreSelectionAfterFormat] Error:', error)
    return false
  }
}

/**
 * Находит первый текстовый узел внутри элемента
 */
export const findFirstTextNode = (element: HTMLElement): Node | null => {
  if (!element) return null

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return child
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      const found = findFirstTextNode(child as HTMLElement)
      if (found) return found
    }
  }
  return null
}

/**
 * Получает все узлы-предки от текущего узла до родительского редактора
 */
export const getAncestorNodes = (node: Node | null, editor: HTMLElement): Node[] => {
  const ancestors: Node[] = []
  let current = node

  while (current && current !== editor) {
    ancestors.push(current)
    current = current.parentNode
  }

  return ancestors
}

/**
 * Получает общие предки для форматирования в выделенном диапазоне
 */
export const getCommonFormatAncestors = (range: Range, editor: HTMLElement): Node[] => {
  const commonAncestor = range.commonAncestorContainer

  if (commonAncestor.nodeType === Node.TEXT_NODE) {
    return getAncestorNodes(commonAncestor, editor)
  }

  const nodes: Node[] = []
  const walker = document.createTreeWalker(commonAncestor, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const nodeRange = document.createRange()
      nodeRange.selectNodeContents(node)

      if (
        range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0
      ) {
        return NodeFilter.FILTER_ACCEPT
      }
      return NodeFilter.FILTER_SKIP
    }
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    nodes.push(node)
  }

  nodes.push(...getAncestorNodes(commonAncestor, editor))
  return nodes
}
