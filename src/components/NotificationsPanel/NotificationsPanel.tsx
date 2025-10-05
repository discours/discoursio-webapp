import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { throttle } from 'throttle-debounce'
import { ARTICLES_PER_PAGE } from '~/constants/pagination'
import { useLocalize } from '~/context/localize'
import { useNotifications } from '~/context/notifications'
import { useSession } from '~/context/session'
import { NotificationGroup as Group } from '~/graphql/generated/graphql'
import { useEscKeyDownHandler } from '~/lib/useEscKeyDownHandler'
import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'
import { PresenceActionType, PresenceEntityType } from '~/types/notifications'
import { Icon } from '../_shared/Icon'
import { EmptyMessage } from './EmptyMessage'
import styles from './NotificationsPanel.module.scss'
import { NotificationGroup } from './NotificationView/NotificationGroup'
import { useSmartGrouping } from './useSmartGrouping'

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
  const [useSmartGroupingEnabled, _setUseSmartGroupingEnabled] = createSignal(true) // 🚀 Demo toggle

  // Debug logging
  createEffect(() => {
    console.log('[NotificationsPanel] isOpen changed:', props.isOpen)
  })
  const { session } = useSession()
  const { t } = useLocalize()
  const {
    after,
    sortedNotifications,
    systemNotifications,
    loadedNotificationsCount,
    totalNotificationsCount,
    loadNotificationsGrouped,
    markSeenAll
  } = useNotifications()

  // 🚀 Smart grouping integration
  const _smartGrouping = useSmartGrouping({
    notifications: sortedNotifications(),
    systemNotifications: systemNotifications(),
    enabled: useSmartGroupingEnabled()
  })
  const handleHide = () => {
    props.onClose()
  }

  let panelRef: HTMLDivElement | undefined

  useOutsideClickHandler({
    containerRef: panelRef,
    predicate: (e) => {
      if (!props.isOpen) return false

      // Проверяем - клик внутри панели или по её элементам?
      const target = e.target as HTMLElement
      const isInsidePanel = panelRef?.contains(target)
      const isTabButton = target.closest(`.${styles.tab}`)
      const isHeaderButton = target.closest(`.${styles.headerActions}`)

      console.log('[NotificationsPanel] Click predicate:', {
        isInsidePanel,
        isTabButton: !!isTabButton,
        isHeaderButton: !!isHeaderButton,
        shouldClose: !isInsidePanel
      })

      return !isInsidePanel
    },
    handler: () => {
      console.log('[NotificationsPanel] Outside click confirmed, closing')
      handleHide()
    }
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
    // Закрываем панель при клике на уведомление (переход к контенту)
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

  const [activeTab, setActiveTab] = createSignal<'all' | 'discussions' | 'comments' | 'edits'>('all')

  const matchesTab = (n: Group) => {
    if (activeTab() === 'all') return true
    if (activeTab() === 'discussions') {
      return n.entity === PresenceEntityType.Shout && n.action === PresenceActionType.Create
    }
    if (activeTab() === 'comments') {
      return n.thread?.includes('::')
    }
    if (activeTab() === 'edits') {
      return n.entity === PresenceEntityType.Shout && n.action === PresenceActionType.Update
    }
    return true
  }

  const filteredNotifications = createMemo(() => {
    return sortedNotifications().filter(matchesTab)
  })

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

        {/* Header с настройками */}
        <div class={styles.header}>
          <div class={styles.headerTop}>
            <h2 class={styles.title}>{t('Notifications')}</h2>
            <div class={styles.headerActions}>
              <button class={styles.markAllRead} onClick={(_e) => markSeenAll()}>
                {t('Mark as read')}
              </button>
              <button class={styles.settingsButton}>
                <Icon name="settings" class={styles.settingsIcon} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div class={styles.tabs}>
            <button
              class={clsx(styles.tab, { [styles.tabActive]: activeTab() === 'all' })}
              onClick={() => setActiveTab('all')}
            >
              {t('All')}
            </button>
            <button
              class={clsx(styles.tab, { [styles.tabActive]: activeTab() === 'discussions' })}
              onClick={() => setActiveTab('discussions')}
            >
              {t('Discussions')}
            </button>
            <button
              class={clsx(styles.tab, { [styles.tabActive]: activeTab() === 'comments' })}
              onClick={() => setActiveTab('comments')}
            >
              {t('Comments')}
            </button>
            <button
              class={clsx(styles.tab, { [styles.tabActive]: activeTab() === 'edits' })}
              onClick={() => setActiveTab('edits')}
            >
              {t('Edits')}
            </button>
          </div>
        </div>
        <div class={clsx('wide-container', styles.content)} ref={(el) => (scrollContainerRef = el)}>
          <Show
            when={filteredNotifications().length > 0}
            fallback={
              <Show when={!isLoading()}>
                <EmptyMessage />
              </Show>
            }
          >
            <div class="row position-relative">
              <div class="col-xs-24">
                <Show when={todayNotifications().filter((n) => activeTab() === 'all' || matchesTab(n)).length > 0}>
                  <div class={styles.periodTitle}>{t('today')}</div>
                  <NotificationGroup
                    notifications={todayNotifications().filter((n) => matchesTab(n))}
                    class={styles.notificationView}
                    onClick={handleNotificationViewClick}
                    dateTimeFormat={'ago'}
                  />
                </Show>
                <Show when={yesterdayNotifications().filter((n) => matchesTab(n)).length > 0}>
                  <div class={styles.periodTitle}>{t('yesterday')}</div>
                  <NotificationGroup
                    notifications={yesterdayNotifications().filter((n) => matchesTab(n))}
                    class={styles.notificationView}
                    onClick={handleNotificationViewClick}
                    dateTimeFormat={'time'}
                  />
                </Show>
                <Show when={earlierNotifications().filter((n) => matchesTab(n)).length > 0}>
                  <div class={styles.periodTitle}>{t('earlier')}</div>
                  <NotificationGroup
                    notifications={earlierNotifications().filter((n) => matchesTab(n))}
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

          {/* Кнопка "Показать больше" */}
          <Show when={!isLoading() && loadedNotificationsCount() < totalNotificationsCount()}>
            <div class={styles.showMore}>
              <button class={styles.showMoreButton} onClick={loadNextPage}>
                {t('Show more')}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
