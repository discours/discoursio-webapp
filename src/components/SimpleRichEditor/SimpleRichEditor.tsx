import { clsx } from 'clsx'
import { Component, For, createEffect, createRoot, createSignal, on, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { Portal } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
import { AudioUploader } from '~/components/Upload/AudioUploader'
import { InlineForm } from '~/components/_shared/InlineForm/InlineForm'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { MODALS } from '~/context/ui'
import { MediaItem } from '~/graphql/schema/core.gen'
import { UploadedFile } from '~/types/upload'
import { handleEditorAction } from './lib/actions'
import { handleAudioUploaderResult } from './lib/audio'
import { CommandGroupType, CommandType, MENU_GROUPS, MICRO_COMMANDS, isGroup } from './lib/commands'
import { useDropFiles } from './lib/drop'
import { createVideoEmbed, detectVideoPlatform, handleContentPaste } from './lib/embed'
import { isEmptyContent } from './lib/empty'
import { getAllFootnotes, getFootnoteById, insertFootnote, removeFootnote } from './lib/footnotes'
import { getEditorPosition } from './lib/helpers'
import { validateUrl } from './lib/link'
import { useSelection } from './lib/selection'
import { EditorState } from './lib/state'
import {
  ContentVersion,
  cleanupJsonContent,
  clearLocalVersion,
  getServerVersionKey,
  getStorageKey,
  loadLocalVersionContent,
  loadVersions,
  saveContent,
  saveVersionToStorage
} from './lib/storage'
import { Position } from './lib/types'
import { isSelectionInElement, replaceSelection, trackSelectionAndCursor } from './lib/utils'
import { InlineFormOptions, validateVideoUrl, validateWebUrl } from './lib/validation'
import { PlusMenu, handlePlusMenuAction, handleSquibFormatting } from './menu/PlusMenu'
import { SimpleToolbar, ToolbarMode } from './menu/SimpleToolbar'
import { SquibMenu } from './menu/SquibMenu'

import styles from './SimpleRichEditor.module.scss'

// Типы для форм
export type FormType = 'link' | 'video' | 'audio' | null
const noop = () => undefined
const DRAFT_REGEX = /draft-(\d+)-/

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

export type EditorFieldType = 'body' | 'lead' | 'description' | 'about' | 'comment'

export interface SimpleRichEditorProps {
  onChange: (data: EditorData) => void
  toolbar?: ToolbarMode
  content?: string
  commands?: CommandType[]
  plus?: boolean
  placeholder?: string
  autofocus?: boolean
  readOnly?: boolean
  editorId?: string
  fieldType?: EditorFieldType
  collaborative?: boolean
  onInit?: (instance: { editor: HTMLDivElement }) => void
  onCollabCursorUpdate?: (data: Position) => void
  onBlur?: () => void
  onFocus?: () => void
}

export const CURSOR_UPDATE_PERIOD = 1000

// Для хранения опций форм между вызовами
let editorFormOptions: InlineFormOptions | null = null

// Сигналы для работы с ресурсами редактора
const [editingFootnote, setEditingFootnote] = createSignal<HTMLElement | null>(null)
const [footnoteContent, setFootnoteContent] = createSignal<string>('')
// импорт переменных из state вместо signals
import {
  setDocumentFootnotes as setStateDocumentFootnotes,
  documentFootnotes as stateDocumentFootnotes
} from './lib/state'

/**
 * Универсальный rich text редактор с различными режимами отображения
 *
 * Возможности:
 * - Базовое форматирование текста (bold, italic, ссылки)
 * - Блочные элементы (цитаты, заголовки, списки, врезки)
 * - Вставка ссылок и сносок
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
  // Отладочная информация при создании компонента
  console.log('[SimpleRichEditor] Creating editor:', {
    editorId: props.editorId,
    fieldType: props.fieldType,
    toolbar: props.toolbar
  })

  const { t } = useLocalize()
  const { showModal, hideModal } = useUI()
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>()

  // Инициализируем тулбар как скрытый для пустого редактора
  const [toolbar, setToolbar] = createSignal<SimpleRichEditorProps['toolbar']>('hidden')
  const [showSquibEditor, setShowSquibEditor] = createSignal(false)
  const [showFootnoteEditor, setShowFootnoteEditor] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)
  // Добавляем состояния для инлайн-форм
  const [showForm, setShowForm] = createSignal<FormType>(null)
  const [formPosition, setFormPosition] = createSignal<Position | null>(null)
  const [formInitialValue, setFormInitialValue] = createSignal('')
  // Состояние для множественных врезок
  // Удаляем неиспользуемый currentSquibId
  // const [currentSquibId, setCurrentSquibId] = createSignal<string | null>(null)
  const [squibMenuPosition, setSquibMenuPosition] = createSignal<{
    top: number
    left: number
    isVisible?: boolean
  }>({
    top: 50,
    left: 50,
    isVisible: true
  })
  // Используем переменную для хранения таймера
  let blurTimerRef = 0

  // Применяем очистку к входящему контенту
  const initialContent = cleanupJsonContent(props.content)

  // Функция для проверки необходимости показа плюс-меню
  const shouldShowPlusMenu = () => {
    // Показываем плюс-меню если редактор в фокусе и курсор на пустой строке
    // или в начале/конце редактора, при условии что другие меню не открыты
    const isNewLine = isCursorOnEmptyLine()
    const isEditorInFocus = hasFocus()
    const isNoOtherMenuOpen = !showForm() && !showSquibEditor()
    const isPlusEnabled = props.plus

    // Важно: показываем и на пустых строках, и на строках с содержимым
    // когда курсор находится в позиции для добавления нового содержимого
    return isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
  }

  // Дополнительная функция для проверки пустого содержимого
  const isEditorEmpty = () => {
    const editor = editorRef()
    if (!editor) return true

    // Проверяем содержимое на пустоту и наличие только пробельных символов
    const content = editor.innerHTML.trim()

    // Проверка на пустой параграф (часто формируется редактором)
    if (content === '<p><br></p>' || content === '<p></p>') return true

    // Проверка на содержание только HTML-тегов без текста
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content
    const textContent = tempDiv.textContent?.trim() || ''

    return textContent === ''
  }

  // Функция для проверки необходимости показа плавающего тулбара
  const shouldShowFloatingToolbar = () => {
    return (
      props.toolbar === 'float' && // 1. Активен режим float (props.toolbar === 'float')
      selection()?.text &&
      !selection()?.isEmpty && // 2. Есть непустое выделение
      hasFocus() && // 3. Редактор в фокусе
      !showForm() // 4. У нас не открыта форма вставки ссылки
    )
  }

  // Состояние для управления локальной версией
  const [localVersion, setLocalVersion] = createSignal<ContentVersion | null>(null)
  const [showLocalVersionLink, setShowLocalVersionLink] = createSignal(false)

  // Вспомогательная функция для безопасного получения текста выделения
  const getSelectionText = () => {
    const currentSelection = selection()
    return currentSelection ? currentSelection.text : ''
  }

  // New collaborative state management
  const [editorState, setEditorState] = createSignal<EditorState>({
    id: props.editorId || `editor-${Math.random().toString(36).slice(2)}`,
    content: props.content || '',
    selection: {
      range: null,
      text: '',
      isEmpty: true,
      position: { top: 0, left: 0 }
    },
    activeFormats: new Set<CommandType>(),
    history: { undo: [], redo: [] },
    isBlurred: false,
    cursorPosition: { top: 0, left: 0 },
    setActiveFormats: noop,
    setContent: noop,
    setIsBlurred: noop
  })

  // Debounced state updates
  const debouncedStateUpdate = debounce(1000, (state: EditorState) => {
    if (state.cursorPosition) {
      props.onCollabCursorUpdate?.(state.cursorPosition)
    }
  })

  // Базовое состояние
  const [content, setContent] = createSignal(initialContent || '')
  const [selection, setSelection] = createSignal({ text: '', isEmpty: true })
  const [cursorPosition, setCursorPosition] = createSignal<Position | null>(null)
  const { updateActiveFormats, activeFormats, saveSelection, restoreSelection } = useSelection(editorRef)
  const { handleDropFiles } = useDropFiles()

  // Эффект для синхронизации содержимого редактора с сигналом content
  createEffect(
    on(content, (newContent) => {
      if (!editorRef() || isServer) return

      // Проверяем, отличается ли текущее содержимое от нового
      if (editorRef()!.innerHTML !== newContent) {
        // Сохраняем текущее выделение
        saveSelection()

        // Обновляем содержимое редактора
        editorRef()!.innerHTML = newContent

        // Восстанавливаем выделение
        restoreSelection()
      }
    })
  )

  // Функция для загрузки локальной версии контента
  const loadLocalVersion = () => {
    const version = localVersion()
    if (!version || !editorRef()) return

    console.log(
      `[SimpleRichEditor] Loading local version from ${new Date(version.timestamp).toLocaleString()}`
    )

    // Используем функцию из storage.ts
    const cleanContent = loadLocalVersionContent(version)

    editorRef()!.innerHTML = cleanContent
    setContent(cleanContent)
    setShowLocalVersionLink(false)

    // Обновляем данные родителя только если контент не пустой
    const plainText = editorRef()!.innerText || ''
    const isEmpty = isEmptyContent(cleanContent)

    if (!isEmpty) {
      props.onChange({
        content: cleanContent,
        plainText,
        length: plainText.length,
        isEmpty: false,
        selection: { text: '', isEmpty: true }
      })
    }

    // Устанавливаем фокус в редактор
    editorRef()!.focus()
  }

  /**
   * Очищает локальную версию контента
   * Используется при сохранении или отмене редактирования
   */
  const handleClearLocalVersion = () => {
    if (!props.editorId) return

    // Используем функцию из storage.ts
    clearLocalVersion(props.editorId, props.fieldType as EditorFieldType)

    // Сбрасываем состояние интерфейса
    setLocalVersion(null)
    setShowLocalVersionLink(false)
  }

  // Добавим кнопку для очистки локальной версии, если она есть
  createEffect(() => {
    if (localVersion() && !props.readOnly) {
      // При необходимости можно добавить кнопку для очистки данных
      const handleClearLocalStorageClick = () => {
        if (confirm('Очистить локальные данные редактора?')) {
          handleClearLocalVersion()
        }
      }

      // Можно использовать для дебага и очистки локального хранилища
      if (import.meta.env.DEV && window.location.search.includes('debug=true')) {
        console.log('Debug mode: можно очистить данные редактора через clearLocalVersion()')
        // @ts-ignore - Добавляем в глобальную область для отладки
        window.clearEditorLocalStorage = handleClearLocalStorageClick
      }
    }
  })

  // Эффект для загрузки сохраненного контента из всех источников
  createEffect(
    on(
      () => [props.editorId, props.fieldType, props.content],
      ([editorId, fieldType, content]) => {
        if (!editorRef() || isServer) return

        // Если пришли пустые props.content, это может означать новый черновик с сервера
        if (content === '') {
          console.log('[SimpleRichEditor] Received empty content from props, clearing editor')
          editorRef()!.innerHTML = ''
          setContent('')

          // Очищаем локальное хранилище для этого редактора
          if (editorId) {
            const storageKey = getStorageKey(editorId, fieldType as EditorFieldType)
            localStorage.removeItem(storageKey)
            localStorage.removeItem(editorId)
          }

          // Сбрасываем флаг локальной версии
          setLocalVersion(null)
          setShowLocalVersionLink(false)
          return
        }

        // Пропускаем обновление, если редактор уже имеет фокус, но только если контент не пустой
        if (hasFocus() && !isEmptyContent(editorRef()!.innerHTML) && content !== '') {
          console.log('[SimpleRichEditor] Editor has focus, skipping content update')

          // Если есть свежий контент с сервера, сохраняем его как серверную версию
          if (content && editorId) {
            const storageKey = getStorageKey(editorId, fieldType as EditorFieldType)
            const serverVersionKey = getServerVersionKey(storageKey)
            saveVersionToStorage(serverVersionKey, content, 'server')
            console.log('[SimpleRichEditor] Saved server version for later comparison')
          }
          return
        }

        // Используем функцию из storage.ts для загрузки версий
        const {
          contentToUse,
          localVersion: localVer,
          showLocalVersionWarning
        } = loadVersions(editorId, fieldType as EditorFieldType, content)

        // Записываем контент в редактор
        if (contentToUse && editorRef()) {
          editorRef()!.innerHTML = contentToUse
          setContent(contentToUse)
        }

        // Устанавливаем флаг локальной версии
        if (showLocalVersionWarning && localVer) {
          setLocalVersion(localVer)
          setShowLocalVersionLink(true)
        } else {
          setLocalVersion(null)
          setShowLocalVersionLink(false)
        }
      },
      // Добавляем отложенное выполнение эффекта для инициализации
      { defer: true }
    )
  )

  // Добавляем эффект для footnoteContent
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

  /**
   * Создает функцию для отслеживания выделения с нужными параметрами
   *
   * Эта функция инкапсулирует логику отслеживания выделения и изменений в редакторе,
   * следуя принципу DRY. Она создает обработчик, который:
   * - Обновляет активные форматы при изменении выделения
   * - Сохраняет информацию о текущем выделении
   * - Устанавливает позицию курсора для отображения меню
   * - Управляет видимостью тулбара в зависимости от режима и состояния выделения
   *
   * @param params Объект с необходимыми зависимостями и колбэками
   * @returns Объект с методом handleTrackSelectionAndCursor
   */
  const createTrackSelectionHandler = (params: {
    isServer: boolean
    editorRef: () => HTMLDivElement | undefined
    updateActiveFormats: () => void
    isSelectionInEditor: (element: HTMLElement | null) => boolean
    setSelection: (sel: { text: string; isEmpty: boolean }) => void
    setCursorPosition: (pos: Position | null) => void
    setToolbar: (mode: string) => void
    isEmptyContent: (content: string) => boolean
    toolbarMode: string
  }) => {
    return {
      handleTrackSelectionAndCursor: () => {
        trackSelectionAndCursor({
          isServer: params.isServer,
          editorRef: params.editorRef,
          updateActiveFormats: params.updateActiveFormats,
          isSelectionInEditor: () => {
            const editor = params.editorRef()
            if (!editor) return false
            return params.isSelectionInEditor(editor)
          },
          setSelection: params.setSelection,
          setCursorPosition: params.setCursorPosition,
          setToolbar: params.setToolbar,
          isEmptyContent: params.isEmptyContent,
          toolbarMode: params.toolbarMode,
          editorId: props.editorId // Передаем идентификатор редактора
        })

        // После обновления позиции курсора обновляем отображение меню
        if (hasFocus() && props.fieldType === 'body') {
          // Для плавного обновления UI используем requestAnimationFrame
          requestAnimationFrame(() => {
            // Дополнительная проверка текущей позиции курсора
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0)
              const editor = params.editorRef()

              // Если курсор в редакторе, обновляем его позицию
              if (editor?.contains(range.commonAncestorContainer)) {
                const rect = range.getBoundingClientRect()

                if (rect && rect.height > 0) {
                  // Получаем относительные координаты внутри редактора
                  const editorRect = editor.getBoundingClientRect()
                  const relativeTop = rect.top - editorRect.top

                  // Обновляем позицию курсора для более точного позиционирования меню
                  params.setCursorPosition({
                    top: relativeTop,
                    left: rect.left - editorRect.left
                  })
                }
              }
            }
          })
        }
      }
    }
  }

  /**
   * Создаем функцию отслеживания выделения с установленными параметрами
   */
  const { handleTrackSelectionAndCursor } = createTrackSelectionHandler({
    isServer,
    editorRef,
    updateActiveFormats,
    isSelectionInEditor: (editor: HTMLElement | null) => isSelectionInElement(editor),
    setSelection,
    setCursorPosition,
    setToolbar,
    isEmptyContent,
    toolbarMode: props.toolbar || 'float'
  })

  // Применяем эффект отслеживания выделения
  createEffect(() => {
    // Запускаем функцию, когда редактор уже смонтирован
    if (editorRef()) {
      // Создаем MutationObserver для отслеживания изменений в DOM
      const observer = new MutationObserver(() => {
        handleTrackSelectionAndCursor()
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
    const editor = editorRef()
    if (!selectionInfo.isEmpty && editor && isSelectionInElement(editor)) {
      // Обновляем активные форматы при изменении выделения
      updateActiveFormats()
      // Показываем тулбар только при выделении
      setToolbar(props.toolbar || 'float')
    } else if (selectionInfo.isEmpty && props.toolbar === 'float') {
      // Скрываем тулбар если нет выделения и режим float
      setToolbar('hidden')
    }
  })

  /**
   * Обработчик изменений в редакторе
   */
  const handleChange = () => {
    if (!editorRef()) return

    const editor = editorRef()!
    const selection = window.getSelection()
    if (!selection) return

    // Получаем выделенный текст
    const text = selection.toString()
    const isEmpty = text.length === 0

    // Проверяем, что выделение внутри редактора
    if (!isSelectionInElement(editor)) {
      return
    }

    // Отслеживаем изменения форматирования и позицию курсора
    handleTrackSelectionAndCursor()

    // Видимость тулбара зависит от режима отображения
    if (props.toolbar) {
      // Если режим явно указан, то используем его
      setToolbar(props.toolbar)
    } else if (props.fieldType === 'comment') {
      // Для комментариев по умолчанию bottom
      setToolbar('bottom')
    } else {
      // Для остальных полей float по умолчанию, скрываем если нет выделения
      setToolbar(isEmpty ? 'hidden' : 'float')
    }

    // Получаем текущий HTML-контент редактора и очищаем от JSON-структур
    const rawContent = editor.innerHTML || ''
    const contentHtml = cleanupJsonContent(rawContent)

    // Проверяем, изменилось ли содержимое
    const currentContent = content()
    if (contentHtml !== currentContent) {
      setContent(contentHtml)
    }

    // Проверяем, является ли контент пустым (нет текста и медиа)
    const editorIsEmpty = isEmptyContent(contentHtml)

    // Проверяем необходимость обновления плейсхолдера
    // Проверяем только при изменении статуса пустоты, чтобы избежать мигания
    if (editorIsEmpty !== shouldShowPlaceholderState()) {
      updatePlaceholderWithDelay(editorIsEmpty)
      // biome-ignore lint/style/useCollapsedElseIf: ok
    } else {
      // Обновляем класс плейсхолдера для отображения
      if (editorIsEmpty) {
        editor.classList.add('placeholder-visible')
      } else {
        editor.classList.remove('placeholder-visible')
      }
    }

    // Создаем данные для отправки родительскому компоненту
    const plainText = editor.innerText || ''

    const editorData = {
      content: contentHtml,
      plainText: plainText,
      length: plainText.length,
      isEmpty: editorIsEmpty,
      selection: {
        text,
        isEmpty,
        position: cursorPosition() || undefined
      }
    }

    // Используем функцию из storage.ts для сохранения контента
    if (props.editorId) {
      saveContent(props.editorId, props.fieldType as EditorFieldType, contentHtml, editorIsEmpty)
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

  // Обработчик ввода данных пользователем
  const handleInput = (_e: InputEvent) => {
    // Получаем элемент редактора и проверяем, пуст ли он
    const editor = editorRef()
    if (!editor) return

    // Получаем HTML-содержимое редактора
    const contentHtml = editor.innerHTML

    // Проверяем пустоту содержимого
    const editorIsEmpty = isEmptyContent(contentHtml)

    // Проверяем находится ли курсор на новой строке
    const onNewLine = isCursorOnEmptyLine()

    // Управляем классом для отображения плейсхолдера на новой строке
    if (onNewLine && !editorIsEmpty) {
      editor.classList.add('show-placeholder-on-new-line')
    } else {
      editor.classList.remove('show-placeholder-on-new-line')
    }

    // Проверяем необходимость обновления плейсхолдера
    // Проверяем только при изменении статуса пустоты, чтобы избежать мигания
    if (editorIsEmpty !== shouldShowPlaceholderState()) {
      updatePlaceholderWithDelay(editorIsEmpty)
      // biome-ignore lint/style/useCollapsedElseIf: ok
    } else {
      // Обновляем класс плейсхолдера для отображения
      if (editorIsEmpty) {
        editor.classList.add('placeholder-visible')
      } else {
        editor.classList.remove('placeholder-visible')
      }
    }

    // Обновляем редактор
    handleChange()
  }

  // Menu modes
  // micro: bold, italic, link
  // mini: bold, italic, link, blockquote, image
  // full:
  //  - blocks: [[h1, h2, h3], [blockuote, punchline, incut]],
  //  - text: bold, italic, highlight
  //  - links: link, footnote
  //  - lists: ol, ul
  //  - plus: image, video, file

  // Focus and blur
  const handleFocus = () => {
    // Если таймаут для сокрытия тулбара был установлен, очищаем его
    if (blurTimerRef) {
      clearTimeout(blurTimerRef)
      blurTimerRef = 0
    }

    // Устанавливаем флаг, что редактор в фокусе
    setHasFocus(true)

    // Проверяем позицию курсора для отображения плейсхолдера на новой строке
    const editor = editorRef()
    if (editor) {
      // Проверяем, находится ли курсор на новой строке
      const onNewLine = isCursorOnEmptyLine()

      // Если курсор на новой строке и контент не полностью пустой
      if (onNewLine && !isEmptyContent(editor.innerHTML)) {
        editor.classList.add('show-placeholder-on-new-line')
      } else {
        editor.classList.remove('show-placeholder-on-new-line')
      }

      // Если плейсхолдер уже не должен отображаться для пустого редактора
      if (!isEmptyContent(editor.innerHTML)) {
        setShouldShowPlaceholderState(false)
        editor.classList.remove('placeholder-visible')
      }
    }

    // Устанавливаем режим тулбара при фокусе в соответствии с props.toolbar
    // Для режима float не показываем тулбар сразу, а только при выделении текста
    if (props.toolbar === 'float') {
      const selection = window.getSelection()
      const hasSelection = selection ? selection.toString().length > 0 : false
      setToolbar(hasSelection ? 'float' : 'hidden')
    } else if (props.toolbar !== 'hidden') {
      setToolbar(props.toolbar || 'float')
    }

    // Логируем, что редактор получил фокус
    console.log('[SimpleRichEditor] focus', { editorId: props.editorId })

    // Если есть обработчик onFocus, вызываем его
    if (props.onFocus) {
      props.onFocus()
    }
  }

  // Функция для обработки потери фокуса редактором
  const handleBlur = (_e: FocusEvent) => {
    // Устанавливаем таймаут для обработки потери фокуса
    // Это нужно, чтобы дать время для возможных кликов на тулбаре
    setTimeout(() => {
      // Проверяем, есть ли активное выделение и находится ли оно в редакторе
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)

        // Проверяем, что выделение не в редакторе или в дочернем элементе
        if (editorRef()?.contains(range.commonAncestorContainer)) {
          // Выделение все еще внутри нашего редактора, не скрываем меню
          return
        }
      }

      setHasFocus(false)
      // Вызываем обработчик потери фокуса из props
      props.onBlur?.()
    }, 100)
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
  const [editingImage, setEditingImage] = createSignal<HTMLElement | null>(null)

  // Функция для обработки клика по элементам в редакторе
  const handleContentClick = (e: MouseEvent) => {
    if (isServer || !editorRef() || props.readOnly) return

    const target = e.target as HTMLElement

    // Существующий код...

    // Добавляем обнаружение врезок
    const squibElement = findSquibElement(target)
    if (squibElement) {
      // Получаем позицию врезки для размещения меню
      const rect = squibElement.getBoundingClientRect()
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft

      // Обновляем состояния для отображения меню
      setCurrentSquib(squibElement)
      setSquibMenuPosition({
        top: rect.top + scrollTop - 48,
        left: rect.left + scrollLeft + rect.width / 2 - 170,
        isVisible: true
      })

      setShowSquibEditor(true)
    }
  }

  // Обновляем onMount, чтобы добавить дополнительные обработчики
  onMount(() => {
    if (!editorRef()) return

    if (props.placeholder) {
      editorRef()!.setAttribute('data-placeholder', props.placeholder)
    }

    // Используем функцию из storage.ts для загрузки версий
    const {
      contentToUse,
      localVersion: localVer,
      showLocalVersionWarning
    } = loadVersions(props.editorId, props.fieldType as EditorFieldType, props.content)

    // Записываем контент в редактор
    if (contentToUse && editorRef()) {
      editorRef()!.innerHTML = contentToUse
      setContent(contentToUse)
    }

    // Устанавливаем флаг локальной версии
    if (showLocalVersionWarning && localVer) {
      setLocalVersion(localVer)
      setShowLocalVersionLink(true)
    } else {
      setLocalVersion(null)
      setShowLocalVersionLink(false)
    }

    if (props.autofocus) {
      editorRef()!.focus()

      // Устанавливаем курсор в конец текста для лучшего UX
      const selection = window.getSelection()
      if (selection && editorRef()!.childNodes.length > 0) {
        const range = document.createRange()
        const lastChild = editorRef()!.lastChild
        if (lastChild) {
          range.selectNodeContents(lastChild)
          range.collapse(false) // Перемещаем в конец
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }

    // Добавляем обработчик кликов по элементам внутри редактора
    editorRef()!.addEventListener('click', handleContentClick)

    // Добавляем обработчик простого клика внутри редактора для обновления позиции курсора
    const handleEditorClick = (e: MouseEvent) => {
      // Позволяем событию клика обрабатываться стандартным образом
      // НЕ останавливаем распространение события

      // Используем небольшую задержку, чтобы курсор успел переместиться перед обработкой
      setTimeout(() => {
        // После клика обновляем активные форматы для выделения активной иконки в тулбаре
        updateActiveFormats()

        // Получаем текущее выделение для обновления UI
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)

          if (editorRef()?.contains(range.commonAncestorContainer)) {
            // Проверяем находится ли курсор на новой строке
            const onNewLine = isCursorOnEmptyLine()

            // Добавляем класс для показа плейсхолдера, если нужно
            if (onNewLine && !isEmptyContent(editorRef()?.innerHTML || '')) {
              editorRef()?.classList.add('show-placeholder-on-new-line')
            } else {
              editorRef()?.classList.remove('show-placeholder-on-new-line')
            }

            // Обновляем состояние редактора
            handleChange()
          }
        }
      }, 0)

      // Используем event для проверки, был ли клик по ссылке
      const target = e.target as HTMLElement
      if (target.tagName === 'A') {
        // Предотвращаем переход по ссылке при клике в редакторе
        e.preventDefault()
        // Обработка клика по ссылке
        console.log('[SimpleRichEditor] Click on link:', target.getAttribute('href'))
      }
    }

    editorRef()!.addEventListener('click', handleEditorClick)

    // Для обработки изменения выделения используем делегирование и проверку принадлежности к редактору
    const handleSelectionChange = (_e?: Event) => {
      // Если редактор не активен, не обрабатываем события выделения
      if (!hasFocus()) return

      const selection = window.getSelection()
      if (!selection) return

      // Получаем элемент редактора
      const editor = editorRef()
      if (!editor) return

      // Проверяем, находится ли курсор на новой строке
      const onNewLine = isCursorOnEmptyLine()

      // Управляем классом отображения плейсхолдера на новой строке
      if (onNewLine && !isEmptyContent(editor.innerHTML)) {
        editor.classList.add('show-placeholder-on-new-line')
      } else {
        editor.classList.remove('show-placeholder-on-new-line')
      }

      // Проверяем, находится ли выделение внутри редактора
      let isSelectionInEditor = false

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        isSelectionInEditor = editor.contains(range.commonAncestorContainer)
      }

      // Если выделение не в редакторе, не обрабатываем дальше
      if (!isSelectionInEditor) return

      // Обновляем позицию курсора и выделение
      handleChange()

      // Если установлен режим float для тулбара, проверяем, есть ли выделение
      // и обновляем режим отображения тулбара соответственно
      if (props.toolbar === 'float') {
        const selText = selection.toString()
        if (selText && selText.length > 0) {
          setToolbar('float') // Показываем тулбар при выделении
        } else {
          setToolbar('hidden') // Скрываем тулбар, если выделения нет
        }
      }

      // Дополнительно обновляем позицию курсора для меню
      requestAnimationFrame(() => {
        handleTrackSelectionAndCursor()
      })
    }

    // Для обработки mouseup и keyup используем делегирование и проверку принадлежности к редактору
    const handleGlobalMouseUp = (e: MouseEvent) => {
      const editor = editorRef()
      if (editor && (editor === e.target || editor.contains(e.target as Node))) {
        handleTrackSelectionAndCursor()
      }
    }

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      const editor = editorRef()
      if (editor && (editor === e.target || editor.contains(e.target as Node))) {
        handleTrackSelectionAndCursor()
      }
    }

    // Инициализируем слушатели событий
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleGlobalMouseUp)
    document.addEventListener('keyup', handleGlobalKeyUp)

    // Начальное отслеживание
    handleTrackSelectionAndCursor()

    // Очистка при размонтировании
    onCleanup(() => {
      if (editorRef()) {
        editorRef()!.removeEventListener('click', handleContentClick)
        editorRef()!.removeEventListener('click', handleEditorClick)
      }
      clearTimeout(blurTimerRef)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('keyup', handleGlobalKeyUp)
      debouncedStateUpdate.cancel()
    })
  })

  // Функция для перехода к другому полю редактора в черновике
  const switchFieldInDraft = (
    nextField: EditorFieldType,
    editorId?: string,
    fieldType?: EditorFieldType
  ) => {
    if (!editorId || !fieldType) return false

    // Получаем префикс ID черновика из editorId
    const draftIdMatch = editorId.match(DRAFT_REGEX)
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

  // Функция для перехода к другому полю редактора в черновике
  const handleNavigation = (nextField: EditorFieldType) => {
    return switchFieldInDraft(nextField, props.editorId, props.fieldType)
  }

  // Обновленная функция вставки ссылки - теперь использует новый обработчик
  const handleInsertLink = (url: string) => {
    // Упрощаем логику, используя новый обработчик
    handleLinkSubmit(url)
    // Сбрасываем UI состояние и возвращаем фокус
    setShowForm(null)
    editorRef()?.focus()
  }

  // Обновленная функция вставки видео - теперь использует новый обработчик
  const handleInsertVideo = (url: string) => {
    // Упрощаем логику, используя новый обработчик
    handleVideoSubmit(url)
    // Сбрасываем UI состояние и возвращаем фокус
    setShowForm(null)
    editorRef()?.focus()
  }

  /**
   * Обработчик загрузки аудио через AudioUploader
   * @param audioItems Загруженные аудио элементы
   */
  const handleAudioUpload = (audioItems: MediaItem[]) => {
    // Сохраняем выделение перед работой с аудио
    saveSelection()

    // Используем функцию из модуля audio.ts
    if (handleAudioUploaderResult(audioItems, editorRef() || null)) {
      handleChange()
    }

    // Возвращаем фокус в редактор и закрываем модальное окно
    editorRef()?.focus()
    restoreSelection()
    hideModal()
  }

  /**
   * Показывает модальное окно для загрузки аудио
   */
  const showAudioUploader = () => {
    // Сохраняем текущее выделение
    saveSelection()

    // Создаем модальное окно с аудио аплоадером
    let dispose: () => void

    const _modal = createRoot((dispose_: () => void) => {
      dispose = dispose_
      const [isOpen, setIsOpen] = createSignal(true)

      // Обработчик закрытия модального окна
      const handleClose = () => {
        setIsOpen(false)
        restoreSelection()
        setTimeout(dispose, 300) // Даём время на анимацию закрытия
      }

      return (
        <Portal>
          <div class="modal" style={{ display: isOpen() ? 'flex' : 'none' }}>
            <div class="modal-backdrop" onClick={handleClose} />
            <div class="modal-content">
              <AudioUploader
                audio={[]}
                onAudioAdd={handleAudioUpload}
                onAudioChange={(_index, _value) => {
                  /* Не используется, но требуется интерфейсом */
                }}
                onAudioSorted={(_value) => {
                  /* Не используется, но требуется интерфейсом */
                }}
              />
            </div>
          </div>
        </Portal>
      )
    })

    // Добавляем модальное окно в DOM (не требуется с Portal)
  }

  /**
   * Обработчик вставки ссылки из модального окна
   * @param url URL для вставки
   */
  const handleLinkSubmit = (url: string) => {
    if (validateUrl(url)) {
      // Восстанавливаем сохраненное выделение
      restoreSelection()

      // Попытка создать инстанс редактора для передачи в функцию insertLink
      const editor = editorRef()
      if (!editor) return

      const editorState = {
        id: editor.id || 'editor',
        content: editor.innerHTML,
        selection: {
          range: window.getSelection()?.getRangeAt(0) || null,
          text: window.getSelection()?.toString() || '',
          isEmpty: !window.getSelection() || window.getSelection()?.isCollapsed || false,
          position: { top: 0, left: 0 }
        },
        activeFormats: new Set<CommandType>(),
        history: { undo: [], redo: [] },
        isBlurred: false,
        selectedRange: window.getSelection()?.getRangeAt(0) || null,
        currentCommand: 'link' as CommandType,
        setActiveFormats: noop,
        setContent: noop,
        setIsBlurred: noop
      }

      const result = handleEditorAction(
        {
          command: 'link',
          data: url,
          editorId: editor.id
        },
        editorState
      )

      if (result.success) {
        handleChange()
      }
    }
  }

  /**
   * Обработчик вставки видео из модального окна
   * @param url URL видео для вставки
   */
  const handleVideoSubmit = (url: string) => {
    if (validateVideoUrl(url)) {
      // Восстанавливаем сохраненное выделение
      restoreSelection()

      // Попытка создать инстанс редактора для передачи в функцию insertVideo
      const editor = editorRef()
      if (!editor) return

      // Определяем платформу видео
      const platform = detectVideoPlatform(url)
      if (!platform) return

      const editorState = {
        id: editor.id || 'editor',
        content: editor.innerHTML,
        selection: {
          range: window.getSelection()?.getRangeAt(0) || null,
          text: window.getSelection()?.toString() || '',
          isEmpty: !window.getSelection() || window.getSelection()?.isCollapsed || false,
          position: { top: 0, left: 0 }
        },
        activeFormats: new Set<CommandType>(),
        history: { undo: [], redo: [] },
        isBlurred: false,
        selectedRange: window.getSelection()?.getRangeAt(0) || null,
        currentCommand: 'video' as CommandType,
        setActiveFormats: noop,
        setContent: noop,
        setIsBlurred: noop
      }

      // Создаем видео-встройку
      const videoEmbed = createVideoEmbed(url, platform)

      // Вставляем видео-встройку
      const result = handleEditorAction(
        {
          command: 'video',
          data: url,
          editorId: editor.id
        },
        editorState
      )

      if (result.success) {
        handleChange()
      } else {
        // Если handleEditorAction не сработал, используем прямую вставку
        handleReplaceSelection(videoEmbed)
      }
    }
  }

  // Восстанавливаем функцию для работы с HTML-контентом
  /**
   * Заменяет текущее выделение HTML контентом
   * @param html HTML строка для вставки
   * @returns true если замена успешна
   */
  const handleReplaceSelection = (html: string): boolean => {
    const editor = editorRef()
    const result = replaceSelection(html, editor || null)

    if (result) {
      // Обновляем сигнал content после вставки
      if (editor) {
        const newContent = editor.innerHTML
        setContent(newContent)
      }

      // Обновляем состояние редактора
      handleChange()

      // Обновляем состояние активных форматов
      updateActiveFormats()
    }

    return result
  }

  // Обработчик для клавиатурных команд
  const handleKeyDown = (e: KeyboardEvent) => {
    // Проверяем сочетания клавиш для форматирования
    const isMac = navigator.platform.includes('Mac')
    const cmdKey = isMac ? e.metaKey : e.ctrlKey

    // После каждого нажатия клавиши-стрелки обновляем позицию курсора
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Используем setTimeout для обновления позиции после обработки нажатия клавиши
      setTimeout(() => {
        handleTrackSelectionAndCursor()
      }, 0)
    }

    // Горячие клавиши форматирования
    if (cmdKey && !e.shiftKey && !e.altKey) {
      if (e.key === 'b') {
        // Cmd/Ctrl+B - Bold
        e.preventDefault()
        handleAction('bold')
        return
      }
      if (e.key === 'i') {
        // Cmd/Ctrl+I - Italic
        e.preventDefault()
        handleAction('italic')
        return
      }

      if (e.key === 'k') {
        // Cmd/Ctrl+K - Link
        e.preventDefault()
        handleAction('link')
        return
      }

      if (e.key === '1') {
        // Cmd/Ctrl+1 - H1
        e.preventDefault()
        handleAction('h1')
        return
      }

      if (e.key === '2') {
        // Cmd/Ctrl+2 - H2
        e.preventDefault()
        handleAction('h2')
        return
      }

      if (e.key === '3') {
        // Cmd/Ctrl+3 - H3
        e.preventDefault()
        handleAction('h3')
        return
      }
      if (e.key === 'q') {
        // Cmd/Ctrl+Q - Blockquote
        e.preventDefault()
        handleAction('blockquote')
        return
      }
    }

    // Обрабатываем навигацию по полям черновика (Tab и Shift+Tab)
    if (e.key === 'Tab' && props.fieldType) {
      e.preventDefault() // Предотвращаем стандартное поведение Tab

      if (e.shiftKey) {
        // Shift+Tab - переход к предыдущему полю
        if (props.fieldType === 'body') handleNavigation('lead')
        else if (props.fieldType === 'lead') handleNavigation('description')
      }

      if (props.fieldType === 'description') {
        handleNavigation('lead')
      } else if (props.fieldType === 'lead') {
        handleNavigation('body')
      }
      return
    }

    // Если нажат Shift+Enter, позволяем стандартное поведение (перевод строки в текущем поле)
    if (e.shiftKey && e.key === 'Enter') {
      // Для редактора вступления вставляем <br> вместо перехода к следующему полю
      if (props.fieldType === 'lead' || props.fieldType === 'description') {
        e.preventDefault()
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        const br = document.createElement('br')
        range.insertNode(br)

        // Перемещаем курсор после добавленного <br>
        range.setStartAfter(br)
        range.setEndAfter(br)
        selection.removeAllRanges()
        selection.addRange(range)

        handleChange()
        return
      }
      return
    }

    // Если нажат просто Enter
    if (e.key === 'Enter') {
      // Для заголовка и lead полей проверяем, нужно ли переходить в следующее поле
      if (props.fieldType === 'description' || props.fieldType === 'lead') {
        // Проверяем, есть ли модификаторы
        if (e.ctrlKey || e.metaKey) {
          // Если нажат Ctrl+Enter или Cmd+Enter, переходим к следующему полю
          e.preventDefault()
          const nextField = props.fieldType === 'description' ? 'lead' : 'body'
          return handleNavigation(nextField)
        }

        // В противном случае создаем обычный перенос строки
        e.preventDefault()
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        const br = document.createElement('br')
        range.insertNode(br)

        // Перемещаем курсор после добавленного <br>
        range.setStartAfter(br)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)

        handleChange()
        return
      }

      // Для поля body (основной контент) обрабатываем блочные элементы
      if (props.fieldType === 'body') {
        const selection = window.getSelection()
        if (!selection) return

        const range = selection.getRangeAt(0)
        const container = range.startContainer
        const blockElement =
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest('blockquote, h1, h2, h3, div[data-type]')
            : (container as Element).closest('blockquote, h1, h2, h3, div[data-type]')

        if (blockElement) {
          e.preventDefault()

          // Проверяем, пуст ли блочный элемент
          const isEmpty =
            blockElement.textContent?.trim() === '' ||
            blockElement.innerHTML === '<br>' ||
            blockElement.innerHTML === ''

          if (isEmpty) {
            // Если блок пустой, заменяем его обычным параграфом
            const p = document.createElement('p')
            p.innerHTML = '<br>'
            blockElement.parentNode?.replaceChild(p, blockElement)

            // Перемещаем курсор в новый параграф
            range.selectNodeContents(p)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)

            // Обновляем активные форматы в тулбаре
            updateActiveFormats()
            handleChange()
            return
          }

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

          handleChange()
          return // Выходим, чтобы предотвратить дальнейшую обработку
        }

        // Если мы внутри обычного параграфа, используем стандартное поведение,
        // но с обязательным обновлением позиции курсора

        // Проверяем, находимся ли мы в пустом параграфе или тексте
        const isEmptyParagraph =
          container.nodeType === Node.ELEMENT_NODE &&
          (container as Element).nodeName === 'P' &&
          (container.textContent === '' ||
            container.textContent === '\n' ||
            (container as HTMLElement).innerHTML === '<br>')

        const isBodyDirectly =
          container === editorRef() ||
          (container.nodeType === Node.TEXT_NODE && container.parentNode === editorRef())

        if (isEmptyParagraph || isBodyDirectly) {
          // Для пустых параграфов или прямого текста в редакторе создаем новый параграф
          e.preventDefault()

          const p = document.createElement('p')
          p.innerHTML = '<br>'

          if (isEmptyParagraph) {
            // Вставляем после текущего пустого параграфа
            container.parentNode?.insertBefore(p, container.nextSibling)
          } else {
            // Вставляем в конец редактора
            editorRef()?.appendChild(p)
          }

          // Перемещаем курсор в новый параграф
          range.selectNodeContents(p)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)

          // Обновляем позицию курсора после создания нового параграфа
          setTimeout(() => {
            handleTrackSelectionAndCursor()
          }, 0)
        } else {
          // В остальных случаях используем стандартную обработку Enter
          // Но после выполнения команды обязательно обновляем позицию курсора
          setTimeout(() => {
            handleTrackSelectionAndCursor()
          }, 0)
        }

        handleChange()
      }
    }

    // Добавляем обработку клавиши Backspace для удаления пустого blockquote
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return

      const range = selection.getRangeAt(0)

      // Проверяем, находимся ли в начале блока цитирования
      const node = range.startContainer
      const blockElement =
        node.nodeType === Node.TEXT_NODE
          ? node.parentElement?.closest('blockquote, h1, h2, h3, div[data-type]')
          : (node as Element).closest('blockquote, h1, h2, h3, div[data-type]')

      if (blockElement) {
        // Для Backspace - проверяем начало блока, для Delete - конец блока или пустой блок
        const isAtStart = range.startOffset === 0 && e.key === 'Backspace'
        const isAtEnd =
          e.key === 'Delete' &&
          ((node.nodeType === Node.TEXT_NODE && range.startOffset === node.textContent?.length) ||
            (node.nodeType !== Node.TEXT_NODE && range.startOffset === (node as Element).childNodes.length))
        const isEmpty =
          blockElement.textContent?.trim() === '' ||
          blockElement.innerHTML === '<br>' ||
          blockElement.innerHTML === ''

        if (isEmpty || isAtStart || isAtEnd) {
          e.preventDefault()

          // Заменяем форматированный блок на обычный параграф
          const p = document.createElement('p')
          p.innerHTML = isEmpty ? '<br>' : blockElement.innerHTML
          blockElement.parentNode?.replaceChild(p, blockElement)

          // Перемещаем курсор в новый параграф
          range.selectNodeContents(p)
          range.collapse(e.key === 'Backspace')
          selection.removeAllRanges()
          selection.addRange(range)

          // Обновляем активные форматы и состояние редактора
          updateActiveFormats()
          handleChange()
          return
        }
      }
    }
  }

  /**
   * Обрабатывает действия форматирования
   * @param action Команда форматирования
   */
  const handleAction = (action: CommandType | CommandGroupType) => {
    if (!editorRef()) return

    // Отладочное логирование для диагностики
    console.log('handleAction вызван с:', action, 'editorRef:', editorRef())

    if (isGroup(action)) {
      // Если это группа команд, обрабатываем их отдельно
      for (const cmd of MENU_GROUPS[action as CommandGroupType]) {
        handleAction(cmd)
      }
      return
    }

    // Проверяем, не link ли это с выделением текста
    if (action === 'link' && getSelectionText() !== '') {
      showInlineForm('link', handleLinkSubmit)
      return
    }

    const editor = editorRef()
    if (!editor) return

    // Создаем минимальный объект состояния редактора
    const editorState = {
      id: props.editorId || 'editor',
      content: editor.innerHTML,
      selection: {
        range: window.getSelection()?.getRangeAt(0) || null,
        text: window.getSelection()?.toString() || '',
        isEmpty: !window.getSelection() || window.getSelection()?.isCollapsed || false,
        position: { top: 0, left: 0 }
      },
      activeFormats: new Set<CommandType>(),
      history: { undo: [], redo: [] },
      isBlurred: false,
      selectedRange: window.getSelection()?.getRangeAt(0) || null,
      currentCommand: action as CommandType,
      setActiveFormats: noop,
      setContent: noop,
      setIsBlurred: noop
    }

    // Используем новый обработчик действий из модуля actions.ts
    // с поддержкой переключения форматирования через hasFormatting
    const result = handleEditorAction(
      {
        command: action as CommandType,
        editorId: props.editorId || editor.getAttribute('data-editor-id') || ''
      },
      editorState
    )

    if (!result.success && result.error) {
      // Если возникла ошибка, можно показать сообщение пользователю
      console.warn(result.error)
    }

    // Вызываем handleAfterFormat для обновления состояния после форматирования
    handleAfterFormat()
  }

  /**
   * Обработчик успешной загрузки изображения
   * @param uploadedFile Загруженный файл
   */
  const handleUploadSuccess = (uploadedFile?: UploadedFile) => {
    if (!uploadedFile) return

    const currentImage = editingImage()

    // Обновление существующего изображения или вставка нового
    if (currentImage) {
      // Обновляем атрибуты существующего изображения
      ;(currentImage as HTMLImageElement).src = uploadedFile.url
      ;(currentImage as HTMLImageElement).alt = uploadedFile.originalFilename || 'Uploaded image'
      setEditingImage(null)
    } else {
      // Вставляем новое изображение
      handleReplaceSelection(
        `<img src="${uploadedFile.url}" alt="${uploadedFile.originalFilename || 'Uploaded image'}" />`
      )
    }

    // Закрываем модальное окно, возвращаем фокус и обновляем контент
    hideModal()
    editorRef()?.focus()
    handleChange()
  }

  /**
   * Обработчик сохранения сноски
   * @param content Содержимое сноски
   */
  const handleFootnoteSubmit = (content: string) => {
    // Определяем правильный набор команд для редактора футнот
    // Используем такой же набор команд, как для комментариев
    const _footnoteCommands = MICRO_COMMANDS as unknown as CommandType[]

    // Редактирование существующей сноски
    if (editingFootnote()) {
      const footnoteEl = editingFootnote()
      const footnoteId = footnoteEl?.getAttribute('data-footnote-id')

      if (footnoteId && footnoteEl) {
        // Обновляем содержимое по ID
        const footnoteContent = editorRef()?.querySelector(`[data-footnote-content="${footnoteId}"]`)
        if (footnoteContent) {
          footnoteContent.innerHTML = content
        }

        // Сбрасываем состояние и обновляем редактор
        setEditingFootnote(null)
        setShowFootnoteEditor(false)
        handleChange()
      }
    } else {
      // Создание новой сноски
      const editor = editorRef()
      if (!editor) return

      // Вставляем сноску и восстанавливаем контекст
      saveSelection()
      insertFootnote(editor, content, window.getSelection() as Selection)
      setShowFootnoteEditor(false)
      restoreSelection()
      setFootnoteContent('')
    }
  }

  /**
   * Показывает инлайн-форму для ввода ссылки или медиа
   * @param type Тип формы
   * @param onSubmit Обработчик отправки формы
   */
  const showInlineForm = (type: FormType, onSubmit: (value: string) => void) => {
    if (!type) return

    // Сохраняем выделение и показываем форму
    saveSelection()
    setFormPosition(
      getEditorPosition(editorRef() || null, {
        type: 'form',
        placement: 'bottom',
        offset: 10,
        centerHorizontally: true
      })
    )

    // Задаем параметры и показываем форму
    setFormInitialValue('')
    setShowForm(type)

    // Настраиваем валидацию для разных типов форм
    editorFormOptions = {
      type,
      onSubmit,
      validate:
        type === 'video'
          ? (url: string) => validateVideoUrl(url, t)
          : (url: string) => validateWebUrl(url, t)
    }
  }

  // Обновленная функция для позиции плавающего тулбара
  const getFloatingToolbarPosition = (): Position => {
    const position = getEditorPosition(editorRef() || null, {
      type: 'float',
      placement: 'top',
      offset: 40,
      centerHorizontally: true
    })

    return {
      top: position.top,
      left: position.left
    }
  }

  /**
   * Рассчитывает позицию всплывающего тулбара
   * @returns Позиция тулбара
   */
  const _getToolbarPosition = (): { top: number; left: number; isVisible?: boolean } => {
    const editor = editorRef()
    if (!editor) return { top: 0, left: 0, isVisible: false }

    return getEditorPosition(editor, {
      type: 'toolbar',
      placement: toolbar() === 'float' ? 'top' : 'bottom',
      offset: 10,
      centerHorizontally: true
    })
  }

  /**
   * Рассчитывает позицию плюс-меню
   * @returns Позиция меню
   */
  const getPlusMenuPosition = (): { top: number; left: number; isVisible?: boolean } => {
    const editor = editorRef()
    if (!editor) return { top: 0, left: 0, isVisible: false }

    return getEditorPosition(editor, {
      type: 'plus',
      placement: 'left',
      offset: 30
    })
  }

  // Функция для определения, находится ли курсор на пустой строке
  const isCursorOnEmptyLine = (): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return true // По умолчанию считаем строку пустой

    const range = selection.getRangeAt(0)
    const node = range.startContainer

    // Определяем текущий узел и родительский элемент
    const currentNode = node.nodeType === Node.TEXT_NODE ? node : (node as Element)
    const parentElement =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : (currentNode as HTMLElement)

    // Случай 1: Текстовый узел - проверяем текст до курсора
    if (node.nodeType === Node.TEXT_NODE) {
      // Получаем текст до курсора в текущей строке
      const textBeforeCursor = node.textContent?.slice(0, range.startOffset) || ''
      // Если текст до курсора пустой, строка считается пустой
      return textBeforeCursor.trim() === ''
    }

    // Случай 2: HTML-элемент (параграф, div и т.д.)
    if (parentElement) {
      // Проверка на пустой параграф или строку
      if (
        parentElement.innerHTML === '' ||
        parentElement.innerHTML === '<br>' ||
        parentElement.textContent?.trim() === '' ||
        ((node as Element).textContent?.trim() === '' && parentElement.innerHTML.includes('<img'))
      ) {
        return true
      }

      // Если курсор в начале непустого элемента
      if (range.startOffset === 0 && parentElement.textContent?.trim()) {
        return true
      }
    }

    // Случай 3: Курсор в начале редактора
    if (range.startOffset === 0 && (node === editorRef() || parentElement === editorRef())) {
      return true
    }

    // По умолчанию считаем, что курсор не на пустой строке
    return false
  }

  // Следим за изменениями режима тулбара
  createEffect(() => {
    console.log('[SimpleRichEditor] Toolbar mode changed:', {
      mode: toolbar(),
      fieldType: props.fieldType,
      hasFocus: hasFocus()
    })
  })

  // Функция для инициализации редактора с правильным позиционированием плейсхолдера
  const initEditor = (element: HTMLDivElement) => {
    if (!element) return

    setEditorRef(element)

    // Загружаем содержимое и определяем, пустое ли оно
    const initialHtml = props.content || ''
    const isEmpty = isEmptyContent(initialHtml)

    // Если контент пуст, устанавливаем пустой HTML и добавляем класс .empty
    if (isEmpty) {
      element.innerHTML = ''
      element.classList.add(styles.empty)
    } else {
      // Если контент не пуст, загружаем его и убираем класс .empty
      element.innerHTML = initialHtml
      element.classList.remove(styles.empty)
    }

    // Устанавливаем начальный режим тулбара на основе props
    setToolbar(props.toolbar || 'float')

    // Устанавливаем placeholder как data-атрибут для использования в CSS
    if (props.placeholder) {
      element.setAttribute('data-placeholder', props.placeholder)
    }

    // Добавляем атрибуты для CSS-селекторов
    if (props.fieldType) {
      element.setAttribute('data-field-type', props.fieldType)
    }

    if (props.editorId) {
      element.setAttribute('data-editor-id', props.editorId)
    }
  }

  // Сигнал для отслеживания, нужно ли показывать плейсхолдер
  const [shouldShowPlaceholderState, setShouldShowPlaceholderState] = createSignal(false)

  // Функция с дебаунсом для обновления плейсхолдера
  let placeholderTimeout: number | undefined

  // Функция для проверки, нужно ли показывать плейсхолдер с задержкой
  const updatePlaceholderWithDelay = (isEmpty: boolean) => {
    // Очищаем предыдущий таймаут, если он был
    if (placeholderTimeout) {
      clearTimeout(placeholderTimeout)
      placeholderTimeout = undefined
    }

    // Если контент не пустой - сразу скрываем плейсхолдер
    if (!isEmpty) {
      setShouldShowPlaceholderState(false)
      return
    }

    // Используем более длительную задержку при форматировании текста
    // Это поможет избежать мигания плейсхолдера при применении стилей
    const selection = window.getSelection()
    const isFormatting = selection && !selection.isCollapsed
    const delay = isFormatting ? 300 : 100

    // Если контент пустой - устанавливаем с задержкой
    placeholderTimeout = window.setTimeout(() => {
      setShouldShowPlaceholderState(isEmpty)
    }, delay)
  }

  // Обновление состояния плейсхолдера
  const updatePlaceholderState = () => {
    // Определяем, пуст ли редактор
    const isEmpty = isEditorEmpty()

    // Обновляем состояние
    setShouldShowPlaceholderState(isEmpty)

    // Добавляем/удаляем класс .empty для редактора
    const editorElement = editorRef()

    if (editorElement) {
      if (isEmpty) {
        editorElement.classList.add('empty')
      } else {
        editorElement.classList.remove('empty')
      }
    }
  }

  // Эффект для инициализации состояния плейсхолдера
  createEffect(() => {
    const editor = editorRef()
    if (!editor) return

    // Проверяем пустоту содержимого
    const isEmpty = isEmptyContent(editor.innerHTML)

    // Сразу устанавливаем начальное состояние
    setShouldShowPlaceholderState(isEmpty)

    // Обновляем класс для соответствия состоянию
    if (isEmpty) {
      editor.classList.add('placeholder-visible')
    } else {
      editor.classList.remove('placeholder-visible')
    }
  })

  // Эффект для обновления отображения плейсхолдера при изменении состояния
  createEffect(() => {
    const editor = editorRef()
    if (!editor) return

    // Добавляем/удаляем класс в зависимости от состояния
    if (shouldShowPlaceholderState()) {
      editor.classList.add('placeholder-visible')
    } else {
      editor.classList.remove('placeholder-visible')
    }
  })

  // Инициализация редактора
  createEffect(() => {
    if (editorRef()) {
      // Заполняем редактор содержимым
      const editor = editorRef()!
      if (initialContent && editor.innerHTML !== initialContent) {
        editor.innerHTML = initialContent
      }

      // Добавляем обработчик клавиатуры для отслеживания изменений
      const handleKeyUp = () => {
        handleChange()

        // Обновляем состояние плейсхолдера
        updatePlaceholderState()

        // Проверяем, находится ли курсор на новой строке после нажатия клавиши
        const onNewLine = isCursorOnEmptyLine()
        const editor = editorRef()

        if (editor) {
          if (onNewLine && !isEmptyContent(editor.innerHTML)) {
            // Если курсор на новой строке - показываем плейсхолдер и плюс-меню
            editor.classList.add('show-placeholder-on-new-line')
          } else {
            editor.classList.remove('show-placeholder-on-new-line')
          }
        }
      }

      // Обновляем отображение плейсхолдера при инициализации
      updatePlaceholderState()

      editor.addEventListener('keyup', handleKeyUp)
      onCleanup(() => editor.removeEventListener('keyup', handleKeyUp))
    }
  })

  // Эффект обновления стиля плейсхолдера при изменении содержимого
  createEffect(() => {
    if (!editorRef() || isServer) return

    // Используем функцию isEditorEmpty для проверки пустоты редактора
    const isEmpty = isEditorEmpty()

    // Обновляем классы для плейсхолдера
    if (isEmpty) {
      editorRef()!.classList.add('placeholder-visible')
    } else {
      editorRef()!.classList.remove('placeholder-visible')
    }
  })

  // Функция для поиска существующей врезки по клику
  const findSquibElement = (target: Node | null): HTMLElement | null => {
    if (!target) return null

    // Находим родительский элемент врезки
    const squibElement = (target as HTMLElement).closest(`.${styles.squib}`)
    return (squibElement as HTMLElement) || null
  }

  // Создаем сигнал для хранения ссылки на текущую врезку
  const [currentSquib, setCurrentSquib] = createSignal<HTMLElement | null>(null)

  /**
   * Обработчик для отслеживания изменений и обновления тулбара
   */
  const updateToolbarState = () => {
    // Прежде чем обновлять тулбар, проверим нужно ли его показывать
    if (shouldShowFloatingToolbar()) {
      setToolbar('float')
      // Позиция будет передана через props при рендеринге SimpleToolbar
    } else if (hasFocus()) {
      // Если есть фокус, но нет выделения - используем заданный режим
      setToolbar(props.toolbar || 'bottom')
    } else {
      // Если нет фокуса - скрываем тулбар
      setToolbar('hidden')
    }
  }

  // Обновляем эффект для отслеживания изменений и обновления тулбара
  createEffect(() => {
    // Отслеживаем изменения в выделении и фокусе
    const _selectionEmpty = selection()?.isEmpty
    const _focused = hasFocus()

    // Обновляем состояние тулбара
    updateToolbarState()
  })

  /**
   * Обработчик для отслеживания изменений выделения текста
   * и обновления видимости тулбаров
   */
  const _trackSelectionAndToolbars = () => {
    handleTrackSelectionAndCursor()
    updateToolbarState()
  }

  // Обработчик для обновления выделения и курсора после
  // завершения операции форматирования
  const handleAfterFormat = () => {
    handleChange()
    updateToolbarState()
  }

  /**
   * Обработчик команд форматирования для панели инструментов сносок
   * Принимает только команды типа CommandType
   * @param action Команда форматирования
   */
  const handleFootnoteToolbarAction = (action: CommandType) => {
    handleAction(action)
  }

  // Создаем функцию для получения всех сносок из текущего редактора
  const getDocumentFootnotes = () => {
    if (!editorRef()) return []
    return getAllFootnotes(editorRef()!)
  }

  // Обновляем список сносок при изменении контента
  createEffect(
    on(content, () => {
      if (editorRef()) {
        updateFootnotes(getDocumentFootnotes())
      }
    })
  )

  /**
   * Открывает редактор сноски для указанного идентификатора
   * @param footnoteId Идентификатор сноски для редактирования
   */
  const openFootnoteEditor = (footnoteId: string) => {
    if (!editorRef()) return

    // Находим сноску по идентификатору
    const footnote = getFootnoteById(editorRef()!, footnoteId)
    if (!footnote) return

    // Сохраняем текущее выделение перед открытием редактора сноски
    saveSelection()

    // Устанавливаем режим редактирования для этой сноски
    setEditingFootnote(footnote.marker as HTMLElement)
    setFootnoteContent(footnote.content)
    setShowFootnoteEditor(true)
  }

  // Обработчики для работы с формами
  const [_linkSubmitHandler, _setLinkSubmitHandler] = createSignal<(url: string) => void>(() => {
    /* Заглушка, будет заменена реальным обработчиком через setLinkSubmitHandler */
  })
  const [_videoSubmitHandler, _setVideoSubmitHandler] = createSignal<(url: string) => void>(() => {
    /* Заглушка, будет заменена реальным обработчиком через setVideoSubmitHandler */
  })

  // Обработчик для компонента модального окна загрузки изображений
  const showImageUploadModal = () => {
    // Сохраняем текущее состояние выделения
    saveSelection()

    // Показываем модальное окно с загрузчиком изображений
    showModal(MODALS.uploadImage)

    // Сохраняем параметры в глобальную переменную для использования в компоненте загрузки
    // @ts-ignore - В реальной ситуации это будет обрабатываться корректно
    window.__imageUploadParams = {
      onSuccess: handleUploadSuccess,
      onCancel: () => {
        hideModal()
        editorRef()?.focus() // Возвращаем фокус в редактор
        restoreSelection()
      }
    }
  }

  // заменяем локальное определение documentFootnotes
  // const [documentFootnotes, setDocumentFootnotes] = createSignal<Array<{ id: string; content: string; marker: Element }>>([])
  // на функцию-адаптер для работы с documentFootnotes из state
  const getFootnotesArray = () => {
    const stateFootnotes = stateDocumentFootnotes()
    return Object.entries(stateFootnotes).map(([id, content]) => {
      const marker = document.querySelector(`[data-footnote-id="${id}"]`)
      return { id, content, marker: marker as Element }
    })
  }

  const updateFootnotes = (footnotes: Array<{ id: string; content: string; marker: Element }>) => {
    const footnotesObject: Record<string, string> = {}
    footnotes.forEach(({ id, content }) => {
      footnotesObject[id] = content
    })
    setStateDocumentFootnotes(footnotesObject)
  }

  return (
    <div
      class={clsx(styles.editorWrapper, {
        [styles.readOnly]: props.readOnly
      })}
      data-field-type={props.fieldType}
    >
      {/* Редактируемая область только для контента */}
      <div
        class={clsx(styles.editor, {
          [styles.focused]: hasFocus(),
          [styles.hasContent]: !isEditorEmpty(),
          [styles.readOnly]: props.readOnly
        })}
        data-editor-id={props.editorId}
        data-field-type={props.fieldType}
      >
        {/* Внутреннее содержимое редактора */}
        <div
          ref={initEditor}
          class={styles.content}
          contentEditable={!props.readOnly}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onInput={handleInput}
          onSelect={handleChange}
          onPaste={handlePaste}
          onDrop={handleDropFiles}
          onKeyDown={handleKeyDown}
          onClick={handleContentClick}
          data-placeholder={props.placeholder}
          spellcheck={true}
        />

        {/* Тулбар в режиме top - видим при фокусе */}
        <Show when={toolbar() === 'top' && hasFocus()}>
          <SimpleToolbar
            commands={props.commands as CommandType[]}
            onAction={(action) => handleAction(action as CommandType)}
            currentFormats={activeFormats()}
            isVisible={true}
            class={styles.topToolbar}
            editorId={props.editorId}
          />
        </Show>

        {/* Тулбар в режиме bottom - видим при фокусе */}
        <Show when={toolbar() === 'bottom' && hasFocus()}>
          <SimpleToolbar
            commands={props.commands as CommandType[]}
            onAction={(action) => handleAction(action as CommandType)}
            currentFormats={activeFormats()}
            isVisible={true}
            class={styles.bottomToolbar}
            editorId={props.editorId}
          />
        </Show>

        {/* Плавающий тулбар - видим при выделении текста */}
        <Show when={toolbar() === 'float' && selection()?.text && !selection()?.isEmpty}>
          <SimpleToolbar
            commands={props.commands as CommandType[]}
            onAction={(action) => handleAction(action as CommandType)}
            currentFormats={activeFormats()}
            isVisible={true}
            position={getFloatingToolbarPosition()}
            class={styles.floatingToolbar}
            editorId={props.editorId}
          />
        </Show>

        {/* Меню врезки (SquibMenu) показывается только когда курсор внутри врезки */}
        <Show when={showSquibEditor() && currentSquib()}>
          <SquibMenu
            isVisible={true}
            onAction={(action) => {
              const squibElement = currentSquib()
              if (squibElement) {
                if (handleSquibFormatting(action as string)) {
                  handleChange()
                  editorRef()?.focus()
                }
              }
            }}
            onClose={() => {
              setShowSquibEditor(false)
              setCurrentSquib(null)
            }}
            currentFormats={activeFormats()}
            position={squibMenuPosition()}
            editorId={props.editorId}
            commands={[
              'align-left',
              'align-center',
              'align-right',
              'bg-gray',
              'bg-white',
              'bg-black',
              'bg-yellow',
              'bg-red',
              'bg-green'
            ]}
          />
        </Show>

        {/* Ссылка для восстановления локальной версии */}
        <Show when={showLocalVersionLink()}>
          <div class={styles.localVersionLabel}>
            {t('Есть локальная версия')}
            <button onClick={loadLocalVersion} class={styles.localVersionRestore}>
              {t('Восстановить')}
            </button>
            <button onClick={handleClearLocalVersion} class={styles.localVersionClear}>
              {t('Очистить')}
            </button>
          </div>
        </Show>

        {/* Отображаем редактор сносок */}
        <Show when={showFootnoteEditor()}>
          <div class={styles.footnoteEditor}>
            <h3>{editingFootnote() ? t('Редактировать сноску') : t('Добавить сноску')}</h3>
            <div
              class={styles.footnoteEditorContent}
              contentEditable={true}
              onInput={(e) => setFootnoteContent(e.currentTarget.innerHTML)}
              data-editor-type="footnote"
            />
            <SimpleToolbar
              commands={MICRO_COMMANDS as unknown as CommandType[]}
              onAction={(action) => handleFootnoteToolbarAction(action as CommandType)}
              currentFormats={activeFormats()}
              isVisible={true}
              class={styles.footnoteToolbar}
            />
            <div class={styles.footnoteEditorActions}>
              <button
                onClick={() => {
                  handleFootnoteSubmit(footnoteContent())
                  setShowFootnoteEditor(false)
                }}
              >
                {t('Сохранить')}
              </button>
              <button
                onClick={() => {
                  setShowFootnoteEditor(false)
                  setFootnoteContent('')
                }}
              >
                {t('Отмена')}
              </button>
            </div>
          </div>
        </Show>

        {/* Меню для отображения всех сносок в документе */}
        <Show when={getFootnotesArray().length > 0 && props.fieldType === 'body'}>
          <div class={styles.footnotesList}>
            <h4>{t('Сноски в документе')}:</h4>
            <ul>
              <For each={getFootnotesArray()}>
                {(footnote: { id: string; content: string; marker: Element }) => (
                  <li>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        openFootnoteEditor(footnote.id)
                      }}
                      title={footnote.content.replace(/<[^>]*>/g, '')}
                    >
                      {footnote.id}
                    </a>
                    <button
                      class={styles.removeFootnoteButton}
                      title={t('Удалить сноску')}
                      onClick={() => {
                        if (editorRef()) {
                          removeFootnote(editorRef()!, footnote.id)
                          updateFootnotes(getDocumentFootnotes())
                          handleChange()
                        }
                      }}
                    >
                      ×
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>

        {/* Заменяем старые формы на InlineForm */}
        <Show when={showForm() === 'link'}>
          <div
            class={styles.inlineFormWrapper}
            style={{
              top: `${formPosition()?.top || 0}px`,
              left: `${formPosition()?.left || 0}px`
            }}
          >
            <InlineForm
              placeholder={t('Вставьте URL')}
              initialValue={formInitialValue()}
              onSubmit={handleInsertLink}
              onClose={() => {
                setShowForm(null)
                editorRef()?.focus()
                restoreSelection()
              }}
              validate={editorFormOptions?.validate || (() => '')}
            />
          </div>
        </Show>

        <Show when={showForm() === 'video'}>
          <div
            class={styles.inlineFormWrapper}
            style={{
              top: `${formPosition()?.top || 0}px`,
              left: `${formPosition()?.left || 0}px`
            }}
          >
            <InlineForm
              placeholder={t('Вставьте URL видео (YouTube, Vimeo)')}
              initialValue={formInitialValue()}
              onSubmit={handleInsertVideo}
              onClose={() => {
                setShowForm(null)
                editorRef()?.focus()
                restoreSelection()
              }}
              validate={editorFormOptions?.validate || (() => '')}
            />
          </div>
        </Show>

        {/* Плюс-меню для вставки специальных элементов */}
        <Show when={shouldShowPlusMenu()}>
          <PlusMenu
            position={getPlusMenuPosition()}
            isVisible={true}
            onEmpty={isCursorOnEmptyLine()}
            onAction={(action) => {
              // Создаем обертку для правильного вызова handlePlusMenuAction
              handlePlusMenuAction(action, editorRef()!, {
                showLinkForm: (onSubmit) => {
                  setShowForm('link')
                  setFormInitialValue('')
                  setFormPosition(getPlusMenuPosition())
                  _setLinkSubmitHandler(() => onSubmit)
                },
                showVideoForm: (onSubmit) => {
                  setShowForm('video')
                  setFormInitialValue('')
                  setFormPosition(getPlusMenuPosition())
                  _setVideoSubmitHandler(() => onSubmit)
                },
                showImageUploadModal,
                showAudioUploader,
                handleChange
              })
            }}
            onClose={() => handleTrackSelectionAndCursor()}
            editorId={props.editorId}
          />
        </Show>
      </div>
    </div>
  )
}
