import { makePersisted } from '@solid-primitives/storage'
import type { Accessor, JSX } from 'solid-js'
import { createContext, createMemo, createSignal, onMount, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { toast } from 'solid-sonner'
import { ARTICLES_PER_PAGE } from '~/constants/pagination'
import { Author, NotificationGroup, QueryLoad_NotificationsArgs, Shout } from '~/graphql/generated/graphql'
import markSeenMutation from '~/graphql/mutation/notifier/mark-seen'
import markSeenAfterMutation from '~/graphql/mutation/notifier/mark-seen-after'
import markSeenThreadMutation from '~/graphql/mutation/notifier/mark-seen-thread'
import getNotifications from '~/graphql/query/notifier/notifications-load'
import { PresenceActionType, PresenceEntityType } from '~/types/notifications'
import { SSEMessage, useConnect } from './connect'
import { useSession } from './session'

// Интерфейс для системных уведомлений из toast
interface SystemNotification {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  timestamp: number
  dismissed?: boolean
}

// Интерфейс для payload SSE сообщений с типизацией
interface SSEPayload {
  author?: Author
  authors?: Author[]
  shout?: Shout
  [key: string]: Author | Author[] | Shout | string | number | boolean | undefined
}

type NotificationsContextType = {
  notificationEntities: Record<string, NotificationGroup>
  systemNotifications: Accessor<SystemNotification[]>
  unreadNotificationsCount: Accessor<number>
  after: Accessor<number | null>
  sortedNotifications: Accessor<NotificationGroup[]>
  loadedNotificationsCount: Accessor<number>
  totalNotificationsCount: Accessor<number>
  isNotificationsPanelOpen: Accessor<boolean>
  showNotificationsPanel: () => void
  hideNotificationsPanel: () => void
  markSeen: (notification_id: number) => Promise<void>
  markSeenThread: (threadId: string) => Promise<void>
  markSeenAll: () => Promise<void>
  dismissNotification: (threadId: string) => void
  dismissSystemNotification: (id: string) => void
  addSystemNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  loadNotificationsGrouped: (options: QueryLoad_NotificationsArgs) => Promise<NotificationGroup[]>
  // SolidJS-стиль методы для toast
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showWarning: (message: string) => void
  showInfo: (message: string) => void
}

const NotificationsContext = createContext<NotificationsContextType>({
  notificationEntities: {},
  systemNotifications: () => [],
  unreadNotificationsCount: () => 0,
  after: () => null,
  sortedNotifications: () => [],
  loadedNotificationsCount: () => 0,
  totalNotificationsCount: () => 0,
  isNotificationsPanelOpen: () => false,
  showNotificationsPanel: () => {},
  hideNotificationsPanel: () => {},
  markSeen: async (_id: number) => {},
  markSeenThread: async (_id: string) => {},
  markSeenAll: async () => {},
  dismissNotification: (_threadId: string) => {},
  dismissSystemNotification: (_id: string) => {},
  addSystemNotification: (_message: string, _type?: 'success' | 'error' | 'info' | 'warning') => {},
  loadNotificationsGrouped: async (_options: QueryLoad_NotificationsArgs) => [],
  // SolidJS-стиль методы для toast
  showToast: (_message: string, _type?: 'success' | 'error' | 'info' | 'warning') => {},
  showSuccess: (_message: string) => {},
  showError: (_message: string) => {},
  showWarning: (_message: string) => {},
  showInfo: (_message: string) => {}
})

export const NotificationsProvider = (props: { children: JSX.Element }) => {
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = createSignal(false)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = createSignal(0)
  const [totalNotificationsCount, setTotalNotificationsCount] = createSignal(0)
  const [systemNotifications, setSystemNotifications] = createSignal<SystemNotification[]>([])
  const [dismissedNotifications, setDismissedNotifications] = createSignal<Set<string>>(new Set())
  const [notificationEntities, setNotificationEntities] = createStore<Record<string, NotificationGroup>>({})
  const { session, client } = useSession()
  const { addHandler, getStatus } = useConnect()

  const loadNotificationsGrouped = async (options: QueryLoad_NotificationsArgs) => {
    if (session()?.token) {
      const resp = await client()?.query(getNotifications, options).toPromise()
      const result = resp?.data?.get_notifications
      const groups = result?.notifications || []
      const total = result?.total || 0
      const unread = result?.unread || 0

      const newGroupsEntries = groups.reduce((acc: { [x: string]: NotificationGroup }, group: NotificationGroup) => {
        acc[group.thread] = group
        return acc
      }, {})

      setTotalNotificationsCount(total)
      setUnreadNotificationsCount(unread)
      setNotificationEntities(newGroupsEntries)
      console.debug('[context.notifications] groups updated', groups)
      return groups
    }
    return []
  }

  const sortedNotifications = createMemo(() => {
    const dismissed = dismissedNotifications()
    return Object.values(notificationEntities)
      .filter((notification) => !dismissed.has(notification.thread))
      .sort((a, b) => b.updated_at - a.updated_at)
  })

  const now = Math.floor(Date.now() / 1000)
  const loadedNotificationsCount = createMemo(() => Object.keys(notificationEntities).length)
  const [after, setAfter] = makePersisted(createSignal<number>(now), { name: 'notifier_timestamp' })

  // Создание нового уведомления из SSE сообщения
  const createNotificationFromSSE = (data: SSEMessage): NotificationGroup | null => {
    try {
      // Проверяем наличие необходимых данных
      if (!data.id || !data.entity || !data.action || !data.payload) {
        console.warn('[context.notifications] Missing required fields in SSE message', data)
        return null
      }

      // Создаем уникальный идентификатор для треда уведомления
      const threadId = `${data.entity}::${data.id}::${data.action}`

      // Получаем текущее время
      const timestamp = data.created_at || Math.floor(Date.now() / 1000)

      // Приводим payload к типизированному интерфейсу
      const payload = data.payload as SSEPayload

      // Подготавливаем payload в зависимости от типа сущности
      const notificationPayload = {
        authors: [] as Author[],
        shout: null as Shout | null,
        entity: data.entity,
        action: data.action,
        thread: threadId,
        updated_at: timestamp,
        seen: false
      }

      // Заполняем данные в зависимости от типа сущности
      switch (data.entity) {
        case PresenceEntityType.Reaction: {
          // Обработка уведомлений о реакциях
          if (payload.author) {
            notificationPayload.authors = [payload.author]
          }
          if (payload.shout) {
            notificationPayload.shout = payload.shout
          }
          break
        }
        case PresenceEntityType.Message: {
          // Обработка уведомлений о сообщениях
          if (payload.author) {
            notificationPayload.authors = [payload.author]
          }
          break
        }
        case PresenceEntityType.Shout: {
          // Обработка уведомлений о публикациях
          if (payload.authors) {
            notificationPayload.authors = payload.authors
          }
          notificationPayload.shout = payload as unknown as Shout
          break
        }
        default: {
          // Для других типов просто пытаемся извлечь авторов
          if (payload.author) {
            notificationPayload.authors = [payload.author]
          } else if (payload.authors) {
            notificationPayload.authors = payload.authors
          }
          break
        }
      }

      // Возвращаем сформированное уведомление
      return notificationPayload as NotificationGroup
    } catch (error) {
      console.error('[context.notifications] Error creating notification from SSE message:', error, data)
      return null
    }
  }

  // Добавление уведомления в список
  const addNotification = (notification: NotificationGroup) => {
    if (!notification || !notification.thread) return

    // Увеличиваем счетчики
    setTotalNotificationsCount((count) => count + 1)
    setUnreadNotificationsCount((count) => count + 1)

    // Добавляем уведомление в хранилище
    setNotificationEntities((prev) => ({
      ...prev,
      [notification.thread]: notification
    }))
  }

  // Обработчик событий от presence сервиса
  const handlePresenceMessage = (data: SSEMessage) => {
    // Проверяем наличие токена сессии
    if (!session()?.token) return

    console.info('[context.notifications] SSE event received:', data)

    try {
      // Обрабатываем разные типы сущностей и действий
      switch (data.entity) {
        case PresenceEntityType.Reaction: {
          // Обработка реакций на комментарии, шауты и т.д.
          console.info('[context.notifications] Reaction event', data)
          if (data.action === PresenceActionType.Create) {
            // Для создания новой реакции создаем уведомление
            const notification = createNotificationFromSSE(data)
            if (notification) {
              addNotification(notification)
            }
          } else {
            // Для других действий обновляем из API
            void loadNotificationsGrouped({
              after: after() || now,
              limit: Math.max(ARTICLES_PER_PAGE, loadedNotificationsCount())
            })
          }
          break
        }
        case PresenceEntityType.Message: {
          // Обработка личных сообщений
          console.info('[context.notifications] Message event', data)
          if (data.action === PresenceActionType.Create) {
            // Создаем уведомление для нового сообщения
            const notification = createNotificationFromSSE(data)
            if (notification) {
              addNotification(notification)
            }
          }
          break
        }

        case PresenceEntityType.Shout: {
          // Обработка публикаций
          console.info('[context.notifications] Shout event', data)
          if (data.action === PresenceActionType.Create) {
            // Создаем уведомление для новой публикации
            const notification = createNotificationFromSSE(data)
            if (notification) {
              addNotification(notification)
            }
          }
          break
        }
        case PresenceEntityType.Follower: {
          // Обработка уведомлений о новых подписчиках
          console.info('[context.notifications] Follower event', data)
          if (data.action === PresenceActionType.Create) {
            // Создаем уведомление для нового подписчика
            const notification = createNotificationFromSSE(data)
            if (notification) {
              addNotification(notification)
            }
          }
          break
        }
        case PresenceEntityType.Global:
        case PresenceEntityType.Personal: {
          // Глобальные и персональные уведомления
          console.info(`[context.notifications] ${data.entity} event`, data)
          // Создаем уведомление
          const notification = createNotificationFromSSE(data)
          if (notification) {
            addNotification(notification)
          }
          break
        }
        default: {
          // Для других типов просто загружаем уведомления с сервера
          console.debug('[context.notifications] Unhandled event type:', data.entity)
          if (data.action === PresenceActionType.Create) {
            void loadNotificationsGrouped({
              after: after() || now,
              limit: Math.max(ARTICLES_PER_PAGE, loadedNotificationsCount())
            })
          }
          break
        }
      }

      // Показываем панель уведомлений для новых уведомлений, если это важное событие
      if (
        data.action === PresenceActionType.Create &&
        [PresenceEntityType.Message, PresenceEntityType.Personal].includes(data.entity as PresenceEntityType)
      ) {
        showNotificationsPanel()
      }
    } catch (error) {
      console.error('[context.notifications] Error processing SSE message:', error, data)
    }
  }

  onMount(() => {
    // Добавляем обработчик SSE сообщений
    addHandler(handlePresenceMessage)

    // Получаем начальные уведомления
    setAfter(now)

    // Если соединение уже установлено, загружаем уведомления
    if (session()?.token && getStatus() === 'connected') {
      void loadNotificationsGrouped({
        after: after() || now,
        limit: ARTICLES_PER_PAGE
      })
    }
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

  // Функции для работы с системными уведомлениями
  const addSystemNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `system-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const notification: SystemNotification = {
      id,
      message,
      type,
      timestamp: Date.now(),
      dismissed: false
    }

    setSystemNotifications((prev) => [notification, ...prev])

    // Если панель уведомлений НЕ открыта, показываем toast
    if (!isNotificationsPanelOpen()) {
      toast(message, {
        icon: type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'
      })
    }
  }

  const dismissSystemNotification = (id: string) => {
    setSystemNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, dismissed: true } : notification))
    )
  }

  // Функция для отклонения обычных уведомлений
  const dismissNotification = (threadId: string) => {
    setDismissedNotifications((prev) => new Set([...prev, threadId]))
  }

  // SolidJS-стиль методы для toast уведомлений
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    addSystemNotification(message, type)
  }

  const showSuccess = (message: string) => {
    addSystemNotification(message, 'success')
  }

  const showError = (message: string) => {
    addSystemNotification(message, 'error')
  }

  const showWarning = (message: string) => {
    addSystemNotification(message, 'warning')
  }

  const showInfo = (message: string) => {
    addSystemNotification(message, 'info')
  }

  const actions = {
    showNotificationsPanel,
    hideNotificationsPanel,
    markSeenThread,
    markSeenAll,
    markSeen,
    dismissNotification,
    addSystemNotification,
    dismissSystemNotification,
    loadNotificationsGrouped,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }

  const value: NotificationsContextType = {
    after,
    notificationEntities,
    systemNotifications,
    sortedNotifications,
    unreadNotificationsCount,
    loadedNotificationsCount,
    totalNotificationsCount,
    isNotificationsPanelOpen,
    ...actions
  }

  return <NotificationsContext.Provider value={value}>{props.children}</NotificationsContext.Provider>
}

export const useNotifications = () => {
  return useContext(NotificationsContext)
}
