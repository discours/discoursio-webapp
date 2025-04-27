import { A, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show } from 'solid-js'
import { toast } from 'solid-toast'
import type { ExtendedDraft } from '~/context/drafts'
import { createValidDate, useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Icon } from '../_shared/Icon'

import styles from './DraftCard.module.scss'

type Props = {
  draft: ExtendedDraft
  onDelete: () => void
  onUnpublish: () => void
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
 *   onUnpublish={() => handleUnpublish(draftId)}
 * />
 * ```
 */

export const DraftCard = (props: Props) => {
  const { t, formatDate } = useLocalize()
  const { showConfirm } = useUI()
  const navigate = useNavigate()

  // Получение URL для редактирования черновика
  const getEditUrl = () => {
    if (props.draft.id) {
      return `/edit/${props.draft.id}`
    } else if (props.draft.localId) {
      return `/edit/${props.draft.localId}/local`
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
    } else {
      toast.error(t('Cannot publish draft without ID'))
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

      toast.success(t('Draft successfully deleted'))
    }
  }

  /**
   * Обработчик клика на кнопку просмотра/превью
   * - Если есть опубликованная версия, переходим на опубликованную страницу
   * - Иначе переходим в режим превью
   */
  const handleViewClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (props.draft.hasPublishedVersion && props.draft.slug) {
      // Переходим на страницу опубликованной версии
      navigate(`/${props.draft.slug}`)
      return
    }

    // Переходим на страницу превью черновика
    if (props.draft.isLocalOnly && props.draft.localId) {
      navigate(`/edit/${props.draft.localId}/preview`)
    } else if (props.draft.id) {
      navigate(`/edit/${props.draft.id}/preview`)
    } else {
      toast.error(t('Cannot preview draft without ID'))
    }
  }

  const hasDateDiscrepancy = () => {
    const draft = props.draft as ExtendedDraft
    if (!draft.updated_at || !draft.published_at) return false
    return new Date(draft.updated_at * 1000) > new Date(draft.published_at * 1000)
  }

  return (
    <div class={styles.draft}>
      <div class={styles.draftContent}>
        <div class={styles.contentTop}>
          {/* Заголовок */}
          <A href={getEditUrl()} onClick={handleEditClick}>
            <div class={styles.titleContainer} onClick={handleEditClick}>
              <span class={styles.title}>{props.draft.title || t('Unnamed draft')}</span>
              <span class={styles.subtitle}>{props.draft.subtitle}</span>
            </div>
          </A>
          {/* Дата создания */}
          <div class={styles.created}>
            <Show when={props.draft.isLocalOnly}>
              <span class={styles.localBadge} title={t('This draft is saved only locally')}>
                <Icon name="file-storage" class={styles.localIcon} />
              </span>
            </Show>
            {(() => {
              const date = createValidDate(props.draft.created_at)
              if (!date) return ''
              return formatDate(date, { hour: '2-digit', minute: '2-digit' })
            })()}
          </div>
        </div>

        <Show when={props.draft.cover}>
          <div class={styles.coverOverlay} style={{ 'background-image': `url(${props.draft.cover})` }} />
        </Show>

        <div class={styles.actions}>
          {/* Просмотр */}
          <span
            onClick={handleViewClick}
            class={styles.actionItem}
            title={
              props.draft.hasPublishedVersion
                ? t('View published version')
                : t('Preview how it will look published')
            }
          >
            <Icon name={props.draft.hasPublishedVersion ? 'eye-off' : 'eye'} class={styles.actionIcon} />
            <span class={styles.actionText}>
              {props.draft.hasPublishedVersion ? t('View') : t('Preview')}
            </span>
          </span>

          <Show
            when={props.draft.hasPublishedVersion}
            fallback={
              <>
                {/* Опубликовать */}
                <span
                  onClick={handlePublishLinkClick}
                  class={clsx(styles.actionItem, styles.publish)}
                  title={props.draft.isLocalOnly ? t('Save draft') : t('Publish')}
                >
                  <Icon
                    name={props.draft.isLocalOnly ? 'cloud-upload' : 'publish'}
                    class={styles.actionIcon}
                  />
                  <span class={styles.actionText}>
                    {t(props.draft.isLocalOnly ? 'Save draft' : 'Publish')}
                  </span>
                </span>
                {/* Удалить */}
                <span
                  onClick={handleDeleteLinkClick}
                  class={clsx(styles.actionItem, styles.delete)}
                  title={t('Delete')}
                >
                  <Icon name="trash" class={styles.actionIcon} />
                  <span class={styles.actionText}>{t('Delete')}</span>
                </span>
              </>
            }
          >
            {/* Снять с публикации */}
            <span
              onClick={props.onUnpublish}
              class={clsx(styles.actionItem, styles.unpublish)}
              title={t('Unpublish')}
            >
              <Icon name="eye-off" class={styles.actionIcon} />
              <span class={styles.actionText}>{t('Unpublish')}</span>
            </span>
            {/* Индикатор расхождения версии */}
            <Show when={hasDateDiscrepancy()}>
              <span class={styles.dateWarning} title={t('Draft updated after publication')}>
                <Icon name="warning" class={styles.warningIcon} />
              </span>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  )
}
