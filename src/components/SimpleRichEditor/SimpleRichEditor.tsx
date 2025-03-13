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
    // Удаляем все пробелы и переносы строк
    const cleanContent = content.replace(/\s/g, '')
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

    // Get content and update state
    const contentText = editorRef()?.textContent || ''
    const contentHtml = contentText ? editorRef()?.innerHTML || '' : ''
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
    const text = e.clipboardData?.getData('text')
    if (!text) return

    handleContentPaste(text, {
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
      showModal(MODALS.uploadImage)
      return
    }
    if (action === 'video') {
      setInsertPosition(calculateInsertPosition())
      showInsert({ type: 'video', text: getSelectionText() })
      return
    }
    if (action === 'link') {
      setInsertPosition(calculateInsertPosition())
      showInsert({ type: 'link', text: getSelectionText() })
      return
    }
    if (action === 'footnote') {
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

    if (hasActiveFormat) {
      console.log('Removing formatting:', action)
      // Если нет выделения - удаляем форматирование только под курсором
      if (isCollapsed) {
        // Расширяем выделение на текущее форматирование
        const node = range.startContainer
        const parentElement =
          node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement

        if (parentElement) {
          const config = FORMAT_CONFIG[action]
          const formattedElement = parentElement.closest(config.tag)

          if (formattedElement) {
            // Расширяем выделение на весь форматированный элемент
            range.selectNodeContents(formattedElement)
            windowSelection.removeAllRanges()
            windowSelection.addRange(range)
          }
        }
      }

      removeFormatting(action, {
        range,
        text: selectedText,
        isEmpty: isCollapsed,
        position: { top: windowSelection.anchorOffset, left: windowSelection.anchorOffset }
      })

      // После удаления форматирования обновляем активные форматы
      updateActiveFormats()

      // Восстанавливаем выделение если оно было
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
    } else {
      console.log('Applying formatting:', action)
      applyFormatting(action, {
        range,
        text: selectedText,
        isEmpty: isCollapsed,
        position: { top: windowSelection.anchorOffset, left: windowSelection.anchorOffset }
      })

      // Восстанавливаем выделение если оно было
      if (!isCollapsed) {
        windowSelection.removeAllRanges()
        windowSelection.addRange(range)
        // Показываем тулбар при активном выделении
        setToolbar(props.toolbar || 'float')
      }
    }

    // Verify content wasn't lost
    const newContent = editorRef()!.innerHTML
    console.log('Content after formatting:', newContent)

    // Only update if content wasn't lost
    if (newContent.trim()) {
      setContent(newContent)
      props.onChange({
        content: newContent,
        plainText: newContent,
        length: newContent.length,
        isEmpty: newContent.trim().length === 0,
        selection: { text: newContent, isEmpty: newContent.trim().length === 0 }
      })
    } else {
      console.error('Content was lost during formatting, restoring...')
      // Restore the original content if it was lost
      const textNode = document.createTextNode(selectedText)
      range.insertNode(textNode)
      range.selectNode(textNode)
    }

    // Keep focus in editor
    editorRef()?.focus()
  }

  /**
   * Заменяет текущее выделение HTML контентом
   * @param html HTML строка для вставки
   * @returns true если замена успешна
   */
  const replaceSelection = (html: string): boolean => {
    if (isServer) return false
    if (!restoreSelection()) return false

    const windowSelection = window.getSelection()
    if (!windowSelection || !windowSelection.rangeCount) return false

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
                const linkText = getSelectionText() || url
                replaceSelection(
                  `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
                )
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
                replaceSelection(createVideoEmbed(url, detectVideoPlatform(url)))
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
