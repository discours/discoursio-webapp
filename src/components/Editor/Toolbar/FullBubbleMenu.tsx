import type { Editor } from '@tiptap/core'
import { clsx } from 'clsx'
import { Accessor, Show, createEffect, createSignal, on } from 'solid-js'
import { createEditorTransaction } from 'solid-tiptap'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover/Popover'
import { useEditorContext } from '~/context/editor'
import { useLocalize } from '~/context/localize'
import { SimpleRichEditor } from '../../SimpleRichEditor/SimpleRichEditor'
import { MicroBubbleMenu } from './MicroBubbleMenu'
import { ToolbarControl } from './ToolbarControl'

import styles from './FullBubbleMenu.module.scss'

type FullBubbleMenuProps = {
  editor: () => Editor | undefined
  ref?: (el: HTMLDivElement) => void
  shouldShow: Accessor<boolean>
  isCommonMarkup?: boolean
}

export const FullBubbleMenu = (props: FullBubbleMenuProps) => {
  const { t } = useLocalize()
  const { isCollabMode, setIsCollabMode } = useEditorContext()

  // SIGNALS
  const [textSizeBubbleOpen, setTextSizeBubbleOpen] = createSignal(false)
  const [listBubbleOpen, setListBubbleOpen] = createSignal(false)
  const [footnoteEditorOpen, setFootnoteEditorOpen] = createSignal(false)
  const [footNote, setFootNote] = createSignal<string>()

  // OBSERVERS
  const isActive = (name: string, attributes?: Record<string, string | number>) =>
    createEditorTransaction(props.editor, (editor) => editor?.isActive(name, attributes))
  const isH1 = isActive('heading', { level: 2 })
  const isH2 = isActive('heading', { level: 3 })
  const isH3 = isActive('heading', { level: 4 })
  const isQuote = isActive('blockquote', { 'data-type': 'quote' })
  const isPunchLine = isActive('blockquote', { 'data-type': 'punchline' })
  const isOrderedList = isActive('isOrderedList')
  const isBulletList = isActive('isBulletList')
  const isFootnote = isActive('footnote')
  const isIncut = isActive('article')
  const isFigcaption = isActive('figcaption')
  const isHighlight = isActive('highlight')

  // toggle open / close on submenus
  createEffect(on(props.shouldShow, (x) => !x && setFootnoteEditorOpen(false)))
  createEffect(on(props.shouldShow, (x) => !x && setTextSizeBubbleOpen(false)))
  createEffect(on(props.shouldShow, (x) => !x && setListBubbleOpen(false)))
  const toggleTextSizeMenu = () => setTextSizeBubbleOpen((x) => !x)
  const toggleListMenu = () => setListBubbleOpen((x) => !x)
  const toggleFootnoteEditor = () => setFootnoteEditorOpen((x) => !x)

  // handle footnote
  const updateCurrentFootnoteValue = createEditorTransaction(props.editor, (ed) => {
    if (!isFootnote()) {
      return
    }
    const value = ed?.getAttributes('footnote').value
    setFootNote(value)
  })
  createEffect(on(isFootnote, updateCurrentFootnoteValue))

  const handleAddFootnote = (value: string) => {
    if (footNote()) {
      props.editor()?.chain().focus().updateFootnote({ value }).run()
    } else {
      props.editor()?.chain().focus().setFootnote({ value }).run()
    }
    setFootNote()
    setFootnoteEditorOpen(false)
    return true
  }

  // handle blockquote
  const handleSetPunchline = () => {
    if (isPunchLine()) {
      props.editor()?.chain().focus().toggleBlockquote('punchline').run()
    }
    props.editor()?.chain().focus().toggleBlockquote('quote').run()
    toggleTextSizeMenu()
  }

  const handleSetQuote = () => {
    if (isQuote()) {
      props.editor()?.chain().focus().toggleBlockquote('quote').run()
    }
    props.editor()?.chain().focus().toggleBlockquote('punchline').run()
    toggleTextSizeMenu()
  }

  // submenus

  const TextSizeDropdown = () => (
    <div class={styles.dropDownHolder}>
      <button
        type="button"
        class={clsx(styles.actionButton, { [styles.buttonActive]: textSizeBubbleOpen() })}
        onClick={toggleTextSizeMenu}
      >
        <Icon name="editor-text-size" />
        <Icon name="down-triangle" class={styles.triangle} />
      </button>

      <Show when={textSizeBubbleOpen()}>
        <div class={styles.dropDown}>
          <header>{t('Headers')}</header>
          <div class={styles.actions}>
            <ToolbarControl
              caption={t('Header 1')}
              editor={props.editor()}
              isActive={isH1}
              onChange={() => {
                props.editor()?.chain().focus().toggleHeading({ level: 2 }).run()
                toggleTextSizeMenu()
              }}
            >
              <Icon name="editor-h1" />
            </ToolbarControl>
            <ToolbarControl
              caption={t('Header 2')}
              editor={props.editor()}
              isActive={isH2}
              onChange={() => {
                props.editor()?.chain().focus().toggleHeading({ level: 3 }).run()
                toggleTextSizeMenu()
              }}
            >
              <Icon name="editor-h2" />
            </ToolbarControl>
            <ToolbarControl
              caption={t('Header 3')}
              editor={props.editor()}
              isActive={isH3}
              onChange={() => {
                props.editor()?.chain().focus().toggleHeading({ level: 4 }).run()
                toggleTextSizeMenu()
              }}
            >
              <Icon name="editor-h3" />
            </ToolbarControl>
          </div>
          <header>{t('Quotes')}</header>
          <div class={styles.actions}>
            <ToolbarControl
              caption={t('Quote')}
              editor={props.editor()}
              isActive={isQuote}
              onChange={handleSetPunchline}
            >
              <Icon name="editor-blockquote" />
            </ToolbarControl>
            <ToolbarControl
              caption={t('Punchline')}
              editor={props.editor()}
              isActive={isPunchLine}
              onChange={handleSetQuote}
            >
              <Icon name="editor-quote" />
            </ToolbarControl>
          </div>
          <header>{t('squib')}</header>
          <div class={styles.actions}>
            <ToolbarControl
              caption={t('Incut')}
              editor={props.editor()}
              isActive={isIncut}
              onChange={() => {
                props.editor()?.chain().focus().toggleArticle().run()
                toggleTextSizeMenu()
              }}
            >
              <Icon name="editor-squib" />
            </ToolbarControl>
          </div>
        </div>
      </Show>
    </div>
  )

  const ListDropdown = () => (
    <div class={styles.dropDownHolder}>
      <div>
        <button
          type="button"
          class={clsx(styles.actionButton, { [styles.buttonActive]: listBubbleOpen() })}
          onClick={toggleListMenu}
        >
          <Icon name="editor-ul" />
          <Icon name="down-triangle" class={styles.triangle} />
        </button>
      </div>
      <Show when={listBubbleOpen()}>
        <div class={styles.dropDown}>
          <header>{t('Lists')}</header>
          <div class={styles.actions}>
            <ToolbarControl
              caption={t('Bullet list')}
              isActive={isBulletList}
              editor={props.editor()}
              onChange={() => {
                props.editor()?.chain().focus().toggleBulletList().run()
                toggleListMenu()
              }}
            >
              <Icon name="editor-ul" />
            </ToolbarControl>

            <ToolbarControl
              caption={t('Ordered list')}
              editor={props.editor()}
              isActive={isOrderedList}
              onChange={() => {
                props.editor()?.chain().focus().toggleOrderedList().run()
                toggleListMenu()
              }}
            >
              <Icon name="editor-ol" />
            </ToolbarControl>
          </div>
        </div>
      </Show>
    </div>
  )

  const MainMenu = () => (
    <>
      <Show when={!isFigcaption()}>
        <TextSizeDropdown />
      </Show>

      <MicroBubbleMenu editor={props.editor} noBorders={true} />

      <Show when={!isFigcaption()}>
        <div class={styles.dropDownHolder}>
          <Popover content={t('Highlight')}>
            {(triggerRef: (el: HTMLButtonElement) => void) => (
              <button
                ref={triggerRef}
                type="button"
                class={clsx(styles.actionButton, {
                  [styles.buttonActive]: isHighlight()
                })}
                onClick={() => props.editor()?.chain().focus().toggleHighlight({ color: '#f6e3a1' }).run()}
              >
                <div class={styles.toggleHighlight} />
              </button>
            )}
          </Popover>

          <ToolbarControl
            caption={t('Insert footnote')}
            editor={props.editor()}
            key="footnote"
            onChange={toggleFootnoteEditor}
          >
            <Icon name="editor-footnote" />
          </ToolbarControl>
        </div>

        <div style={{ width: '5px' }} />

        <ListDropdown />

        <div class={styles.dropDownHolder}>
          <Popover content={t('Collaborative mode')}>
            {(triggerRef: (el: HTMLButtonElement) => void) => (
              <button
                ref={triggerRef}
                type="button"
                class={styles.actionButton}
                onClick={() => setIsCollabMode((x) => !x)}
              >
                <Icon name={`comment${isCollabMode() ? '-hover' : ''}`} />
              </button>
            )}
          </Popover>
        </div>
      </Show>
    </>
  )

  return (
    <div ref={props.ref} class={clsx(styles.FullBubbleMenu, { [styles.growWidth]: footnoteEditorOpen() })}>
      <Show when={footnoteEditorOpen()} fallback={<MainMenu />}>
        <SimpleRichEditor
          placeholder={t('Enter footnote text')}
          onSubmit={handleAddFootnote}
          content={footNote()}
          onCancel={toggleFootnoteEditor}
        />
      </Show>
    </div>
  )
}

export default FullBubbleMenu
