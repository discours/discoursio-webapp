import { clsx } from 'clsx'
import { Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'

import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Button } from '../_shared/Button'
import { CommandGroupType, CommandType, MENU_GROUPS, isGroup } from './lib/commands'
import { useDropFiles } from './lib/drop'
import { createVideoEmbed, detectVideoPlatform, handleContentPaste } from './lib/embed'
import { insertFootnote } from './lib/footnotes'
import { applyFormatting, getActiveFormats, hasFormatting, removeFormatting } from './lib/format'
import { useSelection } from './lib/selection'
import { Position } from './lib/types'
import { SimpleInsert } from './menu/SimpleInsert'
import { SimpleToolbar } from './menu/SimpleToolbar'

import styles from './SimpleRichEditor.module.scss'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]

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
  onChange?: (content: string) => void
  onSubmit?: (content: string) => Promise<boolean> | boolean
  onCancel?: () => void
  collaborative?: boolean
  fieldId?: string
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
 * @example
 * ```tsx
 * <SimpleRichEditor
 *   commands={['bold', 'italic', 'link']}
 * />
 *
 * // Редактор с всплывающим меню
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

  const updateSelection = () => {
    const sel = window.getSelection()
    if (!sel) return

    setSelection({
      text: sel.toString(),
      isEmpty: sel.isCollapsed
    })

    // Обновляем активные форматы
    const formats = new Set(Object.keys(getActiveFormats(sel)))
    updateActiveFormats()

    // Проверяем, что выделение внутри редактора
    if (!isSelectionInEditor()) {
      setMenuVisible(false)
      return
    }

    const range = sel.getRangeAt(0)
    const editorRect = editorRef()!.getBoundingClientRect()

    // Сохраняем выделение
    saveSelection()

    // Обновляем форматы
    if (formats) {
      updateActiveFormats()
    }

    // Обновляем позицию bubble menu
    if (props.bubble && !sel.isCollapsed) {
      const rect = range.getBoundingClientRect()

      setBubbleMenuPosition({
        top: rect.top - editorRect.top - 50, // Поднимаем выше
        left: rect.left - editorRect.left + rect.width / 2
      })
      setMenuVisible(true)
    } else {
      setMenuVisible(false)
    }

    // Обновляем контент
    const content = editorRef()!.innerHTML
    setContent(content)
    props.onChange?.(content)
  }

  const handleSubmit = async () => {
    if (props.onSubmit) {
      const success = await props.onSubmit(content())
      if (success) {
        setContent('')
        setMenuVisible(false)
        setHasFocus(false)
      }
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

  const handleClear = () => {
    // state.setContent('')
    setMenuVisible(false)
    setHasFocus(false)
    props.onCancel?.()
  }

  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !isSelectionInEditor()) {
      setMenuVisible(false)
      return
    }

    // Only calculate bubble menu position if bubble mode is enabled
    if (props.bubble) {
      const range = selection.getRangeAt(0)
      const editorRect = editorRef()!.getBoundingClientRect()
      const rect = range.getBoundingClientRect()

      setBubbleMenuPosition({
        top: rect.top - editorRect.top - 50, // Position above selection
        left: rect.left - editorRect.left + rect.width / 2 // Center horizontally
      })
    }

    updateActiveFormats()
    setMenuVisible(true)
  }

  // Focus and blur
  const handleFocus = () => {
    clearTimeout(blurTimer)
    setHasFocus(true)
    setMenuVisible(true)
  }

  const handleBlur = () => {
    blurTimer = window.setTimeout(() => {
      setHasFocus(false)
      setMenuVisible(false)
      props.onBlur?.()
    }, 200)
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

    document.addEventListener('selectionchange', handleSelectionChange)
  })

  onCleanup(() => {
    clearTimeout(blurTimer)
    document.removeEventListener('selectionchange', handleSelectionChange)
  })

  const [showingInsert, showInsert] = createSignal<string | undefined>()
  const handleAction = (action: CommandType | CommandGroupType) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    if (isGroup(action)) {
      // Группы обрабатываются через DropDown в SimpleToolbar
      return
    }

    switch (action) {
      case 'bold':
      case 'italic':
      case 'link':
      case 'blockquote':
      case 'h1':
      case 'h2':
      case 'h3': {
        // Проверяем текущее состояние форматирования
        if (hasFormatting(action, selection)) {
          removeFormatting(action, {
            range: selection.getRangeAt(0),
            text: selection.toString(),
            isEmpty: selection.isCollapsed,
            position: { top: selection.anchorOffset, left: selection.anchorOffset }
          })
        } else {
          applyFormatting(action, {
            range: selection.getRangeAt(0),
            text: selection.toString(),
            isEmpty: selection.isCollapsed,
            position: { top: selection.anchorOffset, left: selection.anchorOffset }
          })
        }
        break
      }

      case 'image': {
        showModal('editorUploadImage')
        break
      }

      case 'video':
      case 'footnote': {
        showInsert(action)
        break
      }

      default: {
        console.warn(`Unsupported action: ${action}`)
        break
      }
    }

    // Обновляем состояние после форматирования
    updateActiveFormats()

    // Обновляем контент
    const content = editorRef()!.innerHTML
    setContent(content)
    props.onChange?.(content)
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
    updateSelection()

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
      updateSelection()
    }

    setShowFootnoteEditor(false)
  }

  const handleChange = () => {
    const html = editorRef()?.innerHTML || ''
    setContent(html)
    props.onChange?.(html)
  }

  // Add the change handler to the editor element
  createEffect(() => {
    const editor = editorRef()
    if (editor) {
      editor.addEventListener('input', handleChange)

      onCleanup(() => {
        editor.removeEventListener('input', handleChange)
      })
    }
  })

  return (
    <div
      class={clsx(styles.editor, {
        [styles.focused]: hasFocus(),
        [styles.hasContent]: content().length > 0,
        [styles.hasSelection]: !selection().isEmpty,
        [styles.readOnly]: props.readOnly
      })}
      data-editor-id={props.editorId}
    >
      <div class={styles.limitContainer}>
        <small class={styles.limit}>
          {content().length} / {props.limit || '∞'}
        </small>
      </div>

      <div
        ref={setEditorRef}
        class={styles.content}
        contentEditable={!props.readOnly}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={updateSelection}
        onSelect={updateSelection}
        onPaste={handlePaste}
        onDrop={(e) => {
          e.preventDefault()
          handleDropFiles(e.dataTransfer?.files || [])
        }}
        data-placeholder={props.placeholder}
      />

      <div class={styles.actions}>
        <div
          class={clsx(styles.toolbarContainer, {
            [styles.visible]: menuVisible() && !selection().isEmpty && hasFocus(),
            [styles.bubble]: props.bubble
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
            position={props.bubble ? undefined : menuPosition()}
            commands={props.commands as CommandType[]}
            onAction={handleAction}
            currentFormats={activeFormats()}
          />
        </div>

        {/* Кнопки действий */}
        <Show when={!props.hideButtons && !props.readOnly && content().length > 0}>
          <div class={styles.buttons}>
            <Button value={t('Cancel')} variant="secondary" onClick={handleClear} />
            <Button value={t('Submit')} variant="primary" onClick={handleSubmit} />
          </div>
        </Show>
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
            onSubmit={(content) => {
              handleSquibSubmit(content)
              return true
            }}
            onCancel={() => setShowSquibEditor(false)}
          />
        </Show>
        <Show when={showFootnoteEditor()}>
          <SimpleRichEditor
            commands={['bold', 'italic', 'highlight', 'link']}
            bubble={true}
            content={selection().text}
            placeholder={t('Enter text...')}
            onSubmit={(content) => {
              handleFootnoteSubmit(content)
              return true
            }}
            onCancel={() => setShowFootnoteEditor(false)}
          />
        </Show>
      </Portal>
    </div>
  )
}
