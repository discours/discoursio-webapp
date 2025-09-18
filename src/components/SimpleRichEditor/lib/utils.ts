import { useConnect } from '~/context/connect'
import { Position } from './types'

/**
 * Прокручивает страницу к нужному элементу редактора
 * @param element Элемент для прокрутки
 * @param offsetTop Смещение сверху
 */
export const scrollToElement = (element: HTMLElement, offsetTop = 0): void => {
  if (!element) return

  const rect = element.getBoundingClientRect()
  window.scrollTo({
    top: window.scrollY + rect.top - offsetTop,
    behavior: 'smooth'
  })
}

/**
 * Получает позицию курсора в редакторе
 * @param editor Ссылка на редактор
 * @returns Позиция курсора или null
 */
export const getCursorPosition = (editor: HTMLElement | null): Position | null => {
  if (!editor || typeof window === 'undefined') return null

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const editorRect = editor.getBoundingClientRect()

  // Получаем координаты начала диапазона
  const rect = range.getClientRects()[0] || range.getBoundingClientRect()

  if (rect) {
    return {
      top: rect.top - editorRect.top,
      left: rect.left - editorRect.left
    }
  }

  return null
}

/**
 * Проверяет, находится ли выделение внутри элемента
 * @param element Элемент для проверки
 * @returns true если выделение внутри элемента
 */
export const isSelectionInElement = (element: HTMLElement | null): boolean => {
  if (!element || typeof window === 'undefined') return false

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  return element.contains(range.commonAncestorContainer)
}

/**
 * Отслеживает выделение и позицию курсора
 *
 * @param params Параметры для отслеживания
 */
export const trackSelectionAndCursor = ({
  isServer,
  editorRef,
  updateActiveFormats,
  isSelectionInEditor,
  setSelection,
  setCursorPosition,
  setToolbar,
  isEmptyContent,
  toolbarMode,
  editorId, // Опциональный идентификатор редактора
  awarenessProvider // Добавляем провайдер для yjs awareness
}: {
  isServer: boolean
  editorRef: () => HTMLElement | undefined
  updateActiveFormats: () => void
  isSelectionInEditor: () => boolean
  setSelection: (sel: { text: string; isEmpty: boolean }) => void
  setCursorPosition: (pos: Position | null) => void
  setToolbar: (mode: string) => void
  isEmptyContent: (content: string) => boolean
  toolbarMode: string
  editorId?: string
  awarenessProvider?: ReturnType<typeof useConnect>
}): void => {
  if (isServer) return

  try {
    const selection = window.getSelection()
    if (!selection) return

    // Проверяем, что выделение действительно в этом редакторе
    const currentEditor = editorRef()
    if (!currentEditor) return

    // Проверяем, что выделение или курсор находится именно в этом редакторе
    const isInCurrentEditor = isSelectionInEditor()

    // Если выделение не в текущем редакторе, возвращаемся
    if (!isInCurrentEditor) {
      return
    }

    // Обновляем состояние активных форматов при изменении выделения
    if (typeof updateActiveFormats === 'function') {
      updateActiveFormats()
    }

    // Проверяем, пустое ли выделение
    const isEmpty = selection.toString().length === 0

    // Сохраняем информацию о выделении
    const text = isEmpty ? '' : selection.toString()
    if (typeof setSelection === 'function') {
      setSelection({ text, isEmpty })
    }

    // Определяем позицию выделения для меню
    if (isSelectionInEditor() && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)

      // Получаем координаты начала диапазона
      const rect = range.getClientRects()[0] || range.getBoundingClientRect()

      if (rect) {
        // Получаем координаты редактора
        const editor = editorRef()
        if (editor) {
          const editorRect = editor.getBoundingClientRect()
          // Вычисляем относительные координаты внутри редактора
          const position = {
            top: rect.top - editorRect.top,
            left: rect.left + rect.width / 2 - editorRect.left
          }
          setCursorPosition(position)

          // Рассчитываем позицию курсора в формате для Y.js (anchor, head)
          const anchorOffset = getAbsoluteOffset(range.startContainer, range.startOffset, editor)
          const headOffset = getAbsoluteOffset(range.endContainer, range.endOffset, editor)

          // Создаем общий объект состояния с позициями и временем
          const cursorState = {
            cursorPosition: position,
            timestamp: Date.now(),
            anchor: anchorOffset,
            head: headOffset,
            isEmpty: false
          }

          // Всегда сохраняем в localStorage для offline-режима
          try {
            localStorage.setItem(`editor-cursor-${editorId}`, JSON.stringify(cursorState))
          } catch (e) {
            console.warn('[trackSelectionAndCursor] Error saving cursor to localStorage:', e)
          }

          // Если есть awareness провайдер, обновляем позицию там
          if (editorId && awarenessProvider) {
            try {
              // Обновляем позицию курсора в awareness
              // При этом проверяем состояние подключения провайдера
              if (awarenessProvider.getStatus() === 'connected') {
                // Только если соединение активно - обновляем позицию
                awarenessProvider.setCursorPosition(editorId, anchorOffset, headOffset)
              }
            } catch (e) {
              console.warn('[trackSelectionAndCursor] Error saving cursor position in awareness:', e)
              // Ошибки в awareness не должны прерывать работу редактора
            }
          }
        } else {
          // Если не можем получить редактор, используем абсолютные координаты
          const position = {
            top: rect.top,
            left: rect.left + rect.width / 2
          }
          setCursorPosition(position)
        }
      }

      // Управляем видимостью тулбара в режиме float
      if (toolbarMode === 'float') {
        if (isEmpty) {
          setToolbar('hidden')
        } else {
          setToolbar('float')
        }
      }
    } else if (currentEditor && isEmptyContent(currentEditor.innerHTML)) {
      // Если редактор пустой, устанавливаем позицию курсора в середину редактора
      const editorRect = currentEditor.getBoundingClientRect()
      const position = {
        top: editorRect.height / 2,
        left: 10 // Небольшой отступ от левого края
      }
      setCursorPosition(position)

      // Создаем общий объект состояния для пустого редактора
      const cursorState = {
        cursorPosition: position,
        timestamp: Date.now(),
        anchor: 0,
        head: 0,
        isEmpty: true
      }

      // Всегда сохраняем в localStorage для offline-режима
      try {
        localStorage.setItem(`editor-cursor-${editorId}`, JSON.stringify(cursorState))
      } catch (e) {
        console.warn('[trackSelectionAndCursor] Error saving empty cursor to localStorage:', e)
      }

      // Если есть awareness провайдер, обновляем позицию там
      if (editorId && awarenessProvider) {
        try {
          // Проверяем состояние подключения провайдера
          if (awarenessProvider.getStatus() === 'connected') {
            // При пустом редакторе позиция курсора в начале
            awarenessProvider.setCursorPosition(editorId, 0, 0)
          }
        } catch (e) {
          console.warn('[trackSelectionAndCursor] Error saving empty cursor position in awareness:', e)
          // Ошибки в awareness не должны прерывать работу редактора
        }
      }
    }
  } catch (e) {
    console.warn('[trackSelectionAndCursor] Error in trackSelectionAndCursor:', e)
  }
}

/**
 * Вычисляет абсолютное смещение (позицию) для узла в редакторе
 * @param node Узел в DOM
 * @param offset Смещение в узле
 * @param editorNode Корневой узел редактора
 * @returns Абсолютное смещение относительно редактора
 */
export const getAbsoluteOffset = (node: Node, offset: number, editorNode: Node): number => {
  // Если узел - это текстовый узел, находим его абсолютное смещение
  if (node.nodeType === Node.TEXT_NODE) {
    // Находим абсолютное смещение от начала редактора
    let absoluteOffset = offset

    // Перебираем все предыдущие узлы, суммируя длины текстовых узлов
    let currentNode: Node | null = node

    // Сначала учитываем предыдущие текстовые узлы в том же родителе
    let previousSibling = currentNode.previousSibling
    while (previousSibling) {
      if (previousSibling.nodeType === Node.TEXT_NODE) {
        absoluteOffset += (previousSibling as Text).length
      } else if (previousSibling.nodeType === Node.ELEMENT_NODE) {
        // Для элементов учитываем всё их текстовое содержимое
        absoluteOffset += previousSibling.textContent?.length || 0
      }
      previousSibling = previousSibling.previousSibling
    }

    // Теперь поднимаемся по дереву до редактора, учитывая смещения
    while (currentNode && currentNode !== editorNode) {
      const parent: Node | null = currentNode.parentNode
      if (!parent) break

      // Учитываем смещение от предыдущих братьев текущего родителя
      let prevSibling = parent.previousSibling
      while (prevSibling) {
        if (prevSibling.nodeType === Node.TEXT_NODE) {
          absoluteOffset += (prevSibling as Text).length
        } else if (prevSibling.nodeType === Node.ELEMENT_NODE) {
          absoluteOffset += prevSibling.textContent?.length || 0
        }
        prevSibling = prevSibling.previousSibling
      }

      currentNode = parent
    }

    return absoluteOffset
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Если это элемент, находим смещение до дочернего узла
    let absoluteOffset = 0
    for (let i = 0; i < offset && i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      if (child.nodeType === Node.TEXT_NODE) {
        absoluteOffset += (child as Text).length
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        absoluteOffset += child.textContent?.length || 0
      }
    }
    return absoluteOffset
  }

  return offset
}

/**
 * Получает текущее выделение или создает новое в конце редактора
 * @param editor Ссылка на редактор
 * @returns Selection и Range или null
 */
export const getOrCreateSelection = (editor: HTMLElement | null): { selection: Selection; range: Range } | null => {
  if (!editor || typeof window === 'undefined') return null

  const selection = window.getSelection()
  if (!selection) return null

  // Если нет выделения, создаем новое в конце редактора
  if (!selection.rangeCount) {
    const range = document.createRange()

    // Если есть текст в редакторе, ставим курсор в конец
    if (editor.lastChild) {
      range.selectNodeContents(editor)
      range.collapse(false)
    } else {
      // Иначе выбираем весь редактор
      range.selectNodeContents(editor)
    }

    selection.removeAllRanges()
    selection.addRange(range)
  }

  if (!selection.rangeCount) {
    console.error('Не удалось создать выделение в редакторе')
    return null
  }

  return { selection, range: selection.getRangeAt(0) }
}

/**
 * Заменяет текущее выделение HTML контентом
 * @param html HTML строка для вставки
 * @param editor Ссылка на редактор
 * @returns true если замена успешна
 */
export const replaceSelection = (html: string, editor: HTMLElement | null): boolean => {
  const selectionData = getOrCreateSelection(editor)
  if (!selectionData) return false

  const { selection, range } = selectionData

  // Создаем временный контейнер для HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Очищаем текущее выделение
  range.deleteContents()

  // Вставляем новый контент
  const fragment = document.createDocumentFragment()
  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild)
  }

  range.insertNode(fragment)

  // Перемещаем курсор в конец вставленного контента
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

/**
 * Проверяет, является ли узел текстовым
 * @param node Узел для проверки
 * @returns true если узел текстовый
 */
export const isTextNode = (node: Node | null): node is Text => {
  return node?.nodeType === Node.TEXT_NODE
}

/**
 * Проверяет, является ли узел элементом
 * @param node Узел для проверки
 * @returns true если узел элемент
 */
export const isElementNode = (node: Node | null): node is Element => {
  return node?.nodeType === Node.ELEMENT_NODE
}

/**
 * Получает родительский элемент для узла
 * @param node Узел
 * @returns Родительский элемент или null
 */
export const getParentElement = (node: Node | null): HTMLElement | null => {
  if (!node) return null
  return isTextNode(node) ? node.parentElement : (node as HTMLElement)
}

/**
 * Перемещает курсор в конец редактора
 * @param editor Ссылка на редактор
 */
export const moveCursorToEnd = (editor: HTMLElement | null): void => {
  if (!editor || typeof window === 'undefined') return

  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()

  if (editor.lastChild) {
    range.selectNodeContents(editor.lastChild)
    range.collapse(false)
  } else {
    range.selectNodeContents(editor)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * Регулярное выражение для проверки URL
 */
export const URL_REGEX =
  /^(https?:\/\/)?(www\.)?[a-zA-Z0-9]+([-.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/[^\s]*)?$/

/**
 * Валидирует URL
 * @param url URL для проверки
 * @returns true если URL валидный
 */
export const validateUrl = (url: string): boolean => {
  if (!url) return false
  return URL_REGEX.test(url)
}

/**
 * Определяет, находится ли курсор на пустой строке
 *
 * @param editorNode - DOM-элемент редактора
 * @returns true если курсор находится на пустой строке или в начале элемента
 *
 * @example
 * ```ts
 * const editor = document.querySelector('.editor');
 * const isEmpty = isCursorOnEmptyLine(editor);
 * if (isEmpty) {
 *   // Показать специальное меню
 * }
 * ```
 */

export const isCursorOnEmptyLine = (editorNode: HTMLElement | null): boolean => {
  if (!editorNode) return true

  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return true

  const range = selection.getRangeAt(0)
  const node = range.startContainer

  // Проверяем, что выделение в редакторе
  if (!editorNode.contains(node)) return false

  // Определяем текущий узел и родительский элемент
  const currentNode = node.nodeType === Node.TEXT_NODE ? node : (node as Element)
  const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : (currentNode as HTMLElement)

  // Случай 1: Текстовый узел - проверяем текст до курсора
  if (node.nodeType === Node.TEXT_NODE) {
    const textBeforeCursor = node.textContent?.slice(0, range.startOffset) || ''
    return textBeforeCursor.trim() === ''
  }

  // Случай 2: HTML-элемент (параграф, div и т.д.)
  if (parentElement) {
    // Проверка на пустой параграф или строку
    if (
      parentElement.innerHTML === '' ||
      parentElement.innerHTML === '<br>' ||
      parentElement.textContent?.trim() === ''
    ) {
      return true
    }

    // Если курсор в начале непустого элемента
    if (range.startOffset === 0 && parentElement.textContent?.trim()) {
      return true
    }
  }

  // Случай 3: Курсор в начале редактора
  if (range.startOffset === 0 && (node === editorNode || parentElement === editorNode)) {
    return true
  }

  return false
}
