/**
 * @module format/block
 * @description Блочное форматирование (заголовки, цитаты, списки)
 */

import { CommandType, SelectionState } from '../lib/types'
import { FORMAT_CONFIG } from './config'
import { findFirstTextNode } from './utils'

/**
 * Находит ближайший блочный элемент в редакторе
 */
const getClosestBlockElement = (node: Node | null, editorRoot: HTMLElement): HTMLElement | null => {
  if (!node || !editorRoot) return null
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node

  while (current && current !== editorRoot && editorRoot.contains(current)) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement
      if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'BLOCKQUOTE', 'LI', 'PRE'].includes(element.tagName)) {
        return element
      }
    }
    current = current.parentElement
  }

  if (node.parentElement === editorRoot && editorRoot.childNodes.length === 1) {
    return editorRoot
  }

  return null
}

/**
 * Переключает блочное форматирование
 */
export const toggleBlockFormat = (command: CommandType, state: SelectionState, editorRoot: HTMLElement | null) => {
  if (!state.range || !editorRoot) {
    console.warn('[toggleBlockFormat] Missing range or editorRoot')
    return
  }

  const range = state.range
  const config = FORMAT_CONFIG[command]
  const defaultTag = 'p'

  // Только поддерживаемые блочные типы
  if (!config || !['h1', 'h2', 'h3', 'blockquote', 'p'].includes(config.tag)) {
    console.warn(`[toggleBlockFormat] Command ${command} ('${config?.tag}') is not a supported block type.`)
    return
  }

  const targetTag = config.tag.toLowerCase()

  // Находим релевантный блочный элемент
  const blockElement = getClosestBlockElement(range.startContainer, editorRoot)

  if (!blockElement) {
    console.warn('[toggleBlockFormat] Could not find parent block element.')
    return
  }

  const currentTag = blockElement.tagName.toLowerCase()
  const newTag = currentTag === targetTag ? defaultTag : targetTag

  // Избегаем изменений если уже корректно
  if (currentTag === newTag) return

  console.log(`[toggleBlockFormat] Changing block from <${currentTag}> to <${newTag}>`)

  const newBlock = document.createElement(newTag)

  // Копируем атрибуты если необходимо
  const newConfig = Object.values(FORMAT_CONFIG).find((c) => c.tag === newTag)
  if (newConfig?.attributes) {
    Object.entries(newConfig.attributes).forEach(([key, value]) => {
      if (value || key.startsWith('data-')) {
        newBlock.setAttribute(key, value)
      }
    })
  }

  // Перемещаем содержимое из старого блока в новый
  while (blockElement.firstChild) {
    newBlock.appendChild(blockElement.firstChild)
  }

  // Убеждаемся, что блок не пустой
  if (!newBlock.hasChildNodes()) {
    newBlock.appendChild(document.createElement('br'))
  }

  // Заменяем старый блок новым
  try {
    blockElement.parentNode?.replaceChild(newBlock, blockElement)
  } catch (e) {
    console.error('[toggleBlockFormat] Error replacing node:', e)
    return
  }

  // Восстанавливаем позицию курсора в новом блоке
  try {
    const newRange = document.createRange()
    const selection = window.getSelection()

    if (selection) {
      // Ищем текстовый узел или ставим курсор в начало блока
      const firstTextNode = findFirstTextNode(newBlock)
      if (firstTextNode?.textContent) {
        // Сохраняем позицию курсора относительно начала текста
        const originalOffset = Math.min(state.range.startOffset, firstTextNode.textContent.length)
        newRange.setStart(firstTextNode, originalOffset)
        newRange.setEnd(firstTextNode, originalOffset)
        console.log('[toggleBlockFormat] Cursor positioned at offset:', originalOffset)
      } else {
        // Если нет текстовых узлов, ставим курсор в начало блока
        newRange.setStart(newBlock, 0)
        newRange.setEnd(newBlock, 0)
        console.log('[toggleBlockFormat] Cursor positioned at block start')
      }

      selection.removeAllRanges()
      selection.addRange(newRange)

      // Фокус на редакторе (без принуждения)
      if (editorRoot && document.activeElement !== editorRoot) {
        editorRoot.focus()
      }

      console.log('[toggleBlockFormat] Selection and focus restored successfully')
    }
  } catch (e) {
    console.error('[toggleBlockFormat] Error restoring selection:', e)
    // Запасной вариант - просто фокус
    if (editorRoot) {
      editorRoot.focus()
    }
  }
}

/**
 * Сбрасывает все форматирование
 */
export const resetFormat = (editor: HTMLElement, range?: Range) => {
  if (!range || !editor) return

  const selection = window.getSelection()
  if (!selection) return

  selection.removeAllRanges()
  selection.addRange(range.cloneRange())

  const fragment = range.extractContents()
  const p = document.createElement('p')
  p.textContent = fragment.textContent || ''

  range.insertNode(p)
  range.selectNodeContents(p)
  selection.removeAllRanges()
  selection.addRange(range)
}
