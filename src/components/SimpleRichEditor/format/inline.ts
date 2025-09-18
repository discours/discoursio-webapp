/**
 * @module format/inline
 * @description Инлайн форматирование текста (bold, italic, highlight, links)
 */

import { CommandType, SelectionState } from '../lib/types'
import { createElement, FORMAT_CONFIG } from './config'
import { restoreSelectionAfterFormat } from './utils'

/**
 * Применяет инлайн форматирование к выделенному тексту
 */
export const applyInlineFormatting = (command: CommandType, state: SelectionState) => {
  console.log(`[applyInlineFormatting] START - Command: ${command}`, state)

  if (!state.range) {
    console.error('[applyInlineFormatting] No range in state')
    return
  }

  const range = state.range.cloneRange()
  const config = FORMAT_CONFIG[command]

  if (!config) {
    console.error(`[applyInlineFormatting] No config found for command: ${command}`)
    return
  }

  console.log('[applyInlineFormatting] Config:', config)
  console.log(`[applyInlineFormatting] Selection isEmpty: ${state.isEmpty}, text: "${state.text}"`)

  // Обработка пустого выделения (курсор)
  if (state.isEmpty) {
    const container = range.startContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (!element) return

    // Проверяем наличие форматирования у родителя
    const formattedParent = element.closest(config.tag)

    // Если уже есть форматирование этого типа, предотвращаем создание вложенных тегов
    if (formattedParent) {
      console.log('[applyInlineFormatting] Formatting already exists, preventing nested tags')
      return
    }

    // Создаем новый форматированный элемент
    const wrapper = createElement(command)
    wrapper.textContent = '\u200B' // Zero-width space для пустого тега

    // Вставляем элемент
    range.insertNode(wrapper)

    // Позиционируем курсор внутри нового элемента
    restoreSelectionAfterFormat(range, wrapper, 0, false)
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
    const formattedText = Array.from(existingFormatted).reduce((acc, el) => acc + (el.textContent || ''), '')

    // Если все выделение уже отформатировано этим форматом, не делаем ничего
    if (formattedText.length === (tempDiv.textContent || '').length) {
      console.log('[applyInlineFormatting] Selection already completely formatted, preventing nested tags')
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

  // Позиционируем выделение в новом форматированном элементе
  try {
    const selection = window.getSelection()
    if (selection) {
      const newRange = document.createRange()

      if (state.text && state.text.length > 0) {
        // Если был выделен текст, выделяем весь форматированный элемент
        newRange.selectNodeContents(wrapper)
        console.log('[applyInlineFormatting] Selecting formatted content:', state.text)
      } else {
        // Если был курсор, ставим его ПОСЛЕ форматированного элемента
        const nextSibling = wrapper.nextSibling
        if (nextSibling) {
          newRange.setStart(nextSibling, 0)
          newRange.setEnd(nextSibling, 0)
        } else {
          // Если нет следующего элемента, ставим курсор в конец родителя
          const parent = wrapper.parentNode
          if (parent) {
            const wrapperIndex = Array.from(parent.childNodes).indexOf(wrapper)
            newRange.setStart(parent, wrapperIndex + 1)
            newRange.setEnd(parent, wrapperIndex + 1)
          }
        }
        console.log('[applyInlineFormatting] Cursor positioned after formatted element')
      }

      selection.removeAllRanges()
      selection.addRange(newRange)
      console.log('[applyInlineFormatting] Selection restored successfully')
    }
  } catch (error) {
    console.error('[applyInlineFormatting] Error restoring selection:', error)
  }

  console.log('[applyInlineFormatting] COMPLETE - Formatting applied successfully')
}

/**
 * Удаляет инлайн форматирование выделенного текста
 */
export const removeInlineFormatting = (command: CommandType, state: SelectionState) => {
  console.log(`[removeInlineFormatting] START - Command: ${command}`, state)

  // Специальная обработка для unlink - удаляем ссылку полностью
  if (command === 'unlink') {
    console.log('[removeInlineFormatting] Handling unlink command')
    return removeLink(state)
  }
  if (!state.range) {
    console.warn('[removeInlineFormatting] No range in state')
    return
  }

  const range = state.range.cloneRange()
  const config = FORMAT_CONFIG[command]

  if (!config) {
    console.warn('[removeInlineFormatting] No config found for command:', command)
    return
  }

  console.log(`[removeInlineFormatting] Config found for ${command}:`, config)

  // Если пустое выделение (курсор)
  if (state.isEmpty) {
    console.log('[removeInlineFormatting] Processing cursor position (empty selection)')
    const container = range.startContainer
    const element = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

    if (!element) {
      console.warn('[removeInlineFormatting] No element found for cursor')
      return
    }

    console.log(`[removeInlineFormatting] Looking for closest ${config.tag} from element:`, element.tagName)
    const formattedParent = element.closest(config.tag)
    console.log('[removeInlineFormatting] Found formatted parent:', formattedParent?.tagName)

    if (formattedParent) {
      console.log(`[removeInlineFormatting] Removing ${config.tag} formatting from cursor position`)
      // Запоминаем предыдущий или родительский узел перед удалением
      const prevNode = formattedParent.previousSibling || (formattedParent.parentNode as Node)
      const nodeOffset = prevNode === formattedParent.previousSibling ? prevNode.textContent?.length || 0 : 0

      // Создаем временный контейнер для содержимого форматированного элемента
      const tempContainer = document.createDocumentFragment()

      // Копируем все содержимое в этот контейнер
      while (formattedParent.firstChild) {
        tempContainer.appendChild(formattedParent.firstChild)
      }

      // Вставляем содержимое вместо форматированного элемента
      if (formattedParent?.parentNode?.contains(formattedParent)) {
        formattedParent.parentNode.insertBefore(tempContainer, formattedParent)
        formattedParent.parentNode.removeChild(formattedParent)
      }

      // Восстанавливаем позицию курсора в разформатированном тексте
      try {
        const selection = window.getSelection()
        if (selection) {
          const newRange = document.createRange()

          // Находим первый текстовый узел в разформатированном содержимом
          const firstTextNode = tempContainer.firstChild
          if (firstTextNode && firstTextNode.nodeType === Node.TEXT_NODE) {
            newRange.setStart(firstTextNode, Math.min(nodeOffset, firstTextNode.textContent?.length || 0))
            newRange.setEnd(firstTextNode, Math.min(nodeOffset, firstTextNode.textContent?.length || 0))
          } else if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
            newRange.setStart(prevNode, nodeOffset)
            newRange.setEnd(prevNode, nodeOffset)
          }

          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      } catch (error) {
        console.error('[removeInlineFormatting] Error restoring selection:', error)
      }

      console.log(`[removeInlineFormatting] ✅ Successfully removed ${config.tag} formatting from cursor`)
    } else {
      console.log(`[removeInlineFormatting] No ${config.tag} parent found - nothing to remove`)
    }
    return
  }

  // Алгоритм для выделения текста
  console.log('[removeInlineFormatting] Processing text selection')
  const fragment = range.extractContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(fragment)

  // Находим все элементы с заданным форматированием
  const formattedElements = tempDiv.querySelectorAll(config.tag)
  console.log(`[removeInlineFormatting] Found ${formattedElements.length} ${config.tag} elements to remove`)

  // Заменяем форматированные элементы их содержимым
  formattedElements.forEach((el, index) => {
    console.log(`[removeInlineFormatting] Removing ${config.tag} element ${index + 1}/${formattedElements.length}`)
    const parent = el.parentNode
    if (parent) {
      const contentFragment = document.createDocumentFragment()
      while (el.firstChild) {
        contentFragment.appendChild(el.firstChild)
      }
      parent.replaceChild(contentFragment, el)
    }
  })

  // Создаем новый фрагмент с обработанным содержимым
  const newFragment = document.createDocumentFragment()
  while (tempDiv.firstChild) {
    newFragment.appendChild(tempDiv.firstChild)
  }

  // Вставляем фрагмент обратно в документ
  range.insertNode(newFragment)

  // Восстанавливаем выделение
  try {
    if (state.text) {
      const startNode = range.startContainer.firstChild || range.startContainer
      const endNode = range.endContainer.lastChild || range.endContainer
      const newRange = document.createRange()
      newRange.setStartBefore(startNode)
      newRange.setEndAfter(endNode)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    } else {
      restoreSelectionAfterFormat(range, range.startContainer)
    }
  } catch (error) {
    console.error('[removeInlineFormatting] Error restoring selection:', error)
  }

  console.log(`[removeInlineFormatting] ✅ COMPLETE - Successfully processed ${command} removal`)
}

/**
 * Удаляет ссылку, сохраняя текстовое содержимое
 */
const removeLink = (state: SelectionState) => {
  if (!state.range) return

  const range = state.range
  const container = range.startContainer

  // Находим ссылку в текущем выделении или позиции курсора
  const linkElement =
    container.nodeType === Node.TEXT_NODE
      ? container.parentElement?.closest('a')
      : (container as HTMLElement).closest('a')

  if (!linkElement) {
    console.warn('[removeLink] No link found to remove')
    return
  }

  // Сохраняем текстовое содержимое ссылки
  const textContent = linkElement.textContent || ''

  // Создаем текстовый узел с содержимым ссылки
  const textNode = document.createTextNode(textContent)

  // Заменяем ссылку текстовым узлом
  if (linkElement.parentNode) {
    linkElement.parentNode.replaceChild(textNode, linkElement)

    // Восстанавливаем выделение на текстовом узле
    try {
      const newRange = document.createRange()
      newRange.selectNodeContents(textNode)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    } catch (error) {
      console.error('[removeLink] Error restoring selection:', error)
    }
  }
}

// Утилиты перенесены в utils.ts для избежания дублирования
