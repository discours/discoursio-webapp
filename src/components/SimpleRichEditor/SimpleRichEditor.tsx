import { clsx } from 'clsx'
import { Component, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'

import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'
import { execEditorCommand } from './lib/commands'
import { handleContentPaste } from './lib/embed'
import { useKeyboardHandlers } from './lib/keyboard'
import { useEditor } from './lib/state'
import { EditorMenu } from './menu/EditorMenu'

import styles from './SimpleRichEditor.module.scss'

interface SimpleEditorProps {
  content?: string
  onChange?: (content: string) => void
  onSubmit?: (content: string) => Promise<boolean> | boolean
  onCancel?: () => void
  onBlur?: () => void
  limit?: number
  placeholder?: string
  autoFocus?: boolean
  micro?: boolean
  shownAsLead?: boolean
}

export const SimpleRichEditor: Component<SimpleEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  let editorRef: HTMLDivElement | undefined
  let blurTimer: number

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
      storageKey: 'simple-editor',
      autoSave: true
    },
    () => editorRef
  )

  const execCommand = (command: string, value?: string) => {
    if (!editorRef) return false

    const result = execEditorCommand(editorRef, command, value)
    updateState()
    return result
  }

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

  const handleFocus = () => {
    clearTimeout(blurTimer)
    setIsBlurred(false)
  }

  const handleBlur = () => {
    blurTimer = window.setTimeout(() => {
      setIsBlurred(true)
      updateState()

      if (props.shownAsLead && counter() === 0) {
        props.onBlur?.()
      }
    }, 100)
  }

  const handlePaste = async (e: ClipboardEvent) => {
    if (props.micro) return
    e.preventDefault()

    const text = e.clipboardData?.getData('text/plain')
    if (!text) return

    await handleContentPaste(text, {
      showLoading: () => showSnackbar({ body: t('Analyzing content...') }),
      insertText: (text) => execCommand('insertText', text),
      insertHtml: (html) => execCommand('insertHTML', html)
    })
  }
  const { showModal } = useUI()
  const { handleKeyDown } = useKeyboardHandlers(state, execCommand, handleSubmit, () =>
    showModal('insertLink')
  )

  useOutsideClickHandler({
    containerRef: editorRef,
    handler: () => setShowBubbleMenu(false)
  })

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
  })

  return (
    <div
      class={clsx(styles.editor, {
        [styles.micro]: props.micro,
        [styles.isFocused]: !isBlurred()
      })}
    >
      <EditorMenu
        state={state}
        showBubbleMenu={showBubbleMenu()}
        execCommand={execCommand}
        handleImageUpload={handleImageUploadWithSnackbar}
        showLinkForm={true}
        onBold={() => execCommand('bold')}
        onItalic={() => execCommand('italic')}
        onLink={() => execCommand('link')}
        onBlockquote={() => execCommand('blockquote')}
        onClose={() => setShowBubbleMenu(false)}
        handleLinkButtonClick={() => showModal('insertLink')}
      />

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

      <Show when={!props.micro}>
        <div class={clsx(styles.buttons, { [styles.visible]: counter() > 1 })}>
          <Button value={t('Clear')} variant="secondary" onClick={handleClear} />
          <Button value={t('Save')} variant="primary" onClick={handleSubmit} />
        </div>
      </Show>

      <Show when={counter() > 0}>
        <small class={styles.limit}>
          {counter()} / {props.limit || '∞'}
        </small>
      </Show>
    </div>
  )
}
