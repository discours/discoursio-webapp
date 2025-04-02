/**
 * Проверяет, является ли контент действительно пустым (включая пустые теги)
 * @param content Контент для проверки
 * @returns true если контент пустой
 */
export const isEmptyContent = (content: string | null | undefined | Record<string, unknown>): boolean => {
  if (content === null || content === undefined) return true

  // Если контент не строка, пробуем преобразовать
  if (typeof content !== 'string') {
    // Если это объект с полем content, проверяем его содержимое
    if (content && typeof content === 'object' && 'content' in content) {
      const contentField = content.content
      return isEmptyContent(contentField as string | null | undefined)
    }

    try {
      const contentStr = String(content)
      return isEmptyContent(contentStr)
    } catch (_e) {
      // Если не можем преобразовать в строку, считаем пустым
      return true
    }
  }

  // Работаем со строкой
  const contentStr = String(content)

  // Простая проверка на пустую строку
  if (contentStr.trim() === '') return true

  // Проверка на содержимое только BR
  if (contentStr === '<br>' || contentStr === '<br/>' || contentStr === '<p><br></p>') return true

  // Создаем временный DIV для анализа контента
  const div = document.createElement('div')
  div.innerHTML = contentStr

  // Проверяем наличие изображений, видео и iframe
  const hasMedia = div.querySelector('img, video, iframe') !== null

  // Если есть медиа, контент не пустой
  if (hasMedia) return false

  // Если нет медиа, проверяем текст
  const textContent = div.textContent || ''

  // Очищаем текст от пробелов и проверяем его длину
  const cleanText = textContent.trim()

  // Если текстовое содержимое пустое или содержит только пробелы
  return cleanText.length === 0
}

/**
 * Нормализует HTML контент, удаляя лишние переносы и пустые теги
 * @param content HTML контент
 * @returns Нормализованный HTML
 */
export const normalizeContent = (content: string): string => {
  if (!content.trim()) return ''

  // Создаем временный контейнер для обработки HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = content

  // Удаляем пустые теги форматирования
  const emptyTags = tempDiv.querySelectorAll('em:empty, strong:empty, i:empty, b:empty, span:empty')
  emptyTags.forEach((tag) => {
    if (!tag.textContent || tag.textContent === '\u200B') {
      tag.remove()
    }
  })

  // Замена <i> на <em>
  const iTags = tempDiv.querySelectorAll('i')
  iTags.forEach((tag) => {
    const em = document.createElement('em')
    while (tag.firstChild) {
      em.appendChild(tag.firstChild)
    }
    Array.from(tag.attributes).forEach((attr) => {
      em.setAttribute(attr.name, attr.value)
    })
    tag.parentNode?.replaceChild(em, tag)
  })

  // Замена <b> на <strong>
  const bTags = tempDiv.querySelectorAll('b')
  bTags.forEach((tag) => {
    const strong = document.createElement('strong')
    while (tag.firstChild) {
      strong.appendChild(tag.firstChild)
    }
    Array.from(tag.attributes).forEach((attr) => {
      strong.setAttribute(attr.name, attr.value)
    })
    tag.parentNode?.replaceChild(strong, tag)
  })

  // Проверяем на пустые параграфы или избыточные переносы
  let html = tempDiv.innerHTML
  html = html.replace(/(<p>\s*<\/p>){2,}/gi, '<p><br></p>')
  html = html.replace(/(<p><br\s*\/?><\/p>){3,}/gi, '<p><br></p><p><br></p>')

  return html
}

/**
 * Получает чистый текст из HTML
 * @param html HTML контент
 * @returns Чистый текст
 */
export const getPlainText = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

/**
 * Заменяет текущее выделение HTML контентом
 * @param html HTML строка для вставки
 * @param editor Ссылка на редактор
 * @returns true если замена успешна
 */
export const replaceSelection = (html: string, editor: HTMLElement | null): boolean => {
  if (!editor) return false

  const selection = window.getSelection()
  if (!selection) return false

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

  // Должно быть доступно выделение
  if (!selection.rangeCount) return false

  const range = selection.getRangeAt(0)

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
