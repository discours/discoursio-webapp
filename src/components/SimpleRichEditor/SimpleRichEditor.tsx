import { clsx } from 'clsx'
import { Component, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'

import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { InlineForm } from '~/components/_shared/InlineForm'
import { Modal } from '~/components/_shared/Modal'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { MODALS } from '~/context/ui'
import { UploadedFile } from '~/types/upload'
import { CommandGroupType, CommandType, MENU_GROUPS } from './lib/commands'
import { useDropFiles } from './lib/drop'
import { createVideoEmbed, detectVideoPlatform, handleContentPaste } from './lib/embed'
import { insertFootnote } from './lib/footnotes'
import { FORMAT_CONFIG, applyFormatting, hasFormatting, removeFormatting } from './lib/format'
import { useSelection } from './lib/selection'
import { Position } from './lib/types'
import { SimpleToolbar } from './menu/SimpleToolbar'

import styles from './SimpleRichEditor.module.scss'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]

const WEB_URL_REGEX = /^(https|http)?:\/\//
const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.)?vimeo\.com\/([0-9]+)/
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/

export interface EditorData {
  content: string // HTML контент
  plainText: string // Чистый текст
  length: number // Длина текста
  isEmpty: boolean // Пустой ли редактор
  selection?: {
    // Информация о выделении
    text: string
    isEmpty: boolean
    position?: Position
  }
}

export interface SimpleRichEditorProps {
  commands?: CommandType[] | CommandGroupType[]
  plus?: boolean
  squib?: boolean
  editorId?: string
  commentId?: number | string
  content?: string
  readOnly?: boolean
  limit?: number
  placeholder?: string
  autofocus?: boolean
  onBlur?: () => void
  onChange: (data: EditorData) => void
  collaborative?: boolean
  fieldId?: string
  onCollabCursorUpdate?: (position: Position) => void
  toolbar?: 'top' | 'bottom' | 'float' | 'hidden'
}

// Типы для структуры меню
export type MenuGroupId = keyof typeof MENU_GROUPS
export type MenuItemType = 'button' | 'dropdown'
export type MenuGroup = {
  id: MenuGroupId
  type: MenuItemType
  icon?: string // для dropdown кнопок
  commands?: EditorCommandId[][]
}

// Add new types
interface EditorState {
  content: string
  selection?: Selection
  cursorPosition?: Position
}

export const CURSOR_UPDATE_PERIOD = 1000

/**
 * Универсальный rich text редактор с различными режимами отображения
 *
 * Возможности:
 * - Базовое форматирование текста (bold, italic, ссылки)
 * - Блочные элементы (цитаты, заголовки)
 * - Вставка медиа (изображения, видео)
 * - Автосохранение
 * - Счетчик символов
 * - Обработка вставки
 * - Горячие клавиши
 * - Различные режимы меню:
 *   - Фиксированный тулбар (top|bottom)
 *   - Всплывающее меню при выделении (float)
 *   - Плавающее меню с "+" (plus=true)
 *
 * @param props.bubble - Режим отображения тулбара:
 *   - false (по умолчанию): показывает фиксированный тулбар над редактором
 *   - true: показывает всплывающий тулбар только при выделении текста
 * @param props.commands - Список доступных команд форматирования
 * @param props.content - Начальное содержимое редактора
 * @param props.placeholder - Текст-подсказка
 * @param props.onSubmit - Колбэк при отправке формы
 * @param props.onCancel - Колбэк при отмене
 * @param props.onChange - Колбэк при изменении содержимого
 *
 * @example
 * ```tsx
 * // Редактор с фиксированным тулбаром
 * <SimpleRichEditor
 *   commands={['bold', 'italic', 'link']}
 *   toolbar="top"
 * />
 *
 * // Редактор с всплывающим тулбаром
 * <SimpleRichEditor
 *   commands={['bold', 'italic', 'link']}
 *   toolbar="float" // default
 * />
 *
 * // Полный редактор со всеми меню
 * <SimpleRichEditor
 *   commands={['bold', 'italic', 'link', 'blockquote', 'image']}
 *   plus={true}
 * />
 * ```
 */

export const SimpleRichEditor: Component<SimpleRichEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showModal, hideModal } = useUI()
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>()
  // Инициализируем тулбар как скрытый для пустого редактора
  const [toolbar, setToolbar] = createSignal<SimpleRichEditorProps['toolbar']>('hidden')
  const [showSquibEditor, setShowSquibEditor] = createSignal(false)
  const [showFootnoteEditor, setShowFootnoteEditor] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)
  let blurTimer: number

  // Вспомогательная функция для безопасного получения текста выделения
  const getSelectionText = () => {
    const currentSelection = selection()
    return currentSelection ? currentSelection.text : ''
  }

  // New collaborative state management
  const [editorState, setEditorState] = createSignal<EditorState>({
    content: props.content || '',
    cursorPosition: undefined
  })

  // Debounced state updates
  const debouncedStateUpdate = debounce(1000, (state: EditorState) => {
    if (state.cursorPosition) {
      props.onCollabCursorUpdate?.(state.cursorPosition)
    }
  })

  // Флаг для отслеживания источника изменений
  const [isInternalChange, setIsInternalChange] = createSignal(false)

  // Базовое состояние
  const [content, setContent] = createSignal(props.content || '')
  const [selection, setSelection] = createSignal({ text: '', isEmpty: true })
  const [cursorPosition, setCursorPosition] = createSignal<Position | null>(null)
  const { updateActiveFormats, activeFormats, isSelectionInEditor, saveSelection, restoreSelection } =
    useSelection(editorRef)
  const { handleDropFiles } = useDropFiles()

  /**
   * Проверяет, является ли контент действительно пустым (включая пустые теги)
   */
  const isEmptyContent = (content: string | null | undefined): boolean => {
    if (!content) return true

    // Убедимся что content это строка
    const contentStr = String(content)

    // Удаляем все пробелы и переносы строк
    const cleanContent = contentStr.replace(/\s/g, '')

    // Проверяем на пустые параграфы и другие пустые HTML теги
    const div = document.createElement('div')
    div.innerHTML = cleanContent
    return div.textContent?.trim().length === 0
  }

  // Эффект для обновления содержимого при изменении props.content
  // Отслеживаем ТОЛЬКО изменения props.content, НЕ отслеживаем content()
  createEffect(
    on(
      () => props.content,
      (newContent) => {
        const safeNewContent = newContent || ''
        const currentContent = content()

        console.log('SimpleRichEditor: content prop changed', {
          newContent: safeNewContent,
          currentContent,
          editorMounted: !!editorRef(),
          isInternalChange: isInternalChange(),
          isEmpty: isEmptyContent(safeNewContent)
        })

        // Если контент пустой - очищаем редактор
        if (isEmptyContent(safeNewContent)) {
          setContent('')
          if (editorRef()) {
            editorRef()!.innerHTML = ''
          }
          return
        }

        // Обновляем только если содержимое изменилось, редактор смонтирован
        // и изменение пришло извне (не от пользовательского ввода)
        if (safeNewContent !== currentContent && editorRef() && !isInternalChange()) {
          setContent(safeNewContent)
          editorRef()!.innerHTML = safeNewContent
        }

        // Сбрасываем флаг внутреннего изменения
        setIsInternalChange(false)
      }
    )
  )

  const [squibContent, setSquibContent] = createSignal('')
  const [footnoteContent, setFootnoteContent] = createSignal('')

  createEffect(
    on(squibContent, (s?: string) => {
      if (!s) return
      console.log('squibContent', s)
      props.onChange({
        content: s,
        plainText: s,
        length: s.length,
        isEmpty: s.trim().length === 0,
        selection: { text: s, isEmpty: s.trim().length === 0 }
      })
    })
  )

  createEffect(
    on(footnoteContent, (s?: string) => {
      if (!s) return
      console.log('footnoteContent', s)
      props.onChange({
        content: s,
        plainText: s,
        length: s.length,
        isEmpty: s.trim().length === 0,
        selection: { text: s, isEmpty: s.trim().length === 0 }
      })
    })
  )

  // Реактивное отслеживание выделения и позиции курсора
  const trackSelectionAndCursor = () => {
    if (isServer) return
    const windowSelection = window.getSelection()
    if (!windowSelection || !editorRef()) return

    // Обновляем данные о выделении
    const selectionData = {
      text: windowSelection.toString(),
      isEmpty: windowSelection.isCollapsed
    }
    setSelection(selectionData)

    // Обновляем активные форматы
    updateActiveFormats()

    // Обновляем позицию курсора, если выделение внутри редактора
    if (isSelectionInEditor() && windowSelection.rangeCount > 0) {
      const range = windowSelection.getRangeAt(0)
      const editorRect = editorRef()!.getBoundingClientRect()
      const rect = range.getBoundingClientRect()

      const position = {
        top: rect.top - editorRect.top,
        left: rect.left - editorRect.left + rect.width / 2
      }
      setCursorPosition(position)

      // Управляем видимостью тулбара
      if (props.toolbar === 'float') {
        if (windowSelection.isCollapsed) {
          setToolbar('hidden')
        } else {
          setToolbar('float')
        }
      }
    }
  }

  // Применяем эффект отслеживания выделения
  createEffect(() => {
    // Запускаем функцию, когда редактор уже смонтирован
    if (editorRef()) {
      // Создаем MutationObserver для отслеживания изменений в DOM
      const observer = new MutationObserver(() => {
        trackSelectionAndCursor()
      })

      // Конфигурация: наблюдаем за изменениями содержимого и дочерних элементов
      observer.observe(editorRef()!, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false
      })

      // Очистка при размонтировании
      onCleanup(() => observer.disconnect())
    }
  })

  // Эффект для отслеживания активных форматов в зависимости от выделения
  createEffect(() => {
    const selectionInfo = selection()
    if (!selectionInfo.isEmpty && isSelectionInEditor()) {
      // Обновляем активные форматы при изменении выделения
      updateActiveFormats()
      // Показываем тулбар только при выделении
      setToolbar(props.toolbar || 'float')
    } else if (selectionInfo.isEmpty && props.toolbar === 'float') {
      // Скрываем тулбар если нет выделения и режим float
      setToolbar('hidden')
    }
  })

  // Handle selection changes and content updates
  const handleChange = (_ev?: Event) => {
    trackSelectionAndCursor()

    // Get content and normalize HTML
    let contentHtml = editorRef()?.innerHTML || ''

    // Нормализация HTML - замена устаревших тегов на семантические
    if (contentHtml) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = contentHtml
      let hasChanges = false

      // Замена <i> на <em>
      const iTags = tempDiv.querySelectorAll('i')
      if (iTags.length > 0) {
        iTags.forEach((tag) => {
          const em = document.createElement('em')
          // Копируем все дочерние элементы
          while (tag.firstChild) {
            em.appendChild(tag.firstChild)
          }
          // Копируем атрибуты
          Array.from(tag.attributes).forEach((attr) => {
            em.setAttribute(attr.name, attr.value)
          })
          // Заменяем тег
          tag.parentNode?.replaceChild(em, tag)
        })
        hasChanges = true
        console.log(`Нормализация HTML: заменено ${iTags.length} тегов <i> на <em>`)
      }

      // Замена <b> на <strong>
      const bTags = tempDiv.querySelectorAll('b')
      if (bTags.length > 0) {
        bTags.forEach((tag) => {
          const strong = document.createElement('strong')
          // Копируем все дочерние элементы
          while (tag.firstChild) {
            strong.appendChild(tag.firstChild)
          }
          // Копируем атрибуты
          Array.from(tag.attributes).forEach((attr) => {
            strong.setAttribute(attr.name, attr.value)
          })
          // Заменяем тег
          tag.parentNode?.replaceChild(strong, tag)
        })
        hasChanges = true
        console.log(`Нормализация HTML: заменено ${bTags.length} тегов <b> на <strong>`)
      }

      // Удаление пустых тегов форматирования
      const emptyTags = tempDiv.querySelectorAll('em:empty, strong:empty, i:empty, b:empty')
      if (emptyTags.length > 0) {
        emptyTags.forEach((tag) => {
          if (!tag.textContent || tag.textContent === '\u200B') {
            tag.remove()
          }
        })
        hasChanges = true
        console.log(`Удалено ${emptyTags.length} пустых тегов форматирования`)
      }

      // Если были изменения, обновляем контент
      if (hasChanges) {
        contentHtml = tempDiv.innerHTML
        if (editorRef()) {
          editorRef()!.innerHTML = contentHtml
        }
      }
    }

    const contentText = editorRef()?.textContent || ''
    setContent(contentHtml)

    // Prepare editor data
    const editorData: EditorData = {
      content: contentHtml,
      plainText: contentText,
      length: contentText.length,
      isEmpty: contentText.trim().length === 0,
      selection: {
        ...selection(),
        position: cursorPosition() || undefined
      }
    }

    // Update collaborative state if needed
    if (props.collaborative && cursorPosition()) {
      const newState = {
        ...editorState(),
        content: contentHtml,
        cursorPosition: cursorPosition() || undefined
      }
      setEditorState(newState)
      debouncedStateUpdate(newState)
    }

    // Notify parent with complete data
    props.onChange(editorData)
  }

  // Handle input changes
  const handleInput = () => {
    if (!editorRef()) return

    // Устанавливаем флаг внутреннего изменения
    setIsInternalChange(true)

    const html = editorRef()!.innerHTML || ''
    setContent(html)

    // Обновляем состояние выделения
    updateActiveFormats()

    // Отправляем данные родителю
    const plainText = editorRef()!.innerText || ''
    const isEmpty = plainText.trim().length === 0

    props.onChange({
      content: html,
      plainText,
      length: plainText.length,
      isEmpty,
      selection: selection()
    })

    // Обновляем состояние для совместного редактирования
    if (props.collaborative) {
      debouncedStateUpdate({
        content: html
      })
    }
  }

  // Menu modes
  // micro: bold, italic, link
  // mini: bold, italic, link, blockquote, image
  // full:
  //  - blocks: [[h1, h2, h3], [blockuote, punchline, incut]],
  //  - text: bold, italic, highlight
  //  - links: link, footnote
  //  - lists: image, video, file

  // Focus and blur
  const handleFocus = () => {
    clearTimeout(blurTimer)
    setHasFocus(true)

    // Show fixed toolbar immediately on focus if not in float mode
    if (props.toolbar && props.toolbar !== 'float') {
      setToolbar(props.toolbar)
    }
  }

  const handleBlur = (e: FocusEvent) => {
    if (!editorRef()?.contains(e.relatedTarget as Node)) {
      blurTimer = window.setTimeout(() => {
        setHasFocus(false)
        setToolbar('hidden')
        props.onBlur?.()
      }, 200)
    }
  }

  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault()

    // Попробуем получить HTML из буфера обмена для более точной обработки форматирования
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text')

    if (!text && !html) return

    // Если есть HTML, нормализуем его перед вставкой
    if (html) {
      console.log('Вставка HTML из буфера обмена')

      // Нормализуем HTML перед вставкой
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html

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

      // Удаление пустых тегов форматирования
      const emptyTags = tempDiv.querySelectorAll('em:empty, strong:empty, i:empty, b:empty, span:empty')
      emptyTags.forEach((tag) => {
        if (!tag.textContent || tag.textContent === '\u200B') {
          tag.remove()
        }
      })

      // Вставляем нормализованный HTML
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()

        const fragment = document.createDocumentFragment()
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild)
        }

        range.insertNode(fragment)
        range.collapse(false)

        // Обновляем состояние редактора
        handleChange()
        return
      }
    }

    // Если нет HTML или не удалось вставить, используем обычный текст
    handleContentPaste(text || '', {
      insertText: (text) => {
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        const textNode = document.createTextNode(text)
        range.deleteContents()
        range.insertNode(textNode)
        range.collapse(false)
      },
      insertHtml: (html) => {
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        const temp = document.createElement('div')
        temp.innerHTML = html

        const fragment = document.createDocumentFragment()
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild)
        }

        range.deleteContents()
        range.insertNode(fragment)
        range.collapse(false)
      }
    })

    // Обновляем состояние редактора
    handleChange()
  }

  // Состояния для редактирования форматированных элементов
  const [editingLink, setEditingLink] = createSignal<HTMLElement | null>(null)
  const [editingImage, setEditingImage] = createSignal<HTMLElement | null>(null)
  const [editingFootnote, setEditingFootnote] = createSignal<HTMLElement | null>(null)
  const [editElementPosition, setEditElementPosition] = createSignal<
    { top: number; left: number } | undefined
  >()

  // Функция для обработки клика по элементам в редакторе
  const handleContentClick = (e: MouseEvent) => {
    if (isServer || !editorRef() || props.readOnly) return

    const target = e.target as HTMLElement

    // Сбрасываем все состояния редактирования
    setEditingLink(null)
    setEditingImage(null)
    setEditingFootnote(null)

    // Проверяем, кликнули ли по ссылке
    if (target.tagName === 'A' || target.closest('a')) {
      const link = target.tagName === 'A' ? target : target.closest('a')
      if (link) {
        e.preventDefault() // Предотвращаем переход по ссылке

        // Сохраняем ссылку для редактирования
        setEditingLink(link as HTMLElement)

        // Вычисляем позицию для показа формы редактирования
        const rect = link.getBoundingClientRect()
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft

        setEditElementPosition({
          top: rect.bottom + scrollTop + -25, // Показываем над элементом
          left: rect.left + scrollLeft
        })
      }
      return
    }

    // Проверяем, кликнули ли по изображению
    if (target.tagName === 'IMG' || target.closest('img')) {
      const img = target.tagName === 'IMG' ? target : target.closest('img')
      if (img) {
        e.preventDefault()

        // Сохраняем изображение для редактирования
        setEditingImage(img as HTMLElement)

        // Для изображений мы покажем модальное окно uploadImage
        // поэтому позицию не запоминаем
        showModal(MODALS.uploadImage)
      }
      return
    }

    // Проверяем, кликнули ли по сноске (предполагаем, что сноски имеют data-footnote атрибут)
    if (target.hasAttribute('data-footnote') || target.closest('[data-footnote]')) {
      const footnote = target.hasAttribute('data-footnote') ? target : target.closest('[data-footnote]')
      if (footnote) {
        e.preventDefault()

        // Сохраняем сноску для редактирования
        setEditingFootnote(footnote as HTMLElement)

        // Вычисляем позицию для показа формы редактирования
        const rect = footnote.getBoundingClientRect()
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft

        setEditElementPosition({
          top: rect.bottom + scrollTop + 5,
          left: rect.left + scrollLeft
        })

        // Для сноски мы показываем специальный редактор
        setShowFootnoteEditor(true)
      }
    }
  }

  // Обновляем onMount, чтобы добавить обработчик кликов
  onMount(() => {
    if (!editorRef()) return

    if (props.placeholder) {
      editorRef()!.setAttribute('data-placeholder', props.placeholder)
    }

    // Инициализируем содержимое при монтировании
    if (props.content && editorRef()) {
      editorRef()!.innerHTML = props.content
      setContent(props.content)
    }

    if (props.autofocus) {
      editorRef()!.focus()
    }

    // Добавляем обработчик кликов по элементам внутри редактора
    editorRef()!.addEventListener('click', handleContentClick)

    // Инициализируем слушатели событий
    document.addEventListener('selectionchange', handleChange)
    document.addEventListener('mouseup', trackSelectionAndCursor)
    document.addEventListener('keyup', trackSelectionAndCursor)

    // Начальное отслеживание
    trackSelectionAndCursor()
  })

  // Обновляем onCleanup, чтобы удалить наш обработчик
  onCleanup(() => {
    if (editorRef()) {
      editorRef()!.removeEventListener('click', handleContentClick)
    }
    clearTimeout(blurTimer)
    document.removeEventListener('selectionchange', handleChange)
    document.removeEventListener('mouseup', trackSelectionAndCursor)
    document.removeEventListener('keyup', trackSelectionAndCursor)
    debouncedStateUpdate.cancel()
  })

  const [showingInsert, showInsert] = createSignal<{ type: string; text: string } | undefined>()
  const [insertPosition, setInsertPosition] = createSignal<{ top: number; left: number } | undefined>()

  // Функция для вычисления позиции относительно кнопки или выделения
  const calculateInsertPosition = () => {
    // Пытаемся найти активный элемент в тулбаре (кнопку, которая была нажата)
    const activeButton = document.querySelector('.SimpleRichEditor_active__control')
    if (activeButton) {
      const rect = activeButton.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft
      return {
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft
      }
    }

    // Если кнопка не найдена, используем позицию курсора
    const windowSelection = window.getSelection()
    if (windowSelection?.rangeCount) {
      const range = windowSelection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft
      return {
        top: rect.bottom + scrollTop + 5, // Немного ниже курсора
        left: rect.left + scrollLeft
      }
    }

    // Если ничего не найдено, позиционируем по центру редактора
    if (editorRef()) {
      const rect = editorRef()!.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft
      return {
        top: rect.top + scrollTop + 50,
        left: rect.left + scrollLeft + rect.width / 2 - 140 // приблизительно половина ширины InlineForm
      }
    }

    return undefined
  }

  // Функция для валидации URL
  const validateUrl = (url: string): string => {
    if (!url) {
      return t('URL cannot be empty')
    }

    try {
      // Проверяем, что URL начинается с http:// или https://
      if (!url.match(WEB_URL_REGEX)) {
        return t('URL must start with http:// or https://')
      }

      // Пробуем создать объект URL для проверки валидности
      new URL(url)
      return ''
    } catch (_e) {
      return t('Invalid URL format')
    }
  }

  // Функция для валидации ссылок на видео
  const validateVideoUrl = (url: string): string => {
    const urlError = validateUrl(url)
    if (urlError) return urlError

    // Проверяем, что это ссылка на YouTube или Vimeo
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
    const isVimeo = url.includes('vimeo.com')

    if (!isYouTube && !isVimeo) {
      return t('Only YouTube and Vimeo links are supported')
    }

    return ''
  }

  const handleAction = (action: CommandType) => {
    if (isServer) return
    if (action === 'image') {
      // Сохраняем выделение перед открытием модального окна
      saveSelection()
      showModal(MODALS.uploadImage)
      return
    }
    if (action === 'video') {
      // Сохраняем выделение перед открытием формы
      saveSelection()

      // Добавляем класс выделения для визуальной индикации
      const windowSelection = window.getSelection()
      if (windowSelection && windowSelection.rangeCount > 0) {
        // Вместо удаления выделения, добавляем временную CSS-подсветку
        const range = windowSelection.getRangeAt(0)
        const span = document.createElement('span')
        span.className = styles.tempHighlight
        span.dataset.tempHighlight = 'true'

        try {
          // Оборачиваем выделение во временный span для визуального выделения
          const clone = range.cloneRange()
          clone.surroundContents(span)
          windowSelection.removeAllRanges()
          windowSelection.addRange(clone)
        } catch (e) {
          console.warn('Не удалось визуально выделить текст', e)
        }
      }

      setInsertPosition(calculateInsertPosition())
      // Не передаем выделенный текст в форму
      showInsert({ type: 'video', text: '' })
      return
    }
    if (action === 'link') {
      // Сохраняем выделение перед открытием формы
      saveSelection()

      // Добавляем класс выделения к редактору для визуальной индикации
      const windowSelection = window.getSelection()
      if (windowSelection && windowSelection.rangeCount > 0) {
        // Вместо удаления выделения, добавляем временную CSS-подсветку
        const range = windowSelection.getRangeAt(0)
        const span = document.createElement('span')
        span.className = styles.tempHighlight
        span.dataset.tempHighlight = 'true'

        try {
          // Оборачиваем выделение во временный span для визуального выделения
          const clone = range.cloneRange()
          clone.surroundContents(span)
          windowSelection.removeAllRanges()
          windowSelection.addRange(clone)
        } catch (e) {
          console.warn('Не удалось визуально выделить текст', e)
        }
      }

      setInsertPosition(calculateInsertPosition())
      // Не передаем выделенный текст в форму
      showInsert({ type: 'link', text: '' })
      return
    }
    if (action === 'footnote') {
      // Сохраняем выделение перед открытием формы
      saveSelection()
      setShowFootnoteEditor(true)
      return
    }
    console.log('Editor handling action:', action)

    const windowSelection = window.getSelection()
    if (!windowSelection || !windowSelection.rangeCount) {
      console.log('No selection found')
      return
    }

    // Сохраняем текущее выделение
    const range = windowSelection.getRangeAt(0).cloneRange()
    const selectedText = windowSelection.toString()
    const isCollapsed = windowSelection.isCollapsed

    // Проверяем наличие форматирования
    const hasActiveFormat = hasFormatting(action, windowSelection)
    console.log('Format state:', { action, hasActiveFormat, isCollapsed })

    // Очищаем выделение перед применением операции, чтобы избежать побочных эффектов
    const originalContent = editorRef()?.innerHTML || ''

    try {
      if (hasActiveFormat) {
        console.log('Removing formatting:', action)
        removeFormatting(action, {
          range,
          text: selectedText,
          isEmpty: isCollapsed,
          position: { top: windowSelection.anchorOffset, left: windowSelection.anchorOffset }
        })
      } else {
        console.log('Applying formatting:', action)
        applyFormatting(action, {
          range,
          text: selectedText,
          isEmpty: isCollapsed,
          position: { top: windowSelection.anchorOffset, left: windowSelection.anchorOffset }
        })
      }

      // Verify content wasn't lost or corrupted
      const newContent = editorRef()!.innerHTML
      console.log('Content after formatting:', newContent)

      // Проверяем на наличие пустых или некорректных тегов
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = newContent

      // Ищем пустые теги форматирования и удаляем их
      const emptyTags = tempDiv.querySelectorAll(`${FORMAT_CONFIG[action].tag}:empty`)
      emptyTags.forEach((tag) => {
        if (!tag.textContent || tag.textContent === '\u200B') {
          tag.remove()
        }
      })

      // Проверяем, были ли удалены пустые теги
      if (emptyTags.length > 0) {
        console.log(`Removed ${emptyTags.length} empty ${FORMAT_CONFIG[action].tag} tags`)
        editorRef()!.innerHTML = tempDiv.innerHTML
      }

      // После удаления форматирования обновляем активные форматы
      updateActiveFormats()

      // Восстанавливаем выделение если возможно
      if (!isCollapsed) {
        windowSelection.removeAllRanges()
        windowSelection.addRange(range)
      }

      // Проверяем остались ли активные форматы
      const hasOtherActiveFormats = ['bold', 'italic', 'link', 'highlight'].some((format) =>
        hasFormatting(format as CommandType, windowSelection)
      )

      // Управляем видимостью тулбара
      if (isCollapsed && !hasOtherActiveFormats && props.toolbar === 'float') {
        setToolbar('hidden')
      } else if (!isCollapsed) {
        setToolbar(props.toolbar || 'float')
      }
    } catch (error) {
      console.error('Error applying/removing formatting:', error)
      // В случае ошибки восстанавливаем исходное содержимое
      if (editorRef()) {
        editorRef()!.innerHTML = originalContent
      }
    }

    // Trigger change event
    handleChange()
  }

  /**
   * Заменяет текущее выделение HTML контентом
   * @param html HTML строка для вставки
   * @returns true если замена успешна
   */
  const replaceSelection = (html: string): boolean => {
    if (isServer) return false

    // Получаем текущее выделение в любом случае
    const windowSelection = window.getSelection()
    if (!windowSelection) return false

    // Если нет выделения или не удалось восстановить, создаем новое в конце редактора
    if (!windowSelection.rangeCount && editorRef()) {
      console.log('Создаем новое выделение в конце редактора')
      const range = document.createRange()

      // Если есть текст в редакторе, ставим курсор в конец
      if (editorRef()!.lastChild) {
        range.selectNodeContents(editorRef()!)
        range.collapse(false)
      } else {
        // Иначе выбираем весь редактор
        range.selectNodeContents(editorRef()!)
      }

      windowSelection.removeAllRanges()
      windowSelection.addRange(range)
    }

    // Теперь должно быть доступно выделение
    if (!windowSelection.rangeCount) {
      console.error('Не удалось создать выделение в редакторе')
      return false
    }

    const range = windowSelection.getRangeAt(0)

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
    windowSelection.removeAllRanges()
    windowSelection.addRange(range)

    // Обновляем состояние редактора
    handleChange()

    // Обновляем состояние активных форматов
    updateActiveFormats()

    return true
  }

  const handleSquibSubmit = (content: string) => {
    saveSelection()
    replaceSelection(content)
    setShowSquibEditor(false)
    restoreSelection()
  }

  const handleFootnoteSubmit = (content: string) => {
    // Если редактируем существующую сноску
    if (editingFootnote()) {
      const footnoteElement = editingFootnote()
      if (footnoteElement) {
        // Обновляем содержимое сноски
        const footnoteId = footnoteElement.getAttribute('data-footnote-id')
        if (footnoteId) {
          // Находим тело сноски по ID и обновляем его
          const footnoteContent = editorRef()?.querySelector(`[data-footnote-content="${footnoteId}"]`)
          if (footnoteContent) {
            footnoteContent.innerHTML = content

            // Сбрасываем состояние
            setEditingFootnote(null)
            setShowFootnoteEditor(false)

            // Обновляем состояние редактора
            handleChange()
          }
        }
      }
    } else {
      // Стандартная логика для создания новой сноски
      const editor = editorRef()
      if (!editor) return

      saveSelection()
      const windowSelection = window.getSelection()
      insertFootnote(editor, content, windowSelection as Selection)
      setShowFootnoteEditor(false)
      restoreSelection()
    }
  }

  // Обработчик вставки изображения после загрузки
  const handleImageUpload = (uploadedFile?: UploadedFile) => {
    if (!uploadedFile) return

    // Генерируем HTML для вставки изображения
    const imgHtml = `<img src="${uploadedFile.url}" alt="${uploadedFile.originalFilename || 'Uploaded image'}" />`

    // Вставляем в редактор
    replaceSelection(imgHtml)

    // Закрываем модальное окно
    hideModal()

    // Возвращаем фокус в редактор
    editorRef()?.focus()
  }

  // Функция для обновления ссылки
  const handleUpdateLink = (url: string) => {
    const linkElement = editingLink()
    if (!linkElement) return

    linkElement.setAttribute('href', url)

    // Сбрасываем состояние
    setEditingLink(null)

    // Обновляем состояние редактора
    if (editorRef()) {
      handleChange()
    }
  }

  // Функция для обновления атрибутов изображения после загрузки нового
  const handleUpdateImage = (uploadedFile?: UploadedFile) => {
    if (!uploadedFile) return

    const imgElement = editingImage()
    if (imgElement) {
      // Если мы редактируем существующее изображение, обновляем его атрибуты
      ;(imgElement as HTMLImageElement).src = uploadedFile.url
      ;(imgElement as HTMLImageElement).alt = uploadedFile.originalFilename || 'Uploaded image'

      // Сбрасываем состояние
      setEditingImage(null)

      // Обновляем состояние редактора
      if (editorRef()) {
        handleChange()
      }
    } else {
      // Если просто загружаем новое изображение
      handleImageUpload(uploadedFile)
    }

    // Закрываем модальное окно
    hideModal()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Если нажат Shift+Enter, позволяем стандартное поведение
    if (e.shiftKey && e.key === 'Enter') {
      return
    }

    // Если нажат просто Enter
    if (e.key === 'Enter') {
      e.preventDefault()

      const selection = window.getSelection()
      if (!selection) return

      const range = selection.getRangeAt(0)
      const container = range.startContainer
      const blockElement =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement?.closest('blockquote, h1, h2, h3, div[data-type]')
          : (container as Element).closest('blockquote, h1, h2, h3, div[data-type]')

      if (blockElement) {
        // Если курсор в конце блока
        if (
          range.startOffset ===
          (container.nodeType === Node.TEXT_NODE
            ? container.textContent?.length
            : container.childNodes.length)
        ) {
          // Создаем новый параграф после блока
          const p = document.createElement('p')
          p.innerHTML = '<br>'
          blockElement.parentNode?.insertBefore(p, blockElement.nextSibling)

          // Перемещаем курсор в новый параграф
          range.selectNodeContents(p)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          // Разделяем блок в точке курсора
          const newRange = range.cloneRange()
          newRange.setEndAfter(blockElement)
          const extractedContent = newRange.extractContents()

          // Создаем новый параграф с оставшимся содержимым
          const p = document.createElement('p')
          p.appendChild(extractedContent)
          blockElement.parentNode?.insertBefore(p, blockElement.nextSibling)

          // Перемещаем курсор в начало нового параграфа
          range.selectNodeContents(p)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      } else {
        // Стандартное поведение - вставка <br>
        document.execCommand('insertLineBreak')
      }

      handleChange()
    }
  }

  return (
    <div class={styles.editorWrapper}>
      {/* Редактируемая область только для контента */}
      <div
        class={clsx(styles.editor, {
          [styles.focused]: hasFocus()
        })}
      >
        <div
          ref={setEditorRef}
          class={styles.content}
          contentEditable={!props.readOnly}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onInput={handleInput}
          onSelect={handleChange}
          onPaste={handlePaste}
          onDrop={handleDropFiles}
          onKeyDown={handleKeyDown}
          data-placeholder={props.placeholder}
        />
      </div>

      {/* Панель управления как оверлей */}
      <div
        class={clsx(styles.toolbarContainer, {
          [styles.toolbarTop]: props.toolbar === 'top',
          [styles.toolbarBottom]: props.toolbar === 'bottom',
          [styles.toolbarFloat]: !props.toolbar || props.toolbar === 'float',
          [styles.visible]: toolbar() && toolbar() !== 'hidden'
        })}
      >
        <SimpleToolbar
          commands={props.commands || []}
          onAction={(action: CommandType | CommandGroupType) => handleAction(action as CommandType)}
          currentFormats={activeFormats()}
          isVisible={toolbar() !== 'hidden'}
        />
      </div>

      <Portal>
        <Show when={showingInsert()?.type === 'link'}>
          <div
            class={styles.inlineFormWrapper}
            style={
              insertPosition()
                ? `position: absolute; top: ${insertPosition()?.top}px; left: ${insertPosition()?.left}px; z-index: 100;`
                : ''
            }
          >
            <InlineForm
              placeholder={t('Enter link...')}
              initialValue={showingInsert()?.text || ''}
              showInput={true}
              validate={validateUrl}
              onSubmit={(url) => {
                // Сохраняем текст выделения до восстановления
                // Находим временно выделенный элемент
                const highlightElement = editorRef()?.querySelector('[data-temp-highlight="true"]')
                const originalSelectionText = highlightElement?.textContent || ''
                let _useFallbackText = false

                // Удаляем временное выделение
                const parentBeforeRestore = highlightElement?.parentNode

                // Если не удалось восстановить выделение, пробуем создать новое
                if (!restoreSelection()) {
                  console.log('Не удалось восстановить выделение, создаем новое')
                  _useFallbackText = true

                  // Если есть элемент с временным выделением, используем его
                  if (highlightElement) {
                    const range = document.createRange()
                    range.selectNodeContents(highlightElement)
                    const selection = window.getSelection()
                    if (selection) {
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  } else {
                    // Фокусируемся на редакторе
                    editorRef()?.focus()

                    // Создаем новое выделение в конце текста
                    const selection = window.getSelection()
                    if (selection && editorRef()) {
                      const range = document.createRange()
                      if (editorRef()!.lastChild) {
                        range.selectNodeContents(editorRef()!)
                        range.collapse(false) // Коллапсируем в конец
                      } else {
                        // Если редактор пустой, просто выбираем его
                        range.selectNodeContents(editorRef()!)
                      }
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  }
                }

                // Определяем текст для ссылки - всегда используем текст, который был выделен
                const linkText = originalSelectionText || url

                // Если есть временное выделение, заменяем его ссылкой напрямую
                if (highlightElement && parentBeforeRestore) {
                  const link = document.createElement('a')
                  link.href = url
                  link.target = '_blank'
                  link.rel = 'noopener noreferrer'
                  link.textContent = originalSelectionText

                  // Заменяем выделение ссылкой
                  parentBeforeRestore.replaceChild(link, highlightElement)

                  // Обновляем состояние редактора
                  handleChange()
                } else {
                  // Стандартный случай - используем replaceSelection
                  replaceSelection(
                    `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
                  )
                }

                showInsert(undefined)
                editorRef()?.focus()
              }}
              onClose={() => showInsert(undefined)}
            />
          </div>
        </Show>
        <Show when={showingInsert()?.type === 'video'}>
          <div
            class={styles.inlineFormWrapper}
            style={
              insertPosition()
                ? `position: absolute; top: ${insertPosition()?.top}px; left: ${insertPosition()?.left}px; z-index: 100;`
                : ''
            }
          >
            <InlineForm
              placeholder={t('Enter YouTube or Vimeo link...')}
              initialValue={showingInsert()?.text || ''}
              showInput={true}
              validate={validateVideoUrl}
              onSubmit={(url) => {
                // Сохраняем текст выделения до восстановления
                // Находим временно выделенный элемент
                const highlightElement = editorRef()?.querySelector('[data-temp-highlight="true"]')
                const originalSelectionText = highlightElement?.textContent || ''
                let _useFallbackText = false

                // Удаляем временное выделение
                const parentBeforeRestore = highlightElement?.parentNode

                // Если не удалось восстановить выделение, пробуем создать новое
                if (!restoreSelection()) {
                  console.log('Не удалось восстановить выделение, создаем новое')
                  _useFallbackText = true

                  // Если есть элемент с временным выделением, используем его
                  if (highlightElement) {
                    const range = document.createRange()
                    range.selectNodeContents(highlightElement)
                    const selection = window.getSelection()
                    if (selection) {
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  } else {
                    // Фокусируемся на редакторе
                    editorRef()?.focus()

                    // Создаем новое выделение в конце текста
                    const selection = window.getSelection()
                    if (selection && editorRef()) {
                      const range = document.createRange()
                      if (editorRef()!.lastChild) {
                        range.selectNodeContents(editorRef()!)
                        range.collapse(false) // Коллапсируем в конец
                      } else {
                        // Если редактор пустой, просто выбираем его
                        range.selectNodeContents(editorRef()!)
                      }
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  }
                }

                // Используем выделенный текст для описания видео, если он есть
                const videoTitle = originalSelectionText || url
                console.log(`Вставка видео: ${videoTitle}`)

                // Получаем платформу и ID видео
                const platform = detectVideoPlatform(url)

                // Извлекаем ID видео из URL
                let videoId = url
                if (platform === 'youtube') {
                  // Пытаемся извлечь ID из YouTube URL
                  const match = url.match(YOUTUBE_URL_REGEX)
                  if (match?.[1]) {
                    videoId = match[1]
                  }
                } else if (platform === 'vimeo') {
                  // Пытаемся извлечь ID из Vimeo URL
                  const match = url.match(VIMEO_URL_REGEX)
                  if (match?.[1]) {
                    videoId = match[1]
                  }
                }

                // Создаем видео-встройку
                const videoEmbed = createVideoEmbed(videoId, platform)

                // Если есть временное выделение, заменяем его видео-встройкой напрямую
                if (highlightElement && parentBeforeRestore) {
                  // Создаем элемент для вставки видео
                  const videoContainer = document.createElement('div')
                  videoContainer.innerHTML = videoEmbed

                  // Заменяем выделение видео-встройкой
                  parentBeforeRestore.replaceChild(videoContainer.firstChild!, highlightElement)

                  // Обновляем состояние редактора
                  handleChange()
                } else {
                  // Стандартный случай - используем replaceSelection
                  replaceSelection(videoEmbed)
                }

                showInsert(undefined)
                editorRef()?.focus()
              }}
              onClose={() => showInsert(undefined)}
            />
          </div>
        </Show>
        <Show when={showSquibEditor()}>
          <SimpleRichEditor
            content={getSelectionText()}
            squib={true}
            placeholder={t('Enter text...')}
            onChange={(content) => setSquibContent(content.content)}
            onBlur={() => handleSquibSubmit(squibContent())}
          />
        </Show>
        <Show when={showFootnoteEditor()}>
          <SimpleRichEditor
            commands={['bold', 'italic', 'highlight', 'link']}
            content={getSelectionText()}
            placeholder={t('Enter text...')}
            onChange={(content) => setFootnoteContent(content.content)}
            onBlur={() => handleFootnoteSubmit(footnoteContent())}
          />
        </Show>

        {/* Добавляем формы для редактирования существующих элементов */}
        <Show when={editingLink()}>
          <div
            class={styles.inlineFormWrapper}
            style={
              editElementPosition()
                ? `position: absolute; top: ${editElementPosition()?.top}px; left: ${editElementPosition()?.left}px; z-index: 100;`
                : ''
            }
          >
            <InlineForm
              placeholder={t('Edit link URL...')}
              initialValue={(editingLink() as HTMLAnchorElement)?.href || ''}
              showInput={true}
              validate={validateUrl}
              onSubmit={handleUpdateLink}
              onClose={() => setEditingLink(null)}
            />
          </div>
        </Show>

        {/* Модальное окно загрузки изображений для всех случаев */}
        <Modal name={MODALS.uploadImage} variant="narrow">
          <UploadModalContent
            onClose={(uploadedFile) =>
              editingImage() ? handleUpdateImage(uploadedFile) : handleImageUpload(uploadedFile)
            }
          />
        </Modal>
      </Portal>
    </div>
  )
}
