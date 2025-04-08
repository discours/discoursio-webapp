/**
 * @module helpers
 * @description Вспомогательные функции для работы с медиа-контентом в редакторе
 */

// Уникальный идентификатор редактора врезки
export const squibId = 'squib-editor'

/**
 * Получает все медиа элементы из редактора
 * @param editor Элемент редактора
 * @returns Массив медиа элементов
 *
 * @example
 * ```ts
 * const mediaElements = getMedia(editorRef());
 * console.log(`В редакторе ${mediaElements.length} медиа-элементов`);
 * ```
 */
export const getMedia = (editor: HTMLElement | null): HTMLElement[] => {
  if (!editor) return []
  return Array.from(editor.querySelectorAll('img, video, audio, iframe'))
}

/**
 * Интерфейс для параметров вставки медиа в редактор
 */
export interface InsertMedia {
  /** Тип медиа-контента */
  type: 'image' | 'video' | 'audio'
  /** URL медиа-ресурса */
  url: string
  /** Заголовок или альтернативный текст */
  title?: string
  /** Дополнительные атрибуты */
  attributes?: Record<string, string>
}

/**
 * Создает HTML для вставки медиа в редактор
 * @param params Параметры медиа
 * @returns HTML строка для вставки
 *
 * @example
 * ```ts
 * const html = createMediaHtml({
 *   type: 'image',
 *   url: 'https://example.com/image.jpg',
 *   title: 'Описание изображения'
 * });
 * ```
 */
export const createMediaHtml = (params: InsertMedia): string => {
  const { type, url, title = '', attributes = {} } = params

  // Собираем строку атрибутов
  const attributesStr = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  switch (type) {
    case 'image':
      return `<img src="${url}" alt="${title}" ${attributesStr} />`
    case 'video':
      return `<video src="${url}" controls title="${title}" ${attributesStr}></video>`
    case 'audio':
      return `<audio src="${url}" controls title="${title}" ${attributesStr}></audio>`
    default:
      return ''
  }
}

/**
 * Варианты типов меню для позиционирования
 */
export type MenuType = 'toolbar' | 'float' | 'plus' | 'form'

/**
 * Варианты расположения меню
 */
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

/**
 * Параметры позиционирования меню
 */
export interface PositionOptions {
  /** Тип меню для позиционирования */
  type: MenuType
  /** Предпочтительное расположение меню */
  placement?: Placement
  /** Отступ от элемента в пикселях */
  offset?: number
  /** Нужно ли центрировать по горизонтали */
  centerHorizontally?: boolean
}

/**
 * Универсальная функция для позиционирования различных меню редактора
 *
 * @param reference Элемент или выделение для позиционирования
 * @param options Параметры позиционирования
 * @returns Позиция с координатами и флагом видимости
 *
 * @example
 * ```ts
 * // Позиционирование тулбара над выделением
 * const position = getEditorPosition(editorRef(), {
 *   type: 'toolbar',
 *   placement: 'top',
 *   offset: 10
 * });
 *
 * // Позиционирование плюс-меню слева от курсора
 * const position = getEditorPosition(editorRef(), {
 *   type: 'plus',
 *   placement: 'left',
 *   offset: 50
 * });
 * ```
 */
export const getEditorPosition = (
  reference: HTMLElement | null,
  options: PositionOptions
): { top: number; left: number; isVisible: boolean } => {
  // Значения по умолчанию
  const { type = 'toolbar', placement = 'bottom', offset = 5, centerHorizontally = false } = options

  // Если нет элемента, возвращаем нулевую позицию и флаг невидимости
  if (!reference) {
    return { top: 0, left: 0, isVisible: false }
  }

  // Получаем размеры и позицию элемента
  const rect = reference.getBoundingClientRect()
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft

  // Проверяем наличие выделения для более точного позиционирования
  const selection = window.getSelection()
  let selectionRect: DOMRect | null = null

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)

    // Проверяем, что выделение внутри элемента
    if (reference.contains(range.commonAncestorContainer)) {
      selectionRect = range.getBoundingClientRect()
    }
  }

  // Базовые координаты, которые будут скорректированы
  let top = rect.top + scrollTop
  let left = rect.left + scrollLeft

  // Корректируем положение в зависимости от типа меню
  switch (type) {
    case 'float': {
      // Для плавающего меню используем позицию выделения, если оно есть
      if (selectionRect) {
        // Позиционируем выше или ниже выделения в зависимости от placement
        if (placement === 'top') {
          top = selectionRect.top + scrollTop - offset
        } else {
          top = selectionRect.bottom + scrollTop + offset
        }

        // Центрируем по горизонтали относительно выделения
        left = selectionRect.left + scrollLeft + selectionRect.width / 2

        // Если нужно центрировать горизонтально и известна ширина меню
        if (centerHorizontally) {
          const MENU_WIDTH = 280 // Примерная ширина меню в пикселях
          left -= MENU_WIDTH / 2
        }
      }
      break
    }
    case 'plus': {
      // Для плюс-меню позиционируем слева от курсора или элемента
      if (selectionRect) {
        // Берем верхнюю координату выделения для вертикального выравнивания
        top = selectionRect.top + scrollTop
        // Смещаем меню влево от курсора/выделения
        left = selectionRect.left + scrollLeft - offset

        // Если высота selectionRect равна 0 (курсор на пустой строке),
        // пробуем получить родительский блок (строку или параграф)
        if (selectionRect.height === 0) {
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const container = range.startContainer

            // Находим родительский блочный элемент
            let parentBlock = container
            while (parentBlock && parentBlock.nodeType === Node.TEXT_NODE) {
              parentBlock = parentBlock.parentNode as Node
            }

            // Если нашли блочный элемент, используем его координаты
            if (parentBlock && reference.contains(parentBlock)) {
              const blockRect = (parentBlock as Element).getBoundingClientRect()
              // Устанавливаем вертикальную позицию по центру блока
              top = blockRect.top + scrollTop + blockRect.height / 2 - 10
            }
          }
        }
      } else {
        // Если нет выделения, позиционируем слева от элемента
        top = rect.top + scrollTop + 30 // Отступ сверху
        left = rect.left + scrollLeft - offset
      }
      break
    }
    case 'form': {
      // Для формы центрируем по элементу
      top = rect.top + scrollTop + rect.height / 2
      left = rect.left + scrollLeft + rect.width / 2

      // Если нужно центрировать горизонтально и известна ширина формы
      if (centerHorizontally) {
        const FORM_WIDTH = 300 // Примерная ширина формы в пикселях
        left -= FORM_WIDTH / 2
      }
      break
    }
    default: {
      // toolbar
      // Для обычного тулбара позиционируем в зависимости от placement
      switch (placement) {
        case 'top': {
          top = rect.top + scrollTop - offset
          break
        }

        case 'left': {
          left = rect.left + scrollLeft - offset
          top = rect.top + scrollTop + rect.height / 2
          break
        }

        case 'right': {
          left = rect.right + scrollLeft + offset
          top = rect.top + scrollTop + rect.height / 2
          break
        }

        case 'center': {
          top = rect.top + scrollTop + rect.height / 2
          left = rect.left + scrollLeft + rect.width / 2
          break
        }

        default: {
          // bottom
          top = rect.bottom + scrollTop + offset
          break
        }
      }
    }
  }

  // Проверка на выход за границы окна будет добавлена в будущем

  return { top, left, isVisible: true }
}

/**
 * Получает все врезки из редактора
 * @param editor Элемент редактора
 * @returns Массив врезок с их идентификаторами и содержимым
 */
export const getAllSquibs = (
  editor: HTMLElement
): Array<{ id: string; content: string; element: HTMLElement }> => {
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
