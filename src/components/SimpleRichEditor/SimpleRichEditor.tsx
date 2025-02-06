import { clsx } from 'clsx'
import { Component, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'

import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import { handleContentPaste } from './lib/embed'
import { useKeyboardHandlers } from './lib/keyboard'
import { useEditor } from './lib/state'
import { EditorCommand, MenuProps } from './lib/types'

import styles from './SimpleRichEditor.module.scss'
import { EditorToolbar } from './menu/EditorToolbar'
import { BubbleMenu } from './menu/BubbleMenu'

/**
 * Main rich text editor component with formatting and content management
 *
 * Features:
 * - WYSIWYG editing
 * - Formatting toolbar
 * - Media embedding
 * - Link handling
 * - Keyboard shortcuts
 * - Autosave in localStorage
 * - Character counter
 *
 * @example
 * ```tsx
 * <SimpleRichEditor
 *   content={initialContent}
 *   onChange={(html) => updateContent(html)}
 *   onSubmit={async (html) => {
 *     await saveContent(html)
 *     return true
 *   }}
 *   placeholder="Start writing..."
 *   limit={1000}
 * />
 * ```
 */
interface SimpleRichEditorProps {
  /** Initial HTML content */
  content?: string
  /** Called when content changes */
  onChange?: (content: string) => void
  /** Called when editor submitted, should return success status */
  onSubmit?: (content: string) => Promise<boolean> | boolean
  /** Called when editing cancelled */
  onCancel?: () => void
  /** Called when editor loses focus */
  onBlur?: () => void
  /** Placeholder text when empty */
  placeholder?: string
  /** Whether to focus on mount */
  autoFocus?: boolean
  /** Whether editor is read-only */
  readOnly?: boolean
  /** Maximum character limit */
  limit?: number
  /** ID for autosave storage */
  shoutId?: number
  /** Whether editor is showing bubble menu */
  bubble?: boolean
  /** Commands to show in the toolbar */
  commands?: string[]
}

export const SimpleRichEditor: Component<SimpleRichEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const { showModal } = useUI()
  
  let editorRef: HTMLDivElement | undefined
  let blurTimer: number
  
  const [menuVisible, setMenuVisible] = createSignal(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = createSignal({ top: 0, left: 0 })
  
  const {
    state,
    updateState,
    isBlurred,
    setIsBlurred,
    counter,
    handleImageUploadWithSnackbar,
  } = useEditor(
    {
      content: props.content,
      storageKey: 'simple-editor',
      autoSave: true
    },
    () => editorRef
  )
  
  const execCommand = (command: string, value?: string) => {
    if (!editorRef) return false

    try {
      editorRef.focus()
      const result = document.execCommand(command, false, value)
      updateState()
      return result
    } catch (e) {
      console.error(`Failed to execute command ${command}:`, e)
      return false
    }
  }


  const editorClasses = createMemo(() => ({
    [styles.bubble]: props.bubble,
    [styles.isFocused]: !isBlurred()
  }))

  const buttonsVisible = createMemo(() => counter() > 1)

  const limitText = createMemo(() => `${counter()} / ${props.limit || '∞'}`)

  const handleSubmit = async () => {
    if (!props.onSubmit || counter() === 0) return

    try {
      const success = await props.onSubmit(state.content)
      if (success) {
        editorRef!.innerHTML = ''
        updateState()
      }
      return success
    } catch (error) {
      console.error('Error submitting content:', error)
      return false
    }
  }

  const handleClear = () => {
    editorRef!.innerHTML = ''
    updateState()
    props.onCancel?.()
  }

  const handleSelectionChange = () => {
    if (!props.bubble) return
    
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setMenuVisible(false)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const editorRect = editorRef?.getBoundingClientRect()
    
    if (!editorRect) return

    setBubbleMenuPosition({
      top: editorRect.bottom + 8,
      left: editorRect.left + 8
    })
    setMenuVisible(true)
  }

  const handleFocus = () => {
    clearTimeout(blurTimer)
    setIsBlurred(false)
    if (!props.bubble) {
      setMenuVisible(true)
    }
    document.addEventListener('selectionchange', handleSelectionChange)
  }

  const handleBlur = (e: FocusEvent) => {
    // Проверяем, что клик был не по тулбару
    const isToolbarClick = (e.relatedTarget as HTMLElement)?.closest(`.${styles.toolbar}`)
    if (isToolbarClick) {
      e.preventDefault()
      return
    }

    blurTimer = window.setTimeout(() => {
      setIsBlurred(true)
      setMenuVisible(false)
      updateState()

      if (counter() === 0) {
        props.onBlur?.()
      }
    }, 100)
  }

  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault()

    const text = e.clipboardData?.getData('text/plain')
    if (!text) return

    await handleContentPaste(text, {
      showLoading: () => showSnackbar({ body: t('Analyzing content...') }),
      insertText: (text) => execCommand('insertText', text),
      insertHtml: (html) => execCommand('insertHTML', html)
    })
  }

  const { handleKeyDown } = useKeyboardHandlers(state, execCommand, handleSubmit, () =>
    showModal('insertLink')
  )

  const handleDropFiles = async (files: File[]) => {
    try {
      const uploadedUrls = await handleImageUploadWithSnackbar(files)
      
      uploadedUrls.forEach((url) => {
        const imageHtml = `<img src="${url}" alt="" />`
        execCommand('insertHTML', imageHtml)
      })
    } catch (error) {
      console.error('Error handling dropped files:', error)
    }
  }

  // Наборы команд для разных режимов
  const microCommands: EditorCommand[] = ['bold', 'italic', 'link']
  const fullCommands: EditorCommand[] = ['bold', 'italic', 'link', 'blockquote', 'image']

  // Базовая конфигурация команд
  const commandConfig = {
    bold: { icon: 'editor-bold', title: 'Bold', shortcut: '⌘B' },
    italic: { icon: 'editor-italic', title: 'Italic', shortcut: '⌘I' },
    link: { icon: 'editor-link', title: 'Link', shortcut: '⌘K' },
    blockquote: { icon: 'editor-quote', title: 'Quote' },
    image: { icon: 'editor-image', title: 'Image' }
  }

  // Действия для команд
  const commandActions = {
    bold: () => execCommand('bold'),
    italic: () => execCommand('italic'),
    link: () => showModal('insertLink'),
    blockquote: () => execCommand('blockquote'),
    image: () => showModal('uploadImage')
  }

  onMount(() => {
    if (!editorRef) return

    if (props.placeholder) {
      editorRef.setAttribute('data-placeholder', props.placeholder)
    }

    if (props.autoFocus) {
      editorRef.focus()
    }

    updateState()
  })

  onCleanup(() => {
    clearTimeout(blurTimer)
    document.removeEventListener('selectionchange', handleSelectionChange)
  })

  return (
    <div class={clsx(styles.editor, editorClasses())}>
      <div class={styles.limitContainer}>
        <small class={styles.limit}>{limitText()}</small>
      </div>
      <div
        ref={editorRef}
        class={styles.content}
        contentEditable
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={updateState}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={props.placeholder}
      />

      <div class={styles.actions}>
        <Show when={props.bubble} fallback={
          <EditorToolbar
            commands={fullCommands}
            config={commandConfig}
            state={state}
            isVisible={true}
            execCommand={execCommand}
            handleDropFiles={handleDropFiles}
            handleLinkButtonClick={() => showModal('insertLink')}
            restoreSelection={() => editorRef?.focus()}
            actions={commandActions}
          />}>
          <BubbleMenu
            commands={microCommands}
            config={commandConfig}
            state={state}
            position={bubbleMenuPosition()}
            isVisible={menuVisible()}
            onClose={() => setMenuVisible(false)}
            actions={commandActions}
          />
        </Show>
        <Button value={t('Отмена')} disabled={counter() === 0} variant='secondary' onClick={handleClear} />
        <Button value={t('Отправить')} disabled={counter() === 0} variant="primary" onClick={handleSubmit} />
      </div>

    </div>
  )
}
