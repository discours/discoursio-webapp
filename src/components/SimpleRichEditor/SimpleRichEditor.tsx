import { clsx } from 'clsx'
import { Component, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { debounce } from 'throttle-debounce'

import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Button, type ButtonVariant } from '../_shared/Button'
import { CommandGroupType, CommandType, MENU_GROUPS, isGroup } from './lib/commands'
import { useDropFiles } from './lib/drop'
import { createVideoEmbed, detectVideoPlatform, handleContentPaste } from './lib/embed'
import { insertFootnote } from './lib/footnotes'
import { applyFormatting, hasFormatting, removeFormatting } from './lib/format'
import { useSelection } from './lib/selection'
import { Position } from './lib/types'
import { SimpleInsert } from './menu/SimpleInsert'
import { SimpleToolbar } from './menu/SimpleToolbar'

import styles from './SimpleRichEditor.module.scss'
import { createTextChangeRange } from 'typescript'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]

export interface EditorData {
  content: string               // HTML контент
  plainText: string            // Чистый текст
  length: number              // Длина текста
  isEmpty: boolean           // Пустой ли редактор
  selection?: {              // Информация о выделении
    text: string
    isEmpty: boolean
    position?: Position
  }
}

export type EditorMode = 'micro' | 'mini' | 'full'

export interface SimpleRichEditorProps {
  hideButtons?: boolean
  commands?: CommandType[] | CommandGroupType[]
  bubble?: boolean
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
  showToolbar?: boolean
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
 *   - Фиксированный тулбар (bubble=false|undefined)
 *   - Всплывающее меню при выделении (bubble=true)
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
 *   bubble={false}
 * />
 * 
 * // Редактор с всплывающим тулбаром
 * <SimpleRichEditor
 *   commands={['bold', 'italic', 'link']}
 *   bubble={true}
 * />
 *
 * // Полный редактор со всеми меню
 * <SimpleRichEditor
 *   commands={['bold', 'italic', 'link', 'blockquote', 'image']}
 *   bubble={true}
 *   plus={true}
 * />
 * ```
 */

export const SimpleRichEditor: Component<SimpleRichEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showModal } = useUI()
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>()
  const [menuVisible, setMenuVisible] = createSignal(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = createSignal<Position>({ top: 0, left: 0 })
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

  // Базовое состояние
  const [content, setContent] = createSignal(props.content || '')
  const [selection, setSelection] = createSignal({ text: '', isEmpty: true })
  const {
    updateActiveFormats,
    activeFormats,
    menuPosition,
    isSelectionInEditor,
    saveSelection,
    restoreSelection
  } = useSelection(editorRef)
  const { handleDropFiles } = useDropFiles()

  const [squibContent, setSquibContent] = createSignal('')
  const [footnoteContent, setFootnoteContent] = createSignal('')

  createEffect(on(squibContent, (s?: string) => {
    if (!s) return
    console.log('squibContent', s)
    props.onChange({
      content: s,
      plainText: s,
      length: s.length,
      isEmpty: s.trim().length === 0,
      selection: { text: s, isEmpty: s.trim().length === 0 }
    })
  }))

  createEffect(on(footnoteContent, (s?: string) => {
    if (!s) return
    console.log('footnoteContent', s)
    props.onChange({
      content: s,
      plainText: s,
      length: s.length,
      isEmpty: s.trim().length === 0,
      selection: { text: s, isEmpty: s.trim().length === 0 }
    })
  }))
  
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
    const contentHtml = editorRef()?.innerHTML || ''
    const contentText = editorRef()?.textContent || ''
    
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
    if (props.bubble && isSelectionInEditor()) {
      if (!selection.isCollapsed) {
        const range = selection.getRangeAt(0)
        const editorRect = editorRef()!.getBoundingClientRect()
        const rect = range.getBoundingClientRect()

        const position = {
          top: rect.top - editorRect.top - 50,
          left: rect.left - editorRect.left + rect.width / 2
        }
        setBubbleMenuPosition(position)
        
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
        setMenuVisible(true)
      } else {
        setMenuVisible(false)
      }
    }

    // Notify parent with complete data
    props.onChange(editorData)
  }

  // Handle input changes
  const handleInput = () => {
    const content = editorRef()?.innerHTML || ''
    setContent(content)
    props.onChange({
      content: content,
      plainText: content,
      length: content.length,
      isEmpty: content.trim().length === 0,
      selection: { text: content, isEmpty: content.trim().length === 0 }
    })
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
    if (!props.bubble) {
      setMenuVisible(true)
    }
  }

  const handleBlur = (e: FocusEvent) => {
    if (!editorRef()?.contains(e.relatedTarget as Node)) {
      blurTimer = window.setTimeout(() => {
        setHasFocus(false)
        setMenuVisible(false)
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
  const handleAction = (action: CommandType) => {
    console.log('Editor handling action:', action)
    
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) {
      console.log('No selection found')
      return
    }

    // Save the current selection
    const range = selection.getRangeAt(0).cloneRange()
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
    setMenuVisible(true)
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
    replaceSelection(content)
    setShowSquibEditor(false)
  }

  const handleFootnoteSubmit = (content: string) => {
    const editor = editorRef()
    const selection = window.getSelection()

    if (editor && selection) {
      insertFootnote(editor, content, selection)
      handleChange()
    }

    setShowFootnoteEditor(false)
  }

  return (
    <div class={styles.editorWrapper}>
      {/* Редактируемая область только для контента */}
      <div class={styles.editor}>
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
      <div class={clsx(styles.controls, { [styles.visible]: menuVisible() })}>
        <Show when={props.limit}>
          <div class={styles.limitContainer}>
            <small class={styles.limit}>
              {content().length} / {props.limit || '∞'}
            </small>
          </div>
        </Show>

        <div class={styles.actions}>
          <Show when={props.commands && props.commands.length > 0}>
            <div
              class={clsx(styles.toolbarContainer, {
                [styles.bubble]: props.bubble,
                [styles.fixed]: !props.bubble
              })}
              style={
                props.bubble
                  ? {
                      top: `${bubbleMenuPosition().top}px`,
                      left: `${bubbleMenuPosition().left}px`,
                      transform: 'translate(-50%, -100%)'
                    }
                  : undefined
              }
            >
              <SimpleToolbar
                commands={props.commands || []}
                onAction={(action: CommandType | CommandGroupType) => handleAction(action as CommandType)}
                currentFormats={activeFormats()}
                isVisible={menuVisible()}
              />
            </div>
          </Show>
        </div>
      </div>

      <Portal>
        <Show when={showingInsert() === 'link'}>
          <SimpleInsert
            initialValue={selection().text}
            icon="link"
            placeholder={t('Enter URL')}
            onSubmit={(url) => replaceSelection(`<a href="${url}">${selection().text}</a>`)}
            onClose={() => showInsert(undefined)}
          />
        </Show>
        <Show when={showingInsert() === 'video'}>
          <SimpleInsert
            initialValue={selection().text}
            icon="video"
            placeholder={t('YouTube or Vimeo URL')}
            onSubmit={(url) => replaceSelection(createVideoEmbed(url, detectVideoPlatform(url)))}
            onClose={() => showInsert(undefined)}
          />
        </Show>
        <Show when={showSquibEditor()}>
          <SimpleRichEditor
            content={selection().text}
            squib={true}
            placeholder={t('Enter text...')}
            onChange={(content) => setSquibContent(content.content)}
          />
        </Show>
        <Show when={showFootnoteEditor()}>
          <SimpleRichEditor
            commands={['bold', 'italic', 'highlight', 'link']}
            bubble={true}
            content={selection().text}
            placeholder={t('Enter text...')}
            onChange={(content) => setFootnoteContent(content.content)}
          />
        </Show>
      </Portal>
    </div>
  )
}
