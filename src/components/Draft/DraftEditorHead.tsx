import clsx from 'clsx'
import { Show, untrack } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Draft } from '~/graphql/schema/core.gen'
import styles from '~/styles/views/EditView.module.scss'
import { LayoutType } from '~/types/nav'
import GrowingTextarea from '../_shared/GrowingTextarea/GrowingTextarea'

export const MAX_HEADER_LIMIT = 100

// Заменяем any на конкретный тип для validationErrors
type ValidationErrors = {
  title?: string
  slug?: string
  topic_ids?: string
  main_topic_id?: string
  [key: string]: string | undefined
}

/**
 * Компонент для заголовка и подзаголовка
 *
 * @param props Свойства компонента
 * @returns React компонент
 */
export const TitleSection = (props: {
  draft?: Draft
  isTitleClicked: boolean
  isSubtitleVisible: boolean
  isLeadVisible: boolean
  onTitleClick: () => void
  onShowSubtitle: () => void
  onShowLead: () => void
  onTitleChange: (value: string) => void
  validationErrors: ValidationErrors
}) => {
  const { t } = useLocalize()

  const articleTitle = () => {
    switch (props.draft?.layout as LayoutType) {
      case 'audio':
        return t('Album name')
      case 'image':
        return t('Gallery name')
      default:
        return t('Header')
    }
  }

  return (
    <>
      <div class={styles.headingActions}>
        <Show when={props.isTitleClicked && !props.isSubtitleVisible && props.draft?.layout !== 'audio'}>
          <a class={styles.action} onClick={props.onShowSubtitle}>
            {t('Add subtitle')}
          </a>
        </Show>
        <Show
          when={
            props.isTitleClicked &&
            !props.isLeadVisible &&
            !props.draft?.lead &&
            props.draft?.layout !== 'audio'
          }
        >
          <a class={styles.action} onClick={props.onShowLead}>
            {t('Add intro')}
          </a>
        </Show>
      </div>
      <div class={clsx({ [styles.audioHeader]: props.draft?.layout === 'audio' })}>
        <div class={styles.inputContainer}>
          <GrowingTextarea
            allowEnterKey={true}
            onChange={(value) => untrack(() => props.onTitleChange(value))}
            class={styles.titleInput}
            placeholder={articleTitle()}
            initialValue={props.draft?.title || ''}
            maxLength={MAX_HEADER_LIMIT}
            onClick={(e) => {
              e.stopPropagation()
              props.onTitleClick()
            }}
          />

          <Show when={props.validationErrors.title}>
            <div class={styles.validationError}>{props.validationErrors.title}</div>
          </Show>
        </div>
      </div>
    </>
  )
}

/**
 * Компонент для подзаголовка
 *
 * @param props Свойства компонента
 * @returns React компонент
 */
export const SubtitleComponent = (props: {
  draft?: Draft
  isVisible: boolean
  onSubtitleChange: (value: string) => void
  setSubtitleInput: (el: HTMLTextAreaElement) => void
}) => {
  const { t } = useLocalize()

  return (
    <Show when={props.isVisible && props.draft}>
      <GrowingTextarea
        textAreaRef={props.setSubtitleInput}
        allowEnterKey={false}
        onChange={(value: string) => untrack(() => props.onSubtitleChange(value))}
        class={styles.subtitleInput}
        placeholder={t('Subheader')}
        initialValue={props.draft?.subtitle || ''}
        maxLength={MAX_HEADER_LIMIT}
      />
    </Show>
  )
}
