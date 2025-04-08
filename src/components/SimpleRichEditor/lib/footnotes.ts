import { clsx } from 'clsx'
import styles from './footnotes.module.scss'

/**
 * @module footnotes
 * @description Функции для работы со сносками в редакторе
 */

/**
 * Тип сноски
 */
export interface Footnote {
  id: string
  content: string
  marker: Element
}

/**
 * Модуль для работы со сносками в редакторе
 *
 * Особенности:
 * - Автоматическая нумерация
 * - Двусторонняя навигация
 * - Семантическая разметка
 * - ARIA атрибуты
 */

/**
 * Создает ссылку на сноску
 */
const createFootnoteRef = (number: number): HTMLElement => {
  const footnoteRef = document.createElement('sup')
  footnoteRef.className = clsx(styles.footnoteRef)
  footnoteRef.id = `fnref:${number}`
  footnoteRef.setAttribute('data-footnote', 'ref')
  footnoteRef.setAttribute('data-footnote-id', number.toString())

  const refLink = document.createElement('a')
  refLink.href = `#fn:${number}`
  refLink.textContent = number.toString()
  refLink.setAttribute('aria-describedby', 'footnote-label')
  refLink.setAttribute('data-footnote', 'ref-link')
  refLink.setAttribute('data-footnote-id', number.toString())

  footnoteRef.appendChild(refLink)

  return footnoteRef
}

/**
 * Создает элемент сноски
 */
const createFootnoteItem = (number: number, content: string): HTMLElement => {
  const footnoteItem = document.createElement('li')
  footnoteItem.id = `fn:${number}`
  footnoteItem.setAttribute('role', 'doc-endnote')
  footnoteItem.setAttribute('data-footnote', 'item')
  footnoteItem.setAttribute('data-footnote-id', number.toString())

  const footnoteContent = document.createElement('p')
  footnoteContent.innerHTML = content
  footnoteContent.setAttribute('data-footnote-content', number.toString())

  const backlink = document.createElement('a')
  backlink.href = `#fnref:${number}`
  backlink.className = clsx(styles.footnoteBackref)
  backlink.setAttribute('role', 'doc-backlink')
  backlink.setAttribute('aria-label', 'Back to content')
  backlink.setAttribute('data-footnote', 'backlink')
  backlink.setAttribute('data-footnote-id', number.toString())
  backlink.innerHTML = '↩'

  footnoteContent.appendChild(backlink)
  footnoteItem.appendChild(footnoteContent)

  return footnoteItem
}

/**
 * Создает или возвращает существующий список сносок
 */
const getFootnotesList = (editor: HTMLElement): HTMLElement => {
  let footnotesList = editor.querySelector('.footnotes')
  if (!footnotesList) {
    footnotesList = document.createElement('section')
    footnotesList.className = 'footnotes'
    footnotesList.setAttribute('role', 'doc-endnotes')

    const hr = document.createElement('hr')
    footnotesList.appendChild(hr)

    const ol = document.createElement('ol')
    footnotesList.appendChild(ol)

    editor.appendChild(footnotesList)
  }
  return footnotesList as HTMLElement
}

/**
 * Вставляет сноску в редактор
 * @param editor Элемент редактора
 * @param content Содержимое сноски
 * @param selection Текущее выделение
 * @returns true если вставка успешна
 */
export const insertFootnote = (editor: HTMLElement, content: string, selection: Selection): boolean => {
  if (!editor || !content) return false

  // Получаем существующий или создаем новый список сносок
  const footnotesList = getFootnotesList(editor)
  const ol = footnotesList.querySelector('ol')
  if (!ol) return false

  // Определяем номер новой сноски
  const footnoteNumber = ol.children.length + 1

  // Создаем элементы сноски
  const footnoteRef = createFootnoteRef(footnoteNumber)
  const footnoteItem = createFootnoteItem(footnoteNumber, content)

  // Добавляем элемент сноски в список
  ol.appendChild(footnoteItem)

  if (selection && selection.rangeCount > 0) {
    // Вставляем ссылку на сноску в текущую позицию курсора
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(footnoteRef)

    // Перемещаем курсор после вставленной ссылки
    range.setStartAfter(footnoteRef)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    return true
  }

  return false
}

/**
 * Получает все сноски из редактора
 * @param editorElement DOM-элемент редактора
 * @returns массив сносок
 */
export const getAllFootnotes = (editorElement: HTMLElement): Footnote[] => {
  // Находим все элементы с атрибутом data-footnote
  const footnoteElements = editorElement.querySelectorAll('[data-footnote]')

  // Преобразуем NodeList в массив объектов с нужными свойствами
  return Array.from(footnoteElements).map((element) => {
    // Получаем ID сноски из атрибута
    const id = element.getAttribute('data-footnote') || ''

    // Получаем содержимое сноски (в реальной ситуации может храниться в другом месте)
    const content = element.getAttribute('data-footnote-content') || ''

    return { id, content, marker: element }
  })
}

/**
 * Находит сноску по ID
 * @param editorElement DOM-элемент редактора
 * @param footnoteId ID сноски
 * @returns объект сноски или null, если сноска не найдена
 */
export const getFootnoteById = (editorElement: HTMLElement, footnoteId: string): Footnote | null => {
  // Находим элемент сноски по ID
  const footnoteElement = editorElement.querySelector(`[data-footnote="${footnoteId}"]`)

  if (!footnoteElement) return null

  // Получаем содержимое сноски
  const content = footnoteElement.getAttribute('data-footnote-content') || ''

  return { id: footnoteId, content, marker: footnoteElement }
}

/**
 * Создает HTML-код для сноски
 * @param footnoteId ID сноски
 * @param content содержимое сноски
 * @returns HTML-код сноски
 */
export const createFootnoteHTML = (footnoteId: string, content: string): string => {
  return `<span class="footnote" data-footnote="${footnoteId}" data-footnote-content="${encodeURIComponent(content)}">[${footnoteId}]</span>`
}

/**
 * Обновляет содержимое сноски
 * @param editorElement DOM-элемент редактора
 * @param footnoteId ID сноски
 * @param content новое содержимое сноски
 * @returns true, если сноска успешно обновлена
 */
export const updateFootnoteContent = (
  editorElement: HTMLElement,
  footnoteId: string,
  content: string
): boolean => {
  const footnoteElement = editorElement.querySelector(`[data-footnote="${footnoteId}"]`)

  if (!footnoteElement) return false

  footnoteElement.setAttribute('data-footnote-content', encodeURIComponent(content))
  return true
}

/**
 * Обновляет нумерацию сносок
 */
export const renumberFootnotes = (editor: HTMLElement): void => {
  const footnotes = getAllFootnotes(editor)

  // Очищаем существующие сноски
  editor.querySelectorAll('.footnote-ref, .footnotes li').forEach((el) => el.remove())

  // Пересоздаем с правильной нумерацией
  footnotes.forEach(({ content }) => {
    const selection = window.getSelection()
    if (selection) {
      insertFootnote(editor, content, selection)
    }
  })
}

/**
 * Удаляет сноску из редактора
 * @param editor Элемент редактора
 * @param footnoteId ID сноски
 * @returns true если удаление успешно
 */
export const removeFootnote = (editor: HTMLElement, footnoteId: string): boolean => {
  if (!editor || !footnoteId) return false

  // Находим маркер сноски
  const footnoteMarker = editor.querySelector(`[data-footnote-id="${footnoteId}"]`)
  if (!footnoteMarker) return false

  // Находим содержимое сноски
  const footnoteContent = editor.querySelector(`[data-footnote-content="${footnoteId}"]`)
  if (!footnoteContent) return false

  // Удаляем элементы
  footnoteMarker.remove()
  footnoteContent.remove()
  return true
}

/**
 * Обновляет содержимое сноски
 * @param editor Элемент редактора
 * @param footnoteId ID сноски
 * @param content Новое содержимое
 * @returns true если обновление успешно
 */
export const updateFootnote = (editor: HTMLElement, footnoteId: string, content: string): boolean => {
  if (!editor || !footnoteId || !content) return false

  // Находим содержимое сноски
  const footnoteContent = editor.querySelector(`[data-footnote-content="${footnoteId}"]`)
  if (!footnoteContent) return false

  // Обновляем содержимое
  footnoteContent.innerHTML = content
  return true
}
