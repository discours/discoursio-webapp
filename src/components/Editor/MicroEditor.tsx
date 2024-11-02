import BubbleMenu from '@tiptap/extension-bubble-menu'
import Placeholder from '@tiptap/extension-placeholder'
import clsx from 'clsx'
import { type JSX, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { createTiptapEditor, useEditorHTML } from 'solid-tiptap'
import { minimal } from '~/lib/editorExtensions'
import { MicroBubbleMenu } from './Toolbar/MicroBubbleMenu'

import styles from './MiniEditor.module.scss'

interface MicroEditorProps {
  content?: string
  onChange?: (content: string) => void
  onSubmit?: (content: string) => void
  onBlur?: () => void
  placeholder?: string
  bordered?: boolean
  shownAsLead?: boolean
  focusOnMount?: boolean
}

// MicroEditor uses onChange to update the content

export const MicroEditor = (props: MicroEditorProps): JSX.Element => {
  const [editorElement, setEditorElement] = createSignal<HTMLDivElement>()
  const [bubbleMenuElement, setBubbleMenuElement] = createSignal<HTMLDivElement>()
  const [isBlurred, setIsBlurred] = createSignal(false)
  let blurTimer: number | undefined

  const editor = createTiptapEditor(() => ({
    element: editorElement()!,
    extensions: [
      ...minimal,
      Placeholder.configure({ emptyNodeClass: styles.emptyNode, placeholder: props.placeholder }),
      BubbleMenu.configure({
        element: bubbleMenuElement()!,
        shouldShow: ({ state: { selection }, editor }) => !selection.empty || editor.isActive('link')
      })
    ],
    editorProps: {
      attributes: {
        class: styles.compactEditor
      }
    },
    content: props.content || '',
    autofocus: 'end'
  }))

  const html = useEditorHTML(editor)
  createEffect(on(html, (c?: string) => c && props.onChange?.(c)))

  createEffect(
    on(
      isBlurred,
      (lost?: boolean) => {
        if (lost && props.shownAsLead && props.onBlur) {
          setTimeout(props.onBlur, 1000)
        }
      },
      { defer: true }
    )
  )
  const handleBlur = () => {
    blurTimer = window.setTimeout(() => {
      const isEmpty = editor()?.view.state.doc.textContent.trim() === ''
      if (isEmpty && props.shownAsLead && props.onBlur) {
        props.onBlur()
      }
      setIsBlurred(true)
    }, 100) // небольшая задержка для обработки кликов внутри редактора
  }

  const handleFocus = () => {
    clearTimeout(blurTimer)
    setIsBlurred(false)
  }

  createEffect(() => {
    const editorInstance = editor()
    if (editorInstance) {
      editorInstance.on('blur', handleBlur)
      editorInstance.on('focus', handleFocus)
    }
  })

  onCleanup(() => {
    clearTimeout(blurTimer)
    editor()?.off('blur', handleBlur)
    editor()?.off('focus', handleFocus)
  })

  onMount(() => props.focusOnMount && editor()?.commands.focus())

  return (
    <div
      class={clsx(styles.MiniEditor, {
        [styles.bordered]: props.bordered
      })}
    >
      <MicroBubbleMenu editor={editor} ref={setBubbleMenuElement} />
      <div id="micro-editor" ref={setEditorElement} style={styles.minimal} />
    </div>
  )
}

export default MicroEditor
