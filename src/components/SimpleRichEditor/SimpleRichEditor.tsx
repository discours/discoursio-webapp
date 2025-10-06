import { clsx } from 'clsx'
import { Component, createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { InlineForm } from '~/components/_shared/InlineForm/InlineForm'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { executeCommand, type FormatContext } from './format/common'
import { createEventHandlers } from './handlers/events'
import { createFormHandlers } from './handlers/forms'
import { createKeyboardHandlers } from './handlers/keyboard'
import { createUIHelpers } from './handlers/ui'
import { isEmptyContent } from './lib/empty'
import {
  createSelectionState as createSelectionStateUtil,
  findBlockAncestor,
  findLinkAncestor as findLinkAncestorUtil,
  logSelectionDetails,
  useSelection,
  validateSelection
} from './lib/selection'
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
import { afterDOMUpdate, afterToolbarUpdate } from './lib/timing'
import {
  CommandGroupType,
  CommandType,
  EditorData,
  EditorFieldType,
  FormType,
  Position,
  ToolbarMode
} from './lib/types'
import { createMediaHandlers, initEmbedLoaders } from './media'
import { useDropFiles } from './media/upload'
import { isGroup } from './menu/config'
import { switchFieldInDraft } from './menu/helpers'
import { IncutMenu } from './menu/IncutMenu'
import { handleIncutFormatting, handlePlusMenuAction, PlusMenu } from './menu/PlusMenu'
import { SimpleToolbar } from './menu/SimpleToolbar'
import styles from './SimpleRichEditor.module.scss'

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

// Для хранения опций форм между вызовами - перенесено в handlers/forms.ts

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
  const [localVersion, setLocalVersion] = createSignal()

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

  const { handleDropFiles: handleDropFilesHook } = useDropFiles()

  // Local state signals (ensure all needed are here and only defined once)
  const [showIncutEditor, setShowIncutEditor] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)
  const [showForm, setShowForm] = createSignal<FormType>(null)
  const [formPosition, setFormPosition] = createSignal<Position | null>(null)
  const [formInitialValue, setFormInitialValue] = createSignal('')
  const [currentIncut, setCurrentIncut] = createSignal<HTMLElement | null>(null)
  const [editingImage, setEditingImage] = createSignal<HTMLElement | null>(null)
  const [showLocalVersionLink, setShowLocalVersionLink] = createSignal(false)
  const [isInitialFocusDone, setIsInitialFocusDone] = createSignal(false)
  const [hasSelection, setHasSelection] = createSignal(false)

  // ✅ Сигнал видимости Plus-меню
  const [shouldShowPlusMenu, setShouldShowPlusMenu] = createSignal(false)

  // Реактивная позиция Plus-меню
  const [plusMenuTop, setPlusMenuTop] = createSignal<number>(0)

  // Позиция меню подвёрстки
  const [incutMenuPosition, setIncutMenuPosition] = createSignal<Position>({ top: 50, left: 50 })

  // Функция для вычисления позиции меню подвёрстки (по центру редактора, над блоком)
  const calculateIncutMenuPosition = (incutElement: HTMLElement): Position => {
    const rect = incutElement.getBoundingClientRect()
    const editorRect = editorRef()?.getBoundingClientRect()

    if (!editorRect) {
      return { top: 50, left: 50 }
    }

    // Позиционируем меню по центру РЕДАКТОРА (не блока), над блоком подвёрстки
    // Поднимаем тулбар выше на полстроки дополнительно к transform: translate(-50%, -100%)
    return {
      top: rect.top - editorRect.top - 24, // Выше верхней границы блока (дополнительная полстроки)
      left: editorRect.width / 2 // Центр редактора по горизонтали
    }
  }

  let blurTimerRef = 0
  const blurTimeout = 150

  // Применяем очистку к входящему контенту
  const initialContent = cleanupJsonContent(props.content)

  // Base state for content
  const [content, setContent] = createSignal(initialContent || '')

  // Флаг для предотвращения циклических обновлений innerHTML
  // Когда true - изменение content пришло изнутри редактора, не нужно обновлять innerHTML
  const [isInternalUpdate, setIsInternalUpdate] = createSignal(false)

  // Create UI helpers
  const uiHelpers = createUIHelpers({
    editorRef,
    props,
    hasFocus,
    showForm,
    showIncutEditor,
    hasSelection,
    content,
    cursorPosition
  })

  // Create event handlers
  const eventHandlers = createEventHandlers({
    editorRef,
    props,
    setContent,
    setHasFocus,
    ...uiHelpers, // Spread UI helpers instead of duplicating
    saveSelection,
    restoreSelection,
    selectionInfo,
    cursorPosition,
    handleDropFilesHook,
    showModal,
    hideModal
  })

  // Единый оптимизированный обработчик selectionchange (заменяет 3 дублирующихся)
  onMount(async () => {
    const editor = editorRef()
    if (!editor) return

    // Инициализируем lazy loading для embed виджетов
    if (!isServer) {
      initEmbedLoaders()
      // Обрабатываем существующие <preview> теги
      const { processPreviewTags } = await import('./media/previewRenderer')
      await processPreviewTags(editor)
    }

    let rafId: number | null = null
    let _mouseX = 0
    let _mouseY = 0

    // Отслеживаем позицию мыши
    const trackMousePosition = (e: MouseEvent) => {
      _mouseX = e.clientX
      _mouseY = e.clientY
    }

    // Единый обработчик с debouncing через RAF для предотвращения мерцания
    const handleSelectionChange = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        if (!editor.contains(range.commonAncestorContainer)) return

        console.log('[SimpleRichEditor] Selection changed, updating toolbar state')

        // 1. Обновляем состояние кнопок тулбара
        trackSelectionAndCursor()

        // 2. Обновляем состояние выделения
        const hasActiveSelection = !selection.isCollapsed && selection.toString().trim() !== ''
        setHasSelection(hasActiveSelection)

        // 2.1. Если есть выделение текста - скрываем IncutMenu (приоритет основному тулбару)
        if (hasActiveSelection && showIncutEditor()) {
          setShowIncutEditor(false)
          setCurrentIncut(null)
        }

        // 3. Обновляем floating toolbar
        const floatToolbar = document.querySelector(`.${styles.floatingToolbar}[data-editor-id="${props.editorId}"]`)
        if (floatToolbar && floatToolbar instanceof HTMLElement) {
          if (hasActiveSelection) {
            const rect = range.getBoundingClientRect()
            if (rect) {
              floatToolbar.style.position = 'fixed'
              floatToolbar.style.top = `${Math.max(10, rect.top - 60)}px` // Увеличен отступ с -40 до -60
              floatToolbar.style.left = `${rect.left + rect.width / 2}px`
              floatToolbar.classList.add(styles.visible)
            }
          } else {
            floatToolbar.classList.remove(styles.visible)

            // 3.1. Если нет выделения, проверяем - курсор внутри incut? Показываем IncutMenu
            const container = range.commonAncestorContainer
            let incutElement: HTMLElement | null = null

            if (container.nodeType === Node.TEXT_NODE) {
              incutElement = container.parentElement?.closest('[data-align]') as HTMLElement | null
            } else {
              incutElement = (container as HTMLElement).closest('[data-align]')
            }

            if (incutElement && !showIncutEditor()) {
              setCurrentIncut(incutElement)
              setIncutMenuPosition(calculateIncutMenuPosition(incutElement))
              setShowIncutEditor(true)
            } else if (!incutElement && showIncutEditor()) {
              // Курсор вышел из incut - скрываем меню
              setShowIncutEditor(false)
              setCurrentIncut(null)
            }
          }
        }

        rafId = null
      })
    }

    // Добавляем обработчики с passive: true для лучшей производительности
    document.addEventListener('mousemove', trackMousePosition, { passive: true })
    document.addEventListener('selectionchange', handleSelectionChange, { passive: true })
    editor.addEventListener('mouseup', handleSelectionChange, { passive: true })
    editor.addEventListener('keyup', handleSelectionChange, { passive: true })

    onCleanup(() => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      document.removeEventListener('mousemove', trackMousePosition)
      document.removeEventListener('selectionchange', handleSelectionChange)
      editor.removeEventListener('mouseup', handleSelectionChange)
      editor.removeEventListener('keyup', handleSelectionChange)
    })
  })

  // Use helpers from UI module
  const { currentToolbarMode, getFloatingToolbarPosition } = uiHelpers

  // ✅ Обновление видимости Plus-меню при движении курсора
  const updatePlusMenuVisibility = () => {
    if (!props.plus) return

    const plusMenuShouldShow = uiHelpers.shouldShowPlusMenu()
    const currentShouldShow = shouldShowPlusMenu()

    if (plusMenuShouldShow !== currentShouldShow) {
      setShouldShowPlusMenu(plusMenuShouldShow)
      console.log('[SimpleRichEditor] Plus menu visibility updated on cursor move:', plusMenuShouldShow)
    }
  }

  // Обновление сигнала хранения позиции Plus-меню
  const updatePlusMenuPosition = () => {
    if (shouldShowPlusMenu()) {
      const newTop = uiHelpers.getPlusMenuTop()
      console.log('[SimpleRichEditor] Plus menu position calculation:', {
        oldTop: plusMenuTop(),
        newTop: newTop
      })
      setPlusMenuTop(newTop)
      console.log('[SimpleRichEditor] Plus menu top set to:', newTop)
    }
  }

  const clickHandler = (_e: MouseEvent) => {
    updatePlusMenuVisibility()
    updatePlusMenuPosition()
  }

  const keyupHandler = (e: KeyboardEvent) => {
    if (
      e.key === 'Enter' ||
      e.key.startsWith('Arrow') ||
      e.key.startsWith('Page') ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.key === 'Backspace' ||
      e.key === 'Delete'
    ) {
      updatePlusMenuVisibility()
      updatePlusMenuPosition()
    }
  }

  // Bind listeners to editor
  const [listenersBinded, setListenersBinded] = createSignal(false)
  createEffect(
    on(editorRef, (editor) => {
      if (!editor || !props.plus || listenersBinded()) return

      // Слушаем только критичные события
      editor.addEventListener('click', clickHandler)
      editor.addEventListener('keyup', keyupHandler)

      onCleanup(() => {
        editor.removeEventListener('click', clickHandler)
        editor.removeEventListener('keyup', keyupHandler)
      })
      setListenersBinded(true)
    })
  )

  // Обработчик для выхода из блочных элементов при клике вне блока (всегда активен)
  createEffect(
    on(editorRef, (editor) => {
      if (!editor) return

      const handleBlockExit = (e: MouseEvent) => {
        const target = e.target as HTMLElement

        // Проверяем - клик вне блока подвёрстки?
        // Если IncutMenu открыто и клик НЕ по блоку подвёрстки - скрываем меню
        if (showIncutEditor()) {
          const clickedIncut = target.closest('[data-align]')
          const currentIncutElement = currentIncut()

          // Если клик вне текущего блока подвёрстки - скрываем меню
          if (!clickedIncut || clickedIncut !== currentIncutElement) {
            console.log('[handleBlockExit] Click outside incut, hiding IncutMenu')
            setShowIncutEditor(false)
            setCurrentIncut(null)
          }
        }

        // Если клик по самому редактору (пустая область), а не по его содержимому
        if (target === editor) {
          const selection = window.getSelection()
          if (!selection || !selection.rangeCount) return

          const range = selection.getRangeAt(0)
          const container = range.commonAncestorContainer

          // Используем утилиту findBlockAncestor (DRY)
          const blockElement = findBlockAncestor(container, editor)

          // Если курсор внутри блочного элемента - создаем новую строку для выхода
          if (blockElement && editor.contains(blockElement)) {
            // Проверяем - есть ли пустая строка после последнего блока
            const lastChild = editor.lastElementChild
            const isEmpty = !lastChild || lastChild.textContent?.trim() === ''

            if (!isEmpty) {
              // Создаем новую пустую строку в конце
              const newParagraph = document.createElement('p')
              newParagraph.innerHTML = '<br>'
              editor.appendChild(newParagraph)

              // Перемещаем курсор в новую строку
              const newRange = document.createRange()
              newRange.setStart(newParagraph, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              console.log('[handleBlockExit] Created new paragraph after block element:', blockElement.tagName)
            }

            // Если это incut - скрываем IncutMenu
            if (blockElement.hasAttribute('data-align') && showIncutEditor()) {
              setShowIncutEditor(false)
              setCurrentIncut(null)
            }
          }
        }
      }

      editor.addEventListener('click', handleBlockExit)

      onCleanup(() => {
        editor.removeEventListener('click', handleBlockExit)
      })
    })
  )

  // Удалено: плейсхолдер теперь управляется напрямую через uiHelpers.shouldShowPlaceholder()

  // --- Content Loading and Saving Logic ---
  const loadLocalVersion = (_e: MouseEvent) => {
    const version = localVersion() as ContentVersion
    if (!version || !editorRef()) return
    console.log(`[SimpleRichEditor] Loading local version from ${new Date(version.timestamp).toLocaleString()}`)
    const cleanContent = loadLocalVersionContent(version)
    editorRef()!.innerHTML = cleanContent
    setContent(cleanContent)
    setShowLocalVersionLink(false)
    uiHelpers.updatePlaceholderState()
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

  const handleClearLocalVersion = (_e: MouseEvent) => {
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
            uiHelpers.updatePlaceholderState()
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
          uiHelpers.updatePlaceholderState()
          restoreSelection()
        } else if (!contentToUse && !editorElement.innerHTML) {
          uiHelpers.updatePlaceholderState()
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

      // Пропускаем обновление если это внутреннее изменение из getHTML
      if (isInternalUpdate()) {
        console.log('[SimpleRichEditor] Skipping innerHTML sync - internal update')
        return
      }

      if (editorRef()!.innerHTML !== newContent) {
        console.log('[SimpleRichEditor] Syncing editor innerHTML with content signal')
        saveSelection()
        editorRef()!.innerHTML = newContent
        restoreSelection()
        uiHelpers.updatePlaceholderState()
      }
    })
  )

  // --- Core Logic --- Needed before event handlers

  /**
   * Получает HTML содержимое из редактора
   * @param editor DOM элемент редактора
   * @returns Очищенный HTML
   */
  const getHTML = (editor: HTMLElement): string => {
    // Клонируем контент для обработки
    const clone = editor.cloneNode(true) as HTMLElement

    // Конвертируем iframe обратно в <preview> для компактного хранения
    const wrappers = clone.querySelectorAll('.video-embed-wrapper[data-embed-url]')
    for (const wrapper of Array.from(wrappers)) {
      const url = wrapper.getAttribute('data-embed-url')
      if (url) {
        const previewTag = document.createElement('preview')
        previewTag.textContent = url
        wrapper.replaceWith(previewTag)
      }
    }

    const rawContent = clone.innerHTML || ''
    const contentHtml = cleanupJsonContent(rawContent)

    if (contentHtml !== content()) {
      // Устанавливаем флаг что это внутреннее обновление
      setIsInternalUpdate(true)
      setContent(contentHtml)
      // Сбрасываем флаг в следующем тике (DRY: timing)
      afterDOMUpdate(() => {
        setIsInternalUpdate(false)
      })
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

    uiHelpers.updatePlaceholderState()

    const contentHtml = getHTML(editor)
    const editorIsEmpty = uiHelpers.isEditorEmpty()

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

  // Debounced version for input events - перенесено в handlers/events.ts

  // Use event handlers from events module
  const {
    handleInput: handleInputBase,
    handleFocus: handleFocusBase,
    handleBlur: handleBlurBase,
    handlePaste,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDropFiles
  } = eventHandlers

  // Обертка для handleInput чтобы убрать placeholder при вводе
  const handleInput = (e: InputEvent) => {
    const editor = editorRef()
    // Удаляем placeholder оверлей при вводе
    const placeholder = editor?.querySelector('[data-embed-placeholder-overlay]')
    if (placeholder) {
      placeholder.remove()
      console.log('[SimpleRichEditor] Embed placeholder hidden on input')
    }
    handleInputBase(e)
  }

  // Create form handlers
  const formHandlers = createFormHandlers({
    editorRef,
    props,
    showForm,
    setShowForm,
    formPosition,
    setFormPosition,
    formInitialValue,
    setFormInitialValue,
    editingImage,
    setEditingImage,
    saveSelection,
    restoreSelection,
    cursorPosition,
    handleChange
  })

  // Create media handlers
  const { handleContentClick } = createMediaHandlers({
    editorRef,
    props,
    setEditingImage,
    setCurrentIncut,
    setShowIncutEditor,
    setIncutMenuPosition,
    showInlineForm: formHandlers.showInlineForm,
    showImageUploadModal: formHandlers.showImageUploadModal,
    handleInsertLink: formHandlers.handleInsertLink,
    handleInsertTooltip: formHandlers.handleInsertTooltip,
    saveSelection,
    calculateIncutMenuPosition
  })

  // Extend base handlers with additional logic
  const handleFocus = () => {
    handleFocusBase()

    // Показываем тулбары для режимов top и bottom
    const toolbar = props.toolbar || 'float'
    if (toolbar === 'top' || toolbar === 'bottom') {
      const selector = toolbar === 'top' ? styles.topToolbar : styles.bottomToolbar
      const toolbarElement = document.querySelector(`.${selector}[data-editor-id="${props.editorId}"]`)
      if (toolbarElement) {
        toolbarElement.classList.add(styles.visible)
      }
    }

    // Set initial focus flag
    if (!isInitialFocusDone()) {
      setIsInitialFocusDone(true)
    }
  }

  const handleBlur = (e: FocusEvent) => {
    handleBlurBase(e)

    blurTimerRef = window.setTimeout(() => {
      blurTimerRef = 0
    }, blurTimeout)
  }

  // Draft navigation function (должна быть объявлена ДО keyboard handlers)
  const handleNavigation = (nextField: EditorFieldType) => {
    return switchFieldInDraft({
      nextField,
      editorId: props.editorId,
      fieldType: props.fieldType
    })
  }

  const handleAction = (action: CommandType | CommandGroupType) => {
    console.log(`[handleAction] START - Processing action: ${action}`)

    // Не обрабатываем группы команд напрямую
    if (isGroup(action)) {
      console.log(`[handleAction] Skipping group action: ${action}`)
      return
    }

    const command = action as CommandType
    const editor = editorRef()

    // Валидируем выделение через утилиту (DRY)
    const validation = validateSelection(editor)
    if (!validation.isValid) {
      console.warn('[handleAction]', validation.error)
      return
    }

    // Логируем детали выделения (DRY)
    if (validation.selection) {
      logSelectionDetails(validation.selection, 'handleAction')
    }

    // Создаем SelectionState через утилиту (DRY)
    const selectionState = createSelectionStateUtil(editor!, cursorPosition())
    if (!selectionState) {
      console.warn('[handleAction] Failed to create selection state')
      return
    }

    // Создаем контекст для унифицированной системы форматирования
    const formatContext: FormatContext = {
      editor: editor!,
      selection: selectionState,
      editorId: props.editorId
    }

    // Сохраняем текущее выделение для возможного восстановления
    saveSelection()

    // --- Используем унифицированную систему форматирования ---
    console.log(`[handleAction] Processing command: ${command}`)

    // Специальная обработка для команд, требующих UI взаимодействия
    if (['link', 'tooltip', 'image', 'video', 'audio', 'embed'].includes(command)) {
      if (command === 'link') {
        // Используем утилиту findLinkAncestor (DRY)
        const linkElement = findLinkAncestorUtil(validation.selection?.anchorNode ?? null, editor)
        const initialUrl = linkElement ? linkElement.getAttribute('href') || '' : ''
        showInlineForm('link', handleInsertLink, initialUrl)
        return
      }
      if (command === 'tooltip') {
        const tooltipElement = validation.selection?.anchorNode?.parentElement?.closest('tooltip')
        const initialText = tooltipElement ? tooltipElement.textContent || '' : ''
        showInlineForm('tooltip', handleInsertTooltip, initialText)
        return
      }
      if (command === 'video') {
        showInlineForm('video', handleInsertVideo, '')
        return
      }
      if (command === 'embed') {
        showInlineForm('embed', handleInsertEmbed, '')
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
    }

    // Проверяем валидность выделения перед выполнением команды
    if (!selectionState.range) {
      console.warn('[handleAction] No valid range for formatting command')
      return
    }

    // Выполняем команду через унифицированную систему
    console.log(`[handleAction] Executing command: ${command}`)
    const result = executeCommand(command, formatContext)
    console.log('[handleAction] Command result:', result)

    if (!result.success) {
      console.error(`[handleAction] Error processing command ${command}:`, result.error)
      return
    }

    // --- Финальное обновление состояния ---
    // 1. Обновление данных редактора (если команда требует обновления)
    if (result.needsUpdate) {
      // Используем handleChange из events module
      const { handleChange } = eventHandlers
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    }

    // 2. Задержка для стабилизации DOM и обновления состояния кнопок (DRY: timing)
    afterDOMUpdate(() => {
      console.log('[handleAction] Post-command timeout - updating toolbar state')

      // Принудительно обновляем активное форматирование для корректного отображения кнопок
      console.log('[handleAction] Updating active formats for toolbar buttons...')
      trackSelectionAndCursor()

      // Дополнительная проверка через небольшую задержку (DRY: timing)
      afterToolbarUpdate(() => {
        console.log('[handleAction] Secondary toolbar state update')
        trackSelectionAndCursor()
      })

      // Скрываем все активные меню/формы (кроме incut при создании)
      setShowForm(null)

      // Для команды incut - показываем меню редактирования если элемент создан
      if (command === 'incut' && result.success) {
        // Ждем пока DOM обновится после санитизации (DRY: timing)
        afterDOMUpdate(() => {
          const editor = editorRef()
          const selection = window.getSelection()

          if (!editor || !selection || selection.rangeCount === 0) {
            console.log('[handleAction] No editor or selection for incut')
            setShowIncutEditor(false)
            return
          }

          const range = selection.getRangeAt(0)
          const container = range.commonAncestorContainer

          // Пытаемся найти incut элемент несколькими способами
          let incutElement: HTMLElement | null = null

          // 1. Через closest от текущей позиции курсора
          if (container.nodeType === Node.TEXT_NODE) {
            incutElement = container.parentElement?.closest('[data-align]') as HTMLElement | null
          } else {
            incutElement = (container as HTMLElement).closest('[data-align]')
          }

          // 2. Если не нашли через closest, ищем в родительском элементе
          if (!incutElement && container.parentElement) {
            const parent = container.parentElement
            if (parent.hasAttribute('data-align')) {
              incutElement = parent
            }
          }

          // 3. Если всё ещё не нашли, ищем последний созданный элемент с data-align в редакторе
          if (!incutElement) {
            const allIncuts = editor.querySelectorAll('[data-align]')
            if (allIncuts.length > 0) {
              incutElement = allIncuts[allIncuts.length - 1] as HTMLElement
              console.log('[handleAction] Found incut via querySelectorAll (last element)')
            }
          }

          if (incutElement) {
            console.log('[handleAction] Incut created, showing editor menu', incutElement)
            setCurrentIncut(incutElement)
            setIncutMenuPosition(calculateIncutMenuPosition(incutElement))
            setShowIncutEditor(true)
          } else {
            console.log('[handleAction] Incut element not found after all attempts')
            console.log('[handleAction] Container:', container)
            console.log('[handleAction] Editor HTML:', editor.innerHTML)
            setShowIncutEditor(false)
          }
        })
      } else {
        setShowIncutEditor(false)
      }

      console.log('[handleAction] COMPLETE - Command processing finished')
    }) // Увеличиваем задержку для стабильного обновления состояния кнопок
  }

  // Create keyboard handlers (ПОСЛЕ объявления handleAction и handleNavigation)
  const { handleKeyDown } = createKeyboardHandlers({
    editorRef,
    props,
    trackSelectionAndCursor,
    handleAction,
    handleChange,
    restoreSelection,
    handleNavigation
  })

  // Use form handlers
  const {
    showInlineForm,
    showInlineFormAtPosition,
    handleInsertLink,
    handleInsertVideo,
    handleInsertEmbed,
    handleInsertTooltip,
    showAudioUploader,
    showImageUploadModal,
    editorFormOptions
  } = formHandlers

  // --- Initialization ---
  const initEditor = (element: HTMLDivElement) => {
    if (!element) return
    setEditorRef(element)
    // Content set via effect on props.content
    if (props.placeholder) element.setAttribute('data-placeholder', props.placeholder)
    if (props.fieldType) element.setAttribute('data-field-type', props.fieldType)
    if (props.editorId) element.setAttribute('data-editor-id', props.editorId)
    uiHelpers.updatePlaceholderState() // Initial check

    // Tooltip иконки теперь управляются через CSS :not(:has(tooltip))

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

  // Удален третий дублирующийся onMount - функциональность перенесена в единый обработчик выше

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

  // Редактор рендерится только на клиенте - никакого SSR
  if (isServer) {
    return null
  }

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
            validate={editorFormOptions()?.validate || (() => '')}
          />
        </div>
      </Show>
      <Show when={showForm() === 'tooltip'}>
        <div
          class={styles.inlineFormWrapper}
          style={{ top: `${formPosition()?.top || 0}px`, left: `${formPosition()?.left || 0}px` }}
        >
          <InlineForm
            placeholder={t('Enter tooltip text')}
            initialValue={formInitialValue()}
            onSubmit={handleInsertTooltip}
            onClose={() => {
              setShowForm(null)
              editorRef()?.focus()
              restoreSelection()
            }}
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
            validate={editorFormOptions()?.validate || (() => '')}
          />
        </div>
      </Show>
      <Show when={showForm() === 'embed'}>
        <div
          class={styles.inlineFormWrapper}
          style={{ top: `${formPosition()?.top || 0}px`, left: `${formPosition()?.left || 0}px` }}
        >
          <InlineForm
            placeholder={t('Paste any link')}
            initialValue={formInitialValue()}
            onSubmit={handleInsertEmbed}
            onClose={() => {
              setShowForm(null)
              editorRef()?.focus()
              restoreSelection()
            }}
            validate={editorFormOptions()?.validate || (() => '')}
            supportPlainText={true}
          />
        </div>
      </Show>
      {/* Editor Container with UI Layer */}
      <div style={{ position: 'relative' }}>
        {/* Plus Menu positioned relative to editor container (not body portal) */}
        <Show when={props.plus && shouldShowPlusMenu() && !showIncutEditor() && !showForm()}>
          <PlusMenu
            top={plusMenuTop()}
            left={uiHelpers.getPlusMenuLeft()}
            isVisible={true}
            onEmpty={uiHelpers.isCursorOnEmptyLine()}
            isFormActive={showForm() !== null}
            onAction={(action) => {
              console.log('[SimpleRichEditor] Plus menu action:', action)
              handlePlusMenuAction(action, editorRef()!, {
                showLinkForm: () => {
                  const plusMenuPosition = { top: plusMenuTop(), left: uiHelpers.getPlusMenuLeft() + 35 }
                  showInlineFormAtPosition('link', plusMenuPosition, handleInsertLink)
                },
                showTooltipForm: () => {
                  const plusMenuPosition = { top: plusMenuTop(), left: uiHelpers.getPlusMenuLeft() + 35 }
                  showInlineFormAtPosition('tooltip', plusMenuPosition, handleInsertTooltip, '')
                },
                showEmbedForm: () => {
                  const plusMenuPosition = { top: plusMenuTop(), left: uiHelpers.getPlusMenuLeft() + 35 }
                  showInlineFormAtPosition('embed', plusMenuPosition, handleInsertEmbed, '')
                },
                showEmbedPlaceholder: () => {
                  // Вставляем реальный non-selectable элемент как оверлей
                  const editor = editorRef()
                  if (editor) {
                    // Удаляем старый placeholder если есть
                    const oldPlaceholder = editor.querySelector('[data-embed-placeholder-overlay]')
                    if (oldPlaceholder) oldPlaceholder.remove()

                    // Получаем позицию курсора
                    const selection = window.getSelection()
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0)
                      const rect = range.getBoundingClientRect()
                      const editorRect = editor.getBoundingClientRect()

                      // Создаем placeholder элемент
                      const placeholder = document.createElement('span')
                      placeholder.contentEditable = 'false'
                      placeholder.textContent = 'https://...'
                      placeholder.setAttribute('data-embed-placeholder-overlay', 'true')
                      placeholder.style.cssText = `
                        position: absolute;
                        left: ${rect.left - editorRect.left}px;
                        top: ${rect.top - editorRect.top}px;
                        color: #9ca3af;
                        opacity: 0.6;
                        pointer-events: none;
                        user-select: none;
                        z-index: 1;
                      `

                      editor.appendChild(placeholder)
                      editor.focus()
                      console.log('[SimpleRichEditor] Embed placeholder shown at cursor')
                    }
                  }
                },
                showImageUploadModal,
                showAudioUploader,
                handleChange
              })
            }}
            editorId={props.editorId}
          />
        </Show>

        {/* Editor Content */}
        <div
          class={clsx(styles.editor, {
            [styles.empty]: uiHelpers.isEditorEmpty(),
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
              [styles['placeholder-visible']]: uiHelpers.shouldShowPlaceholder()
            })}
            contentEditable={!props.readOnly}
            data-placeholder={props.placeholder}
            onInput={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDropFiles}
            onClick={handleContentClick}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Other UI Elements */}
        <Show when={currentToolbarMode() === 'bottom' && !showForm()}>
          <SimpleToolbar
            commands={displayedCommands()}
            onAction={handleAction}
            currentFormats={activeFormats()}
            class={clsx(styles.bottomToolbar, {
              [styles.visible]: hasFocus() && !uiHelpers.isEditorEmpty()
            })}
            mode={currentToolbarMode() as ToolbarMode}
            editorId={props.editorId}
          />
        </Show>
        <Show when={currentToolbarMode() === 'float' && !showForm() && !showIncutEditor()}>
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
        <Show when={showIncutEditor() && currentIncut()}>
          <IncutMenu
            commands={props.commands as CommandType[]}
            currentFormats={activeFormats()}
            isVisible={true}
            incutElement={currentIncut()}
            onAction={(action) => {
              const incutElement = currentIncut()
              if (incutElement) {
                const handler = handleIncutFormatting(action as string)
                if (handler(incutElement)) {
                  // Форсируем обновление контента для сохранения изменений
                  handleChange(props.fieldType ? String(props.fieldType) : 'content')
                  // Обновляем позицию меню если блок изменил размеры
                  setIncutMenuPosition(calculateIncutMenuPosition(incutElement))
                  // Форсируем перерисовку меню обновляя currentIncut (DRY: timing)
                  setCurrentIncut(null)
                  afterDOMUpdate(() => setCurrentIncut(incutElement))
                }
              }
            }}
            onClose={() => {
              const incutElement = currentIncut()
              if (incutElement) {
                // Убираем форматирование подвёрстки - заменяем на обычный параграф
                const textContent = incutElement.textContent || ''
                const p = document.createElement('p')
                p.textContent = textContent
                incutElement.replaceWith(p)

                // Сохраняем изменения
                handleChange(props.fieldType ? String(props.fieldType) : 'content')
              }
              setShowIncutEditor(false)
              setCurrentIncut(null)
            }}
            position={incutMenuPosition()}
          />
        </Show>

        {/* Forms and Modal Portals */}
      </div>
    </div>
  )
}
