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

import { ActiveFormatsType, findAncestor, getNodesInRange } from './helpers'
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
    console.log(`[applyFormatting] No config found for command: ${command}`)
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
      console.log('[applyFormatting] Formatting already exists, preventing nested tags')
      // Позиционируем курсор внутри существующего форматированного элемента
      restoreSelectionState(range, formattedParent, 0, false)
      return
    }

    // Создаем новый форматированный элемент
    const wrapper = createElement(command)
    wrapper.textContent = '\u200B' // Zero-width space для пустого тега

    // Вставляем элемент
    range.insertNode(wrapper)

    // Позиционируем курсор внутри нового элемента
    restoreSelectionState(range, wrapper, 0, false)
    return
  }

  // Обработка выделения текста
  const fragment = range.cloneContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // Проверяем, есть ли уже форматированные элементы этого типа в выделении
  const existingFormatted = tempDiv.querySelectorAll(config.tag)

  // Избегаем создания вложенных тегов
  if (existingFormatted.length > 0) {
    const formattedText = Array.from(existingFormatted).reduce(
      (acc, el) => acc + (el.textContent || ''),
      ''
    )

    // Если все выделение уже отформатировано этим форматом, не делаем ничего
    if (formattedText.length === (tempDiv.textContent || '').length) {
      console.log('[applyFormatting] Selection already completely formatted, preventing nested tags')
      return
    }
  }

  // Извлекаем и форматируем контент
  const content = range.extractContents()
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
  if (state.text) {
    // Если был выделен текст, выделяем весь форматированный элемент
    restoreSelectionState(range, wrapper, 0, true)
  } else {
    // Если был курсор, ставим его внутрь элемента
    restoreSelectionState(range, wrapper, 0, false)
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
    // Используем правильный селектор для поиска элемента, поддерживая работу с mark, strong, em и т.д.
    const formattedParent = element.closest(config.tag)

    if (formattedParent) {
      // Запоминаем предыдущий или родительский узел перед удалением
      const prevNode = formattedParent.previousSibling || (formattedParent.parentNode as Node)
      const nodeOffset =
        prevNode === formattedParent.previousSibling ? prevNode.textContent?.length || 0 : 0

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

      // Используем универсальную функцию для восстановления позиции курсора
      restoreSelectionState(range, prevNode, nodeOffset)
    }

    return
  }

  // Алгоритм для выделения текста
  // 1. Извлекаем содержимое выделения
  const fragment = range.extractContents()

  // 2. Создаем временный контейнер для работы с фрагментом
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // 3. Находим все элементы с заданным форматированием
  // Используем правильный селектор для поиска элементов, поддерживая работу с mark, strong, em и т.д.
  const formattedElements = tempDiv.querySelectorAll(config.tag)

  console.log(`[removeFormatting] Found ${formattedElements.length} ${config.tag} elements to remove`)

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

  // 8. Используем универсальную функцию для восстановления выделения
  try {
    if (state.text) {
      // Если было выделение, пытаемся выделить содержимое снова
      const startNode = range.startContainer.firstChild || range.startContainer
      const endNode = range.endContainer.lastChild || range.endContainer

      // Создаем новый диапазон
      const newRange = document.createRange()
      newRange.setStartBefore(startNode)
      newRange.setEndAfter(endNode)

      // Восстанавливаем выделение
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    } else {
      // Если было пустое выделение, позиционируем курсор
      restoreSelectionState(range, range.startContainer)
    }
  } catch (error) {
    console.error('[removeFormatting] Error restoring selection:', error)
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

  const config = FORMAT_CONFIG[format]
  if (!config) return false

  const tag = config.tag.toUpperCase()

  // Если нет выделения, проверяем текущую позицию курсора
  if (state.isEmpty) {
    const node = state.range.startContainer

    // Проверяем, находится ли курсор внутри элемента с нужным форматированием
    if (node) {
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)

      if (!element) return false

      // Проверяем текущий элемент и его предков на соответствие требуемому тегу
      if (tag === 'MARK') {
        // Для highlight проверяем и тег mark, и стили background-color
        return hasTagOrStyle(element, 'MARK', null, 'background-color')
      } else if (tag === 'STRONG') {
        return hasTagOrStyle(element, 'B', 'STRONG', 'font-weight', 'bold', '700')
      } else if (tag === 'EM') {
        return hasTagOrStyle(element, 'I', 'EM', 'font-style', 'italic')
      } else if (tag === 'A') {
        return element.tagName === 'A' || !!findAncestor(element, 'A')
      } else {
        // Для остальных тегов просто проверяем, есть ли такой предок
        return !!element.closest(tag.toLowerCase()) || !!findAncestor(element, (el) => el.tagName === tag)
      }
    }
  } else {
    // Для выделенного текста
    const selectedNodes = getNodesInRange(state.range)
    if (selectedNodes.length === 0) return false

    // Проверяем все узлы в выделении
    // Форматирование активно, если все текстовые узлы имеют его
    const textNodes = selectedNodes.filter((node) => node.nodeType === Node.TEXT_NODE)

    // Если нет текстовых узлов, проверяем все узлы
    const nodesToCheck = textNodes.length > 0 ? textNodes : selectedNodes

    return nodesToCheck.every((node: Node) => {
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)

      if (!element) return false

      if (tag === 'MARK') {
        return hasTagOrStyle(element, 'MARK', null, 'background-color')
      } else if (tag === 'STRONG') {
        return hasTagOrStyle(element, 'B', 'STRONG', 'font-weight', 'bold', '700')
      } else if (tag === 'EM') {
        return hasTagOrStyle(element, 'I', 'EM', 'font-style', 'italic')
      } else if (tag === 'A') {
        return element.tagName === 'A' || !!findAncestor(element, 'A')
      } else if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'P', 'DIV'].includes(tag)) {
        // Для блочных элементов достаточно, чтобы один элемент имел форматирование
        return !!findAncestor(element, tag)
      } else {
        return !!element.closest(tag.toLowerCase()) || !!findAncestor(element, (el) => el.tagName === tag)
      }
    })
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
  if (!element) return false

  // Проверка на селектор класса (например, 'SPAN.punchline')
  if (tag1.includes('.')) {
    const [tagName, className] = tag1.split('.')

    // Проверяем непосредственно текущий элемент
    if (element.tagName === tagName && element.classList.contains(className)) {
      return true
    }

    // Проверяем предков
    return !!findAncestor(element, (el) => el.tagName === tagName && el.classList.contains(className))
  }

  // Проверка на соответствие тегу
  if (element.tagName === tag1 || (tag2 && element.tagName === tag2)) {
    return true
  }

  // Проверка предков с соответствующим тегом
  const hasParentWithTag =
    element.closest(tag1.toLowerCase()) !== null || (tag2 && element.closest(tag2.toLowerCase()) !== null)

  if (hasParentWithTag) {
    return true
  }

  // Проверка на наличие стилевого свойства (если указано)
  if (style) {
    // Проверяем непосредственные стили элемента
    const computedStyle = window.getComputedStyle(element)
    const styleValue = computedStyle.getPropertyValue(style)

    // Если значения не указаны, проверяем наличие любого значения
    if (!value1 && !value2) {
      const hasStyle = styleValue !== '' && styleValue !== 'none' && styleValue !== 'normal'
      if (hasStyle) return true
    } else {
      // Проверка на соответствие одному из значений
      const matchesValue = Boolean(
        (value1 && styleValue.includes(value1)) || (value2 && styleValue.includes(value2))
      )
      if (matchesValue) return true
    }

    // Проверяем родительские элементы на наличие стиля
    let parent: HTMLElement | null = element.parentElement
    while (parent) {
      const parentStyle = window.getComputedStyle(parent)
      const parentStyleValue = parentStyle.getPropertyValue(style)

      if (!value1 && !value2) {
        if (parentStyleValue !== '' && parentStyleValue !== 'none' && parentStyleValue !== 'normal') {
          return true
        }
      } else if (
        (value1 && parentStyleValue.includes(value1)) ||
        (value2 && parentStyleValue.includes(value2))
      ) {
        return true
      }

      parent = parent.parentElement
    }
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

    // Добавление проверки highlight для выделения
    formats.highlight = commonAncestors.some(
      (node) =>
        node.nodeName === 'MARK' ||
        (node.nodeName === 'SPAN' && node.parentElement?.classList.contains('highlight'))
    )

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

  // Восстанавливаем позицию курсора
  try {
    // Позиционируем курсор в начало блока или на первый текстовый узел
    const firstTextNode = findFirstTextNode(newBlock)

    if (firstTextNode) {
      // Если есть текстовый узел, ставим курсор в его начало
      restoreSelectionState(range, firstTextNode, 0)
    } else {
      // Иначе ставим курсор в начало блока
      restoreSelectionState(range, newBlock, 0)
    }
  } catch (e) {
    console.error('[toggleBlockFormat] Error restoring selection:', e)
    // Если восстановление не удалось, просто фокусируемся на редакторе
    if (editorRoot) {
      editorRoot.focus()
    }
  }
}

/**
 * Универсальная функция для применения/удаления форматирования
 * Объединяет логику для всех типов форматирования
 *
 * @param command Команда форматирования
 * @param state Текущее состояние выделения
 * @param editorRoot Корневой элемент редактора (опционально, для блочных элементов)
 * @returns Результат операции (успех/ошибка)
 */
export const toggleFormatting = (
  command: CommandType,
  state: SelectionState,
  editorRoot?: HTMLElement | null
): { success: boolean; error?: string } => {
  if (!state.range) {
    return { success: false, error: 'Нет выделения' }
  }

  const config = FORMAT_CONFIG[command]
  if (!config) {
    return { success: false, error: `Неизвестная команда: ${command}` }
  }

  try {
    // Определяем тип команды по тегу и атрибутам
    const isBlockCommand = ['h1', 'h2', 'h3', 'blockquote', 'p'].includes(command)
    const isListCommand = ['bulletList', 'orderedList'].includes(command)

    // Проверяем, активно ли уже это форматирование
    const isFormatActive = hasFormatting(command, state)
    console.log(`[toggleFormatting] ${command} is active:`, isFormatActive)

    // Разная логика в зависимости от типа команды
    if (isBlockCommand && editorRoot) {
      // Блочные команды используют toggleBlockFormat
      toggleBlockFormat(command, state, editorRoot)
    } else if (isListCommand) {
      // Для списков лучше работает стандартный execCommand
      const commandId = command === 'bulletList' ? 'insertUnorderedList' : 'insertOrderedList'
      document.execCommand(commandId, false)
    } else if (isFormatActive) {
      // Удаляем форматирование
      removeFormatting(command, state)

      // Дополнительная очистка при выделении (для сложных случаев)
      if (!state.isEmpty) {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const checkDiv = document.createElement('div')
          checkDiv.appendChild(range.cloneContents())

          const tagName = config.tag.toLowerCase()
          const remainingTags = checkDiv.querySelectorAll(tagName)

          if (remainingTags.length > 0) {
            console.log(`[toggleFormatting] Found remaining ${tagName} tags, applying additional cleanup`)
            // Используем removeFormat только для команд, где это имеет смысл
            if (['bold', 'italic', 'highlight'].includes(command)) {
              document.execCommand('removeFormat', false)
            }
          }
        }
      }
    } else {
      // Применяем форматирование
      applyFormatting(command, state)
    }

    return { success: true }
  } catch (error) {
    console.error(`[toggleFormatting] Error for command ${command}:`, error)
    return { success: false, error: String(error) }
  }
}

/**
 * Универсальная функция для восстановления выделения после операций форматирования
 * @param range Диапазон выделения для восстановления
 * @param target Целевой элемент или узел для позиционирования (опционально)
 * @param offset Смещение курсора (опционально)
 * @param expandToElement Флаг, указывающий нужно ли расширить выделение на весь элемент
 * @returns Успешность восстановления выделения
 */
export const restoreSelectionState = (
  range: Range,
  target?: Node | null,
  offset?: number,
  expandToElement = false
): boolean => {
  try {
    if (!range) return false

    const selection = window.getSelection()
    if (!selection) return false

    // Создаем новый диапазон для манипуляций
    const newRange = document.createRange()

    if (target) {
      // Если указан целевой узел, позиционируем на нем
      const nodeOffset = offset !== undefined ? offset : 0

      try {
        newRange.setStart(target, nodeOffset)
        newRange.setEnd(target, nodeOffset)
      } catch (e) {
        console.error('[restoreSelectionState] Error setting range on target:', e)

        // Запасной вариант: пытаемся выбрать текстовый узел внутри target
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

      // Если нужно выделить весь элемент
      if (expandToElement && target.nodeType === Node.ELEMENT_NODE) {
        newRange.selectNodeContents(target)
      }
    } else {
      // Используем оригинальный диапазон, если нет целевого узла
      newRange.setStart(range.startContainer, range.startOffset)
      newRange.setEnd(range.endContainer, range.endOffset)
    }

    // Применяем выделение
    selection.removeAllRanges()
    selection.addRange(newRange)

    return true
  } catch (error) {
    console.error('[restoreSelectionState] Error restoring selection:', error)
    return false
  }
}

/**
 * Находит первый текстовый узел внутри элемента (рекурсивно)
 */
const findFirstTextNode = (element: HTMLElement): Node | null => {
  if (!element) return null

  // Для всех дочерних узлов
  for (const child of Array.from(element.childNodes)) {
    // Если это текстовый узел с содержимым, возвращаем его
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      return child
    }

    // Рекурсивный поиск внутри элементов
    if (child.nodeType === Node.ELEMENT_NODE) {
      const found = findFirstTextNode(child as HTMLElement)
      if (found) return found
    }
  }

  return null
}

/**
 * Специализированная функция для применения highlight-форматирования
 * Использует ТОЛЬКО тег <mark> для выделения текста
 *
 * @param range Диапазон для обработки
 */
export const applyHighlightFormatting = (range: Range): void => {
  try {
    if (!range) return

    // Клонируем диапазон для безопасных операций
    const clonedRange = range.cloneRange()

    // Сохраняем начало и конец выделения
    const startContainer = range.startContainer
    const startOffset = range.startOffset
    const endContainer = range.endContainer
    const endOffset = range.endOffset

    // Извлекаем содержимое выделения
    const fragment = clonedRange.extractContents()
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(fragment)

    console.log(`[applyHighlightFormatting] Текст для форматирования: "${tempDiv.textContent}"`)

    // Рекурсивная функция для обработки узлов
    const processNode = (node: Node): void => {
      // Пропускаем уже обработанные mark элементы
      if (node.nodeName === 'MARK') return

      // Обрабатываем текстовые узлы
      if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim() !== '') {
        // Создаем mark и помещаем в него текстовый узел
        const mark = document.createElement('mark')
        mark.textContent = node.textContent
        if (node.parentNode) {
          node.parentNode.replaceChild(mark, node)
        }
        return
      }

      // Для элементов рекурсивно обрабатываем каждый дочерний узел
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Копируем массив дочерних узлов, чтобы можно было изменять DOM в процессе итерации
        const childNodes = Array.from(node.childNodes)
        childNodes.forEach((childNode) => {
          processNode(childNode)
        })
      }
    }

    // Применяем обработку ко всем узлам в выделении
    processNode(tempDiv)

    // Вставляем обновленное содержимое обратно в документ
    range.deleteContents()
    while (tempDiv.firstChild) {
      range.insertNode(tempDiv.firstChild)
      range.collapse(false)
    }

    // Восстанавливаем исходный диапазон выделения
    try {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()

        const newRange = document.createRange()
        newRange.setStart(startContainer, startOffset)
        newRange.setEnd(endContainer, endOffset)
        selection.addRange(newRange)
      }
    } catch (e) {
      console.error('[applyHighlightFormatting] Error restoring selection:', e)
    }

    // Имитируем событие ввода для обновления состояния редактора
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'formatApply'
    })
    range.commonAncestorContainer.dispatchEvent(inputEvent)
  } catch (error) {
    console.error('[applyHighlightFormatting] Error:', error)
  }
}

/**
 * Специализированная функция для удаления форматирования highlight
 * Обрабатывает ТОЛЬКО теги <mark>
 *
 * @param range Диапазон для обработки
 */
export const removeHighlightFormatting = (range: Range): void => {
  try {
    // Клонируем диапазон для безопасных операций
    const clonedRange = range.cloneRange()

    // Сохраняем начало и конец выделения
    const startContainer = range.startContainer
    const startOffset = range.startOffset
    const endContainer = range.endContainer
    const endOffset = range.endOffset

    // Создаем временный контейнер
    const tempContainer = document.createElement('div')
    tempContainer.appendChild(clonedRange.cloneContents())

    // Находим все теги mark
    const markElements = tempContainer.querySelectorAll('mark')

    console.log(`[removeHighlightFormatting] Found: ${markElements.length} marks`)

    // Обработка тегов mark: заменяем их содержимым
    markElements.forEach((mark) => {
      const parent = mark.parentNode
      if (parent) {
        // Создаем новый фрагмент с содержимым mark
        const fragment = document.createDocumentFragment()
        while (mark.firstChild) {
          fragment.appendChild(mark.firstChild)
        }
        parent.replaceChild(fragment, mark)
      }
    })

    // Рекурсивная функция для очистки DOM-структуры от пустых span
    const cleanupEmptySpans = (element: Element) => {
      // Сначала обрабатываем все дочерние элементы
      Array.from(element.children).forEach((child) => {
        cleanupEmptySpans(child)
      })

      // Затем проверяем, стал ли текущий элемент пустым или бесполезным
      if (element.tagName === 'SPAN' && element.attributes.length === 0 && element.parentElement) {
        // Перемещаем все содержимое в родительский элемент
        const parent = element.parentElement
        const fragment = document.createDocumentFragment()

        while (element.firstChild) {
          fragment.appendChild(element.firstChild)
        }

        parent.insertBefore(fragment, element)
        parent.removeChild(element)
      }
    }

    // Выполняем очистку для удаления лишних пустых span
    cleanupEmptySpans(tempContainer)

    // Применяем измененное содержимое
    range.deleteContents()

    // Вставляем обработанное содержимое
    while (tempContainer.firstChild) {
      range.insertNode(tempContainer.firstChild)
      range.collapse(false)
    }

    // Восстанавливаем исходный диапазон выделения
    try {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()

        const newRange = document.createRange()
        newRange.setStart(startContainer, startOffset)
        newRange.setEnd(endContainer, endOffset)
        selection.addRange(newRange)
      }
    } catch (e) {
      console.error('[removeHighlightFormatting] Error restoring selection:', e)
    }

    // Имитируем событие ввода для обновления состояния редактора
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'formatRemove'
    })
    range.commonAncestorContainer.dispatchEvent(inputEvent)
  } catch (error) {
    console.error('[removeHighlightFormatting] Error:', error)
  }
}
