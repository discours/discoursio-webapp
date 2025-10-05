/**
 * @module format/selection-utils
 * @description Утилиты для работы с выделением и определения типа форматирования
 */

/**
 * Проверяет, выделен ли весь блок полностью
 * Блочное форматирование применяется только если:
 * 1. Курсор находится в блоке без выделения (isEmpty: true)
 * 2. Весь текст блока выделен полностью
 */
export function isFullBlockSelected(range: Range, editorRoot: HTMLElement): boolean {
  if (!range || !editorRoot) return false

  // Если нет выделения (collapsed) - это курсор в блоке
  if (range.collapsed) {
    return true // Курсор = блочное форматирование разрешено
  }

  // Есть выделение - проверяем, выделен ли весь блок
  const startContainer = range.startContainer
  const endContainer = range.endContainer

  // Находим блочный элемент для начала и конца выделения
  const startBlock = getBlockElement(startContainer, editorRoot)
  const endBlock = getBlockElement(endContainer, editorRoot)

  // Если начало и конец в разных блоках - это не полное выделение блока
  if (startBlock !== endBlock) {
    return false
  }

  // Если блок не найден
  if (!startBlock) {
    return false
  }

  // Проверяем, что выделен весь текст блока
  const blockText = startBlock.textContent || ''
  const selectedText = range.toString()

  // Если выделенный текст равен всему тексту блока - это полное выделение
  return blockText === selectedText
}

/**
 * Находит ближайший блочный элемент для node
 */
function getBlockElement(node: Node, editorRoot: HTMLElement): HTMLElement | null {
  let current: Node | null = node

  while (current && current !== editorRoot) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement
      const tagName = element.tagName.toLowerCase()

      // Блочные элементы
      if (['p', 'h1', 'h2', 'h3', 'blockquote', 'div', 'li'].includes(tagName)) {
        return element
      }
    }
    current = current.parentNode
  }

  return null
}

/**
 * Определяет, должна ли команда применяться как блочное форматирование
 */
export function shouldApplyBlockFormatting(command: string, range: Range, editorRoot: HTMLElement): boolean {
  // Список блочных команд
  const blockCommands = ['h1', 'h2', 'h3', 'blockquote', 'p', 'punchline', 'squib']

  // Если это не блочная команда - false
  if (!blockCommands.includes(command)) {
    return false
  }

  // Проверяем, выделен ли весь блок
  return isFullBlockSelected(range, editorRoot)
}
