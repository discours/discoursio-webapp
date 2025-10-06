/**
 * Утилиты и хелперы для редактора SimpleRichEditor
 *
 * Содержит вспомогательные функции для работы с DOM, выделением, позиционирования
 * курсора и меню, а также для управления состоянием редактора.
 */

import { isEmptyContent } from '../lib/empty'
import { getEditorPosition } from '../lib/positioning'
import { EditorFieldType } from '../lib/types'

/**
 * Обновляет состояние тулбара в зависимости от режима редактора и выделения
 *
 * @param params Объект с параметрами и зависимостями для обновления состояния тулбара
 */
export const updateToolbarState = (params: {
  editorRef: () => HTMLDivElement | undefined
  toolbar: string
  hasFocus: boolean
  selection: { text: string; isEmpty: boolean }
  setToolbar: (mode: string) => void
}) => {
  const { toolbar, hasFocus, selection, setToolbar } = params

  // Если нет фокуса, скрываем тулбар
  if (!hasFocus) {
    setToolbar('hidden')
    return
  }

  // Если это плавающий тулбар
  if (toolbar === 'float') {
    // Показываем тулбар только при непустом выделении
    if (selection.text && !selection.isEmpty) {
      setToolbar('float')
    } else {
      setToolbar('hidden')
    }
    return
  }

  // Если явно указан режим, используем его
  setToolbar(toolbar)
}

/**
 * Обновляет стиль отображения плейсхолдера на новой строке
 *
 * @param params Объект с параметрами и зависимостями для обновления стиля плейсхолдера
 */
export const updatePlaceholderStyle = (params: {
  editorRef: () => HTMLDivElement | undefined
  isCursorOnNewLine: boolean
}) => {
  const { editorRef, isCursorOnNewLine } = params
  const editor = editorRef()
  if (!editor) return

  // Управляем классом отображения плейсхолдера на новой строке
  if (isCursorOnNewLine && !isEmptyContent(editor.innerHTML)) {
    editor.classList.add('show-placeholder-on-new-line')
  } else {
    editor.classList.remove('show-placeholder-on-new-line')
  }
}

// Функции позиционирования перенесены в ../lib/positionUtils.ts
export {
  getFloatingToolbarPosition,
  getPlusMenuPosition
} from '../lib/positioning'

/**
 * Регулярное выражение для извлечения ID черновика из editorId
 */
export const DRAFT_ID_REGEX = /draft-(\d+)-/

/**
 * Извлекает ID черновика из editorId
 *
 * @param editorId ID редактора
 * @returns ID черновика или undefined
 */
export const extractDraftId = (editorId?: string): string | undefined => {
  if (!editorId) return undefined
  const match = editorId.match(DRAFT_ID_REGEX)
  return match ? match[1] : undefined
}

/**
 * Переключает фокус на другое поле редактора в том же черновике
 *
 * @param params Параметры для переключения
 * @returns true если переключение выполнено успешно
 */
export const switchFieldInDraft = (params: {
  nextField: EditorFieldType
  editorId?: string
  fieldType?: EditorFieldType
}): boolean => {
  const { nextField, editorId, fieldType } = params

  if (!editorId || !fieldType) return false

  // Получаем префикс ID черновика из editorId
  const draftIdMatch = editorId.match(DRAFT_ID_REGEX)
  if (!draftIdMatch) return false

  // Строим селектор для поиска редактора
  const draftId = draftIdMatch[1]
  const nextEditorId = `draft-${draftId}-${nextField}`

  // Находим следующий редактор
  const nextEditor = document.querySelector(`[data-editor-id="${nextEditorId}"]`)
  if (nextEditor) {
    // Фокусируемся на следующем редакторе
    ;(nextEditor as HTMLElement).focus()

    // Дополнительно прокручиваем к редактору, если он не виден
    nextEditor.scrollIntoView({ behavior: 'smooth', block: 'center' })

    return true
  }

  return false
}

/**
 * Получает позицию для плавающего меню редактора
 *
 * @param editorRef Ссылка на DOM-элемент редактора
 * @returns Объект с позиционированием: {top, left, isVisible}
 */
export const getEditorFloatingMenuPosition = (
  editorRef: () => HTMLDivElement | undefined
): {
  top: number
  left: number
  isVisible?: boolean
} => {
  return getEditorPosition(editorRef() || null, {
    type: 'float',
    placement: 'bottom',
    offset: 10,
    centerHorizontally: true
  })
}
