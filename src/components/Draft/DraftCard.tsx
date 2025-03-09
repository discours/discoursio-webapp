import { A, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import type { Draft } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'

import styles from './DraftCard.module.scss'

type Props = {
  draft: Draft
  onPublish: () => void
  onDelete: () => void
}

/**
 * Компонент для отображения черновика
 * @component
 * @example
 * ```tsx
 * <DraftCard
 *   draft={draftData}
 *   onDelete={() => handleDelete(draftId)}
 *   onPublish={() => handlePublish(draftId)}
 * />
 * ```
 */

export const DraftCard = (props: Props) => {
  const { t, formatDate } = useLocalize()
  const { showConfirm } = useUI()
  const { showSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const handlePublishLinkClick = (e: MouseEvent) => {
    e.preventDefault()
    if (props.draft.topics?.[0]?.slug) {
      props.onPublish()
    } else {
      showSnackbar({ body: t('Please, set the main topic first') })
      navigate(`/edit/${props.draft.id}/settings`)
    }
  }

  const handleDeleteLinkClick = async (e: MouseEvent) => {
    e.preventDefault()

    const isConfirmed = await showConfirm({
      confirmBody: t('Are you sure you want to delete this draft?'),
      confirmButtonLabel: t('Delete'),
      confirmButtonVariant: 'danger',
      declineButtonVariant: 'primary'
    })
    if (isConfirmed) {
      props.onDelete()

      await showSnackbar({ body: t('Draft successfully deleted') })
    }
  }

  return (
    <div class={styles.draft}>
      <div class={styles.created}>
        <Icon name="pencil-outline" class={styles.icon} />{' '}
        {formatDate(new Date(props.draft.created_at * 1000), { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div class={styles.titleContainer}>
        <span class={styles.title}>{props.draft.title || t('Unnamed draft')}</span> {props.draft.subtitle}
      </div>
      <div class={styles.actions}>
        <A class={styles.actionItem} href={`/edit/${props.draft?.id.toString()}`}>
          {t('Edit')}
        </A>
        <span onClick={handlePublishLinkClick} class={clsx(styles.actionItem, styles.publish)}>
          {t('Publish')}
        </span>
        <span onClick={handleDeleteLinkClick} class={clsx(styles.actionItem, styles.delete)}>
          {t('Delete')}
        </span>
      </div>
    </div>
  )
}
