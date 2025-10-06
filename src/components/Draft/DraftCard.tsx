import { A, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show } from 'solid-js'
import { toast } from 'solid-sonner'
import type { ExtendedDraft } from '~/context/drafts'
import { useDrafts } from '~/context/drafts'
import { createValidDate, useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Author, DraftInput, Maybe, Topic } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache'
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
  const { updateDraft, loadDrafts, setCurrentDraft } = useDrafts()

  // Получение URL для редактирования черновика
  const getEditUrl = () => {
    if (props.draft.id) {
      return `/edit/${props.draft.id}`
    } else if (props.draft.local_id) {
      return `/edit/${props.draft.local_id}/local`
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

    if (!props.draft.id) {
      toast.error(t('Cannot publish draft without ID'))
      return
    }

    try {
      // Явно обновляем черновик на сервере со всеми последними изменениями
      // Это гарантирует, что title и lead будут доступны на странице настроек
      const updatedDraft: DraftInput = {
        id: props.draft.id,
        layout: props.draft.layout || 'article',
        title: props.draft.title || '',
        subtitle: props.draft.subtitle || '',
        lead: props.draft.lead || '',
        slug: props.draft.slug || '',
        body: props.draft.body || '',
        cover: props.draft.cover || '',
        main_topic_id: props.draft.topics?.[0]?.id || 0,
        author_ids: (props.draft.authors || []).map?.((author?: Maybe<Author>) => author?.id || 0) || [],
        topic_ids:
          (props.draft.topics || [])
            .map?.((topic?: Maybe<Topic>) => {
              if (!topic || !topic.id) {
                console.warn('[DraftCard] Найдена некорректная тема в массиве:', topic)
                return 0
              }
              return topic.id
            })
            .filter((id) => id > 0) || []
      }

      // Проверяем, что у нас есть хотя бы одна тема
      if (!updatedDraft.topic_ids || !updatedDraft.topic_ids.length) {
        console.warn('[DraftCard] После фильтрации не найдено валидных тем, что может привести к ошибке')
        // Пытаемся найти main_topic_id в качестве резервного варианта
        if (updatedDraft.main_topic_id && updatedDraft.main_topic_id > 0) {
          console.log('[DraftCard] Используем main_topic_id в качестве резервного варианта для тем')
          updatedDraft.topic_ids = [updatedDraft.main_topic_id]
        }
      }

      console.log('[DraftCard] Отправка черновика на сервер перед публикацией:', {
        draftId: updatedDraft.id,
        title: updatedDraft.title,
        topicIds: updatedDraft.topic_ids,
        mainTopicId: updatedDraft.main_topic_id
      })

      // Сохраняем черновик перед дальнейшими действиями
      updateDraft(updatedDraft)
        .then(async (result) => {
          if (result?.data?.update_draft?.draft) {
            setCurrentDraft(result.data.update_draft.draft as ExtendedDraft)
          }
          await loadDrafts()
          navigate(`/edit/${props.draft.id}/settings`)
        })
        .catch((error: Error) => {
          console.error('[DraftCard] Ошибка обновления черновика перед публикацией:', error)
          navigate(`/edit/${props.draft.id}/settings`)
        })
    } catch (error) {
      console.error('[DraftCard] Ошибка в обработчике публикации:', error)
      toast.error(t('An error occurred while processing publication'))

      // При любой ошибке пытаемся перейти на страницу настроек
      if (props.draft.id) {
        const fallbackUrl = `/edit/${props.draft.id}/settings`
        console.log(`[DraftCard] Аварийный переход на настройки: ${fallbackUrl}`)
        navigate(fallbackUrl)
      }
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
      console.log('[DraftCard] Вызываем обработчик удаления:', props.draft.id || props.draft.local_id)
      props.onDelete()
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

    if (props.draft.published_at && props.draft.slug) {
      // Переходим на страницу опубликованной версии
      navigate(`/${props.draft.slug}`)
      return
    }

    // Переходим на страницу превью черновика
    // Локальный черновик: local_id не начинается с "server-" и нет draft_id
    const isLocalDraft = props.draft.local_id && !props.draft.local_id.startsWith('server-') && !props.draft.draft_id

    if (isLocalDraft) {
      navigate(`/edit/${props.draft.local_id}/preview`)
    } else if (props.draft.id) {
      navigate(`/edit/${props.draft.id}/preview`)
    } else {
      toast.error(t('Cannot preview draft without ID'))
    }
  }

  /**
   * Проверяет, были ли внесены изменения в черновик после публикации
   */
  const isModifiedSincePublish = () => {
    return props.draft.shout?.published_at && props.draft.shout?.published_at > 0
  }

  /**
   * Проверяет, есть ли у черновика опубликованная версия
   */
  const isPublished = () => {
    return !!props.draft.shout?.published_at || ('published_at' in props.draft && !!props.draft.published_at)
  }

  /**
   * Обработчик перехода к настройкам с предварительным сохранением черновика
   */
  const handleSettingsClick = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!props.draft.id) {
      toast.error(t('Cannot open settings without draft ID'))
      return
    }

    try {
      // Обновляем черновик на сервере со всеми последними изменениями
      const updatedDraft: DraftInput = {
        id: props.draft.id,
        layout: props.draft.layout || 'article',
        title: props.draft.title || '',
        subtitle: props.draft.subtitle || '',
        lead: props.draft.lead || '',
        slug: props.draft.slug || '',
        body: props.draft.body || '',
        cover: props.draft.cover || '',
        main_topic_id: props.draft.topics?.[0]?.id || 0,
        author_ids: (props.draft.authors || []).map?.((author?: Maybe<Author>) => author?.id || 0) || [],
        topic_ids:
          (props.draft.topics || [])
            .map?.((topic?: Maybe<Topic>) => {
              if (!topic || !topic.id) {
                console.warn('[DraftCard] Найдена некорректная тема в массиве:', topic)
                return 0
              }
              return topic.id
            })
            .filter((id) => id > 0) || []
      }

      // Проверяем наличие тем
      if (!updatedDraft.topic_ids || !updatedDraft.topic_ids.length) {
        console.warn('[DraftCard] После фильтрации не найдено валидных тем, что может привести к ошибке')
        if (updatedDraft.main_topic_id && updatedDraft.main_topic_id > 0) {
          console.log('[DraftCard] Используем main_topic_id в качестве резервного варианта для тем')
          updatedDraft.topic_ids = [updatedDraft.main_topic_id]
        }
      }

      console.log('[DraftCard] Отправка черновика на сервер перед переходом в настройки:', {
        draftId: updatedDraft.id,
        title: updatedDraft.title,
        topicIds: updatedDraft.topic_ids,
        mainTopicId: updatedDraft.main_topic_id
      })

      // Сохраняем черновик перед переходом
      updateDraft(updatedDraft)
        .then(async (result) => {
          if (result?.data?.update_draft?.draft) {
            setCurrentDraft(result.data.update_draft.draft as ExtendedDraft)
          }
          await loadDrafts()
          navigate(`/edit/${props.draft.id}/settings`)
        })
        .catch((error: Error) => {
          console.error('[DraftCard] Ошибка обновления черновика перед переходом в настройки:', error)
          navigate(`/edit/${props.draft.id}/settings`)
        })
    } catch (error) {
      console.error('[DraftCard] Ошибка в обработчике перехода в настройки:', error)
      toast.error(t('An error occurred while processing settings'))

      // При любой ошибке пытаемся перейти на страницу настроек
      if (props.draft.id) {
        const fallbackUrl = `/edit/${props.draft.id}/settings`
        console.log(`[DraftCard] Аварийный переход на настройки: ${fallbackUrl}`)
        navigate(fallbackUrl)
      }
    }
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
          {/* Дата создания и статус */}
          <div class={styles.created}>
            {(() => {
              const date = createValidDate(props.draft.created_at)
              if (!date) return ''
              return formatDate(date, { hour: '2-digit', minute: '2-digit' })
            })()}
          </div>
        </div>

        <Show when={props.draft?.cover}>
          <div
            class={styles.coverOverlay}
            style={{ 'background-image': `url(${getCdnUrl(props.draft.cover || '')})` }}
          />
        </Show>

        <div class={styles.actions}>
          {/* Предпросмотр */}
          <span
            onClick={handleViewClick}
            class={clsx(styles.actionItem, styles.edit)}
            title={isPublished() ? t('View published article') : t('Preview')}
          >
            <Icon name="eye" class={styles.actionIcon} />
            <span class={styles.actionText}>{isPublished() ? t('View') : t('Preview')}</span>
          </span>

          {/* Публикация/Снятие с публикации */}
          <Show
            when={isPublished()}
            fallback={
              <span
                onClick={handlePublishLinkClick}
                class={clsx(styles.actionItem, styles.publish)}
                title={props.draft.draft_id ? t('Publish') : t('Save draft')}
              >
                <Icon name={props.draft.draft_id ? 'publish' : 'cloud-upload'} class={styles.actionIcon} />
                <span class={styles.actionText}>{t(props.draft.draft_id ? 'Publish' : 'Save draft')}</span>
              </span>
            }
          >
            {/* Кнопки для опубликованной статьи */}
            <div class={styles.publishedActions}>
              {/* Кнопка настроек */}
              <span onClick={handleSettingsClick} class={clsx(styles.actionItem)} title={t('Settings')}>
                <Icon name="settings" class={styles.actionIcon} />
                <span class={styles.actionText}>{t('Settings')}</span>
              </span>

              {/* Кнопка снятия с публикации */}
              <span
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('[DraftCard] Вызываем обработчик снятия с публикации:', props.draft.id)
                  props.onUnpublish()
                }}
                class={clsx(styles.actionItem, styles.delete)}
                title={t('Unpublish')}
              >
                <Icon name="eye-off" class={styles.actionIcon} />
                <span class={clsx(styles.actionText, styles.publish)}>{t('Unpublish')}</span>
              </span>
            </div>
          </Show>

          {/* Удаление - всегда присутствует */}
          <span onClick={handleDeleteLinkClick} class={clsx(styles.actionItem, styles.delete)} title={t('Delete')}>
            <Icon name="trash" class={styles.actionIcon} />
            <span class={clsx(styles.actionText)}>{t('Delete')}</span>
          </span>
        </div>
      </div>

      {/* Индикатор изменений после публикации - отображаем компактно */}
      <Show when={isModifiedSincePublish()}>
        <div class={styles.modifiedBadge} title={t('Modified since publish')}>
          <Icon name="sync-problem" class={styles.modifiedIndicator} />
        </div>
      </Show>
    </div>
  )
}
