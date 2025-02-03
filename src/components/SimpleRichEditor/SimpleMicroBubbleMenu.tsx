import { Show, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import styles from './SimpleMicroBubbleMenu.module.scss'
import { SimpleToolbarControl as Control } from './SimpleToolbarControl'

type Position = {
  top: number
  left: number
}

type Props = {
  position: Position
  format: {
    bold: boolean
    italic: boolean
    link: boolean
  }
  onBold: () => void
  onItalic: () => void
  onLink: () => void
  onClose: () => void
}

export const SimpleMicroBubbleMenu = (props: Props) => {
  const [showLinkForm, setShowLinkForm] = createSignal(false)

  const handleLinkClick = () => {
    if (props.format.link) {
      props.onLink()
    } else {
      setShowLinkForm(true)
    }
  }

  return (
    <div
      class={styles.bubbleMenu}
      style={{
        top: `${props.position.top}px`,
        left: `${props.position.left}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <Show
        when={!showLinkForm()}
        fallback={
          <SimpleInsertLinkForm
            class={styles.linkForm}
            onClose={() => setShowLinkForm(false)}
            onSubmit={(_url: string) => {
              props.onLink()
              setShowLinkForm(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <div class={styles.controls}>
          <Control key="bold" isActive={props.format.bold} onChange={props.onBold} caption="Bold (⌘B)">
            <Icon name="editor-bold" />
          </Control>
          <Control
            key="italic"
            isActive={props.format.italic}
            onChange={props.onItalic}
            caption="Italic (⌘I)"
          >
            <Icon name="editor-italic" />
          </Control>
          <Control key="link" isActive={props.format.link} onChange={handleLinkClick} caption="Link (⌘K)">
            <Icon name="editor-link" />
          </Control>
        </div>
      </Show>
    </div>
  )
}
