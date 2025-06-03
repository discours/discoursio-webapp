import { clsx } from 'clsx'
import { For, Show } from 'solid-js'

import { GroupAvatar } from '~/components/_shared/GroupAvatar'
import { TimeAgo } from '~/components/_shared/TimeAgo'
import { useLocalize } from '~/context/localize'
import { PresenceActionType, PresenceEntityType, useNotifications } from '~/context/notifications'
import { Author, NotificationGroup as Group } from '~/graphql/schema/core.gen'

import { A, useNavigate, useSearchParams } from '@solidjs/router'
import styles from './NotificationView.module.scss'

type NotificationGroupProps = {
  notifications: Group[]
  onClick: () => void
  dateTimeFormat: 'ago' | 'time' | 'date'
  class?: string
}

const getTitle = (title: string) => {
  let shoutTitle = ''
  let i = 0
  const shoutTitleWords = title.split(' ')

  while (shoutTitle.length <= 30 && i < shoutTitleWords.length) {
    shoutTitle += `${shoutTitleWords[i]} `
    i++
  }

  if (shoutTitle.length < title.length) {
    shoutTitle = `${shoutTitle.trim()}...`

    if (shoutTitle[0] === '«') {
      shoutTitle += '»'
    }
  }
  return shoutTitle
}

// Генерация текста уведомления в зависимости от типа уведомления
const getNotificationText = (
  n: Group,
  t: (key: string, params?: Record<string, number | string>) => string
) => {
  // Для уведомлений от presence сервиса
  if (n.entity && n.action) {
    switch (n.entity) {
      case PresenceEntityType.Reaction:
        return n.action === PresenceActionType.Create
          ? t('New reaction to your content')
          : t('Reaction updated')

      case PresenceEntityType.Message:
        return t('New message')

      case PresenceEntityType.Shout:
        return n.action === PresenceActionType.Create ? t('New publication') : t('Publication updated')

      case PresenceEntityType.Global:
        return t('System notification')

      case PresenceEntityType.Personal:
        return t('Personal notification')

      default:
        return t('Common notification')
    }
  }

  // Для стандартных уведомлений о комментариях
  return n.thread?.includes(':')
    ? t('Some new replies to your comment', { commentsCount: n.reactions?.length || 0 })
    : t('Some new comments to your publication', { commentsCount: n.reactions?.length || 0 })
}

export const NotificationGroup = (props: NotificationGroupProps) => {
  const { t, formatTime, formatDate } = useLocalize()
  const navigate = useNavigate()
  const [, changeSearchParams] = useSearchParams()
  const { hideNotificationsPanel, markSeenThread } = useNotifications()

  const handleClick = (n: Group) => {
    props.onClick()

    // Маркируем уведомление как прочитанное
    if (n.thread) {
      markSeenThread(n.thread)
    }

    // Определяем, куда перейти в зависимости от типа уведомления
    if (n.entity === PresenceEntityType.Message) {
      // Для сообщений переходим в inbox
      navigate('/inbox')
    } else if (n.shout?.slug) {
      // Для публикаций и комментариев переходим на страницу публикации
      navigate(`/${n.shout.slug}`)

      // Если это комментарий, добавляем параметр commentId
      if (n.thread?.includes('::')) {
        const [, commentId] = n.thread.split('::')
        if (commentId) changeSearchParams({ commentId })
      }
    }
  }

  const handleLinkClick = (event: MouseEvent | TouchEvent) => {
    event.stopPropagation()
    hideNotificationsPanel()
  }

  return (
    <>
      <For each={props.notifications}>
        {(n: Group, _index) => (
          <>
            <div
              class={clsx(styles.NotificationView, props.class, { [styles.seen]: n.seen })}
              onClick={(_) => handleClick(n)}
            >
              <div class={styles.userpic}>
                <GroupAvatar authors={n.authors as Author[]} />
              </div>
              <div>
                <Show when={n.shout?.title}>
                  <A href={`/${n.shout?.slug || ''}`} onClick={handleLinkClick}>
                    {getTitle(n.shout?.title || '')}
                  </A>{' '}
                </Show>

                {getNotificationText(n, t)}

                <Show when={n.authors?.[0]}>
                  {' '}
                  {t('from')}{' '}
                  <A href={`/@${n.authors?.[0]?.slug || ''}`} onClick={handleLinkClick}>
                    {n.authors?.[0]?.name || ''}
                  </A>
                </Show>
              </div>

              <div class={styles.timeContainer}>
                <Show when={props.dateTimeFormat === 'ago'}>
                  <TimeAgo date={n.updated_at} />
                </Show>

                <Show when={props.dateTimeFormat === 'time'}>
                  {formatTime(new Date(n.updated_at * 1000))}
                </Show>

                <Show when={props.dateTimeFormat === 'date'}>
                  {formatDate(new Date(n.updated_at * 1000), { month: 'numeric', year: '2-digit' })}
                </Show>
              </div>
            </div>
          </>
        )}
      </For>
    </>
  )
}
