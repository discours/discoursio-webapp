import { Editor, isTextSelection } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/extension-bubble-menu'
import { CharacterCount } from '@tiptap/extension-character-count'
import { FloatingMenu } from '@tiptap/extension-floating-menu'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import { createTiptapEditor } from 'solid-tiptap'
import { sticky } from 'tippy.js'
import { useSnackbar } from '~/context/ui'
import { base, custom, extended } from '~/lib/editorExtensions'
import { handleClipboardPaste } from '~/lib/handleClipboardPaste'
import { useEditorContext } from '../../context/editor'
import { useLocalize } from '../../context/localize'
import { useSession } from '../../context/session'
import { BlockquoteBubbleMenu } from './Toolbar/BlockquoteBubbleMenu'
import { EditorFloatingMenu } from './Toolbar/EditorFloatingMenu'
import { FigureBubbleMenu } from './Toolbar/FigureBubbleMenu'
import { FullBubbleMenu } from './Toolbar/FullBubbleMenu'
import { IncutBubbleMenu } from './Toolbar/IncutBubbleMenu'
import { ArticleNode } from './extensions/Article'
import { TrailingNode } from './extensions/TrailingNode'
import './Editor.module.scss'
import './EditorProseMirror.scss'

type Props = {
  shoutId: number
  initialContent?: string
  // onChange?: (text: string) => void
}

// Editor uses context/editor to keep content

export const EditorComponent = (props: Props) => {
  const { t } = useLocalize()
  const { session } = useSession()
  const { showSnackbar } = useSnackbar()
  const { setEditing } = useEditorContext()
  const [isCommonMarkup, setIsCommonMarkup] = createSignal(false)
  const [shouldShowTextBubbleMenu, setShouldShowTextBubbleMenu] = createSignal(false)
  const [editorElRef, setEditorElRef] = createSignal<HTMLElement | undefined>()
  const [incutBubbleMenuRef, setIncutBubbleMenuRef] = createSignal<HTMLDivElement | undefined>()
  const [figureBubbleMenuRef, setFigureBubbleMenuRef] = createSignal<HTMLDivElement | undefined>()
  const [blockquoteBubbleMenuRef, setBlockquoteBubbleMenuRef] = createSignal<HTMLDivElement | undefined>()
  const [floatingMenuRef, setFloatingMenuRef] = createSignal<HTMLDivElement | undefined>()
  const [textBubbleMenuRef, setFullBubbleMenuRef] = createSignal<HTMLDivElement | undefined>()

  const editor: () => Editor | undefined = createTiptapEditor(() => ({
    element: editorElRef()!,
    editorProps: {
      attributes: {
        class: 'articleEditor'
      },
      transformPastedHTML(html) {
        return html.replaceAll(/<img.*?>/g, '')
      },
      handlePaste: () => {
        showSnackbar({ body: t('Uploading image') })
        handleClipboardPaste(editor(), session()?.access_token || '').then(() => false)
        return false
      }
    },
    extensions: [
      ...base,
      ...custom,
      ...extended,
      Placeholder.configure({
        placeholder: t('Add a link or click plus to embed media')
      }),
      CharacterCount.configure(),
      // https://github.com/ueberdosis/tiptap/issues/2589#issuecomment-1093084689
      BubbleMenu.configure({
        pluginKey: 'textBubbleMenu',
        element: textBubbleMenuRef()!,
        shouldShow: ({ editor: e, view, state: { doc, selection }, from, to }) => {
          const isEmptyTextBlock = doc.textBetween(from, to).length === 0 && isTextSelection(selection)
          if (isEmptyTextBlock) {
            e.chain().focus().removeTextWrap({ class: 'highlight-fake-selection' }).run()
          }
          setIsCommonMarkup(e.isActive('figcaption'))
          const result =
            (view.hasFocus() &&
              !selection.empty &&
              !isEmptyTextBlock &&
              !e.isActive('image') &&
              !e.isActive('figure')) ||
            e.isActive('footnote') ||
            (e.isActive('figcaption') && !selection.empty)
          setShouldShowTextBubbleMenu(result)
          return result
        },
        tippyOptions: {
          plugins: [sticky],
          sticky: true
        }
      }),
      BubbleMenu.configure({
        pluginKey: 'blockquoteBubbleMenu',
        element: blockquoteBubbleMenuRef()!,
        shouldShow: ({ editor: e, state }) => {
          const { selection } = state
          const { empty } = selection
          return empty && e.isActive('blockquote')
        },
        tippyOptions: {
          offset: [0, 0],
          placement: 'top',
          getReferenceClientRect: (): DOMRect => {
            const selectedElement = editor()?.view.dom.querySelector('.has-focus') as HTMLElement | null
            if (selectedElement) {
              return selectedElement.getBoundingClientRect()
            }
            return new DOMRect()
          }
        }
      }),
      BubbleMenu.configure({
        pluginKey: 'incutBubbleMenu',
        element: incutBubbleMenuRef()!,
        shouldShow: ({ editor: e, state }) => {
          const { selection } = state
          const { empty } = selection
          return empty && e.isActive('article')
        },
        tippyOptions: {
          offset: [0, -16],
          placement: 'top',
          getReferenceClientRect: (): DOMRect => {
            const selectedElement = editor()?.view.dom.querySelector('.has-focus') as HTMLElement | null
            return selectedElement?.getBoundingClientRect() || new DOMRect()
          }
        }
      }),
      BubbleMenu.configure({
        pluginKey: 'imageBubbleMenu',
        element: figureBubbleMenuRef()!,
        shouldShow: ({ editor: e, view }) => {
          return view.hasFocus() && e.isActive('image')
        }
      }),
      FloatingMenu.configure({
        tippyOptions: {
          placement: 'left',
          appendTo: document.body
        },
        element: floatingMenuRef()!
      }),
      TrailingNode,
      ArticleNode
    ],
    enablePasteRules: [Link],
    content: props.initialContent || ''
  }))

  // store tiptap editor in context provider's signal to use it in Panel
  createEffect(() => setEditing(editor() || undefined))

  onCleanup(() => {
    editor()?.destroy()
  })

  return (
    <>
      <div class="row">
        <div class="col-md-5" />
        <div class="col-md-12">
          <div ref={setEditorElRef} id="editorBody" />
        </div>
      </div>

      <FullBubbleMenu
        editor={editor}
        ref={setFullBubbleMenuRef}
        shouldShow={shouldShowTextBubbleMenu}
        isCommonMarkup={isCommonMarkup()}
      />
      <BlockquoteBubbleMenu editor={editor() as Editor} ref={setBlockquoteBubbleMenuRef} />
      <FigureBubbleMenu editor={editor() as Editor} ref={setFigureBubbleMenuRef} />
      <IncutBubbleMenu editor={editor() as Editor} ref={setIncutBubbleMenuRef} />
      <EditorFloatingMenu editor={editor() as Editor} ref={setFloatingMenuRef} />
    </>
  )
}
