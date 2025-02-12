/**
 * @module format
 * @description Unified module for text formatting using modern Selection API
 *
 * Features:
 * - Text formatting (bold, italic, highlight)
 * - Block elements (blockquote, punchline, incut)
 * - Headings (h1-h3)
 * - Lists (ul, ol)
 * - Media (image, video)
 *
 * @example
 * ```ts
 * // Apply formatting
 * applyFormatting('bold', selection)
 *
 * // Remove formatting
 * removeFormatting('bold', selection)
 *
 * // Check formatting state
 * const isActive = hasFormatting('bold', selection)
 * ```
 */

import { CommandType } from './commands'

// Common types
export type SelectionState = {
  range: Range | null
  text: string
  isEmpty: boolean
  position: { top: number; left: number }
}

// Mapping commands to HTML elements configuration
const FORMAT_CONFIG: Record<CommandType, { tag: string; attributes?: Record<string, string> }> = {
  bold: { tag: 'strong', attributes: {} },
  italic: { tag: 'em', attributes: {} },
  link: {
    tag: 'a',
    attributes: { href: '#' }
  },
  blockquote: { tag: 'blockquote', attributes: {} },
  h1: { tag: 'h1', attributes: {} },
  h2: { tag: 'h2', attributes: {} },
  h3: { tag: 'h3', attributes: {} },
  highlight: { tag: 'mark', attributes: {} },
  bulletList: { tag: 'ul', attributes: {} },
  orderedList: { tag: 'ol', attributes: {} },
  punchline: {
    tag: 'div',
    attributes: { 'data-type': 'punchline' }
  },
  footnote: { tag: 'sup', attributes: {} },
  hr: { tag: 'hr' },
  image: { tag: 'img', attributes: {} },
  video: { tag: 'div', attributes: { 'data-type': 'video' } },
  audio: { tag: 'audio', attributes: {} },
  p: { tag: 'p', attributes: {} },
  squib: { tag: 'div', attributes: { 'data-align': '' } },
  'align-left': { tag: 'div', attributes: { 'data-align': 'left' } },
  'align-center': { tag: 'div', attributes: { 'data-align': 'center' } },
  'align-right': { tag: 'div', attributes: { 'data-align': 'right' } },
  'bg-gray': { tag: 'div', attributes: { 'data-bg': 'gray' } },
  'bg-white': { tag: 'div', attributes: { 'data-bg': 'white' } },
  'bg-black': { tag: 'div', attributes: { 'data-bg': 'black' } },
  'bg-yellow': { tag: 'div', attributes: { 'data-bg': 'yellow' } },
  'bg-red': { tag: 'div', attributes: { 'data-bg': 'red' } },
  'bg-green': { tag: 'div', attributes: { 'data-bg': 'green' } }
} as const

/**
 * Creates element with proper attributes for given command
 */
const createElement = (command: CommandType): HTMLElement => {
  const config = FORMAT_CONFIG[command as keyof typeof FORMAT_CONFIG] || { tag: 'span' }
  const element = document.createElement(config.tag)

  if (config.attributes) {
    Object.entries(config.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })
  }

  return element
}

/**
 * Handles selection state management
 */
const manageSelection = (range: Range): Selection => {
  const selection = window.getSelection() || new Selection()
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

/**
 * Applies formatting to selected text
 */
export const applyFormatting = (command: CommandType, state: SelectionState) => {
  if (!state.range) return

  const range = state.range.cloneRange()
  const content = range.extractContents()
  const wrapper = createElement(command)

  // Проверяем, есть ли уже такое форматирование
  const selection = window.getSelection()
  if (selection && hasFormatting(command, selection)) {
    // Если есть - удаляем его
    const fragment = document.createDocumentFragment()
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(content)

    // Находим все элементы с данным форматированием
    const elements = Array.from(tempDiv.getElementsByTagName(FORMAT_CONFIG[command].tag))
    elements.forEach((element) => {
      while (element.firstChild) {
        fragment.appendChild(element.firstChild)
      }
      element.remove()
    })

    range.insertNode(fragment)
  } else {
    // Если нет - добавляем
    wrapper.appendChild(content)
    range.insertNode(wrapper)
  }

  // Восстанавливаем выделение
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/**
 * Removes formatting from selected text
 */
export const removeFormatting = (command: CommandType, state: SelectionState) => {
  if (!state.range) return

  const range = state.range
  const content = range.extractContents()
  const fragment = document.createDocumentFragment()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(content)

  const config = FORMAT_CONFIG[command as keyof typeof FORMAT_CONFIG]
  if (config) {
    const elements = tempDiv.getElementsByTagName(config.tag)
    while (elements.length > 0) {
      const element = elements[0]
      while (element.firstChild) {
        fragment.appendChild(element.firstChild)
      }
      element.remove()
    }
  }

  range.insertNode(fragment)
  manageSelection(range)
}

// Проверяем наличие форматирования в текущем диапазоне
export const checkFormat = (tag: string, range: Range): boolean => {
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node: Node) => {
      if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP
      return node.matches(tag) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    }
  })

  let node = walker.currentNode
  while (node) {
    if (range.intersectsNode(node)) {
      return true
    }
    node = walker.nextNode() as Node
  }
  return false
}

/**
 * Checks if formatting is active for selected text
 */
export const hasFormatting = (format: CommandType, selection: Selection | null): boolean => {
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  const parentElement = range.commonAncestorContainer as HTMLElement

  // Получаем ближайший HTML элемент
  const element = parentElement.nodeType === Node.ELEMENT_NODE ? parentElement : parentElement.parentElement

  if (!element) return false

  switch (format) {
    case 'bold':
      return checkFormat('strong', range)
    case 'italic':
      return checkFormat('em', range)
    case 'link':
      return checkFormat('a', range)
    case 'blockquote':
      return checkFormat('blockquote', range)
    case 'punchline':
      return checkFormat('[data-type="punchline"]', range)
    default:
      return false
  }
}

// Move this helper function to the top, before it's used
const getSelectedElement = (selection: Selection): HTMLElement | null => {
  const range = selection.getRangeAt(0)
  const parentElement = range.commonAncestorContainer as HTMLElement
  return parentElement.nodeType === Node.ELEMENT_NODE ? parentElement : parentElement.parentElement
}

/**
 * Gets all active formatting states
 * @param selection Current selection object
 * @returns Object containing active format states
 * @example
 * const formats = getActiveFormats(window.getSelection())
 * if (formats.text.bold) {
 *   // Handle bold text
 * }
 */
export const getActiveFormats = (selection: Selection | null) => {
  const formats = {
    block: {
      blockquote: false,
      punchline: false,
      incut: false
    },
    text: {
      bold: false,
      italic: false,
      link: false,
      highlight: false
    }
  }

  if (!selection?.rangeCount) return formats

  const element = getSelectedElement(selection)
  if (!element) return formats

  formats.text.bold = hasFormatting('bold', selection)
  formats.text.italic = hasFormatting('italic', selection)
  formats.text.link = hasFormatting('link', selection)
  formats.block.blockquote = hasFormatting('blockquote', selection)
  formats.block.punchline = hasFormatting('punchline', selection)

  return formats
}

/**
 * Resets all formatting
 */
export const resetFormat = (editor: HTMLElement, range?: Range) => {
  if (!range || !editor) return

  const selection = manageSelection(range.cloneRange())
  const fragment = range.extractContents()
  const p = document.createElement('p')
  p.textContent = fragment.textContent || ''

  range.insertNode(p)
  range.selectNodeContents(p)
  selection.removeAllRanges()
  selection.addRange(range)
}

// Legacy support with proper typing
export const formatCommand = hasFormatting
export const applyFormat = (_kind: string, cmd: CommandType, range: Range) => {
  const selection = window.getSelection()
  if (!selection) return

  selection.removeAllRanges()
  selection.addRange(range)

  applyFormatting(cmd, {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  })
}

export const removeFormat = removeFormatting
