import { clsx } from 'clsx'
import { Component, createEffect, createMemo, createRoot, createSignal, on, onCleanup, onMount, Show } from 'solid-js'
import { isServer, Portal } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
import { InlineForm } from '~/components/_shared/InlineForm/InlineForm'
import { AudioUploader } from '~/components/Upload/AudioUploader'
import { useLocalize } from '~/context/localize'
import { MODALS, useUI } from '~/context/ui'
import { MediaItem } from '~/graphql/generated/graphql'
import { UploadedFile } from '~/types/upload'
import { validateVideoUrl, validateWebUrl } from '../../lib/validateDraft'
import { handleAudioUploaderResult } from './lib/audio'
import { isGroup } from './lib/commands'
import { createVideoEmbed, detectVideoPlatform, handleContentPaste } from './lib/embed'
import { isEmptyContent } from './lib/empty'
import { applyFormatting, removeFormatting, type SelectionState, toggleFormatting } from './lib/format'
import { getEditorPosition, isTouchDevice } from './lib/helpers'
import { validateUrl } from './lib/link'
import { useSelection } from './lib/selection'
import {
  ContentVersion,
  cleanupJsonContent,
  clearLocalVersion,
  getServerVersionKey,
  getStorageKey,
  loadLocalVersionContent,
  loadVersions,
  saveEditorContent,
  saveVersionToStorage
} from './lib/storage'
import {
  CommandGroupType,
  CommandType,
  EditorData,
  EditorFieldType,
  FormType,
  InlineFormOptions,
  Position,
  ToolbarMode
} from './lib/types'
import { replaceSelection } from './lib/utils'
import { handlePlusMenuAction, handleSquibFormatting, PlusMenu } from './menu/PlusMenu'
import { SimpleToolbar } from './menu/SimpleToolbar'
import { SquibMenu } from './menu/SquibMenu'

import styles from './SimpleRichEditor.module.scss'

// Типы для форм
const noop = () => undefined
const DRAFT_REGEX = /draft-(\d+)-/

export interface SimpleRichEditorProps {
  onChange: (data: EditorData) => void
  toolbar?: ToolbarMode
  content?: string
  commands?: readonly (CommandType | readonly CommandType[])[]
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

  // Сигналы для работы с ресурсами редактора (Keep footnote signals if footnote editor is used)
  // Footnotes removed
  // const [editingFootnote, setEditingFootnote] = createSignal<HTMLElement | null>(null)
  // const [footnoteContent, setFootnoteContent] = createSignal<string>('')
  const [localVersion, setLocalVersion] = createSignal()

  // Instantiate useSelection hook early
  const {
    saveSelection,
    restoreSelection,
    activeFormats,
    selectionInfo,
    cursorPosition,
    handleTrackSelectionAndCursor: trackSelectionAndCursor
  } = useSelection(
    editorRef,
    () => props.toolbar || 'bottom',
    () => props.editorId
  )

  // Local state signals (ensure all needed are here and only defined once)
  const [showSquibEditor, setShowSquibEditor] = createSignal(false)
  // Footnote editor removed
  // const [showFootnoteEditor, setShowFootnoteEditor] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)
  const [showForm, setShowForm] = createSignal<FormType>(null)
  const [formPosition, setFormPosition] = createSignal<Position | null>(null)
  const [formInitialValue, setFormInitialValue] = createSignal('')
  const [currentSquib, setCurrentSquib] = createSignal<HTMLElement | null>(null)
  const [editingImage, setEditingImage] = createSignal<HTMLElement | null>(null)
  const [showLocalVersionLink, setShowLocalVersionLink] = createSignal(false)
  const [shouldShowPlaceholderState, setShouldShowPlaceholderState] = createSignal(false)
  const [isInitialFocusDone, setIsInitialFocusDone] = createSignal(false)
  // Воркэраунд для Lightning CSS: отслеживаем выделение через класс
  const [hasSelection, setHasSelection] = createSignal(false)

  let blurTimerRef = 0
  const blurTimeout = 150

  // Применяем очистку к входящему контенту
  const initialContent = cleanupJsonContent(props.content)

  // Base state for content
  const [content, setContent] = createSignal(initialContent || '')

  // --- Memoized values ---
  const currentToolbarMode = createMemo((): ToolbarMode => props.toolbar || 'float')

  // --- Helper Functions ---
  const isClickInsideToolbar = (e: FocusEvent): boolean => {
    if (!e.relatedTarget) return false
    const target = e.relatedTarget as HTMLElement
    return target.closest(`.${styles.toolbar}`) !== null || target.closest('[data-toolbar="true"]') !== null
  }

  const isEditorEmpty = () => {
    const editor = editorRef()
    if (!editor) return true
    const currentSignalContent = content()
    if (isEmptyContent(currentSignalContent)) return true
    const contentHtml = editor.innerHTML.trim()
    if (contentHtml === '<p><br></p>' || contentHtml === '<p></p>') return true
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = contentHtml
    const textContent = tempDiv.textContent?.trim() || ''
    return textContent === ''
  }

  const isCursorOnEmptyLine = (): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return true
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    const editorNode = editorRef()
    if (!editorNode || !editorNode.contains(node)) return false
    const currentNode = node.nodeType === Node.TEXT_NODE ? node : (node as Element)
    const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : (currentNode as HTMLElement)

    if (node.nodeType === Node.TEXT_NODE) {
      const textBeforeCursor = node.textContent?.slice(0, range.startOffset) || ''
      return textBeforeCursor.trim() === ''
    }

    if (parentElement) {
      if (
        parentElement.innerHTML === '' ||
        parentElement.innerHTML === '<br>' ||
        parentElement.textContent?.trim() === '' ||
        ((node as Element).textContent?.trim() === '' && parentElement.innerHTML.includes('<img'))
      ) {
        return true
      }
      if (range.startOffset === 0 && parentElement.textContent?.trim()) {
        return true
      }
    }

    if (range.startOffset === 0 && (node === editorNode || parentElement === editorNode)) {
      return true
    }
    return false
  }

  const shouldShowPlusMenu = createMemo(() => {
    const isNewLine = isCursorOnEmptyLine()
    const isEditorInFocus = hasFocus()
    const isNoOtherMenuOpen = !showForm() && !showSquibEditor()
    const isPlusEnabled = props.plus
    return isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
  })

  const getFloatingToolbarPosition = (): Position => {
    return getEditorPosition(editorRef() || null, {
      type: 'float',
      placement: 'top',
      offset: 40,
      centerHorizontally: isTouchDevice()
    })
  }

  const getPlusMenuPosition = (): { top: number; left: number; isVisible?: boolean } => {
    const editor = editorRef()
    const selection = window.getSelection()
    if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) {
      return { top: 0, left: 0, isVisible: false }
    }

    const range = selection.getRangeAt(0)
    const node = range.startContainer

    // Find the closest block element (typically <p>) containing the cursor
    let blockElement = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null
    while (
      blockElement &&
      blockElement !== editor &&
      !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(blockElement.nodeName)
    ) {
      blockElement = blockElement.parentElement
    }

    // Ensure the block element is empty and directly within the editor content area
    if (!blockElement || !editor.contains(blockElement) || blockElement.closest('.ProseMirror') !== editor) {
      // Check it belongs to *this* editor instance
      // Check if the direct parent is the editor itself (cursor might be directly in the root)
      if (node.parentElement === editor && (editor.innerHTML === '' || editor.innerHTML === '<br>')) {
        blockElement = editor // Treat editor as the block if it is empty
      } else {
        return { top: 0, left: 0, isVisible: false } // Not in a valid block
      }
    }

    // Additional check for emptiness might be redundant if shouldShowPlusMenu already covers it,
    // but can be added for robustness:
    // const isEmpty = blockElement.textContent?.trim() === '' || blockElement.innerHTML === '<br>' || blockElement.innerHTML === '';
    // if (!isEmpty && blockElement !== editor) {
    //    return { top: 0, left: 0, isVisible: false };
    // }

    const rect = blockElement.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect() // Get editor bounds for relative positioning
    const scrollTop = window.scrollY
    const scrollLeft = window.scrollX
    const offsetLeft = 20 // Adjust this value to control distance from the left edge

    return {
      // Position vertically centered to the block element
      top: rect.top + scrollTop + rect.height / 2 - 12, // Assuming button height is ~24px
      // Position to the left of the editor's content area
      left: editorRect.left + scrollLeft - offsetLeft,
      isVisible: true
    }
  }

  const findLinkAncestor = (node: Node | null): HTMLAnchorElement | null => {
    if (!node) return null
    let currentNode = node
    const rootNode = editorRef() // Get editor boundary
    while (currentNode && currentNode !== rootNode) {
      if (currentNode.nodeName === 'A') {
        return currentNode as HTMLAnchorElement
      }
      // Stop traversal if parentNode is null or we reach outside the editor
      if (!currentNode.parentNode || currentNode.parentNode === document.body) break
      currentNode = currentNode.parentNode
    }
    return null
  }

  // --- Placeholder Logic ---
  const updatePlaceholderState = () => {
    const isEmpty = isEditorEmpty()
    if (isEmpty !== shouldShowPlaceholderState()) {
      setShouldShowPlaceholderState(isEmpty)
    }
    const editorElement = editorRef()
    if (editorElement) {
      if (isEmpty) {
        editorElement.classList.add(styles.empty, 'placeholder-visible')
      } else {
        editorElement.classList.remove(styles.empty, 'placeholder-visible')
      }
    }
  }

  createEffect(() => {
    const editor = editorRef()
    if (!editor) return
    if (shouldShowPlaceholderState()) {
      editor.classList.add('placeholder-visible')
    } else {
      editor.classList.remove('placeholder-visible')
    }
  })

  createEffect(
    () => {
      const editor = editorRef()
      if (!editor || isServer) return
      updatePlaceholderState() // Set initial state
    },
    { defer: true }
  )

  // --- Content Loading and Saving Logic ---
  const loadLocalVersion = () => {
    const version = localVersion() as ContentVersion
    if (!version || !editorRef()) return
    console.log(`[SimpleRichEditor] Loading local version from ${new Date(version.timestamp).toLocaleString()}`)
    const cleanContent = loadLocalVersionContent(version)
    editorRef()!.innerHTML = cleanContent
    setContent(cleanContent)
    setShowLocalVersionLink(false)
    updatePlaceholderState()
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
    editorRef()!.focus()
  }

  const handleClearLocalVersion = () => {
    if (!props.editorId) return
    clearLocalVersion(props.editorId, props.fieldType as EditorFieldType)
    setLocalVersion(null)
    setShowLocalVersionLink(false)
  }

  createEffect(
    on(
      () => [props.editorId, props.fieldType, props.content],
      ([editorId, fieldType, contentFromProps]) => {
        if (!editorRef() || isServer) return
        const editorElement = editorRef()!
        const currentHTML = editorElement.innerHTML
        if (contentFromProps === '') {
          console.log('[SimpleRichEditor] Received empty content from props, clearing editor')
          if (currentHTML !== '') {
            editorElement.innerHTML = ''
            setContent('')
            updatePlaceholderState()
          }
          if (editorId) {
            const storageKey = getStorageKey(editorId, fieldType as EditorFieldType)
            localStorage.removeItem(storageKey)
            localStorage.removeItem(getServerVersionKey(storageKey))
          }
          setLocalVersion(null)
          setShowLocalVersionLink(false)
          return
        }
        const hasFocusNow = hasFocus()
        if (hasFocusNow && contentFromProps && contentFromProps !== currentHTML) {
          // Если редактор в фокусе и получает новый контент от props,
          // мы не должны обновлять содержимое - это может прервать ввод пользователя
          console.log('[SimpleRichEditor] Editor has focus, ignoring content update from props')

          // Вместо этого, если мы получаем серверное обновление, сохраним его для сравнения
          if (editorId) {
            const storageKey = getStorageKey(editorId, fieldType as EditorFieldType)
            const serverVersionKey = getServerVersionKey(storageKey)
            // Сохраняем серверную версию, но не применяем ее к редактору
            saveVersionToStorage(serverVersionKey, contentFromProps, 'server')
            console.log('[SimpleRichEditor] Saved server version for later comparison')
          }
          return
        } else if (hasFocusNow) {
          if (editorId && contentFromProps) {
            const storageKey = getStorageKey(editorId, fieldType as EditorFieldType)
            const serverVersionKey = getServerVersionKey(storageKey)
            const versions = loadVersions(editorId, fieldType as EditorFieldType, undefined)
            if (versions.serverVersion?.content !== contentFromProps) {
              saveVersionToStorage(serverVersionKey, contentFromProps, 'server')
              console.log('[SimpleRichEditor] Saved server version for focused editor.')
            }
          }
          return
        }
        const {
          contentToUse,
          localVersion: localVer,
          showLocalVersionWarning
        } = loadVersions(editorId, fieldType as EditorFieldType, contentFromProps)
        if (contentToUse && editorElement.innerHTML !== contentToUse) {
          console.log('[SimpleRichEditor] Loading versions, setting content.')
          saveSelection()
          editorElement.innerHTML = contentToUse
          setContent(contentToUse)
          updatePlaceholderState()
          restoreSelection()
        } else if (!contentToUse && !editorElement.innerHTML) {
          updatePlaceholderState()
        }
        if (showLocalVersionWarning && localVer) {
          setLocalVersion(localVer)
          setShowLocalVersionLink(true)
        } else {
          setLocalVersion(null)
          setShowLocalVersionLink(false)
        }
      },
      { defer: true }
    )
  )

  createEffect(
    on(content, (newContent) => {
      if (!editorRef() || isServer) return
      if (editorRef()!.innerHTML !== newContent) {
        console.log('[SimpleRichEditor] Syncing editor innerHTML with content signal')
        saveSelection()
        editorRef()!.innerHTML = newContent
        restoreSelection()
        updatePlaceholderState()
      }
    })
  )

  // Воркэраунд для Lightning CSS: отслеживаем выделение через класс
  createEffect(() => {
    if (isServer) return

    const updateSelectionState = () => {
      const selection = window.getSelection()
      const editor = editorRef()

      if (!selection || !editor) {
        setHasSelection(false)
        return
      }

      // Проверяем есть ли выделение и оно не пустое
      const hasActiveSelection =
        !selection.isCollapsed && selection.toString().trim().length > 0 && editor.contains(selection.anchorNode)

      setHasSelection(hasActiveSelection)
    }

    const handleSelectionChange = () => updateSelectionState()

    // Добавляем слушатель изменений выделения
    document.addEventListener('selectionchange', handleSelectionChange)

    // Также проверяем при изменении фокуса
    const editor = editorRef()
    if (editor) {
      editor.addEventListener('mouseup', updateSelectionState)
      editor.addEventListener('keyup', updateSelectionState)
    }

    onCleanup(() => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (editor) {
        editor.removeEventListener('mouseup', updateSelectionState)
        editor.removeEventListener('keyup', updateSelectionState)
      }
    })
  })

  // --- Core Logic --- Needed before event handlers

  /**
   * Получает HTML содержимое из редактора
   * @param editor DOM элемент редактора
   * @returns Очищенный HTML
   */
  const getHTML = (editor: HTMLElement): string => {
    const rawContent = editor.innerHTML || ''
    const contentHtml = cleanupJsonContent(rawContent)

    if (contentHtml !== content()) {
      setContent(contentHtml)
    }

    return contentHtml
  }

  /**
   * Основной обработчик изменений. Обновляет сигнал `content`,
   * сохраняет локально, проверяет placeholder и уведомляет родителя.
   */
  const handleChange = (fieldName?: string) => {
    const editor = editorRef()
    if (!editor) return

    updatePlaceholderState()

    const contentHtml = getHTML(editor)
    const editorIsEmpty = isEditorEmpty()

    // Обновляем UI состояние если редактор пуст
    if (editorIsEmpty) {
      editor.classList.add('show-placeholder-on-new-line')
    } else {
      editor.classList.remove('show-placeholder-on-new-line')
    }

    const plainText = editor.innerText || ''
    const currentSelectionInfo = selectionInfo() // Get latest from hook

    const editorData: EditorData = {
      content: contentHtml,
      plainText: plainText,
      length: plainText.length,
      isEmpty: editorIsEmpty,
      selection: {
        text: currentSelectionInfo.text,
        isEmpty: currentSelectionInfo.isEmpty,
        position: cursorPosition() || undefined
      }
    }

    if (props.editorId) {
      // Используем тип поля из пропсов, если он передан
      const actualFieldName = fieldName || (props.fieldType ? String(props.fieldType) : 'content')
      saveEditorContent(props.editorId, actualFieldName as EditorFieldType, contentHtml, editorIsEmpty)
    }

    props.onChange(editorData)
  }

  // Debounced version for input events
  const debouncedHandleAfterFormat = debounce(150, () =>
    handleChange(props.fieldType ? String(props.fieldType) : 'content')
  )

  // --- Event Handlers ---
  const handleInput = (_e: InputEvent) => {
    // Call the debounced version after input
    debouncedHandleAfterFormat()
  }

  const handleFocus = () => {
    setHasFocus(true)

    // Показываем тулбары для режимов top и bottom
    const toolbar = props.toolbar || 'float'
    if (toolbar === 'top' || toolbar === 'bottom') {
      const selector = toolbar === 'top' ? styles.topToolbar : styles.bottomToolbar
      const toolbarElement = document.querySelector(`.${selector}[data-editor-id="${props.editorId}"]`)
      if (toolbarElement) {
        toolbarElement.classList.add(styles.visible)
      }
    }

    const editor = editorRef()
    if (editor) {
      const editorIsEmpty = isEmptyContent(editor.innerHTML)
      updatePlaceholderState()
      if (isCursorOnEmptyLine() && !editorIsEmpty) {
        editor.classList.add('show-placeholder-on-new-line')
      } else {
        editor.classList.remove('show-placeholder-on-new-line')
      }
    }

    // 2. Set initial focus flag
    if (!isInitialFocusDone()) {
      setIsInitialFocusDone(true)
    }

    if (props.onFocus) props.onFocus()
  }

  const handleBlur = (e: FocusEvent) => {
    // Проверяем, что клик не был внутри тулбара
    if (isClickInsideToolbar(e)) return

    setHasFocus(false)

    const editor = editorRef()
    if (editor?.contains(e.relatedTarget as Node)) return // Focus moved within editor/toolbar

    if (editor) {
      updatePlaceholderState()
      editor.classList.remove('show-placeholder-on-new-line')
    }
    blurTimerRef = window.setTimeout(() => {
      blurTimerRef = 0
    }, blurTimeout)
    if (props.onBlur) props.onBlur()
  }

  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text')
    if (!text && !html) return

    saveSelection()
    let pasted = false
    if (html) {
      console.log('Pasting HTML')
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      tempDiv.querySelectorAll('i').forEach((tag) => {
        /* normalize */ const em = document.createElement('em')
        while (tag.firstChild) em.appendChild(tag.firstChild)
        Array.from(tag.attributes).forEach((attr) => {
          em.setAttribute(attr.name, attr.value)
        })
        tag.parentNode?.replaceChild(em, tag)
      })
      tempDiv.querySelectorAll('b').forEach((tag) => {
        /* normalize */ const strong = document.createElement('strong')
        while (tag.firstChild) strong.appendChild(tag.firstChild)
        Array.from(tag.attributes).forEach((attr) => {
          strong.setAttribute(attr.name, attr.value)
        })
        tag.parentNode?.replaceChild(strong, tag)
      })
      tempDiv.querySelectorAll('em:empty, strong:empty, i:empty, b:empty, span:empty').forEach((tag) => {
        if (!tag.textContent || tag.textContent === '\u200B') tag.remove()
      })
      const cleanHtml = tempDiv.innerHTML
      if (restoreSelection()) {
        pasted = replaceSelection(cleanHtml, editorRef() || null)
      }
    }

    if (!pasted && text) {
      console.log('Pasting TEXT')
      if (restoreSelection()) {
        handleContentPaste(text, {
          insertText: (textToInsert) => {
            const selection = window.getSelection()
            if (!selection || !selection.rangeCount) return false
            const range = selection.getRangeAt(0)
            const textNode = document.createTextNode(textToInsert)
            range.deleteContents()
            range.insertNode(textNode)
            range.setStartAfter(textNode) // Move cursor after inserted text
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
            return true
          },
          insertHtml: (htmlToInsert) => {
            return replaceSelection(htmlToInsert, editorRef() || null)
          }
        })
        pasted = true
      }
    }

    if (pasted) {
      handleChange(props.fieldType ? String(props.fieldType) : 'content') // Update state after successful paste
    }
  }

  const handleDropFiles = async (e: DragEvent) => {
    e.preventDefault()
    if (!editorRef() || props.readOnly) return

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) return

    console.log('[SimpleRichEditor] Dropped files:', files)
    saveSelection() // Save selection before inserting content

    // Example: Handle image uploads
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length > 0) {
      console.warn('Dropped image handling needs implementation via upload modal or direct upload.')
      // showImageUploadModal(imageFiles); // Hypothetical
    }

    // Example: Insert other files
    const otherFiles = files.filter((f) => !f.type.startsWith('image/'))
    let insertedHtml = false
    if (otherFiles.length > 0 && restoreSelection()) {
      let htmlToInsert = ''
      for (const file of otherFiles) {
        htmlToInsert += `<p>Dropped file: ${file.name}</p>`
      }
      if (htmlToInsert) {
        insertedHtml = replaceSelection(htmlToInsert, editorRef() || null)
      }
    }

    if (insertedHtml) {
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    } else {
      restoreSelection()
    }
    editorRef()?.focus()
  }

  const handleContentClick = (e: MouseEvent) => {
    if (isServer || !editorRef() || props.readOnly) return
    const target = e.target as HTMLElement

    // Обработка клика по ссылке
    if (target.tagName === 'A' || target.closest('a')) {
      e.preventDefault() // Предотвращаем переход по ссылке внутри редактора
      const link = target.tagName === 'A' ? target : target.closest('a')

      // Если это внутренняя ссылка на сноску
      /* if (link?.getAttribute('data-footnote')) {
        const footnoteId = link?.getAttribute('data-footnote')
        if (!footnoteId) return
        if (!editorRef()) return
        const footnote = getFootnoteById(editorRef()!, footnoteId)
        if (footnote) {
          openFootnoteEditor(footnote.marker as HTMLElement)
        }
        return
      } */

      // Для обычных ссылок - показываем форму редактирования
      const href = link?.getAttribute('href') || ''

      // Выделяем ссылку для правильного редактирования
      if (link) {
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()
          range.selectNodeContents(link)
          selection.removeAllRanges()
          selection.addRange(range)
          // Сохраняем выделение для последующего применения изменений
          saveSelection()
        }
      }

      // Показываем форму с текущим URL ссылки
      showInlineForm('link', (url) => handleInsertLink(url), href)
      return
    }

    // Обработка клика по изображению
    if (target.tagName === 'IMG') {
      e.preventDefault()
      setEditingImage(target)
      showImageUploadModal()
      return
    }

    // Custom <tooltip> clicks are regular links/content; no separate editor

    // Обработка клика по врезке (squib)
    if (target.closest('[data-type="squib"]')) {
      e.preventDefault()
      const squib = target.closest('[data-type="squib"]')
      if (squib) {
        setCurrentSquib(squib as HTMLElement)
        setShowSquibEditor(true)
      }
      return
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.includes('Mac')
    const cmdKey = isMac ? e.metaKey : e.ctrlKey

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setTimeout(trackSelectionAndCursor, 0)
      return // Don't process further for simple navigation
    }

    // Formatting shortcuts
    if (cmdKey && !e.shiftKey && !e.altKey) {
      const shortcuts: { [key: string]: CommandType } = {
        b: 'bold',
        i: 'italic',
        k: 'link',
        '1': 'h1',
        '2': 'h2',
        '3': 'h3',
        q: 'blockquote'
      }
      if (shortcuts[e.key]) {
        e.preventDefault()
        handleAction(shortcuts[e.key])
        return
      }
    }

    // Draft navigation
    if (e.key === 'Tab' && props.fieldType && props.editorId?.startsWith('draft-')) {
      e.preventDefault()
      const currentField = props.fieldType
      let prevField: EditorFieldType | null = null
      let nextField: EditorFieldType | null = null
      if (currentField === 'title') {
        nextField = 'lead'
      } else if (currentField === 'lead') {
        prevField = 'title'
        nextField = 'body'
      } else if (currentField === 'body') {
        prevField = 'lead'
      }
      if (e.shiftKey && prevField) handleNavigation(prevField)
      else if (!e.shiftKey && nextField) handleNavigation(nextField)
      return
    }

    // Shift+Enter for <br> in specific fields
    if (e.shiftKey && e.key === 'Enter') {
      if (props.fieldType === 'lead') {
        e.preventDefault()
        if (restoreSelection()) {
          // Ensure selection is valid
          replaceSelection('<br>', editorRef() || null) // Use replaceSelection for consistency
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        return
      }
      // Allow default Shift+Enter in body (will create new paragraph)
      setTimeout(handleChange, 0) // Update state after default action
      return
    }

    // Enter key handling
    if (e.key === 'Enter') {
      // Navigate on Cmd/Ctrl+Enter in lead/description
      if (props.fieldType === 'lead' && cmdKey) {
        e.preventDefault()
        const nextField = 'body'
        handleNavigation(nextField)
        return
      }
      // Insert <br> on Enter in lead/description
      if (props.fieldType === 'lead') {
        e.preventDefault()
        if (restoreSelection()) {
          replaceSelection('<br>', editorRef() || null)
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        return
      }

      // Body field: Handle block element exit/split
      if (props.fieldType === 'body') {
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return
        const range = selection.getRangeAt(0)
        const container = range.startContainer
        const editorRoot = editorRef()
        if (!editorRoot) return

        const blockElement = (
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container instanceof Element
              ? container
              : null
        )?.closest('blockquote, h1, h2, h3, ul, ol, div[data-type]')

        if (blockElement && editorRoot.contains(blockElement)) {
          const isEmptyBlock =
            blockElement.textContent?.trim() === '' ||
            blockElement.innerHTML === '<br>' ||
            blockElement.innerHTML === ''

          // Check if cursor is effectively at the end of the block content
          const isAtEndOfBlock = (() => {
            if (!range.collapsed) return false
            let node: Node | null = range.startContainer
            let offset = range.startOffset
            // Traverse up until the block element or editor root
            while (node && node !== blockElement && node !== editorRoot) {
              // Check if there are non-empty sibling nodes after the current position
              while (node.nextSibling) {
                node = node.nextSibling
                if (node.textContent?.trim() !== '') return false // Content after cursor in this block
              }
              // Move to parent and check from its position
              const parent: Node | null = node.parentNode
              if (!parent || parent === editorRoot) {
                node = parent
                break
              }
              // Ensure node is not null before accessing parentNode
              if (!node) break

              // Find the index of the original node within its parent
              const childIndex = Array.from(parent.childNodes).indexOf(node as ChildNode)

              if (parent) {
                // Check parent is not null before assignment
                node = parent // Move up
              } else {
                break // Should not happen if parent was checked above, but safer
              }

              offset = childIndex + 1
              // container = node; // Update container only if needed? Check usage below
            }
            // Check if we ended up at the block element and the effective offset is at the end
            return node === blockElement && offset === node.childNodes.length
          })()

          if (isEmptyBlock || isAtEndOfBlock) {
            e.preventDefault()
            // Exit block: Create new paragraph after
            const p = document.createElement('p')
            p.innerHTML = '<br>'
            // Безопасная проверка перед insertBefore для избежания NotFoundError
            if (blockElement.parentNode && blockElement.nextSibling && blockElement.parentNode.contains(blockElement)) {
              blockElement.parentNode.insertBefore(p, blockElement.nextSibling)
            } else {
              console.warn('[SimpleRichEditor] Cannot safely insert element: parent or sibling not found')
              return
            }

            // Move cursor to new paragraph
            range.selectNodeContents(p)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
            handleChange(props.fieldType ? String(props.fieldType) : 'content')
            return
          }
          // If not empty and not at end, let default Enter split the block (like a list item)
          // But we need to update state after the browser handles it
          setTimeout(handleChange, 0)
          return
        }

        // Default Enter behavior (creates new paragraph in contentEditable)
        // Update state after browser handles Enter
        setTimeout(handleChange, 0)
        return // Prevent further processing if Enter was handled
      }
    }

    // Backspace/Delete key handling for block elements
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount || !editorRef() || !selection.isCollapsed) {
        // If not collapsed, let default backspace/delete handle selection removal
        setTimeout(handleChange, 0) // Update state after default action
        return
      }

      const range = selection.getRangeAt(0)
      const editor = editorRef()!
      const container = range.startContainer

      // Check if cursor is at the start of a block element for Backspace
      if (e.key === 'Backspace' && range.startOffset === 0) {
        const blockElement = (
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container instanceof Element
              ? container
              : null
        )?.closest('blockquote, h1, h2, h3, ul, ol, div[data-type]')

        // Check if the block is the first element OR if the cursor is truly at the beginning of the block
        if (blockElement && editor.contains(blockElement)) {
          let isAtVeryStart = false
          if (
            container === blockElement ||
            (container.nodeType === Node.TEXT_NODE && container.parentElement === blockElement)
          ) {
            isAtVeryStart = true
          } else {
            // Check if there's any content before the cursor within the block
            const tempRange = document.createRange()
            tempRange.setStart(blockElement, 0)
            tempRange.setEnd(range.startContainer, range.startOffset)
            if (tempRange.toString().trim() === '') {
              isAtVeryStart = true
            }
          }

          if (isAtVeryStart) {
            e.preventDefault()
            // Pass a minimal SelectionState object with position
            const currentSelection = window.getSelection()
            const currentRange = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null
            applyFormatting('p', {
              range: currentRange,
              text: currentSelection?.toString() || '',
              isEmpty: !currentSelection || currentSelection.isCollapsed,
              position: { top: 0, left: 0 }
            })
            handleChange(props.fieldType ? String(props.fieldType) : 'content')
            return
          }
        }
      }

      // Let default Backspace/Delete handle other cases (removing text, merging paragraphs)
      // Update state after browser action
      setTimeout(handleChange, 0)
      return // Prevent further processing if handled
    }

    // If key wasn't handled above, let default behavior occur, but update state after timeout
    // This catches things like typing characters, etc.
    // setTimeout(handleChange, 0); // Potentially redundant with handleInput? handleInput covers typing.
  }

  const handleAction = (action: CommandType | CommandGroupType) => {
    // Не обрабатываем группы команд напрямую
    if (isGroup(action)) return

    const command = action as CommandType
    const editor = editorRef()

    // Убедимся, что есть редактор
    if (!editor) {
      console.warn('[handleAction] No editor found')
      return
    }

    // Восстанавливаем выделение (если есть)
    restoreSelection()
    const activeSelection = window.getSelection()
    if (!activeSelection || activeSelection.rangeCount === 0) {
      console.warn('[handleAction] Selection could not be restored or is invalid')
      // В некоторых случаях можно продолжить без выделения (например, применить блок к пустой строке)
      // Но для безопасности пока выйдем
      return
    }

    const state: SelectionState = {
      range: activeSelection.getRangeAt(0),
      text: activeSelection.toString(),
      isEmpty: activeSelection.isCollapsed,
      position: cursorPosition() || { top: 0, left: 0 }
    }

    // Сохраняем выделение перед модификацией
    saveSelection()

    // --- Специальная обработка для ссылок, медиа, сносок ---
    if (['link', 'image', 'video', 'audio'].includes(command)) {
      if (command === 'link') {
        const linkElement = findLinkAncestor(activeSelection.anchorNode)
        const initialUrl = linkElement ? linkElement.getAttribute('href') || '' : ''
        showInlineForm('link', handleInsertLink, initialUrl)
        return
      }
      if (command === 'video') {
        showInlineForm('video', handleInsertVideo, '')
        return
      }
      if (command === 'image') {
        showImageUploadModal()
        return
      }
      if (command === 'audio') {
        showAudioUploader()
        return
      }
      // footnote command removed
    } else {
      // --- Унифицированная обработка форматирования ---
      console.log(`[handleAction] Processing command: ${command}`)

      // Используем универсальный обработчик форматирования
      const result = toggleFormatting(command, state, editor)

      if (!result.success) {
        console.error(`[handleAction] Error processing command ${command}:`, result.error)
      }
    }

    // --- Финальное обновление состояния ---
    // Реализуем трехэтапное обновление UI для большей надежности

    // 1. Фокус обратно на редактор
    editor.focus()

    // 2. Обновление данных редактора
    handleChange(props.fieldType ? String(props.fieldType) : 'content')

    // 3. С задержкой отслеживаем активное форматирование, когда DOM обновился
    setTimeout(() => {
      // Проверяем, какое форматирование сейчас активно
      console.log('[handleAction] Updating active formats after DOM update')
      trackSelectionAndCursor()
      const currentFormats = activeFormats()
      console.log('[handleAction] Current formats after update:', currentFormats)

      // Скрываем все активные меню/формы
      setShowForm(null)
      setShowSquibEditor(false)
    }, 300) // Увеличиваем задержку до 300 мс для надежной синхронизации с DOM
  }

  // --- Form Handling ---
  const showInlineForm = (type: FormType, onSubmit: (value: string) => void, initialValue?: string) => {
    if (!type) return

    // Получаем текущую позицию курсора для точного позиционирования формы
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      // Устанавливаем позицию формы относительно курсора
      setFormPosition({
        top: rect.bottom + window.scrollY + 5, // 5px отступ от курсора
        left: rect.left + window.scrollX
      })
    } else {
      // Запасной вариант, если нет выделения
      const cursorPos = cursorPosition()
      if (cursorPos) {
        setFormPosition({
          top: cursorPos.top + window.scrollY + 5,
          left: cursorPos.left + window.scrollX
        })
      } else {
        // Если нет информации о курсоре, используем центр редактора
        const editorRect = editorRef()?.getBoundingClientRect()
        if (editorRect) {
          setFormPosition({
            top: editorRect.top + window.scrollY + editorRect.height / 2,
            left: editorRect.left + window.scrollX + editorRect.width / 2
          })
        }
      }
    }

    // Если initialValue передан явно, используем его
    if (initialValue !== undefined) {
      console.log('[SimpleRichEditor] Using provided initial value for form:', initialValue)
      setFormInitialValue(initialValue)
    } else {
      // Иначе пытаемся определить текущий URL из выделенной ссылки
      const currentLink = findLinkAncestor(window.getSelection()?.focusNode ?? null)
      const linkUrl = currentLink?.getAttribute('href') || ''
      console.log('[SimpleRichEditor] Using detected link URL:', linkUrl)
      setFormInitialValue(linkUrl)
    }

    // Показываем форму нужного типа
    setShowForm(type)

    // Устанавливаем опции формы
    editorFormOptions = {
      onSubmit,
      validate: type === 'video' ? (url: string) => validateVideoUrl(url) : (url: string) => validateWebUrl(url)
    }
  }

  const handleInlineFormSubmit = (type: FormType, url: string) => {
    setShowForm(null)
    if (restoreSelection()) {
      if (type === 'link') {
        const currentSelection = window.getSelection()
        const currentRange = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null

        if (url === '') {
          // If URL is cleared, remove the link// Using 1 argument for removeFormatting, expecting error or optional arg
          removeFormatting('link', {
            range: currentRange,
            text: currentSelection?.toString() || '',
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          })
        } else if (validateUrl(url)) {
          const caption = currentSelection?.toString() || ''
          // Using 2 arguments for link with URL, expecting error or special handling
          applyFormatting('link', {
            range: currentRange,
            text: `<a href="${url}">${caption}</a>`,
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          })
        } else {
          console.warn('Invalid URL for link:', url)
        }
      } else if (type === 'video' && validateVideoUrl(url)) {
        const platform = detectVideoPlatform(url)
        if (platform) {
          const embedHtml = createVideoEmbed(url, platform)
          replaceSelection(embedHtml, editorRef() || null)
        }
      } else {
        console.warn(`Invalid URL for ${type}:`, url)
      }
      handleChange(props.fieldType ? String(props.fieldType) : 'content') // Update state after potential change
      editorRef()?.focus()
    } else {
      console.warn('Could not restore selection for inline form submission.')
      editorRef()?.focus()
    }
  }

  const handleInsertLink = (url: string) => handleInlineFormSubmit('link', url)
  const handleInsertVideo = (url: string) => handleInlineFormSubmit('video', url)

  // --- Media Handling ---
  const handleAudioUpload = (audioItems: MediaItem[]) => {
    saveSelection()
    if (handleAudioUploaderResult(audioItems, editorRef() || null)) {
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    }
    editorRef()?.focus()
    restoreSelection()
    hideModal()
  }

  const showAudioUploader = () => {
    saveSelection()
    let dispose: () => void
    createRoot((dispose_: () => void) => {
      dispose = dispose_
      const [isOpen, setIsOpen] = createSignal(true)
      const handleClose = () => {
        setIsOpen(false)
        restoreSelection()
        setTimeout(dispose, 300)
      }
      return (
        <Portal>
          <div class="modal" style={{ display: isOpen() ? 'flex' : 'none' }}>
            <div class="modal-backdrop" onClick={handleClose} />
            <div class="modal-content">
              <AudioUploader audio={[]} onAudioAdd={handleAudioUpload} onAudioChange={noop} onAudioSorted={noop} />
            </div>
          </div>
        </Portal>
      )
    })
  }

  const handleUploadSuccess = (uploadedFile?: UploadedFile) => {
    if (!uploadedFile) return
    const currentImage = editingImage()
    if (currentImage) {
      // @ts-expect-error - Linter error seems incorrect for simple property assignment
      ;(currentImage as HTMLImageElement).src = uploadedFile.url(currentImage as HTMLImageElement).alt =
        uploadedFile.originalFilename || 'Uploaded image'
      setEditingImage(null)
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    } else if (restoreSelection()) {
      replaceSelection(
        `<img src="${uploadedFile.url}" alt="${uploadedFile.originalFilename || 'Uploaded image'}" />`,
        editorRef() || null
      )
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    }
    hideModal()
    editorRef()?.focus()
  }

  const showImageUploadModal = () => {
    saveSelection()
    showModal(MODALS.uploadImage)
    // @ts-expect-error
    window.__imageUploadParams = {
      onSuccess: handleUploadSuccess,
      onCancel: () => {
        hideModal()
        editorRef()?.focus()
        restoreSelection()
      }
    }
  }

  // Footnote handling removed

  // This manual update might conflict with the createMemo above. Let's rely on the memo.
  // const updateFootnotes = (footnotes: Array<{ id: string; content: string; marker: Element }>) => {
  //   const footnotesObject: Record<string, string> = {}
  //   footnotes.forEach(({ id, content }) => {
  //     footnotesObject[id] = content
  //   })
  //   setStateDocumentFootnotes(footnotesObject)
  // }

  // Effect no longer needed if getFootnotesArray is a memo depending on content()
  // createEffect(
  //   on(content, () => {
  //     if (editorRef()) {
  //       updateFootnotes(getAllFootnotes(editorRef()!))
  //     }
  //   })
  // )

  // openFootnoteEditor removed

  // handleFootnoteSubmit removed

  // --- Draft Navigation ---
  const switchFieldInDraft = (nextField: EditorFieldType, editorId?: string, fieldType?: EditorFieldType) => {
    if (!editorId || !fieldType) return false
    const draftIdMatch = editorId.match(DRAFT_REGEX)
    if (!draftIdMatch) return false
    const draftId = draftIdMatch[1]
    const nextEditorId = `draft-${draftId}-${nextField}`
    const nextEditor = document.querySelector(`[data-editor-id="${nextEditorId}"]`) as HTMLElement | null
    if (nextEditor) {
      nextEditor.focus()
      nextEditor.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
    return false
  }

  const handleNavigation = (nextField: EditorFieldType) => {
    return switchFieldInDraft(nextField, props.editorId, props.fieldType)
  }

  // --- Initialization ---
  const initEditor = (element: HTMLDivElement) => {
    if (!element) return
    setEditorRef(element)
    // Content set via effect on props.content
    if (props.placeholder) element.setAttribute('data-placeholder', props.placeholder)
    if (props.fieldType) element.setAttribute('data-field-type', props.fieldType)
    if (props.editorId) element.setAttribute('data-editor-id', props.editorId)
    updatePlaceholderState() // Initial check

    if (props.autofocus) {
      element.focus()
      const selection = window.getSelection()
      if (selection && element.childNodes.length > 0) {
        const range = document.createRange()
        const lastChild = element.lastChild
        if (lastChild) {
          try {
            if (lastChild.nodeType === Node.TEXT_NODE) {
              range.setStart(lastChild, lastChild.textContent?.length ?? 0)
            } else {
              range.selectNodeContents(lastChild)
              range.collapse(false)
            }
            selection.removeAllRanges()
            selection.addRange(range)
          } catch (err) {
            console.warn('Error setting cursor to end:', err)
            try {
              range.selectNodeContents(element)
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
            } catch (fallbackErr) {
              console.error('Fallback cursor positioning failed:', fallbackErr)
            }
          }
        }
      }
    }
    if (props.onInit) props.onInit({ editor: element })
    onCleanup(() => {
      clearTimeout(blurTimerRef) /* remove specific listeners if any */
    })
  }

  onMount(() => {
    const editor = editorRef()
    if (!editor) return

    let mouseX = 0
    let mouseY = 0

    // Отслеживаем позицию мыши для более точного позиционирования
    const trackMousePosition = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    // Обработчик для отслеживания выделения текста
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const hasValidSelection =
        selection && selection.rangeCount > 0 && !selection.isCollapsed && selection.toString().trim() !== ''

      // Проверяем, есть ли выделение внутри нашего редактора
      const isSelectionInEditor = hasValidSelection && editor.contains(selection?.getRangeAt(0).commonAncestorContainer)

      // Находим тулбар с режимом float
      const floatToolbar = document.querySelector(`.${styles.floatingToolbar}[data-editor-id="${props.editorId}"]`)

      if (floatToolbar && floatToolbar instanceof HTMLElement) {
        if (isSelectionInEditor) {
          // Используем более простой способ позиционирования
          // Показываем тулбар прямо над выделением текста или над курсором мыши
          const range = selection?.getRangeAt(0)
          const rect = range?.getBoundingClientRect()

          if (rect) {
            // Используем координаты выделения
            floatToolbar.style.position = 'fixed'
            floatToolbar.style.top = `${Math.max(10, rect.top - 40)}px`
            floatToolbar.style.left = `${rect.left + rect.width / 2}px`
            floatToolbar.classList.add(styles.visible)
          } else if (mouseX > 0 && mouseY > 0) {
            // Запасной вариант - используем позицию мыши
            floatToolbar.style.position = 'fixed'
            floatToolbar.style.top = `${Math.max(10, mouseY - 40)}px`
            floatToolbar.style.left = `${mouseX}px`
            floatToolbar.classList.add(styles.visible)
          }
        } else {
          floatToolbar.classList.remove(styles.visible)
        }
      }
    }

    // Добавляем обработчики событий
    document.addEventListener('mousemove', trackMousePosition)
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleSelectionChange)

    onCleanup(() => {
      document.removeEventListener('mousemove', trackMousePosition)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleSelectionChange)
    })
  })

  // --- Render ---
  // 3. Create memo for displayed commands
  const displayedCommands = createMemo(() => {
    // Change field check to 'title'
    const isTitleField = props.fieldType === 'title'
    const isFirstFocus = !isInitialFocusDone()

    if (isTitleField && isFirstFocus) {
      // Commands shown only on the first focus of the title field
      return ['link', 'h2', 'h3'] as (CommandType | CommandGroupType | '')[]
    } else {
      // Otherwise, show all commands passed in props
      return props.commands as (CommandType | CommandGroupType | '')[]
    }
  })

  return (
    <div class={clsx(styles.editorWrapper)} data-field-type={props.fieldType}>
      {/* Toolbars */}
      <Show when={currentToolbarMode() === 'top'}>
        <SimpleToolbar
          commands={displayedCommands()}
          onAction={handleAction}
          currentFormats={activeFormats()}
          class={clsx(styles.topToolbar, styles.visible)}
          mode={currentToolbarMode() as ToolbarMode}
          editorId={props.editorId}
        />
      </Show>

      {/* Переключатель локальной версии */}
      <Show when={showLocalVersionLink()}>
        <div class={styles.localVersionSwitcher}>
          <button
            onClick={loadLocalVersion}
            class={styles.switcherBtn}
            title={t('You have a newer local version, click to use it')}
          >
            <span class={styles.switcherIcon}>
              <svg
                class="no-transition"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 2V8L11 11"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </span>
            {t('Use local version')}
          </button>
          <button
            onClick={handleClearLocalVersion}
            class={clsx(styles.switcherBtn, styles.clearBtn)}
            title={t('Delete local version')}
          >
            <span class={styles.switcherIcon}>
              <svg
                class="no-transition"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </span>
          </button>
        </div>
      </Show>

      {/* Footnote editor removed */}

      {/* Inline Forms */}
      <Show when={showForm() === 'link'}>
        <div
          class={styles.inlineFormWrapper}
          style={{ top: `${formPosition()?.top || 0}px`, left: `${formPosition()?.left || 0}px` }}
        >
          <InlineForm
            placeholder={t('Enter URL')}
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
          style={{ top: `${formPosition()?.top || 0}px`, left: `${formPosition()?.left || 0}px` }}
        >
          <InlineForm
            placeholder={t('Enter video URL (YouTube, Vimeo)')}
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

      {/* Plus Menu */}
      <Show when={shouldShowPlusMenu()}>
        <PlusMenu
          onAction={(action) => {
            handlePlusMenuAction(action, editorRef()!, {
              showLinkForm: () => showInlineForm('link', handleInsertLink),
              showVideoForm: () => showInlineForm('video', handleInsertVideo, ''),
              showImageUploadModal,
              showAudioUploader,
              handleChange
            })
          }}
          position={getPlusMenuPosition()}
          isVisible={!showForm() && !showSquibEditor() && hasFocus() && isCursorOnEmptyLine()}
          editorId={props.editorId}
        />
      </Show>

      {/* Editor Content */}
      <div
        class={clsx(styles.editor, {
          [styles.empty]: isEditorEmpty(),
          [styles.withTopToolbar]: currentToolbarMode() === 'top',
          [styles.withBottomToolbar]: currentToolbarMode() === 'bottom',
          [styles.focused]: hasFocus(),
          [styles.hasSelection]: hasSelection()
        })}
        data-editor-id={props.editorId}
        data-field-type={props.fieldType}
      >
        <div
          ref={initEditor}
          class={clsx(styles.content, {
            [styles['placeholder-visible']]: shouldShowPlaceholderState()
          })}
          contentEditable={!props.readOnly}
          data-placeholder={props.placeholder}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onDrop={handleDropFiles}
          onClick={handleContentClick}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Other UI Elements */}
      <Show when={currentToolbarMode() === 'bottom'}>
        <SimpleToolbar
          commands={displayedCommands()}
          onAction={handleAction}
          currentFormats={activeFormats()}
          class={clsx(styles.bottomToolbar, {
            [styles.visible]: hasFocus() && !isEditorEmpty()
          })}
          mode={currentToolbarMode() as ToolbarMode}
          editorId={props.editorId}
        />
      </Show>
      <Show when={currentToolbarMode() === 'float'}>
        <SimpleToolbar
          commands={displayedCommands()}
          onAction={handleAction}
          currentFormats={activeFormats()}
          class={clsx(styles.floatingToolbar, hasSelection() && styles.visible)}
          position={getFloatingToolbarPosition()}
          mode={currentToolbarMode() as ToolbarMode}
          editorId={props.editorId}
        />
      </Show>
      <Show when={showSquibEditor() && currentSquib()}>
        <SquibMenu
          commands={props.commands as CommandType[]}
          currentFormats={activeFormats()}
          isVisible={true}
          onAction={(action) => {
            const squibElement = currentSquib()
            if (squibElement && handleSquibFormatting(action as string)) {
              handleChange(props.fieldType ? String(props.fieldType) : 'content')
              editorRef()?.focus()
            }
          }}
          onClose={() => {
            setShowSquibEditor(false)
            setCurrentSquib(null)
          }}
          position={{ top: 50, left: 50 } as Position}
        />
      </Show>

      {/* Forms and Modal Portals */}
      <Portal mount={document.body}>
        <Show when={showForm() !== null}>
          <InlineForm
            onBlur={(e: FocusEvent) => {
              if (isClickInsideToolbar(e)) return
              setShowForm(null)
              editorRef()?.focus()
            }}
            onClose={() => setShowForm(null)}
            onSubmit={(value) => handleInlineFormSubmit(showForm()!, value)}
            initialValue={formInitialValue()}
            placeholder={showForm() === 'video' ? t('Enter video URL (YouTube, Vimeo)') : t('Enter URL')}
          />
        </Show>
      </Portal>
    </div>
  )
}
