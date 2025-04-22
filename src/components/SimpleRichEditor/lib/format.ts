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

import { ActiveFormatsType, getNodesInRange } from './helpers'
import { findAncestor } from './helpers'
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

  // Упрощенный алгоритм для выделения текста
  // 1. Извлекаем содержимое выделения
  const fragment = range.extractContents()

  // 2. Создаем временный контейнер для работы с фрагментом
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // 3. Находим все элементы с заданным форматированием
  const formattedElements = tempDiv.querySelectorAll(config.tag)

  // 4. Заменяем форматированные элементы их содержимым (удаляем форматирование)
  formattedElements.forEach((el) => {
    const parent = el.parentNode
    if (parent) {
      // Создаем фрагмент с содержимым элемента
      const contentFragment = document.createDocumentFragment()
      while (el.firstChild) {
        contentFragment.appendChild(el.firstChild)
      }
      // Заменяем форматированный элемент его содержимым
      parent.replaceChild(contentFragment, el)
    }
  })

  // 5. Если в выделении не было форматированных элементов, но выделен весь форматированный текст,
  // извлекаем чистый текст для удаления форматирования
  if (formattedElements.length === 0) {
    const plainText = tempDiv.textContent || ''
    tempDiv.innerHTML = ''
    tempDiv.textContent = plainText
  }

  // 6. Создаем новый фрагмент с обработанным содержимым
  const newFragment = document.createDocumentFragment()
  while (tempDiv.firstChild) {
    newFragment.appendChild(tempDiv.firstChild)
  }

  // 7. Вставляем фрагмент обратно в документ
  range.insertNode(newFragment)

  // 8. Восстанавливаем выделение
  try {
    // Пытаемся выделить вставленное содержимое
    range.setStartBefore(range.startContainer.firstChild || range.startContainer)
    range.setEndAfter(range.endContainer.lastChild || range.endContainer)

    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  } catch (error) {
    console.error('Error restoring selection after removing formatting:', error)
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
 * Проверяет применено ли форматирование к выделенному тексту
 *
 * @param format - Формат для проверки
 * @param state - Состояние выделения
 * @returns Булево значение, указывающее наличие форматирования
 *
 * @example
 * const state = { range: range, text: "Выделенный текст", isEmpty: false }
 * const isBold = hasFormatting('bold', state) // Проверка наличия жирного шрифта
 */
export function hasFormatting(format: CommandType, state: SelectionState): boolean {
  if (!state.range) return false

  // Если нет выделения, проверяем текущую позицию курсора
  if (state.isEmpty) {
    const node = state.range.startContainer
    if (node?.nodeType === Node.TEXT_NODE) {
      // Для текстового узла проверяем родительский элемент
      const parentNode = node.parentElement
      if (!parentNode) return false

      // Проверка inline форматирования
      if (format === 'bold') return hasTagOrStyle(parentNode, 'B', 'STRONG', 'font-weight', 'bold', '700')
      if (format === 'italic') return hasTagOrStyle(parentNode, 'I', 'EM', 'font-style', 'italic')
      if (format === 'highlight') return hasTagOrStyle(parentNode, 'MARK', null, 'background-color')
      if (format === 'link') return parentNode.tagName === 'A' || !!findAncestor(parentNode, 'A')
      if (format === 'punchline') return hasTagOrStyle(parentNode, 'SPAN.punchline')

      // Проверка блочного форматирования
      if (format === 'blockquote') return !!findAncestor(parentNode, 'BLOCKQUOTE')
      if (format === 'h1') return !!findAncestor(parentNode, 'H1')
      if (format === 'h2') return !!findAncestor(parentNode, 'H2')
      if (format === 'h3') return !!findAncestor(parentNode, 'H3')
      if (format === 'p') return !!findAncestor(parentNode, 'P')
    }
  } else {
    // Для выделенного текста
    const selectedNodes = getNodesInRange(state.range)
    if (selectedNodes.length === 0) return false

    // Для inline форматирования проверяем все узлы в выделении
    if (
      format === 'bold' ||
      format === 'italic' ||
      format === 'highlight' ||
      format === 'link' ||
      format === 'punchline'
    ) {
      // Форматирование активно, если все узлы имеют его
      return selectedNodes.every((node: Node) => {
        const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
        if (!element) return false

        if (format === 'bold') return hasTagOrStyle(element, 'B', 'STRONG', 'font-weight', 'bold', '700')
        if (format === 'italic') return hasTagOrStyle(element, 'I', 'EM', 'font-style', 'italic')
        if (format === 'highlight') return hasTagOrStyle(element, 'MARK', null, 'background-color')
        if (format === 'link') return element.tagName === 'A' || !!findAncestor(element, 'A')
        if (format === 'punchline') return hasTagOrStyle(element, 'SPAN.punchline')

        return false
      })
    }

    // Для блочного форматирования проверяем общий контейнер
    if (
      format === 'blockquote' ||
      format === 'h1' ||
      format === 'h2' ||
      format === 'h3' ||
      format === 'p'
    ) {
      const firstElement =
        selectedNodes[0].nodeType === Node.TEXT_NODE
          ? selectedNodes[0].parentElement
          : (selectedNodes[0] as Element)

      if (!firstElement) return false

      // Используем первый элемент для определения блочного форматирования
      if (format === 'blockquote') return !!findAncestor(firstElement, 'BLOCKQUOTE')
      if (format === 'h1') return !!findAncestor(firstElement, 'H1')
      if (format === 'h2') return !!findAncestor(firstElement, 'H2')
      if (format === 'h3') return !!findAncestor(firstElement, 'H3')
      if (format === 'p') return !!findAncestor(firstElement, 'P')
    }
  }

  return false
}

/**
 * Проверяет, имеет ли элемент определенный тег или стилевое свойство
 *
 * @param element - Элемент для проверки
 * @param tag1 - Первый возможный тег (например, 'B')
 * @param tag2 - Второй возможный тег (например, 'STRONG')
 * @param style - CSS свойство для проверки
 * @param value1 - Первое возможное значение CSS свойства
 * @param value2 - Второе возможное значение CSS свойства
 * @returns Булево значение, указывающее наличие тега или стиля
 */
function hasTagOrStyle(
  element: Element,
  tag1: string,
  tag2: string | null = null,
  style?: string,
  value1?: string,
  value2?: string
): boolean {
  // Проверка на селектор класса (например, 'SPAN.punchline')
  if (tag1.includes('.')) {
    const [tagName, className] = tag1.split('.')
    if (element.tagName === tagName && element.classList.contains(className)) {
      return true
    }
    return !!findAncestor(element, (el) => el.tagName === tagName && el.classList.contains(className))
  }

  // Проверка на соответствие тегу
  if (element.tagName === tag1 || (tag2 && element.tagName === tag2)) {
    return true
  }

  // Проверка на наличие стилевого свойства
  if (style) {
    const computedStyle = window.getComputedStyle(element)
    const styleValue = computedStyle.getPropertyValue(style)

    // Если значения не указаны, проверяем наличие любого значения
    if (!value1 && !value2) {
      return styleValue !== '' && styleValue !== 'none' && styleValue !== 'normal'
    }

    // Проверка на соответствие одному из значений
    return Boolean((value1 && styleValue.includes(value1)) || (value2 && styleValue.includes(value2)))
  }

  // Проверка на наличие родительского элемента с соответствующим тегом
  const matchesTag = (el: Element) => Boolean(el.tagName === tag1 || (tag2 && el.tagName === tag2))
  return !!findAncestor(element, matchesTag)
}

/**
 * Получает активные форматы для текущей позиции курсора или выделения
 * @param selection Текущее выделение
 * @param editor Ссылка на DOM-элемент редактора
 * @returns Объект с активными форматами
 */
export const getActiveFormats = (selection?: Selection, editor?: HTMLDivElement): ActiveFormatsType => {
  // Базовое состояние: ничего не активно
  const formats: ActiveFormatsType = {
    bold: false,
    italic: false,
    // underline: false,
    //strike: false,
    link: false,
    // superscript: false,
    // subscript: false,
    highlight: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    // numberList: false,
    punchline: false,
    h1: false,
    h2: false,
    h3: false,
    p: false
    // left: false,
    // center: false,
    // right: false,
    // justify: false,
  }

  if (!selection || !editor) return formats

  // Если ничего не выделено, но есть курсор в редакторе
  if (selection.isCollapsed) {
    // Проверка форматирования в точке курсора
    const ancestorNodes = getAncestorNodes(selection.anchorNode, editor)

    // Проверяем inline форматирование
    formats.bold = ancestorNodes.some((node) => node.nodeName === 'B' || node.nodeName === 'STRONG')
    formats.italic = ancestorNodes.some((node) => node.nodeName === 'I' || node.nodeName === 'EM')
    // formats.underline = ancestorNodes.some(node => node.nodeName === 'U')
    // formats.strike = ancestorNodes.some(node => node.nodeName === 'STRIKE' || node.nodeName === 'S')
    // formats.superscript = ancestorNodes.some(node => node.nodeName === 'SUP')
    // formats.subscript = ancestorNodes.some(node => node.nodeName === 'SUB')
    formats.highlight = ancestorNodes.some(
      (node) =>
        node.nodeName === 'MARK' ||
        (node.nodeName === 'SPAN' && node.parentElement?.getAttribute('style')?.includes('background'))
    )

    // Проверка ссылки
    formats.link = ancestorNodes.some((node: Node) => node.nodeName === 'A')

    // Проверка блочного форматирования
    formats.blockquote = ancestorNodes.some((node: Node) => node.nodeName === 'BLOCKQUOTE')
    formats.bulletList = ancestorNodes.some(
      (node: Node) =>
        node.nodeName === 'UL' || (node.nodeName === 'LI' && ancestorNodes.some((n) => n.nodeName === 'UL'))
    )
    formats.orderedList = ancestorNodes.some(
      (node: Node) =>
        node.nodeName === 'OL' || (node.nodeName === 'LI' && ancestorNodes.some((n) => n.nodeName === 'OL'))
    )

    // Проверка специальных блоков
    formats.punchline = ancestorNodes.some(
      (node: Node) => node.nodeName === 'DIV' && node.parentElement?.classList.contains('punchline')
    )
    /*
    formats.alignLeft = ancestorNodes.some((node: Node) => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-left')
    )
    formats.alignCenter = ancestorNodes.some((node: Node) => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-center')
    )
    formats.alignRight = ancestorNodes.some((node: Node) => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-right')
    )
    */

    console.log('[getActiveFormats] Cursor formats:', formats)
    return formats
  }

  // Если есть выделение
  try {
    // Получаем общие стили для всего выделения
    const range = selection.getRangeAt(0)

    // Проверка inline форматирования через document.queryCommandState
    formats.bold = document.queryCommandState('bold')
    formats.italic = document.queryCommandState('italic')
    // formats.underline = document.queryCommandState('underline')
    // formats.strike = document.queryCommandState('strikethrough')
    // formats.superscript = document.queryCommandState('superscript')
    // formats.subscript = document.queryCommandState('subscript')

    // Для более сложных форматов проверяем общие элементы
    const commonAncestors = getCommonFormatAncestors(range, editor)

    // Проверяем наличие ссылки
    formats.link = commonAncestors.some((node) => node.nodeName === 'A')

    // Проверяем блочное форматирование
    formats.blockquote = commonAncestors.some((node) => node.nodeName === 'BLOCKQUOTE')
    formats.bulletList = document.queryCommandState('insertUnorderedList')
    formats.orderedList = document.queryCommandState('insertOrderedList')

    // Проверяем специальные классы
    formats.punchline = commonAncestors.some(
      (node) => node.nodeName === 'DIV' && node.parentElement?.classList.contains('punchline')
    )
    /*
    formats.alignLeft = commonAncestors.some(node => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-left')
    )
    formats.alignCenter = commonAncestors.some(node => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-center')
    )
    formats.alignRight = commonAncestors.some(node => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-right')
    )
    formats.alignJustify = commonAncestors.some(node => 
      node.nodeName === 'DIV' && node.parentElement?.classList.contains('align-justify')
    )
    */

    // Добавление проверки highlight для выделения
    formats.highlight = isHighlighted(range)

    console.log('[getActiveFormats] Selection formats:', formats)
  } catch (e) {
    console.error('Error getting active formats:', e)
  }

  return formats
}

/**
 * Проверяет наличие класса выравнивания на узле
 * @param node DOM-узел для проверки
 * @param alignment Тип выравнивания ('left', 'center', 'right', 'justify')
 * @returns true если узел имеет соответствующее выравнивание
 */
export const hasAlignClass = (node: Node, alignment: string): boolean => {
  if (node instanceof HTMLElement) {
    // Проверяем классы text-align-*
    if (node.classList.contains(`text-align-${alignment}`)) return true

    // Проверяем inline-стили
    const style = node.getAttribute('style')
    if (style?.includes(`text-align: ${alignment}`)) return true
  }
  return false
}

/**
 * Проверяет наличие выделения текста
 * @param range Диапазон выделения
 * @returns true если текст выделен
 */
const isHighlighted = (range: Range): boolean => {
  // Создаем временный элемент для проверки содержимого выделения
  const tempElement = document.createElement('div')
  tempElement.appendChild(range.cloneContents())

  // Проверяем наличие тегов MARK или SPAN с background
  return (
    !!tempElement.querySelector('mark') ||
    Array.from(tempElement.querySelectorAll('span')).some(
      (span) => span.style.backgroundColor || span.getAttribute('style')?.includes('background')
    )
  )
}

/**
 * Получает все узлы-предки от текущего узла до родительского редактора
 * @param node Текущий узел
 * @param editor Элемент редактора
 * @returns Массив узлов-предков
 */
const getAncestorNodes = (node: Node | null, editor: HTMLElement): Node[] => {
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
 * @param range Диапазон выделения
 * @param editor Элемент редактора
 * @returns Массив общих узлов-предков
 */
const getCommonFormatAncestors = (range: Range, editor: HTMLElement): Node[] => {
  // Получаем общего предка выделения
  const commonAncestor = range.commonAncestorContainer

  // Если общий предок - текстовый узел, возвращаем его родителей
  if (commonAncestor.nodeType === Node.TEXT_NODE) {
    return getAncestorNodes(commonAncestor, editor)
  }

  // Иначе обходим все дочерние узлы и проверяем общие стили
  const nodes: Node[] = []
  const walker = document.createTreeWalker(commonAncestor, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      // Проверяем, входит ли узел в выделение
      const nodeRange = document.createRange()
      nodeRange.selectNodeContents(node)

      // Если узел полностью внутри выделения, добавляем его
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

  // Добавляем общего предка и его родителей
  nodes.push(...getAncestorNodes(commonAncestor, editor))

  return nodes
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

// --- Block Formatting ---

// Helper to find the closest block ancestor within the editor
const getClosestBlockElement = (node: Node | null, editorRoot: HTMLElement): HTMLElement | null => {
  if (!node || !editorRoot) return null
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node

  while (current && current !== editorRoot && editorRoot.contains(current)) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement
      // Check common block tags (add more if needed based on editor structure)
      if (
        ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'BLOCKQUOTE', 'LI', 'PRE'].includes(
          element.tagName
        )
      ) {
        return element
      }
      // If the element has display: block, consider it a block too
      // Note: getComputedStyle can be slow if called repeatedly
      // const display = window.getComputedStyle(element).display;
      // if (display === 'block' || display === 'list-item') {
      //   return element;
      // }
    }
    current = current.parentElement
  }
  // If the direct parent is the editor root, and it's the only child, treat it as the block
  if (node.parentElement === editorRoot && editorRoot.childNodes.length === 1) {
    return editorRoot // Or maybe null? Needs testing.
  }

  return null // No suitable block parent found
}

/**
 * Toggles block format (H1-H3, Blockquote) for the block containing the selection start.
 * Reverts to paragraph (<p>) if the target format is already active.
 */
export const toggleBlockFormat = (
  command: CommandType,
  state: SelectionState,
  editorRoot: HTMLElement | null
) => {
  if (!state.range || !editorRoot) {
    console.warn('[toggleBlockFormat] Missing range or editorRoot')
    return
  }

  const range = state.range
  const config = FORMAT_CONFIG[command]
  const defaultTag = 'p'

  // Only handle specific block types suitable for simple tag switching
  if (!config || !['h1', 'h2', 'h3', 'blockquote', 'p'].includes(config.tag)) {
    console.warn(`[toggleBlockFormat] Command ${command} ('${config?.tag}') is not a supported block type.`)
    // Fallback to applyFormatting for other potential block-like commands (divs with data-*)?
    // applyFormatting(command, state);
    return
  }

  const targetTag = config.tag.toLowerCase()

  // Find the relevant block element
  const blockElement = getClosestBlockElement(range.startContainer, editorRoot)

  if (!blockElement) {
    console.warn('[toggleBlockFormat] Could not find parent block element.')
    // If no block is found, maybe wrap the current selection in the target block?
    // This might be complex if selection spans lines.
    // Let's try simple applyFormatting as a fallback for now.
    applyFormatting(command, state)
    return
  }

  const currentTag = blockElement.tagName.toLowerCase()
  const newTag = currentTag === targetTag ? defaultTag : targetTag

  // Avoid changing if already correct (e.g., applying P to a P block)
  if (currentTag === newTag) return

  console.log(`[toggleBlockFormat] Changing block from <${currentTag}> to <${newTag}>`)

  const newBlock = document.createElement(newTag)

  // Copy specific attributes if necessary (e.g., data-*) - Check config
  const newConfig = Object.values(FORMAT_CONFIG).find((c) => c.tag === newTag)
  if (newConfig?.attributes) {
    Object.entries(newConfig.attributes).forEach(([key, value]) => {
      // Only add attributes specified in config, avoid adding empty ones unless explicit
      if (value || key.startsWith('data-')) {
        newBlock.setAttribute(key, value)
      }
    })
  }

  // Move children from old block to new block
  while (blockElement.firstChild) {
    newBlock.appendChild(blockElement.firstChild)
  }
  // Ensure the block isn't completely empty to avoid display issues
  if (!newBlock.hasChildNodes()) {
    newBlock.appendChild(document.createElement('br'))
  }

  // Replace the old block with the new one
  try {
    blockElement.parentNode?.replaceChild(newBlock, blockElement)
  } catch (e) {
    console.error('[toggleBlockFormat] Error replacing node:', e)
    return // Stop if replacement failed
  }

  // --- Restore Selection (Basic) ---
  // This part is fragile. Selecting the whole node is simplest but disruptive.
  // Collapsing to start/end is better but might not match user expectation.
  try {
    const selection = window.getSelection()
    if (selection) {
      const newRange = document.createRange()
      // Place cursor at the beginning of the new block
      newRange.setStart(newBlock, 0)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }
  } catch (e) {
    console.error('[toggleBlockFormat] Error restoring selection:', e)
    editorRoot.focus() // Fallback focus
  }
}
