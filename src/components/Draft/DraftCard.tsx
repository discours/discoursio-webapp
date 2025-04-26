import { A, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show } from 'solid-js'
import type { ExtendedDraft } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import { Icon } from '../_shared/Icon'

import styles from './DraftCard.module.scss'

type Props = {
  draft: ExtendedDraft
  onDelete: () => void
  onPublish: () => void
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
  const { t, formatDate, createValidDate } = useLocalize()
  const { showConfirm } = useUI()
  const { showSnackbar } = useSnackbar()
  const navigate = useNavigate()
  
  // Получение URL для редактирования черновика
  const getEditUrl = () => {
    if (props.draft.id) {
      return `/edit/${props.draft.id}`
    } else if (props.draft.localId) {
      return `/edit/local/${props.draft.localId}`
    }
    return '#'
  }
  
  // Обработчик клика на заголовок для редактирования
  const handleEditClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(getEditUrl())
  }
  
  const handlePublishLinkClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (props.draft.id) {
      navigate(`/edit/${props.draft.id}/settings`)
    } else if (props.draft.localId) {
      navigate(`/edit/local/${props.draft.localId}/settings`)
    } else {
      showSnackbar({ body: t('Cannot publish draft without ID') })
    }
  }

  const handleDeleteLinkClick = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

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
      <div class={styles.draftContent}>
        <div class={styles.contentTop}>
          <div class={styles.titleContainer} onClick={handleEditClick}>
            <span class={styles.title}>{props.draft.title || t('Unnamed draft')}</span>
            <span class={styles.subtitle}>{props.draft.subtitle}</span>
          </div>

          <div class={styles.created}>
            <Show when={props.draft.isLocalOnly}>
              <span class={styles.localBadge} title={t('This draft is saved only locally')}>
                <Icon name="file-storage" class={styles.localIcon} />
              </span>
            </Show>
            {(() => {
              const date = createValidDate(props.draft.created_at);
              if (!date) return '';
              return formatDate(date, { hour: '2-digit', minute: '2-digit' });
            })()}
          </div>
        </div>

        <Show when={props.draft.cover}>
          <div class={styles.coverOverlay} style={{ 'background-image': `url(${props.draft.cover})` }} />
        </Show>

        <div class={styles.actions}>
          <A
            class={styles.actionItem}
            href={getEditUrl()}
            title={t('Edit')}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="pencil-outline" class={styles.actionIcon} />
            <span class={styles.actionText}>{t('Edit')}</span>
          </A>
          <span
            onClick={handlePublishLinkClick}
            class={clsx(styles.actionItem, styles.publish)}
            title={props.draft.isLocalOnly ? t('Save draft') : t('Publish')}
          >
            <Icon name={props.draft.isLocalOnly ? 'cloud-upload' : 'publish'} class={styles.actionIcon} />
            <span class={styles.actionText}>
              {t(props.draft.isLocalOnly ? 'Save draft' : 'Publish')}
            </span>
          </span>
          <span
            onClick={handleDeleteLinkClick}
            class={clsx(styles.actionItem, styles.delete)}
            title={t('Delete')}
          >
            <Icon name="trash" class={styles.actionIcon} />
            <span class={styles.actionText}>{t('Delete')}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
