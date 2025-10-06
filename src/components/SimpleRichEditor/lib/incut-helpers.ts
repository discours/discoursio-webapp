/**
 * @module lib/incut-helpers
 * @description Функции для работы с врезками (incut) в редакторе
 */

// Уникальный идентификатор редактора врезки
export const incutId = 'incut-editor'

/**
 * Получает все подвёрстки из редактора
 * Подвёрстка (incut) — выделенный блок текста с особым оформлением
 * @param editor Элемент редактора
 * @returns Массив подвёрсток с их идентификаторами и содержимым
 */
export const getAllIncuts = (editor: HTMLElement): Array<{ id: string; content: string; element: HTMLElement }> => {
  if (!editor) return []

  // Находим все подвёрстки в редакторе (определяются по атрибуту data-align)
  const incutElements = editor.querySelectorAll('[data-align]')
  if (!incutElements.length) return []

  // Собираем информацию о подвёрстках
  const incuts = Array.from(incutElements).map((incut) => {
    const incutId = incut.getAttribute('data-incut-id')
    if (!incutId) return null

    return {
      id: incutId,
      content: incut.innerHTML,
      element: incut as HTMLElement
    }
  })

  // Фильтруем null значения
  return incuts.filter(Boolean) as Array<{ id: string; content: string; element: HTMLElement }>
}

/**
 * Находит конкретную врезку по идентификатору
 * @param editor Элемент редактора
 * @param incutId Идентификатор врезки
 * @returns Данные врезки или null, если не найдена
 */
export const getIncutById = (
  editor: HTMLElement,
  incutId: string
): { id: string; content: string; element: HTMLElement } | null => {
  if (!editor || !incutId) return null

  // Находим элемент врезки
  const incutElement = editor.querySelector(`[data-incut-id="${incutId}"]`)
  if (!incutElement) return null

  return {
    id: incutId,
    content: incutElement.innerHTML,
    element: incutElement as HTMLElement
  }
}

/**
 * Удаляет врезку из редактора
 * @param editor Элемент редактора
 * @param incutId ID врезки
 * @returns true если удаление успешно
 */
export const removeIncut = (editor: HTMLElement, incutId: string): boolean => {
  if (!editor || !incutId) return false

  // Находим врезку
  const incutElement = editor.querySelector(`[data-incut-id="${incutId}"]`)
  if (!incutElement) return false

  // Удаляем элемент
  incutElement.remove()
  return true
}
