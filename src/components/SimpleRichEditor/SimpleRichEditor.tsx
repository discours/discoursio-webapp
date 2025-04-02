import { clsx } from 'clsx'
import { Component, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'

import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { Button } from '~/components/_shared/Button'
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
import { calculateMenuPosition, getMenuPosition, useSelection } from './lib/selection'
import { Position } from './lib/types'
import { PlusMenu } from './menu/PlusMenu'
import { SimpleToolbar } from './menu/SimpleToolbar'
import { SquibMenu } from './menu/SquibMenu'

import styles from './SimpleRichEditor.module.scss'
import { isEmptyContent } from './lib/empty'
import {
  ContentVersion,
  cleanupJsonContent,
  clearLocalVersion,
  getServerVersionKey,
  getStorageKey,
  loadLocalVersionContent,
  loadVersions,
  removeLocalVersion,
  saveContent,
  saveVersionToStorage
} from './lib/storage'
import {
  isSelectionInElement as isSelInEditor,
  replaceSelection,
  trackSelectionAndCursor
} from './lib/utils'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]

const WEB_URL_REGEX = /^(https|http)?:\/\//
const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.)?vimeo\.com\/([0-9]+)/
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/

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
  fieldType?: EditorFieldType
  // Добавляем колбэки для кнопок сохранения и отмены
  onSave?: () => void
  onCancel?: () => void
  // Флаг для отображения кнопок сохранения и отмены
  showButtons?: boolean
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
  const { t } = useLocalize()
  const { showModal, hideModal } = useUI()
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>()

  // Инициализируем тулбар как скрытый для пустого редактора
  const [toolbar, setToolbar] = createSignal<SimpleRichEditorProps['toolbar']>('hidden')
  const [showSquibEditor, setShowSquibEditor] = createSignal(false)
  const [showFootnoteEditor, setShowFootnoteEditor] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)
  let blurTimer: number

  // Применяем очистку к входящему контенту
  const initialContent = cleanupJsonContent(props.content)

  // Функция для проверки необходимости показа плюс-меню
  const shouldShowPlusMenu = () => {
    // Показываем плюс-меню всегда для редактора основного тела или когда редактор в фокусе
    return props.plus && (hasFocus() || props.fieldType === 'body')
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
    content: props.content || '',
    cursorPosition: undefined
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
          toolbarMode: params.toolbarMode
        })
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
    isSelectionInEditor: (editor: HTMLElement | null) => isSelInEditor(editor),
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
    if (!selectionInfo.isEmpty && editor && isSelInEditor(editor)) {
      // Обновляем активные форматы при изменении выделения
      updateActiveFormats()
      // Показываем тулбар только при выделении
      setToolbar(props.toolbar || 'float')
    } else if (selectionInfo.isEmpty && props.toolbar === 'float') {
      // Скрываем тулбар если нет выделения и режим float
      setToolbar('hidden')
    }
  })

  // Отслеживает изменения выделения и обновляет состояние редактора
  const handleChange = () => {
    if (!editorRef()) return

    const editor = editorRef()!
    const selection = window.getSelection()
    if (!selection) return

    // Получаем выделенный текст
    const text = selection.toString()
    const isEmpty = text.length === 0

    // Проверяем, что выделение внутри редактора
    if (!isSelInEditor(editor)) {
      return
    }

    // Отслеживаем изменения форматирования и позицию курсора
    handleTrackSelectionAndCursor()

    // Изменяем видимость тулбара в зависимости от режима отображения
    if (!props.toolbar || props.toolbar === 'float') {
      // Bubble toolbar - показываем только при выделении текста
      if (isEmpty) {
        setToolbar('hidden')
      } else {
        setToolbar('float')
      }
    }
    // В фиксированных режимах тулбар уже отображается

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

  // Handle input changes
  const handleInput = () => {
    if (!editorRef()) return

    const html = editorRef()!.innerHTML || ''

    // Очищаем от JSON-строк перед сохранением
    const cleanContent = cleanupJsonContent(html)

    setContent(cleanContent)

    // Сохраняем текущую позицию курсора перед обновлением
    saveSelection()

    // Обновляем позицию курсора и состояние выделения
    handleTrackSelectionAndCursor()

    // Обновляем состояние выделения
    updateActiveFormats()

    // Проверяем на пустое содержимое для корректной работы плейсхолдера
    if (editorRef()) {
      const onlyBr =
        editorRef()!.innerHTML === '<br>' ||
        editorRef()!.innerHTML === '<br/>' ||
        editorRef()!.innerHTML === '<p><br></p>' ||
        editorRef()!.innerHTML === ''
      // Если содержимое пустое или содержит только BR, очищаем редактор
      if (onlyBr) {
        editorRef()!.innerHTML = ''
      }
    }

    // Используем улучшенную функцию проверки пустого контента (учитывает наличие медиа)
    const isEmpty = isEmptyContent(cleanContent)

    // Отправляем данные родителю
    const plainText = editorRef()!.innerText || ''

    const editorData = {
      content: cleanContent,
      plainText,
      length: plainText.length,
      isEmpty,
      selection: selection()
    }

    // Используем функцию из storage.ts для сохранения контента
    if (props.editorId) {
      saveContent(props.editorId, props.fieldType as EditorFieldType, cleanContent, isEmpty)
    }

    // Отправляем данные родителю
    props.onChange(editorData)

    // Обновляем состояние для совместного редактирования
    if (props.collaborative) {
      debouncedStateUpdate({
        content: cleanContent,
        cursorPosition: cursorPosition() || undefined
      })
    }

    // Восстанавливаем выделение
    restoreSelection()
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
    clearTimeout(blurTimer)
    setHasFocus(true)

    // Show fixed toolbar immediately on focus if not in float mode
    if (props.toolbar && props.toolbar !== 'float') {
      setToolbar(props.toolbar)
    }

    // Обновляем позицию курсора для правильного отображения плюс-меню
    handleTrackSelectionAndCursor()

    // Устанавливаем курсор в конец, если это первый фокус и контент не пустой
    const windowSelection = window.getSelection()
    if (windowSelection && windowSelection.rangeCount === 0 && editorRef()!.childNodes.length > 0) {
      const range = document.createRange()
      range.selectNodeContents(editorRef()!)
      range.collapse(false) // Коллапсируем в конец
      windowSelection.removeAllRanges()
      windowSelection.addRange(range)
      handleTrackSelectionAndCursor() // Обновляем информацию о выделении
    }
  }

  const handleBlur = (e: FocusEvent) => {
    // Проверяем, что фокус не переходит на элемент внутри редактора
    if (!editorRef()?.contains(e.relatedTarget as Node)) {
      blurTimer = window.setTimeout(() => {
        setHasFocus(false)
        if (props.toolbar === 'float') {
          setToolbar('hidden')
        }
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

    // Проверяем, кликнули ли по плейсхолдеру
    if (
      target.hasAttribute('data-placeholder') ||
      target.classList.contains(styles.placeholder) ||
      target.closest('[data-placeholder]')
    ) {
      // Устанавливаем фокус на редактор
      editorRef()?.focus()
      // Обновляем позицию курсора после фокуса
      handleTrackSelectionAndCursor()
      return
    }

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

    // Инициализируем слушатели событий
    document.addEventListener('selectionchange', handleChange)
    document.addEventListener('mouseup', handleTrackSelectionAndCursor)
    document.addEventListener('keyup', handleTrackSelectionAndCursor)

    // Начальное отслеживание
    handleTrackSelectionAndCursor()
  })

  // Обновляем onCleanup, чтобы удалить наш обработчик
  onCleanup(() => {
    if (editorRef()) {
      editorRef()!.removeEventListener('click', handleContentClick)
    }
    clearTimeout(blurTimer)
    document.removeEventListener('selectionchange', handleChange)
    document.removeEventListener('mouseup', handleTrackSelectionAndCursor)
    document.removeEventListener('keyup', handleTrackSelectionAndCursor)
    debouncedStateUpdate.cancel()
  })

  const [showingInsert, showInsert] = createSignal<{ type: string; text: string } | undefined>()
  const [insertPosition, setInsertPosition] = createSignal<{ top: number; left: number } | undefined>()

  // Функция для вычисления позиции относительно кнопки или выделения
  const calculateInsertMenuPosition = () => {
    return calculateMenuPosition(editorRef() || null)
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

  const handleKeyDown = (e: KeyboardEvent) => {
    // Проверяем сочетания клавиш для форматирования
    const isMac = navigator.platform.includes('Mac')
    const cmdKey = isMac ? e.metaKey : e.ctrlKey

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
        // biome-ignore lint/style/useCollapsedElseIf: ok
      } else {
        // Tab - переход к следующему полю
        if (props.fieldType === 'description') handleNavigation('lead')
        else if (props.fieldType === 'lead') handleNavigation('body')
      }
      return
    }

    // Если нажат Shift+Enter, позволяем стандартное поведение (перевод строки в текущем поле)
    if (e.shiftKey && e.key === 'Enter') {
      return
    }

    // Если нажат просто Enter
    if (e.key === 'Enter') {
      // Для заголовка и lead полей Enter всегда должен переводить в следующее поле
      if (props.fieldType === 'description' || props.fieldType === 'lead') {
        e.preventDefault()
        const nextField = props.fieldType === 'description' ? 'lead' : 'body'
        return handleNavigation(nextField)
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
        } else {
          // Стандартное поведение - вставка <br>
          document.execCommand('insertLineBreak')
          handleChange()
        }
      }
    }
  }

  // Обработчик для создания и редактирования врезки
  const handleSquibAction = () => {
    // Сохраняем выделение перед открытием редактора врезки
    saveSelection()

    // Проверяем, находится ли курсор внутри существующей врезки
    const currentNode = window.getSelection()?.anchorNode
    const existingSquib = currentNode?.parentElement?.closest('[data-type="squib"]')

    if (existingSquib) {
      // Редактируем существующую врезку
      setSquibContent(existingSquib.innerHTML)
    } else {
      // Создаем новую врезку из выделенного текста
      setSquibContent(getSelectionText())
    }

    setShowSquibEditor(true)
  }

  // Обновленная функция для применения форматирования к врезке
  const applySquibFormatting = (action: CommandType) => {
    // Проверяем, находится ли курсор внутри врезки
    const currentNode = window.getSelection()?.anchorNode
    const squibElement = currentNode?.parentElement?.closest('[data-type="squib"]')

    if (!squibElement) return false

    // Проверяем, это команда выравнивания или фона
    if (action.startsWith('align-')) {
      // Удаляем предыдущее выравнивание
      const alignValues = ['align-left', 'align-center', 'align-right']
      alignValues.forEach((align) => {
        if (align === action) {
          // Применяем новое выравнивание (кроме left, который считается дефолтным)
          if (action !== 'align-left') {
            squibElement.setAttribute('data-align', action.replace('align-', ''))
          } else {
            squibElement.removeAttribute('data-align')
          }
        } else {
          // Удаляем другие выравнивания
          squibElement.removeAttribute(align)
        }
      })
      return true
    }

    if (action.startsWith('bg-')) {
      // Удаляем предыдущий фон
      const bgValues = ['bg-gray', 'bg-white', 'bg-black', 'bg-yellow', 'bg-red', 'bg-green']
      bgValues.forEach((bg) => {
        squibElement.classList.remove(bg)
      })

      // Устанавливаем новый фон (кроме gray, который дефолтный)
      if (action !== 'bg-gray') {
        squibElement.setAttribute('data-bg', action)
      } else {
        squibElement.removeAttribute('data-bg')
      }

      return true
    }

    return false
  }

  // Обновленная функция handleAction
  const handleAction = (action: CommandType) => {
    if (isServer) return

    // Специальные команды
    if (action === 'squib') {
      handleSquibAction()
      return
    }

    // Проверяем, нужно ли применить форматирование к врезке
    if ((action.startsWith('align-') || action.startsWith('bg-')) && applySquibFormatting(action)) {
      // Форматирование применено к врезке
      handleChange()
      return
    }

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

      setInsertPosition(calculateInsertMenuPosition())
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

      setInsertPosition(calculateInsertMenuPosition())
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

  const handleSquibSubmit = (content: string) => {
    if (!content.trim()) {
      setShowSquibEditor(false)
      return
    }

    // Проверяем, редактируем ли существующую врезку
    const currentNode = window.getSelection()?.anchorNode
    const existingSquib = currentNode?.parentElement?.closest('[data-type="squib"]')

    if (existingSquib) {
      // Обновляем содержимое существующей врезки
      existingSquib.innerHTML = content
    } else {
      // Создаем новую врезку
      const squibHtml = `<div data-type="squib" class="${styles.squib}">${content}</div>`
      handleReplaceSelection(squibHtml)
    }

    setShowSquibEditor(false)
    editorRef()?.focus()

    // Обновляем состояние редактора
    handleChange()
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
    handleReplaceSelection(imgHtml)

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

  const handleInsertVideo = (url: string) => {
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
      handleReplaceSelection(videoEmbed)
    }

    showInsert(undefined)
    editorRef()?.focus()
  }

  const handleInsertLink = (url: string) => {
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
      handleReplaceSelection(`<a href="${url}">${linkText}</a>`)
    }

    showInsert(undefined)
    editorRef()?.focus()
  }

  return (
    <div class={styles.editorWrapper} data-field-type={props.fieldType}>
      {/* Редактируемая область только для контента */}
      <div
        class={clsx(styles.editor, {
          [styles.focused]: hasFocus(),
          [styles.empty]: isEmptyContent(content())
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
          data-editor-id={props.editorId || undefined}
          data-field-type={props.fieldType || undefined}
          spellcheck={true}
        />
      </div>

      {/* Ссылка для восстановления локальной версии */}
      <Show when={showLocalVersionLink()}>
        <div class={styles.localVersionLink}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              loadLocalVersion()
            }}
          >
            {t('Несохраненные изменения от')}{' '}
            {localVersion() ? new Date(localVersion()!.timestamp).toLocaleString() : ''}
          </a>
        </div>
      </Show>

      {/* Кнопки сохранения и отмены для редактора вступления - показываем только если есть содержимое */}
      <Show
        when={
          props.fieldType === 'lead' && props.showButtons && !props.readOnly && !isEmptyContent(content())
        }
      >
        <div class={styles.editorButtonsWrapper}>
          <Button
            variant="secondary"
            value={t('Cancel')}
            onClick={() => {
              // Очищаем редактор перед отменой
              if (editorRef()) {
                editorRef()!.innerHTML = ''
                setContent('')
                // Вызываем родительский обработчик
                if (props.onCancel) {
                  props.onCancel()
                }
              }
            }}
          />
          <Button
            variant="primary"
            value={t('Save')}
            onClick={() => {
              // Вызываем родительский обработчик
              if (props.onSave) {
                props.onSave()
              }
            }}
          />
        </div>
      </Show>

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

      {/* Плавающее меню "+" должно всегда показываться для основного редактора */}
      <Show when={shouldShowPlusMenu()}>
        <PlusMenu
          position={getMenuPosition(editorRef() || null)}
          isVisible={true}
          onAction={(action) => handleAction(action)}
          currentFormats={activeFormats()}
          onClose={() => handleTrackSelectionAndCursor()}
        />
      </Show>

      {/* Меню форматирования врезки */}
      <Show when={props.squib && hasFocus()}>
        <SquibMenu
          isVisible={hasFocus()}
          onAction={(action) => handleAction(action)}
          onClose={() => updateActiveFormats()}
          currentFormats={activeFormats()}
        />
      </Show>

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
              onSubmit={handleInsertLink}
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
              onSubmit={handleInsertVideo}
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

// Экспортируем функцию удаления локальной версии
export { removeLocalVersion }
