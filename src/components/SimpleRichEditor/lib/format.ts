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

import { CommandType } from './types'

// Common types
export type SelectionState = {
  range: Range | null
  text: string
  isEmpty: boolean
  position: { top: number; left: number }
}

/**
 * Определяет структуру состояния форматирования
 */
export type FormattingState = {
  text: {
    bold: boolean
    italic: boolean
    link: boolean
  }
  block: {
    blockquote: boolean
    punchline: boolean
  }
}

// Mapping commands to HTML elements configuration
export const FORMAT_CONFIG: Record<CommandType, { tag: string; attributes?: Record<string, string> }> = {
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
  'bg-green': { tag: 'div', attributes: { 'data-bg': 'green' } },
  'bg-color': { tag: 'div', attributes: { 'data-bg': '' } }
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
  const config = FORMAT_CONFIG[command]

  if (!config) {
    console.log('No config found for command:', command)
    return
  }

  // Проверяем, есть ли уже форматирование этого типа в выделении
  // Обработка пустого выделения (курсор)
  if (state.isEmpty) {
    const container = range.startContainer
    const element =
      container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (!element) return

    // Проверяем наличие форматирования у родителя
    const formattedParent = element.closest(config.tag)

    // Если уже есть форматирование этого типа, предотвращаем создание вложенных тегов
    if (formattedParent) {
      console.log('Formatting already exists, preventing nested tags')
      // Вместо создания нового тега просто позиционируем курсор
      range.collapse(true)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      return
    }

    // Создаем новый форматированный элемент
    const wrapper = createElement(command)
    wrapper.textContent = '\u200B' // Zero-width space для пустого тега

    // Вставляем элемент и позиционируем курсор внутри него
    range.insertNode(wrapper)
    range.selectNodeContents(wrapper)
    range.collapse(true)

    return
  }

  // Обработка выделения текста
  // Сначала клонируем выделение для анализа
  const fragment = range.cloneContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // Проверяем, есть ли уже форматированные элементы этого типа в выделении
  const existingFormatted = tempDiv.querySelectorAll(config.tag)

  // Если все выделение уже отформатировано этим форматом, предотвращаем создание вложенных тегов
  if (existingFormatted.length > 0) {
    const formattedText = Array.from(existingFormatted).reduce(
      (acc, el) => acc + (el.textContent || ''),
      ''
    )
    if (formattedText.length === (tempDiv.textContent || '').length) {
      console.log('Selection already completely formatted, preventing nested tags')
      return
    }
  }

  // Теперь извлекаем и форматируем контент
  const content = range.extractContents()

  // Проверяем содержимое на уже отформатированные элементы
  const contentDiv = document.createElement('div')
  contentDiv.appendChild(content)

  // Находим элементы, которые уже имеют такое форматирование
  const alreadyFormatted = contentDiv.querySelectorAll(config.tag)

  // Убираем форматирование с уже отформатированных элементов чтобы избежать вложенности
  alreadyFormatted.forEach((el) => {
    const innerContent = document.createDocumentFragment()
    while (el.firstChild) {
      innerContent.appendChild(el.firstChild)
    }
    el.parentNode?.replaceChild(innerContent, el)
  })

  // Создаем новый форматированный элемент
  const wrapper = createElement(command)

  // Добавляем очищенное содержимое в новый форматированный элемент
  while (contentDiv.firstChild) {
    wrapper.appendChild(contentDiv.firstChild)
  }

  // Вставляем форматированный элемент обратно в документ
  range.insertNode(wrapper)

  // Позиционируем выделение вокруг всего нового элемента
  range.setStartBefore(wrapper)
  range.setEndAfter(wrapper)

  // Обновляем выделение в документе
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

/**
 * Удаляет форматирование выделенного текста
 */
export const removeFormatting = (command: CommandType, state: SelectionState) => {
  if (!state.range) return

  const range = state.range.cloneRange()
  const config = FORMAT_CONFIG[command]

  if (!config) {
    console.log('No config found for command:', command)
    return
  }

  // Если пустое выделение (курсор)
  if (state.isEmpty) {
    const container = range.startContainer
    const element =
      container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (!element) return

    // Находим ближайший родительский элемент с требуемым форматированием
    const formattedParent = element.closest(config.tag)

    if (formattedParent) {
      // Находим позицию текущего курсора внутри форматированного элемента
      const offset = range.startOffset

      // Создаем временный контейнер для содержимого форматированного элемента
      const tempContainer = document.createDocumentFragment()

      // Копируем все содержимое в этот контейнер
      while (formattedParent.firstChild) {
        tempContainer.appendChild(formattedParent.firstChild)
      }

      // Вставляем содержимое вместо форматированного элемента
      formattedParent.parentNode?.insertBefore(tempContainer, formattedParent)

      // Удаляем пустой форматированный элемент
      formattedParent.parentNode?.removeChild(formattedParent)

      // Устанавливаем позицию курсора в то же место, где он был
      try {
        const newTextNode = range.startContainer
        const newRange = document.createRange()
        newRange.setStart(newTextNode, Math.min(offset, newTextNode.textContent?.length || 0))
        newRange.setEnd(newTextNode, Math.min(offset, newTextNode.textContent?.length || 0))

        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      } catch (error) {
        console.error('Error setting cursor position after removing formatting:', error)
      }
    }

    return
  }

  // Если есть выделение текста
  const fragment = range.extractContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // Находим все элементы с нужным форматированием внутри выделения
  const formattedElements = tempDiv.querySelectorAll(config.tag)

  // Удаляем форматирование, заменяя элементы на их содержимое
  formattedElements.forEach((el) => {
    const content = document.createDocumentFragment()

    // Копируем содержимое форматированного элемента
    while (el.firstChild) {
      content.appendChild(el.firstChild)
    }

    // Заменяем форматированный элемент его содержимым
    el.parentNode?.replaceChild(content, el)
  })

  // Вставляем обратно текст с удаленным форматированием
  range.insertNode(tempDiv)

  // Если вставили div-контейнер, извлекаем его содержимое
  if (tempDiv.parentNode) {
    const content = document.createDocumentFragment()
    while (tempDiv.firstChild) {
      content.appendChild(tempDiv.firstChild)
    }
    tempDiv.parentNode.replaceChild(content, tempDiv)
  }

  // Обновляем выделение, чтобы оно охватывало только что вставленный текст
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()

    try {
      // Создаем новый диапазон, который охватывает всё содержимое
      const newRange = document.createRange()
      newRange.setStartBefore(range.startContainer)
      newRange.setEndAfter(range.endContainer)
      selection.addRange(newRange)
    } catch (error) {
      console.error('Error restoring selection after removing formatting:', error)
      // Запасной вариант - просто устанавливаем курсор в начало
      range.collapse(true)
      selection.addRange(range)
    }
  }
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
 * Проверяет, имеет ли текущее выделение указанный тип форматирования
 * @param command - Тип форматирования
 * @param state - Состояние выделения
 * @returns true, если текущее выделение имеет указанное форматирование
 */
export const hasFormatting = (command: CommandType, state: SelectionState): boolean => {
  if (!state.range) return false

  const config = FORMAT_CONFIG[command]
  if (!config) return false

  // Если пустое выделение (курсор)
  if (state.isEmpty) {
    const container = state.range.startContainer
    const element =
      container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (!element) return false

    // Проверяем, находится ли курсор внутри элемента с указанным форматированием
    return !!element.closest(config.tag)
  }

  // Если есть выделение текста
  const range = state.range.cloneRange()
  const fragment = range.cloneContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // Проверяем, есть ли элементы с нужным форматированием внутри выделения
  const formattedElements = tempDiv.querySelectorAll(config.tag)
  return formattedElements.length > 0
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

  formats.text.bold = hasFormatting('bold', {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  })
  formats.text.italic = hasFormatting('italic', {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  })
  formats.text.link = hasFormatting('link', {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  })
  formats.block.blockquote = hasFormatting('blockquote', {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  })
  formats.block.punchline = hasFormatting('punchline', {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  })

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

/**
 * Создает объект SelectionState из объекта Selection
 * @param selection - Объект Selection
 * @returns Объект SelectionState или null, если selection неверный
 */
export const createSelectionState = (selection: Selection | null): SelectionState | null => {
  if (!selection || selection.rangeCount === 0) return null

  return {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  }
}

export const getCurrentFormats = (selection: Selection | null): FormattingState => {
  const formats: FormattingState = {
    text: {
      bold: false,
      italic: false,
      link: false
    },
    block: {
      blockquote: false,
      punchline: false
    }
  }

  if (!selection || selection.rangeCount === 0) return formats

  // Получаем элемент, на котором находится курсор
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  const element =
    container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

  if (!element) return formats

  const state = createSelectionState(selection)
  if (!state) return formats

  formats.text.bold = hasFormatting('bold', state)
  formats.text.italic = hasFormatting('italic', state)
  formats.text.link = hasFormatting('link', state)
  formats.block.blockquote = hasFormatting('blockquote', state)
  formats.block.punchline = hasFormatting('punchline', state)

  return formats
}
