/**
 * @module link
 * @description Модуль для работы со ссылками в редакторе
 */

/**
 * Регулярное выражение для проверки URL
 */
export const URL_REGEX =
  /^(https?:\/\/)?(www\.)?[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/[^\s]*)?$/

/**
 * Валидирует URL
 * @param url URL для проверки
 * @returns true если URL валидный
 */
export const validateUrl = (url: string): boolean => {
  if (!url) return false

  // Проверяем соответствие формату URL
  return URL_REGEX.test(url)
}

/**
 * Нормализует URL, добавляя протокол, если он отсутствует
 * @param url URL для нормализации
 * @returns нормализованный URL
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return url
  return url.startsWith('http') ? url : `https://${url}`
}

/**
 * Вставляет ссылку в текущее выделение
 * @param url URL для вставки
 * @param text Текст ссылки (если не указан, используется текст выделения или сам URL)
 * @param editor Ссылка на редактор
 * @returns true если вставка успешна
 */
export const insertLink = (url: string, text: string | undefined, editor: HTMLElement): boolean => {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return false

  // Проверяем, что курсор находится внутри редактора
  if (!editor.contains(selection.focusNode)) {
    editor.focus()
  }

  const range = selection.getRangeAt(0)
  const normalizedUrl = normalizeUrl(url)
  const linkText = text || selection.toString() || url

  // Создаем ссылку
  const link = document.createElement('a')
  link.href = normalizedUrl
  link.textContent = linkText
  link.target = '_blank'
  link.rel = 'noopener noreferrer'

  // Вставляем ссылку
  range.deleteContents()
  range.insertNode(link)

  // Перемещаем курсор после ссылки
  range.setStartAfter(link)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

/**
 * Обновляет существующую ссылку
 * @param link Элемент ссылки
 * @param url Новый URL
 * @returns true если обновление успешно
 */
export const updateLink = (link: HTMLAnchorElement, url: string): boolean => {
  if (!link) return false

  const normalizedUrl = normalizeUrl(url)
  link.href = normalizedUrl

  return true
}

/**
 * Находит ссылку по координатам
 * @param x Координата X
 * @param y Координата Y
 * @param editor Ссылка на редактор
 * @returns Элемент ссылки или null
 */
export const findLinkAtPosition = (x: number, y: number, editor: HTMLElement): HTMLAnchorElement | null => {
  const element = document.elementFromPoint(x, y)
  if (!element || !editor.contains(element)) return null

  // Проверяем, является ли элемент ссылкой или находится внутри ссылки
  const link = element.closest('a')
  return link as HTMLAnchorElement
}

/**
 * Удаляет ссылку, сохраняя её текст
 * @param link Элемент ссылки
 * @returns true если удаление успешно
 */
export const removeLink = (link: HTMLAnchorElement): boolean => {
  if (!link) return false

  const text = link.textContent || ''
  const textNode = document.createTextNode(text)
  link.parentNode?.replaceChild(textNode, link)

  return true
}
