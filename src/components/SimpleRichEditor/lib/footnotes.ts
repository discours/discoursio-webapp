import styles from './footnotes.module.scss'

export interface Footnote {
  id: number
  content: string
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
  footnoteRef.className = styles['footnote-ref']
  footnoteRef.id = `fnref:${number}`

  const refLink = document.createElement('a')
  refLink.href = `#fn:${number}`
  refLink.textContent = number.toString()
  refLink.setAttribute('aria-describedby', 'footnote-label')
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

  const footnoteContent = document.createElement('p')
  footnoteContent.innerHTML = content

  const backlink = document.createElement('a')
  backlink.href = `#fnref:${number}`
  backlink.className = styles['footnote-backref']
  backlink.setAttribute('role', 'doc-backlink')
  backlink.setAttribute('aria-label', 'Back to content')
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
 */
export const insertFootnote = (editor: HTMLElement, content: string, selection: Selection): boolean => {
  if (!selection.rangeCount) return false

  // Получаем текущий номер сноски
  const footnotes = editor.querySelectorAll('.footnote-ref')
  const footnoteNumber = footnotes.length + 1

  // Создаем элементы сноски
  const footnoteRef = createFootnoteRef(footnoteNumber)
  const footnoteItem = createFootnoteItem(footnoteNumber, content)

  // Вставляем ссылку в текст
  const range = selection.getRangeAt(0)
  range.deleteContents()
  range.insertNode(footnoteRef)

  // Добавляем сноску в список
  const footnotesList = getFootnotesList(editor)
  footnotesList.querySelector('ol')?.appendChild(footnoteItem)

  // Перемещаем курсор после сноски
  range.setStartAfter(footnoteRef)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

/**
 * Получает все сноски из редактора
 */
export const getFootnotes = (editor: HTMLElement): Footnote[] => {
  const footnotes: Footnote[] = []
  const items = editor.querySelectorAll('.footnote-ref')

  items.forEach((_item, index) => {
    const id = index + 1
    const footnote = editor.querySelector(`#fn:${id}`)
    if (footnote) {
      footnotes.push({
        id,
        content: footnote.querySelector('p')?.innerHTML || ''
      })
    }
  })

  return footnotes
}

/**
 * Обновляет нумерацию сносок
 */
export const renumberFootnotes = (editor: HTMLElement): void => {
  const footnotes = getFootnotes(editor)

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
