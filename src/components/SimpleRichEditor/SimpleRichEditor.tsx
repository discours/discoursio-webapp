import { clsx } from 'clsx'
import { Component, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { debounce } from 'throttle-debounce'

import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { MODALS } from '~/context/ui'
import { CommandGroupType, CommandType, MENU_GROUPS } from './lib/commands'
import { useDropFiles } from './lib/drop'
import { createVideoEmbed, detectVideoPlatform, handleContentPaste } from './lib/embed'
import { insertFootnote } from './lib/footnotes'
import { applyFormatting, hasFormatting, removeFormatting } from './lib/format'
import { useSelection } from './lib/selection'
import { Position } from './lib/types'
import { SimpleToolbar } from './menu/SimpleToolbar'
import { Modal } from '~/components/_shared/Modal'
import { InlineForm } from '~/components/_shared/InlineForm'
import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { UploadedFile } from '~/types/upload'

import styles from './SimpleRichEditor.module.scss'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]

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
  const [toolbar, setToolbar] = createSignal<SimpleRichEditorProps['toolbar']>('float')
  const [showSquibEditor, setShowSquibEditor] = createSignal(false)
  const [showFootnoteEditor, setShowFootnoteEditor] = createSignal(false)
  const [hasFocus, setHasFocus] = createSignal(false)
  let blurTimer: number

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

  // Handle selection changes and content updates
  const handleChange = (_ev?: Event) => {
    const selection = window.getSelection()
    if (!selection) return

    // Update selection state
    const selectionData = {
      text: selection.toString(),
      isEmpty: selection.isCollapsed
    }
    setSelection(selectionData)

    // Update active formats
    updateActiveFormats()

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
      selection: selectionData
    }

    // Handle bubble menu positioning if needed
    if (props.toolbar === 'float' && isSelectionInEditor()) {
      if (selection.isCollapsed) {
        setToolbar('hidden')
      } else {
        const range = selection.getRangeAt(0)
        const editorRect = editorRef()!.getBoundingClientRect()
        const rect = range.getBoundingClientRect()

        const position = {
          top: rect.top - editorRect.top - 50,
          left: rect.left - editorRect.left + rect.width / 2
        }

        // Update collaborative state if needed
        if (props.collaborative) {
          const newState = {
            ...editorState(),
            cursorPosition: position
          }
          setEditorState(newState)
          debouncedStateUpdate(newState)
        }
        editorData.selection!.position = position
        setToolbar(props.toolbar || 'float')
      }
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

    // Show fixed toolbar immediately on focus if not in bubble mode
    setToolbar(props.toolbar || 'float')
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
        document.execCommand('insertText', false, text)
      },
      insertHtml: (html) => {
        document.execCommand('insertHTML', false, html)
      }
    })
  }

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

    document.addEventListener('selectionchange', handleChange)
  })

  onCleanup(() => {
    clearTimeout(blurTimer)
    document.removeEventListener('selectionchange', handleChange)
    debouncedStateUpdate.cancel()
  })

  const [showingInsert, showInsert] = createSignal<string | undefined>()
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
    const selection = window.getSelection()
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0)
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
      if (!url.match(/^https?:\/\//)) {
        return t('URL must start with http:// or https://')
      }
      
      // Пробуем создать объект URL для проверки валидности
      new URL(url)
      return ''
    } catch (e) {
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
    if (action === 'image') {
      showModal(MODALS.uploadImage)
      return
    }
    if (action === 'video') {
      setInsertPosition(calculateInsertPosition())
      showInsert('video')
      return
    }
    if (action === 'link') {
      setInsertPosition(calculateInsertPosition())
      showInsert('link')
      return
    }
    if (action === 'footnote') {
      setShowFootnoteEditor(true)
      return
    }
    console.log('Editor handling action:', action)

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) {
      console.log('No selection found')
      return
    }

    // Save the current selection
    const range = selection.getRangeAt(0).cloneRange()
    saveSelection()
    console.log('Selection range:', {
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      text: selection.toString()
    })

    // Save the selected text for verification
    const selectedText = selection.toString()

    // Apply formatting without losing selection
    if (hasFormatting(action, selection)) {
      console.log('Removing formatting:', action)
      removeFormatting(action, {
        range,
        text: selectedText,
        isEmpty: selection.isCollapsed,
        position: { top: selection.anchorOffset, left: selection.anchorOffset }
      })
    } else {
      console.log('Applying formatting:', action)
      applyFormatting(action, {
        range,
        text: selectedText,
        isEmpty: selection.isCollapsed,
        position: { top: selection.anchorOffset, left: selection.anchorOffset }
      })
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

    // Restore the selection
    selection.removeAllRanges()
    selection.addRange(range)

    // Keep menu visible and focused
    setToolbar(props.toolbar || 'float')
    editorRef()?.focus()
  }

  /**
   * Заменяет текущее выделение HTML контентом
   * @param html HTML строка для вставки
   * @returns true если замена успешна
   */
  const replaceSelection = (html: string): boolean => {
    if (!restoreSelection()) return false

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return false

    const range = selection.getRangeAt(0)

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
    selection.removeAllRanges()
    selection.addRange(range)

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
    const editor = editorRef()
    if (!editor) return

    saveSelection()
    const sel = window.getSelection()
    insertFootnote(editor, content, sel as Selection)
    setShowFootnoteEditor(false)
    restoreSelection()
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
      <div class={clsx(styles.controls, { [styles.visible]: toolbar() && toolbar() !== 'hidden' })}>
        <div class={styles.actions}>
          <Show
            when={!props.readOnly && toolbar() !== 'hidden' && props.commands && props.commands.length > 0}
          >
            <div
              class={clsx(styles.toolbarContainer, {
                [styles.toolbarTop]: props.toolbar === 'top',
                [styles.toolbarBottom]: props.toolbar === 'bottom',
                [styles.toolbarFloat]: !props.toolbar || props.toolbar === 'float'
              })}
            >
              <SimpleToolbar
                commands={props.commands || []}
                onAction={(action: CommandType | CommandGroupType) => handleAction(action as CommandType)}
                currentFormats={activeFormats()}
                isVisible={toolbar() !== 'hidden'}
              />
            </div>
          </Show>
        </div>
      </div>

      <Portal>
        <Show when={showingInsert() === 'link'}>
          <div 
            class={styles.inlineFormWrapper} 
            style={insertPosition() ? `position: absolute; top: ${insertPosition()?.top}px; left: ${insertPosition()?.left}px; z-index: 100;` : ''}
          >
            <InlineForm
              placeholder={t('Enter link...')}
              initialValue={selection().text}
              showInput={true}
              validate={validateUrl}
              onSubmit={(url) => {
                const linkText = selection().text || url;
                replaceSelection(`<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
                showInsert(undefined);
                editorRef()?.focus();
              }}
              onClose={() => showInsert(undefined)}
            />
          </div>
        </Show>
        <Show when={showingInsert() === 'video'}>
          <div 
            class={styles.inlineFormWrapper} 
            style={insertPosition() ? `position: absolute; top: ${insertPosition()?.top}px; left: ${insertPosition()?.left}px; z-index: 100;` : ''}
          >
            <InlineForm
              placeholder={t('Enter YouTube or Vimeo link...')}
              initialValue={selection().text}
              showInput={true}
              validate={validateVideoUrl}
              onSubmit={(url) => {
                replaceSelection(createVideoEmbed(url, detectVideoPlatform(url)));
                showInsert(undefined);
                editorRef()?.focus();
              }}
              onClose={() => showInsert(undefined)}
            />
          </div>
        </Show>
        <Show when={showSquibEditor()}>
          <SimpleRichEditor
            content={selection().text}
            squib={true}
            placeholder={t('Enter text...')}
            onChange={(content) => setSquibContent(content.content)}
            onBlur={() => handleSquibSubmit(squibContent())}
          />
        </Show>
        <Show when={showFootnoteEditor()}>
          <SimpleRichEditor
            commands={['bold', 'italic', 'highlight', 'link']}
            content={selection().text}
            placeholder={t('Enter text...')}
            onChange={(content) => setFootnoteContent(content.content)}
            onBlur={() => handleFootnoteSubmit(footnoteContent())}
          />
        </Show>
        
        {/* Модальное окно загрузки изображений */}
        <Modal name={MODALS.uploadImage} variant="narrow">
          <UploadModalContent onClose={handleImageUpload} />
        </Modal>
      </Portal>
    </div>
  )
}
