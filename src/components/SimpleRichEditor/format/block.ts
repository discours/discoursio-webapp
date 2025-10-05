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

  // Если не нашли блок, но node является прямым потомком editorRoot
  if (node.parentElement === editorRoot) {
    // Если это текстовый узел - оборачиваем в параграф
    if (node.nodeType === Node.TEXT_NODE) {
      const p = document.createElement('p')
      node.parentElement?.insertBefore(p, node)
      p.appendChild(node)
      return p
    }
    // Если это элемент - возвращаем его
    return node as HTMLElement
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
  if (!config || !['h1', 'h2', 'h3', 'blockquote', 'p', 'punchline', 'div'].includes(config.tag)) {
    console.warn(`[toggleBlockFormat] Command ${command} ('${config?.tag}') is not a supported block type.`)
    return
  }

  // Специальная обработка для squib: должен иметь data-align
  if (command === 'squib' && config.tag === 'div') {
    console.log('[toggleBlockFormat] Processing squib command')
  }

  const targetTag = config.tag.toLowerCase()

  // Находим релевантный блочный элемент
  let blockElement = getClosestBlockElement(range.startContainer, editorRoot)

  if (!blockElement) {
    console.warn('[toggleBlockFormat] Could not find parent block element, creating new one')
    // Создаём новый параграф для содержимого
    const p = document.createElement('p')

    // Если есть выделенный текст, перемещаем его в новый параграф
    if (!range.collapsed) {
      const fragment = range.extractContents()
      p.appendChild(fragment)
      range.insertNode(p)
    } else {
      // Если нет выделения, просто вставляем пустой параграф
      p.innerHTML = '<br>'
      range.insertNode(p)
    }

    blockElement = p

    // Обновляем range для работы с новым элементом
    range.selectNodeContents(blockElement)
    range.collapse(false)
  }

  const currentTag = blockElement.tagName.toLowerCase()

  // Логика взаимоисключения для блочных элементов
  let newTag = targetTag

  // Специальная логика для squib - оборачивает/разворачивает блоки
  if (command === 'squib') {
    // Проверяем: находимся ли мы уже внутри squib?
    const parentSquib = blockElement.closest('[data-align]') as HTMLElement | null

    if (parentSquib) {
      // Если родитель - squib, разворачиваем: убираем обертку squib
      console.log('[toggleBlockFormat] Unwrapping squib')

      // Получаем все дочерние элементы squib
      const children = Array.from(parentSquib.childNodes)
      const parent = parentSquib.parentElement

      if (parent) {
        // Вставляем все дочерние элементы перед squib
        children.forEach((child) => {
          parent.insertBefore(child, parentSquib)
        })

        // Удаляем пустой squib
        parentSquib.remove()

        console.log('[toggleBlockFormat] Squib unwrapped successfully')
      }

      return // Завершаем, не продолжаем дальше
    } else {
      // Если нет родителя-squib, оборачиваем текущий блок в squib
      console.log('[toggleBlockFormat] Wrapping block in squib')

      // Проверяем: не содержит ли текущий блок вложенный squib (запрещено)
      const hasNestedSquib = blockElement.querySelector('[data-align]')
      if (hasNestedSquib) {
        console.warn('[toggleBlockFormat] Cannot wrap block containing squib - nested squibs not allowed')
        return
      }

      const squibWrapper = document.createElement('div')
      squibWrapper.setAttribute('data-align', config.attributes?.['data-align'] || 'left')

      // Вставляем обертку перед текущим блоком
      blockElement.parentElement?.insertBefore(squibWrapper, blockElement)

      // Перемещаем блок внутрь обертки
      squibWrapper.appendChild(blockElement)

      // Восстанавливаем курсор в блоке
      try {
        const newRange = document.createRange()
        const selection = window.getSelection()

        if (selection) {
          const firstTextNode = findFirstTextNode(blockElement)
          if (firstTextNode) {
            newRange.setStart(firstTextNode, 0)
            newRange.setEnd(firstTextNode, 0)
            selection.removeAllRanges()
            selection.addRange(newRange)
          }
        }
      } catch (e) {
        console.error('[toggleBlockFormat] Error restoring cursor:', e)
      }

      console.log('[toggleBlockFormat] Block wrapped in squib successfully')
      return // Завершаем, не продолжаем дальше
    }
  }
  // Если применяем заголовок, а уже есть другой заголовок - заменяем
  else if (['h1', 'h2', 'h3'].includes(targetTag) && ['h1', 'h2', 'h3'].includes(currentTag)) {
    newTag = currentTag === targetTag ? defaultTag : targetTag
  }
  // Если применяем punchline к blockquote или наоборот - заменяем (они взаимоисключающие)
  else if (
    (targetTag === 'punchline' && currentTag === 'blockquote') ||
    (targetTag === 'blockquote' && currentTag === 'punchline')
  ) {
    newTag = targetTag
  }
  // Если применяем заголовок к punchline или наоборот - заменяем
  else if (
    (['h1', 'h2', 'h3'].includes(targetTag) && currentTag === 'punchline') ||
    (targetTag === 'punchline' && ['h1', 'h2', 'h3'].includes(currentTag))
  ) {
    newTag = targetTag
  }
  // Заголовки и blockquote НЕ взаимоисключающие - обычная toggle логика
  else {
    newTag = currentTag === targetTag ? defaultTag : targetTag
  }

  // Избегаем изменений если уже корректно
  if (currentTag === newTag) return

  console.log(`[toggleBlockFormat] Changing block from <${currentTag}> to <${newTag}>`)

  const newBlock = document.createElement(newTag)

  // Копируем атрибуты если необходимо
  const newConfig = Object.values(FORMAT_CONFIG).find((c) => c.tag === newTag)
  if (newConfig?.attributes) {
    console.log('[toggleBlockFormat] Applying attributes:', newConfig.attributes)
    Object.entries(newConfig.attributes).forEach(([key, value]) => {
      // Для класса используем className, а не setAttribute
      if (key === 'class') {
        newBlock.className = value
      } else if (value || key.startsWith('data-')) {
        newBlock.setAttribute(key, value)
        console.log(`[toggleBlockFormat] Set attribute: ${key}="${value}"`)
      }
    })
  }

  console.log('[toggleBlockFormat] New block created:', newBlock.outerHTML)

  // Убеждаемся, что новый блок может быть редактируемым
  if (newTag === 'blockquote') {
    // Blockquote должен наследовать contentEditable от родителя
    console.log('[toggleBlockFormat] Creating blockquote element')
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
    console.log('[toggleBlockFormat] Replacing old block:', blockElement.outerHTML)
    console.log('[toggleBlockFormat] With new block:', newBlock.outerHTML)
    const parent = blockElement.parentNode
    parent?.replaceChild(newBlock, blockElement)
    if (parent && 'innerHTML' in parent) {
      console.log('[toggleBlockFormat] Replacement complete. Parent HTML:', (parent as HTMLElement).innerHTML)
    }
  } catch (e) {
    console.error('[toggleBlockFormat] Error replacing node:', e)
    return
  }

  // Восстанавливаем позицию курсора в новом блоке
  try {
    console.log('[toggleBlockFormat] Starting selection restoration...')

    // Принудительно фокусируемся на редакторе СНАЧАЛА
    editorRoot.focus()

    // Небольшая задержка для стабилизации DOM
    setTimeout(() => {
      try {
        const newRange = document.createRange()
        const selection = window.getSelection()

        if (selection && editorRoot.contains(newBlock)) {
          console.log('[toggleBlockFormat] New block is in DOM, restoring selection...')

          // Ищем текстовый узел или ставим курсор в начало блока
          const firstTextNode = findFirstTextNode(newBlock)
          if (firstTextNode?.textContent) {
            // Сохраняем позицию курсора относительно начала текста
            const originalOffset = Math.min(state.range?.startOffset || 0, firstTextNode.textContent.length)
            newRange.setStart(firstTextNode, originalOffset)
            newRange.setEnd(firstTextNode, originalOffset)
            console.log('[toggleBlockFormat] Cursor positioned at text offset:', originalOffset)
          } else if (newBlock.childNodes.length > 0) {
            // Если есть дочерние элементы, ставим курсор в первый
            const firstChild = newBlock.childNodes[0]
            if (firstChild.nodeType === Node.TEXT_NODE) {
              newRange.setStart(firstChild, 0)
              newRange.setEnd(firstChild, 0)
            } else {
              newRange.setStart(newBlock, 0)
              newRange.setEnd(newBlock, 0)
            }
            console.log('[toggleBlockFormat] Cursor positioned at first child')
          } else {
            // Если блок пустой, ставим курсор в начало блока
            newRange.setStart(newBlock, 0)
            newRange.setEnd(newBlock, 0)
            console.log('[toggleBlockFormat] Cursor positioned at empty block start')
          }

          selection.removeAllRanges()
          selection.addRange(newRange)

          // Убеждаемся, что редактор все еще в фокусе
          if (document.activeElement !== editorRoot) {
            editorRoot.focus()
          }

          console.log('[toggleBlockFormat] Selection and focus restored successfully')
        } else {
          console.error('[toggleBlockFormat] New block not found in DOM or selection unavailable')
          editorRoot.focus()
        }
      } catch (innerError) {
        console.error('[toggleBlockFormat] Error in delayed restoration:', innerError)
        editorRoot.focus()
      }
    }, 5) // Минимальная задержка для стабилизации DOM
  } catch (e) {
    console.error('[toggleBlockFormat] Error restoring selection:', e)
    // Запасной вариант - просто фокус
    editorRoot.focus()
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
