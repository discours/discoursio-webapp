/**
 * @module lib/squib-helpers
 * @description Функции для работы с врезками (squib) в редакторе
 */

// Уникальный идентификатор редактора врезки
export const squibId = 'squib-editor'

/**
 * Получает все врезки из редактора
 * @param editor Элемент редактора
 * @returns Массив врезок с их идентификаторами и содержимым
 */
export const getAllSquibs = (editor: HTMLElement): Array<{ id: string; content: string; element: HTMLElement }> => {
  if (!editor) return []

  // Находим все врезки в редакторе
  const squibElements = editor.querySelectorAll('[data-type="squib"]')
  if (!squibElements.length) return []

  // Собираем информацию о врезках
  const squibs = Array.from(squibElements).map((squib) => {
    const squibId = squib.getAttribute('data-squib-id')
    if (!squibId) return null

    return {
      id: squibId,
      content: squib.innerHTML,
      element: squib as HTMLElement
    }
  })

  // Фильтруем null значения
  return squibs.filter(Boolean) as Array<{ id: string; content: string; element: HTMLElement }>
}

/**
 * Находит конкретную врезку по идентификатору
 * @param editor Элемент редактора
 * @param squibId Идентификатор врезки
 * @returns Данные врезки или null, если не найдена
 */
export const getSquibById = (
  editor: HTMLElement,
  squibId: string
): { id: string; content: string; element: HTMLElement } | null => {
  if (!editor || !squibId) return null

  // Находим элемент врезки
  const squibElement = editor.querySelector(`[data-squib-id="${squibId}"]`)
  if (!squibElement) return null

  return {
    id: squibId,
    content: squibElement.innerHTML,
    element: squibElement as HTMLElement
  }
}

/**
 * Удаляет врезку из редактора
 * @param editor Элемент редактора
 * @param squibId ID врезки
 * @returns true если удаление успешно
 */
export const removeSquib = (editor: HTMLElement, squibId: string): boolean => {
  if (!editor || !squibId) return false

  // Находим врезку
  const squibElement = editor.querySelector(`[data-squib-id="${squibId}"]`)
  if (!squibElement) return false

  // Удаляем элемент
  squibElement.remove()
  return true
}
