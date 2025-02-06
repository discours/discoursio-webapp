import { clsx } from 'clsx'
import sanitizeHtml from 'sanitize-html'
import { Component, createSignal, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'

import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import { useDropFiles } from './lib/drop'
import { handleContentPaste } from './lib/embed'
import { useKeyboardHandlers } from './lib/keyboard'
import { useEditor } from './lib/state'
import { EditorBubbleMenu } from './menu/EditorBubbleMenu'
import { EditorFloatingMenu } from './menu/EditorFloatingMenu'

import styles from './RichEditor.module.scss'

/**
 * Rich text editor component with formatting controls and content management
 *
 * Features:
 * - Basic text formatting (bold, italic, links)
 * - Block elements (headings, quotes)
 * - Media embedding (images, videos)
 * - Content autosave
 * - Character counter
 * - Paste handling
 * - Keyboard shortcuts
 * - Sliding toolbar animation
 *
 * @example
 * ```tsx
 * <RichEditor
 *   content="Initial content"
 *   onChange={(content) => console.log(content)}
 *   onSubmit={async (content) => {
 *     await saveContent(content)
 *     return true
 *   }}
 *   placeholder="Start typing..."
 *   limit={1000}
 * />
 * ```
 */
export interface RichEditorProps {
  /** Initial HTML content */
  content?: string
  /** Called when content changes */
  onChange?: (content: string) => void
  /** Called when Save button clicked. Should return true if save successful */
  onSubmit?: (content: string) => Promise<boolean>
  /** Called when Cancel button clicked */
  onCancel?: () => void
  /** Called when editor loses focus */
  onBlur?: () => void
  /** Placeholder text shown when editor is empty */
  placeholder?: string
  /** Whether to focus editor on mount */
  autoFocus?: boolean
  /** Whether editor is in read-only mode */
  readOnly?: boolean
  /** Maximum character count limit */
  limit?: number
  /** ID for autosave storage key */
  shoutId?: number
}

export const RichEditor: Component<RichEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>()
  const [isFocused, setIsFocused] = createSignal(false)

  const { state, updateState, setIsBlurred, counter } = useEditor(
    {
      content: props.content,
      storageKey: `rich-editor-${props.shoutId || 'new'}`,
      autoSave: !props.readOnly
    },
    editorRef
  )

  const execCommand = (command: string, value?: string) => {
    const editor = editorRef()
    if (!editor) return false

    try {
      editor.focus()
      const result = document.execCommand(command, false, value)
      updateState()
      return result
    } catch (e) {
      console.error(`Failed to execute command ${command}:`, e)
      return false
    }
  }

  const handleSubmit = async () => {
    if (!props.onSubmit) return

    try {
      const sanitizedContent = sanitizeHtml(editorRef()?.innerHTML || '')
      const success = await props.onSubmit(sanitizedContent)

      if (success) {
        showSnackbar({ body: t('Changes saved') })
      }
    } catch (error) {
      console.error('Submit error:', error)
      showSnackbar({ body: t('Save failed'), type: 'error' })
    }
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

  const { handleDropFiles } = useDropFiles()

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    const editor = editorRef()
    if (editor) {
      editor.classList.add(styles.dragover)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    const editor = editorRef()
    if (editor) {
      editor.classList.remove(styles.dragover)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const editor = editorRef()
    if (editor) {
      editor.classList.remove(styles.dragover)
      if (e.dataTransfer?.files) {
        handleDropFiles(e.dataTransfer.files)
      }
    }
  }

  onMount(() => {
    const editor = editorRef()
    if (!editor) return

    if (props.placeholder) {
      editor.setAttribute('data-placeholder', props.placeholder)

      const updateEmptyClass = () => {
        const isEmpty = !editor.textContent?.trim()
        editor.classList.toggle('empty', isEmpty)
      }

      editor.addEventListener('input', updateEmptyClass)
      updateEmptyClass()

      onCleanup(() => {
        editor.removeEventListener('input', updateEmptyClass)
      })
    }

    if (props.autoFocus) {
      editor.focus()
    }

    updateState()
  })
  const { showModal } = useUI()
  return (
    <div
      class={clsx(styles.richEditor, {
        [styles.readOnly]: props.readOnly,
        [styles.focused]: isFocused()
      })}
    >
      <div
        ref={setEditorRef}
        class={styles.content}
        contentEditable={!props.readOnly}
        onFocus={() => {
          setIsFocused(true)
          setIsBlurred(false)
        }}
        onBlur={() => {
          setIsFocused(false)
          setIsBlurred(true)
        }}
        onInput={updateState}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-placeholder={props.placeholder}
        data-drop-text={t('Drop images here')}
      />

      <Portal>
        <Show when={!props.readOnly && state.selection.isEmpty}>
          <EditorFloatingMenu
            position={state.selection.position || { top: 0, left: 0 }}
            onAddImage={() => showModal('uploadImage')}
            onAddVideo={() => showModal('insertVideo')}
            onAddLink={() => showModal('insertLink')}
            onAddHeading={(level) => execCommand('formatBlock', `<h${level}>`)}
          />

          <EditorBubbleMenu
            position={state.selection.position || { top: 0, left: 0 }}
            format={state.format}
            execCommand={execCommand}
            onBold={() => execCommand('bold')}
            onItalic={() => execCommand('italic')}
            onLink={() => showModal('insertLink')}
            onBlockquote={() => execCommand('formatBlock', '<blockquote>')}
          />
        </Show>
      </Portal>

      <Show when={!props.readOnly}>
        <EditorFloatingMenu
          position={state.selection.position || { top: 0, left: 0 }}
          onAddImage={() => showModal('uploadImage')}
          onAddVideo={() => showModal('insertVideo')}
          onAddLink={() => showModal('insertLink')}
          onAddHeading={(level) => execCommand('formatBlock', `<h${level}>`)}
        />
        <div class={styles.footer}>
          <div class={styles.counter}>
            {counter()} / {props.limit || '∞'}
          </div>
          <div class={styles.actions}>
            <Button variant="secondary" value={t('Cancel')} onClick={props.onCancel} />
            <Button variant="primary" value={t('Save')} onClick={handleSubmit} disabled={counter() === 0} />
          </div>
        </div>
      </Show>
    </div>
  )
}
