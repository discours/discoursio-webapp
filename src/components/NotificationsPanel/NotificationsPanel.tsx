import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { throttle } from 'throttle-debounce'
import { ARTICLES_PER_PAGE } from '~/constants/pagination'
import { useLocalize } from '~/context/localize'
import { useNotifications } from '~/context/notifications'
import { useSession } from '~/context/session'
import { useEscKeyDownHandler } from '~/lib/useEscKeyDownHandler'
import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { EmptyMessage } from './EmptyMessage'
import styles from './NotificationsPanel.module.scss'
import { NotificationGroup } from './NotificationView/NotificationGroup'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const getYesterdayStart = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
}
const hourAgo = () => Date.now() - 3600 * 1000
const isSameDate = (date1: Date, date2: Date) =>
  date1.getDate() === date2.getDate() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getFullYear() === date2.getFullYear()

const isToday = (date: Date) => {
  return isSameDate(date, new Date())
}

const isYesterday = (date: Date) => {
  const yesterday = getYesterdayStart()
  return isSameDate(date, yesterday)
}

const isEarlier = (date: Date) => {
  const yesterday = getYesterdayStart()
  return date.getTime() < yesterday.getTime()
}

export const NotificationsPanel = (props: Props) => {
  const [isLoading, setIsLoading] = createSignal(false)
  const { session } = useSession()
  const { t } = useLocalize()
  const {
    after,
    sortedNotifications,

    unreadNotificationsCount,
    loadedNotificationsCount,
    totalNotificationsCount,
    loadNotificationsGrouped,
    markSeenAll
  } = useNotifications()
  const handleHide = () => {
    props.onClose()
  }

  let panelRef: HTMLDivElement | undefined

  useOutsideClickHandler({
    containerRef: panelRef,
    predicate: () => props.isOpen,
    handler: () => handleHide()
  })

  let windowScrollTop = 0

  createEffect(() => {
    if (isServer) return
    const mainContent = document.querySelector<HTMLDivElement>('.main-content')

    if (props.isOpen && mainContent && window) {
      windowScrollTop = window?.scrollY || 0
      mainContent.style.marginTop = `-${windowScrollTop}px`
    }

    document.body.classList.toggle('fixed', props.isOpen)

    if (!props.isOpen && mainContent && window) {
      mainContent.style.marginTop = ''
      window?.scrollTo(0, windowScrollTop)
    }
  })

  useEscKeyDownHandler(handleHide)

  const handleNotificationViewClick = () => {
    handleHide()
  }

  const todayNotifications = createMemo(() => {
    return sortedNotifications().filter((notification) => isToday(new Date(notification.updated_at * 1000)))
  })

  const yesterdayNotifications = createMemo(() => {
    return sortedNotifications().filter((notification) => isYesterday(new Date(notification.updated_at * 1000)))
  })

  const earlierNotifications = createMemo(() => {
    return sortedNotifications().filter((notification) => isEarlier(new Date(notification.updated_at * 1000)))
  })

  let scrollContainerRef: HTMLDivElement | undefined
  const loadNextPage = async () => {
    await loadNotificationsGrouped({
      after: after() || hourAgo(),
      limit: ARTICLES_PER_PAGE,
      offset: loadedNotificationsCount()
    })
    if (loadedNotificationsCount() < totalNotificationsCount()) {
      const hasMore = (scrollContainerRef?.scrollHeight || 0) <= (scrollContainerRef?.offsetHeight || 0)

      if (hasMore) {
        await loadNextPage()
      }
    }
  }
  const handleScroll = async () => {
    if (!scrollContainerRef || isLoading()) {
      return
    }
    if (totalNotificationsCount() === loadedNotificationsCount()) {
      return
    }

    const isNearBottom =
      scrollContainerRef.scrollHeight - scrollContainerRef.scrollTop <= scrollContainerRef.clientHeight * 1.5

    if (isNearBottom) {
      setIsLoading(true)
      await loadNextPage()
      setIsLoading(false)
    }
  }
  const handleScrollThrottled = throttle(50, handleScroll)

  onMount(() => {
    scrollContainerRef?.addEventListener('scroll', handleScrollThrottled)
    onCleanup(() => {
      scrollContainerRef?.removeEventListener('scroll', handleScrollThrottled)
    })
  })

  createEffect(
    on(session, async (s) => {
      if (s?.token) {
        setIsLoading(true)
        await loadNextPage()
        setIsLoading(false)
      }
    })
  )

  return (
    <div
      class={clsx(styles.container, {
        [styles.isOpened]: props.isOpen
      })}
    >
      <div ref={(el) => (panelRef = el)} class={styles.panel}>
        <div class={styles.closeButton} onClick={handleHide}>
          <Icon class={styles.closeIcon} name="close" />
        </div>
        <div class={styles.title}>{t('Notifications')}</div>
        <div class={clsx('wide-container', styles.content)} ref={(el) => (scrollContainerRef = el)}>
          <Show
            when={sortedNotifications().length > 0}
            fallback={
              <Show when={!isLoading()}>
                <EmptyMessage />
              </Show>
            }
          >
            <div class="row position-relative">
              <div class="col-xs-24">
                <Show when={todayNotifications().length > 0}>
                  <div class={styles.periodTitle}>{t('today')}</div>
                  <NotificationGroup
                    notifications={todayNotifications()}
                    class={styles.notificationView}
                    onClick={handleNotificationViewClick}
                    dateTimeFormat={'ago'}
                  />
                </Show>
                <Show when={yesterdayNotifications().length > 0}>
                  <div class={styles.periodTitle}>{t('yesterday')}</div>
                  <NotificationGroup
                    notifications={yesterdayNotifications()}
                    class={styles.notificationView}
                    onClick={handleNotificationViewClick}
                    dateTimeFormat={'time'}
                  />
                </Show>
                <Show when={earlierNotifications().length > 0}>
                  <div class={styles.periodTitle}>{t('earlier')}</div>
                  <NotificationGroup
                    notifications={earlierNotifications()}
                    class={styles.notificationView}
                    onClick={handleNotificationViewClick}
                    dateTimeFormat={'date'}
                  />
                </Show>
              </div>
            </div>
          </Show>
          <Show when={isLoading()}>
            <div class={styles.loading}>{t('Loading')}</div>
          </Show>
        </div>

        <Show when={unreadNotificationsCount() > 0}>
          <div class={styles.actions}>
            <Button onClick={(_e) => markSeenAll()} variant="secondary" value={t('Mark as read')} />
          </div>
        </Show>
      </div>
    </div>
  )
}
