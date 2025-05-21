import { makePersisted } from '@solid-primitives/storage'
import type { Accessor, JSX } from 'solid-js'
import { createContext, createMemo, createSignal, onMount, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Portal } from 'solid-js/web'

import markSeenMutation from '~/graphql/mutation/notifier/mark-seen'
import markSeenAfterMutation from '~/graphql/mutation/notifier/mark-seen-after'
import markSeenThreadMutation from '~/graphql/mutation/notifier/mark-seen-thread'
import getNotifications from '~/graphql/query/notifier/notifications-load'
import { NotificationGroup, QueryLoad_NotificationsArgs } from '~/graphql/schema/core.gen'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { ShowIfAuthenticated } from '../components/_shared/ShowIfAuthenticated'
import { SSEMessage, useConnect } from './connect'
import { useSession } from './session'

type NotificationsContextType = {
  notificationEntities: Record<string, NotificationGroup>
  unreadNotificationsCount: Accessor<number>
  after: Accessor<number | null>
  sortedNotifications: Accessor<NotificationGroup[]>
  loadedNotificationsCount: Accessor<number>
  totalNotificationsCount: Accessor<number>
  showNotificationsPanel: () => void
  hideNotificationsPanel: () => void
  markSeen: (notification_id: number) => Promise<void>
  markSeenThread: (threadId: string) => Promise<void>
  markSeenAll: () => Promise<void>
  loadNotificationsGrouped: (options: QueryLoad_NotificationsArgs) => Promise<NotificationGroup[]>
}

export const PAGE_SIZE = 20
const NotificationsContext = createContext<NotificationsContextType>({
  showNotificationsPanel: () => undefined,
  hideNotificationsPanel: () => undefined
} as NotificationsContextType)

export function useNotifications() {
  return useContext(NotificationsContext)
}

export const NotificationsProvider = (props: { children: JSX.Element }) => {
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = createSignal(false)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = createSignal(0)
  const [totalNotificationsCount, setTotalNotificationsCount] = createSignal(0)
  const [notificationEntities, setNotificationEntities] = createStore<Record<string, NotificationGroup>>({})
  const { session, client } = useSession()
  const { addHandler } = useConnect()

  const loadNotificationsGrouped = async (options: QueryLoad_NotificationsArgs) => {
    if (session()?.token) {
      const resp = await client()?.query(getNotifications, options).toPromise()
      const result = resp?.data?.get_notifications
      const groups = result?.notifications || []
      const total = result?.total || 0
      const unread = result?.unread || 0

      const newGroupsEntries = groups.reduce(
        (acc: { [x: string]: NotificationGroup }, group: NotificationGroup) => {
          acc[group.thread] = group
          return acc
        },
        {}
      )

      setTotalNotificationsCount(total)
      setUnreadNotificationsCount(unread)
      setNotificationEntities(newGroupsEntries)
      console.debug('[context.notifications] groups updated', groups)
      return groups
    }
    return []
  }

  const sortedNotifications = createMemo(() => {
    return Object.values(notificationEntities).sort((a, b) => b.updated_at - a.updated_at)
  })

  const now = Math.floor(Date.now() / 1000)
  const loadedNotificationsCount = createMemo(() => Object.keys(notificationEntities).length)
  const [after, setAfter] = makePersisted(createSignal<number>(now), { name: 'notifier_timestamp' })

  onMount(() => {
    addHandler((data: SSEMessage) => {
      if (data.entity === 'reaction' && session()?.token) {
        console.info('[context.notifications] event', data)
        loadNotificationsGrouped({
          after: after() || now,
          limit: Math.max(PAGE_SIZE, loadedNotificationsCount())
        })
      }
    })
    setAfter(now)
  })

  const markSeenThread = async (threadId: string) => {
    await client()?.mutation(markSeenThreadMutation, { threadId }).toPromise()
    const thread = notificationEntities[threadId]
    thread.seen = true
    setNotificationEntities((nnn) => ({ ...nnn, [threadId]: thread }))
    setUnreadNotificationsCount((oldCount) => oldCount - 1)
  }

  const markSeenAll = async () => {
    if (session()?.token) {
      const _resp = await client()?.mutation(markSeenAfterMutation, { after: after() }).toPromise()
      await loadNotificationsGrouped({ after: after() || now, limit: loadedNotificationsCount() })
    }
  }

  const markSeen = async (notification_id: number) => {
    if (session()?.token) {
      await client()?.mutation(markSeenMutation, { notification_id }).toPromise()
      await loadNotificationsGrouped({ after: after() || now, limit: loadedNotificationsCount() })
    }
  }

  const showNotificationsPanel = () => {
    setIsNotificationsPanelOpen(true)
  }

  const hideNotificationsPanel = () => {
    setIsNotificationsPanelOpen(false)
  }

  const actions = {
    showNotificationsPanel,
    hideNotificationsPanel,
    markSeenThread,
    markSeenAll,
    markSeen,
    loadNotificationsGrouped
  }

  const value: NotificationsContextType = {
    after,
    notificationEntities,
    sortedNotifications,
    unreadNotificationsCount,
    loadedNotificationsCount,
    totalNotificationsCount,
    ...actions
  }

  const handleNotificationPanelClose = () => {
    setIsNotificationsPanelOpen(false)
  }

  return (
    <NotificationsContext.Provider value={value}>
      {props.children}
      <ShowIfAuthenticated>
        <Portal>
          <NotificationsPanel isOpen={isNotificationsPanelOpen()} onClose={handleNotificationPanelClose} />
        </Portal>
      </ShowIfAuthenticated>
    </NotificationsContext.Provider>
  )
}
