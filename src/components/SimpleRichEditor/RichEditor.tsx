import { clsx } from 'clsx'
import sanitizeHtml from 'sanitize-html'
import { Component, createSignal, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'

import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import { handleContentPaste } from './lib/embed'
import { useKeyboardHandlers } from './lib/keyboard'
import { useEditor } from './lib/state'
import { EditorBubbleMenu } from './menu/EditorBubbleMenu'
import { EditorToolbar } from './menu/EditorToolbar'

import styles from './RichEditor.module.scss'

export interface RichEditorProps {
  content?: string
  onChange?: (content: string) => void
  onSubmit?: (content: string) => Promise<boolean>
  onCancel?: () => void
  onBlur?: () => void
  placeholder?: string
  autoFocus?: boolean
  readOnly?: boolean
  limit?: number
  shoutId?: number // TODO: use or remove
}

export const RichEditor: Component<RichEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const [editorRef, setEditorRef] = createSignal<HTMLDivElement>()

  const {
    state,
    updateState,
    isBlurred,
    setIsBlurred,
    counter,
    showBubbleMenu,
    setShowBubbleMenu,
    handleImageUploadWithSnackbar
  } = useEditor(
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

  onMount(() => {
    const editor = editorRef()
    if (!editor) return

    if (props.placeholder) {
      editor.setAttribute('data-placeholder', props.placeholder)
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
        [styles.focused]: !isBlurred()
      })}
    >
      <Show when={!props.readOnly}>
        <EditorToolbar
          state={state}
          execCommand={execCommand}
          handleImageUpload={handleImageUploadWithSnackbar}
          handleLinkButtonClick={() => showModal('insertLink')}
        />
      </Show>

      <div
        ref={setEditorRef}
        class={styles.content}
        contentEditable={!props.readOnly}
        onFocus={() => setIsBlurred(false)}
        onBlur={() => setIsBlurred(true)}
        onInput={updateState}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={props.placeholder}
        data-drop-text={t('Drop images here')}
      />

      <Show when={!props.readOnly}>
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

      <Portal>
        <Show when={showBubbleMenu() && !isBlurred()}>
          <EditorBubbleMenu
            position={state.selection.position || { top: 0, left: 0 }}
            format={state.format}
            execCommand={execCommand}
            onClose={() => setShowBubbleMenu(false)}
            onBold={() => execCommand('bold')}
            onItalic={() => execCommand('italic')}
            onLink={() => execCommand('link')}
            onBlockquote={() => execCommand('blockquote')}
          />
        </Show>
      </Portal>
    </div>
  )
}
