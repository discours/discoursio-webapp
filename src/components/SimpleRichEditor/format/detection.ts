/**
 * @module format/detection
 * @description Проверка активного форматирования в выделении
 */

import { findAncestor, getNodesInRange } from '../lib/dom-utils'
import { CommandType, SelectionState } from '../lib/types'
import { FORMAT_CONFIG } from './config'
import { ActiveFormatsType } from './types'
import { getAncestorNodes, getCommonFormatAncestors } from './utils'

/**
 * Проверяет применено ли форматирование к выделенному тексту
 */
export function hasFormatting(format: CommandType, state: SelectionState): boolean {
  if (!state.range) return false

  // Специальная обработка для unlink - проверяем наличие ссылки
  if (format === 'unlink') {
    return hasFormatting('link', state)
  }

  const config = FORMAT_CONFIG[format]
  if (!config) {
    // console.warn(`[hasFormatting] No config found for format: ${format}`)
    return false
  }

  const tag = config.tag.toUpperCase()

  // Если нет выделения, проверяем текущую позицию курсора
  if (state.isEmpty) {
    const node = state.range.startContainer

    if (node) {
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
      if (!element) return false

      // Проверяем текущий элемент и его предков на соответствие требуемому тегу
      if (tag === 'MARK') {
        const result = hasTagOrStyle(element, 'MARK', null, 'background-color')
        // console.log(`[hasFormatting] MARK check (cursor) result: ${result}`)
        return result
      } else if (tag === 'STRONG') {
        const result = hasTagOrStyle(element, 'B', 'STRONG', 'font-weight', 'bold', '700')
        // console.log(`[hasFormatting] STRONG check (cursor) result: ${result}`)
        return result
      } else if (tag === 'EM') {
        const result = hasTagOrStyle(element, 'I', 'EM', 'font-style', 'italic')
        // console.log(`[hasFormatting] EM check (cursor) result: ${result}`)
        return result
      } else if (tag === 'A') {
        const result = element.tagName === 'A' || !!findAncestor(element, 'A')
        // console.log(`[hasFormatting] A check (cursor) result: ${result}`)
        return result
      } else if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'P'].includes(tag)) {
        // Для блочных элементов проверяем ближайший блочный родитель
        const blockParent = element.closest('h1, h2, h3, blockquote, p, div')
        const result = blockParent?.tagName === tag
        // console.log(`[hasFormatting] Block check - looking for ${tag}, found: ${blockParent?.tagName}, result: ${result}`)
        return result
      } else {
        const result = !!element.closest(tag.toLowerCase()) || !!findAncestor(element, (el) => el.tagName === tag)
        // console.log(`[hasFormatting] Element check - looking for ${tag}, result: ${result}`)
        return result
      }
    }
  } else {
    // Для выделенного текста
    const selectedNodes = getNodesInRange(state.range)
    if (selectedNodes.length === 0) return false

    const textNodes = selectedNodes.filter((node) => node.nodeType === Node.TEXT_NODE)
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
      } else if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'P'].includes(tag)) {
        // Для блочных элементов проверяем ближайший блочный родитель
        const blockParent = element.closest('h1, h2, h3, blockquote, p, div')
        // console.log(`[hasFormatting] Block check - looking for ${tag}, found: ${blockParent?.tagName}`)
        return blockParent?.tagName === tag
      } else {
        return !!element.closest(tag.toLowerCase()) || !!findAncestor(element, (el) => el.tagName === tag)
      }
    })
  }

  // console.log(`[hasFormatting] FINAL RESULT for ${format}: false (no conditions matched)`)
  return false
}

/**
 * Проверяет, имеет ли элемент определенный тег или стилевое свойство
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
    if (element.tagName === tagName && element.classList.contains(className)) {
      return true
    }
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

  // Проверка на наличие стилевого свойства
  if (style) {
    const computedStyle = window.getComputedStyle(element)
    const styleValue = computedStyle.getPropertyValue(style)

    if (!value1 && !value2) {
      const hasStyle = styleValue !== '' && styleValue !== 'none' && styleValue !== 'normal'
      if (hasStyle) return true
    } else {
      const matchesValue = Boolean((value1 && styleValue.includes(value1)) || (value2 && styleValue.includes(value2)))
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
      } else if ((value1 && parentStyleValue.includes(value1)) || (value2 && parentStyleValue.includes(value2))) {
        return true
      }

      parent = parent.parentElement
    }
  }

  const matchesTag = (el: Element) => Boolean(el.tagName === tag1 || (tag2 && el.tagName === tag2))
  return !!findAncestor(element, matchesTag)
}

/**
 * Получает активные форматы для текущей позиции курсора или выделения
 */
export const getActiveFormats = (selection?: Selection, editor?: HTMLDivElement): ActiveFormatsType => {
  const formats: ActiveFormatsType = {
    bold: false,
    italic: false,
    link: false,
    highlight: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    punchline: false,
    h1: false,
    h2: false,
    h3: false,
    p: false
  }

  if (!selection || !editor) return formats

  // Если ничего не выделено, но есть курсор в редакторе
  if (selection.isCollapsed) {
    const ancestorNodes = getAncestorNodes(selection.anchorNode, editor)

    // Проверяем inline форматирование
    formats.bold = ancestorNodes.some((node) => node.nodeName === 'B' || node.nodeName === 'STRONG')
    formats.italic = ancestorNodes.some((node) => node.nodeName === 'I' || node.nodeName === 'EM')
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

    // Проверка заголовков
    formats.h1 = ancestorNodes.some((node: Node) => node.nodeName === 'H1')
    formats.h2 = ancestorNodes.some((node: Node) => node.nodeName === 'H2')
    formats.h3 = ancestorNodes.some((node: Node) => node.nodeName === 'H3')
    formats.p = ancestorNodes.some((node: Node) => node.nodeName === 'P')

    // Проверка специальных блоков
    formats.punchline = ancestorNodes.some(
      (node: Node) => node.nodeName === 'DIV' && node.parentElement?.classList.contains('punchline')
    )

    return formats
  }

  // Если есть выделение
  try {
    const range = selection.getRangeAt(0)

    // Проверка inline форматирования через document.queryCommandState
    formats.bold = document.queryCommandState('bold')
    formats.italic = document.queryCommandState('italic')

    // Для более сложных форматов проверяем общие элементы
    const commonAncestors = getCommonFormatAncestors(range, editor)

    formats.link = commonAncestors.some((node) => node.nodeName === 'A')
    formats.blockquote = commonAncestors.some((node) => node.nodeName === 'BLOCKQUOTE')
    formats.bulletList = document.queryCommandState('insertUnorderedList')
    formats.orderedList = document.queryCommandState('insertOrderedList')

    // Проверка заголовков для выделенного текста
    formats.h1 = commonAncestors.some((node) => node.nodeName === 'H1')
    formats.h2 = commonAncestors.some((node) => node.nodeName === 'H2')
    formats.h3 = commonAncestors.some((node) => node.nodeName === 'H3')
    formats.p = commonAncestors.some((node) => node.nodeName === 'P')

    formats.punchline = commonAncestors.some(
      (node) => node.nodeName === 'DIV' && node.parentElement?.classList.contains('punchline')
    )
    formats.highlight = commonAncestors.some(
      (node) =>
        node.nodeName === 'MARK' || (node.nodeName === 'SPAN' && node.parentElement?.classList.contains('highlight'))
    )
  } catch (e) {
    console.error('Error getting active formats:', e)
  }

  return formats
}

// getAncestorNodes и getCommonFormatAncestors перенесены в utils.ts
