import { Show, untrack } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Draft } from '~/graphql/schema/core.gen'
import styles from '~/styles/views/EditView.module.scss'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { isEmptyContent } from '../SimpleRichEditor/lib/empty'
import { EditorData } from '../SimpleRichEditor/lib/types'

/**
 * Компонент для лида (краткого вступления)
 *
 * @param props Свойства компонента
 * @returns SolidJS компонент
 */
export const LeadComponent = (props: {
  draft?: Draft
  isVisible: boolean
  getEditorContent: (id: string) => string
  setLeadEditorRef: (el: HTMLDivElement) => void
  onLeadChange: (data: EditorData) => void
  onLeadSave: () => void
  onShowLead: () => void
  handleEditorInput: () => void
}) => {
  const { t } = useLocalize()

  return (
    <>
      <Show when={props.isVisible}>
        <div class={styles.leadEditorWrapper}>
          <SimpleRichEditor
            editorId={`draft-${props.draft?.id}-lead`}
            fieldType="lead"
            toolbar="bottom"
            commands={['bold', 'italic', 'link']}
            placeholder={t('A short introduction to keep the reader interested')}
            content={props.getEditorContent(`draft-${props.draft?.id}-lead`) || props.draft?.lead || ''}
            onChange={(data) => untrack(() => props.onLeadChange(data))}
            onInit={(instance) => {
              props.setLeadEditorRef(instance.editor)
              if (instance.editor) {
                instance.editor.addEventListener('input', props.handleEditorInput)
              }
            }}
            onBlur={() => props.onLeadSave()}
          />
        </div>
      </Show>
      <Show when={!props.isVisible && props.draft?.lead}>
        <div
          class={styles.leadContentDisplay}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!props.isVisible) props.onShowLead()
          }}
        >
          {(() => {
            const draftId = props.draft?.id || 0
            const leadContent = props.getEditorContent(`draft-${draftId}-lead`) || props.draft?.lead || ''

            if (isEmptyContent(leadContent)) {
              return null
            }

            return <div innerHTML={leadContent} class={styles.leadContentText} />
          })()}
        </div>
      </Show>
    </>
  )
}
