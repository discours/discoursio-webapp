import { clsx } from 'clsx'
import { For, Show } from 'solid-js'

import { GroupAvatar } from '~/components/_shared/GroupAvatar'
import { TimeAgo } from '~/components/_shared/TimeAgo'
import { useLocalize } from '~/context/localize'
import { useNotifications } from '~/context/notifications'
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

const threadCaption = (threadId: string) =>
  threadId.includes(':') ? 'Some new replies to your comment' : 'Some new comments to your publication'

export const NotificationGroup = (props: NotificationGroupProps) => {
  const { t, formatTime, formatDate } = useLocalize()
  const navigate = useNavigate()
  const [, changeSearchParams] = useSearchParams()
  const { hideNotificationsPanel, markSeenThread } = useNotifications()
  const handleClick = (threadId: string) => {
    props.onClick()

    markSeenThread(threadId)
    const [slug, commentId] = threadId.split('::')
    navigate(`/${slug}`)
    if (commentId) changeSearchParams({ commentId })
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
            {t(threadCaption(n.thread), { commentsCount: n.reactions?.length || 0 })}{' '}
            <div
              class={clsx(styles.NotificationView, props.class, { [styles.seen]: n.seen })}
              onClick={(_) => handleClick(n.thread)}
            >
              <div class={styles.userpic}>
                <GroupAvatar authors={n.authors as Author[]} />
              </div>
              <div>
                <A href={`/${n.shout?.slug || ''}`} onClick={handleLinkClick}>
                  {getTitle(n.shout?.title || '')}
                </A>{' '}
                {t('from')}{' '}
                <A href={`/@${n.authors?.[0]?.slug || ''}`} onClick={handleLinkClick}>
                  {n.authors?.[0]?.name || ''}
                </A>{' '}
              </div>

              <div class={styles.timeContainer}>
                <Show when={props.dateTimeFormat === 'ago'}>
                  <TimeAgo date={n.updated_at} />
                </Show>

                <Show when={props.dateTimeFormat === 'time'}>{formatTime(new Date(n.updated_at))}</Show>

                <Show when={props.dateTimeFormat === 'date'}>
                  {formatDate(new Date(n.updated_at), { month: 'numeric', year: '2-digit' })}
                </Show>
              </div>
            </div>
          </>
        )}
      </For>
    </>
  )
}
