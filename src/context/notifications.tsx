import { makePersisted } from '@solid-primitives/storage'
import type { Accessor, JSX } from 'solid-js'
import { createContext, createMemo, createSignal, onMount, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Portal } from 'solid-js/web'

import markSeenMutation from '~/graphql/mutation/notifier/mark-seen'
import markSeenAfterMutation from '~/graphql/mutation/notifier/mark-seen-after'
import markSeenThreadMutation from '~/graphql/mutation/notifier/mark-seen-thread'
import getNotifications from '~/graphql/query/notifier/notifications-load'
import { Author, NotificationGroup, QueryLoad_NotificationsArgs, Shout } from '~/graphql/schema/core.gen'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { ShowIfAuthenticated } from '../components/_shared/ShowIfAuthenticated'
import { SSEMessage, useConnect } from './connect'
import { useSession } from './session'

export const PAGE_SIZE = 10

// Типы уведомлений, которые могут приходить от presence сервиса
export enum PresenceEntityType {
  Global = 'global',
  Personal = 'personal',
  Topic = 'topic',
  Shout = 'shout',
  Reaction = 'reaction',
  Chat = 'chat',
  Message = 'message',
  Editor = 'editor',
  Cursor = 'cursor',
  Draft = 'draft',
  Proposal = 'proposal'
}

// Действия, которые могут происходить с сущностями
export enum PresenceActionType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Join = 'join',
  Left = 'left',
  Seen = 'seen'
}

// Интерфейс для payload SSE сообщений с типизацией
interface SSEPayload {
  author?: Author
  authors?: Author[]
  shout?: Shout
  [key: string]: any
}

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

const NotificationsContext = createContext<NotificationsContextType>({
  notificationEntities: {},
  unreadNotificationsCount: () => 0,
  after: () => null,
  sortedNotifications: () => [],
  loadedNotificationsCount: () => 0,
  totalNotificationsCount: () => 0,
  showNotificationsPanel: () => {},
  hideNotificationsPanel: () => {},
  markSeen: async (_id) => {},
  markSeenThread: async (_id) => {},
  markSeenAll: async () => {},
  loadNotificationsGrouped: async (_options) => []
})

export const NotificationsProvider = (props: { children: JSX.Element }) => {
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = createSignal(false)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = createSignal(0)
  const [totalNotificationsCount, setTotalNotificationsCount] = createSignal(0)
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
        case PresenceEntityType.Reaction:
          // Обработка уведомлений о реакциях
          if (payload.author) {
            notificationPayload.authors = [payload.author]
          }
          if (payload.shout) {
            notificationPayload.shout = payload.shout
          }
          break
          
        case PresenceEntityType.Message:
          // Обработка уведомлений о сообщениях
          if (payload.author) {
            notificationPayload.authors = [payload.author]
          }
          break
          
        case PresenceEntityType.Shout:
          // Обработка уведомлений о публикациях
          if (payload.authors) {
            notificationPayload.authors = payload.authors
          }
          notificationPayload.shout = payload as unknown as Shout
          break
          
        default:
          // Для других типов просто пытаемся извлечь авторов
          if (payload.author) {
            notificationPayload.authors = [payload.author]
          } else if (payload.authors) {
            notificationPayload.authors = payload.authors
          }
          break
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
    setTotalNotificationsCount(count => count + 1)
    setUnreadNotificationsCount(count => count + 1)
    
    // Добавляем уведомление в хранилище
    setNotificationEntities(prev => ({ 
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
        case PresenceEntityType.Reaction:
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
            loadNotificationsGrouped({
              after: after() || now,
              limit: Math.max(PAGE_SIZE, loadedNotificationsCount())
            })
          }
          break
          
        case PresenceEntityType.Message:
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
          
        case PresenceEntityType.Shout:
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
          
        case PresenceEntityType.Global:
        case PresenceEntityType.Personal:
          // Глобальные и персональные уведомления
          console.info(`[context.notifications] ${data.entity} event`, data)
          // Создаем уведомление
          const notification = createNotificationFromSSE(data)
          if (notification) {
            addNotification(notification)
          }
          break
          
        default:
          // Для других типов просто загружаем уведомления с сервера
          console.debug('[context.notifications] Unhandled event type:', data.entity)
          if (data.action === PresenceActionType.Create) {
            loadNotificationsGrouped({
              after: after() || now,
              limit: Math.max(PAGE_SIZE, loadedNotificationsCount())
            })
          }
          break
      }
      
      // Показываем панель уведомлений для новых уведомлений, если это важное событие
      if (data.action === PresenceActionType.Create && 
          [PresenceEntityType.Message, PresenceEntityType.Personal].includes(data.entity as PresenceEntityType)) {
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
      loadNotificationsGrouped({
        after: after() || now,
        limit: PAGE_SIZE
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

export const useNotifications = () => {
  return useContext(NotificationsContext)
}
