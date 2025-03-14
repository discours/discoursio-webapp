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
 * Removes formatting from selected text
 */
export const removeFormatting = (command: CommandType, state: SelectionState) => {
  if (!state.range) return

  console.log('Starting removeFormatting for:', command)
  console.log('Initial text:', state.text)

  const range = state.range.cloneRange()
  const config = FORMAT_CONFIG[command]
  if (!config) {
    console.log('No config found for command:', command)
    return
  }

  // Если выделение схлопнуто (курсор), ищем ближайший форматированный элемент
  if (state.isEmpty) {
    const container = range.startContainer
    const element =
      container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (element) {
      const formattedElement = element.closest(config.tag)

      if (formattedElement) {
        // Расширяем выделение на весь форматированный элемент
        range.selectNodeContents(formattedElement)
      } else {
        // Если нет форматированного элемента, то нечего удалять
        console.log('No formatted element found for cursor position')
        return
      }
    }
  }

  // Проверим, что выделение не пустое после расширения
  if (range.collapsed) {
    console.log('Range is still collapsed, nothing to extract')
    return
  }

  // Клонируем содержимое выделения
  const fragment = range.cloneContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)
  console.log('Content in temp div:', tempDiv.innerHTML)

  // Сначала попытаемся найти корневые форматированные элементы
  const formattedElements = tempDiv.querySelectorAll(config.tag)

  if (formattedElements.length === 0) {
    // Если форматированных элементов не найдено на верхнем уровне,
    // возможно формат применен к родительскому элементу
    const parentElement =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : (range.commonAncestorContainer as Node).parentElement

    if (parentElement && parentElement.nodeName.toLowerCase() === config.tag.toLowerCase()) {
      // Форматирование применено к родительскому элементу
      // Создаем новый фрагмент только с контентом
      const newFragment = document.createDocumentFragment()
      while (parentElement.firstChild) {
        newFragment.appendChild(parentElement.firstChild)
      }
      parentElement.parentNode?.replaceChild(newFragment, parentElement)

      console.log('Removed formatting from parent element')
      return
    }

    // Если мы здесь, значит не нашли форматированных элементов
    console.log('No formatted elements found in selection')
    return
  }

  // Создаем новый фрагмент для удаления форматирования
  // Используем эту переменную для фрагмента без форматирования
  const resultFragment = document.createDocumentFragment()

  // Удаляем исходное содержимое
  const extractedContent = range.extractContents()
  tempDiv.innerHTML = ''
  tempDiv.appendChild(extractedContent)

  // Обрабатываем все найденные форматированные элементы
  const allFormatted = tempDiv.querySelectorAll(config.tag)

  allFormatted.forEach((formatted) => {
    // Создаем фрагмент для содержимого этого форматированного элемента
    const elementContent = document.createDocumentFragment()

    // Перемещаем все дочерние элементы в новый фрагмент
    while (formatted.firstChild) {
      elementContent.appendChild(formatted.firstChild)
    }

    // Заменяем форматированный элемент его содержимым
    formatted.parentNode?.replaceChild(elementContent, formatted)
  })

  // Вставляем очищенный от форматирования контент
  range.insertNode(tempDiv)

  // Очищаем временный контейнер, оставив только его содержимое
  // Используем ранее созданный resultFragment вместо создания нового фрагмента
  while (tempDiv.firstChild) {
    resultFragment.appendChild(tempDiv.firstChild)
  }
  tempDiv.parentNode?.replaceChild(resultFragment, tempDiv)

  console.log('Formatting successfully removed')
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
  const config = FORMAT_CONFIG[format]
  if (!config) return false

  // Более детальная проверка для схлопнутого выделения (курсора)
  if (selection.isCollapsed) {
    // Получаем ближайший родительский элемент
    const container = range.startContainer
    const element =
      container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (!element) return false

    // Проверяем наличие форматирования на текущем или родительском элементе
    const formattedElement = element.closest(config.tag)
    return formattedElement !== null
  }

  // Для не схлопнутого выделения проверяем, находится ли все выделение внутри форматированного элемента
  // Проверим родительский элемент выделения
  const container = range.commonAncestorContainer
  const element =
    container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

  if (!element) return false

  // Проверяем ближайший родительский элемент с нужным тегом
  const formattedElement = element.closest(config.tag)

  // Если такой элемент найден и он полностью содержит выделение, считаем форматирование активным
  if (formattedElement) {
    const formattedRange = document.createRange()
    formattedRange.selectNodeContents(formattedElement)

    // Проверяем, полностью ли выделение находится внутри форматированного элемента
    return (
      formattedRange.compareBoundaryPoints(Range.START_TO_START, range) <= 0 &&
      formattedRange.compareBoundaryPoints(Range.END_TO_END, range) >= 0
    )
  }

  // Проверяем также, является ли выделение форматированным элементом целиком
  const fragment = range.cloneContents()
  const temp = document.createElement('div')
  temp.appendChild(fragment)

  // Если все выделение состоит только из форматированных элементов, считаем форматирование активным
  const formattedElements = temp.querySelectorAll(config.tag)

  // Проверяем, что все содержимое выделения находится внутри форматированных элементов
  if (formattedElements.length > 0) {
    let totalFormattedLength = 0
    formattedElements.forEach((el) => {
      totalFormattedLength += el.textContent?.length || 0
    })

    // Если длина форматированного текста совпадает с длиной всего выделения (учитывая вложенность)
    return totalFormattedLength === (temp.textContent?.length || 0)
  }

  return false
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
