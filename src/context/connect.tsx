/**
 * Унифицированный контекст SSE соединения для Discours.io
 *
 * Объединяет в себе:
 * - Service Worker управление и SSE соединение
 * - Обработку SSE сообщений и уведомлений
 * - YJS Awareness для совместного редактирования
 * - Background Sync и офлайн поддержку
 *
 * Это единственная точка входа для всей SSE функциональности приложения.
 */

import type { JSX } from 'solid-js'
import type { Author, Reaction, Shout, Topic } from '~/graphql/schema/core.gen'

import { createContext, createEffect, createSignal, on, onCleanup, onMount, useContext } from 'solid-js'
import { Awareness } from 'y-protocols/awareness.js'
import { Doc } from 'yjs'

import { Chat, Message } from '~/graphql/schema/chat.gen'
import { useSession } from './session'

/**
 * Интерфейс SSE сообщения
 */
export interface SSEMessage {
  id: string
  entity: string // follower | shout | reaction | draft | message | cursor
  action: string // create | delete | update | join | follow | seen
  payload: Author | Shout | Topic | Reaction | Chat | Message
  created_at?: number // unixtime x1000
  seen?: boolean
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

// Типы для Awareness
export type DraftField = {
  content: string
  isEmpty?: boolean
  lastUpdate: number
}

export type DraftContent = {
  draftId: string | number
  fields: Record<string, DraftField>
}

export type EditorState = {
  user: {
    id: string | number
    name: string
    color: string
    tabId: string
  }
  editorId: string
  timestamp: number
  draftContent?: DraftContent
  cursor?: {
    anchor: number
    head: number
  }
}

// Типы для Service Worker сообщений
interface ServiceWorkerMessage {
  type: string
  data?: unknown
  messageId?: string
  timestamp?: number
  version?: string
  error?: string
}

// Унифицированный контекст
export type ConnectContextType = {
  // SSE функциональность
  addHandler: (handler: (data: SSEMessage) => void) => () => void
  getStatus: () => ConnectionStatus

  // Service Worker управление
  isRegistered: () => boolean
  isConnected: () => boolean
  isSupported: () => boolean
  error: () => string | null
  version: () => string | null
  register: () => Promise<void>
  unregister: () => Promise<void>
  ping: () => Promise<boolean>
  clearCache: () => Promise<void>
  requestBackgroundSync: (tag: string) => void
  lastPong: () => number | null
  lastSSEMessage: () => SSEMessage | null

  // Awareness функциональность
  setUserInfo: (editorId: string, user: Partial<EditorState['user']>) => void
  setCursorPosition: (editorId: string, anchor: number, head: number) => void
  updateDraftField: (
    editorId: string,
    draftId: number,
    fieldName: string,
    content: string,
    isEmpty?: boolean
  ) => void
  getConnectedUsers: (
    editorId: string
  ) => Array<{ clientId: number; user: EditorState['user']; timestamp: number }>
  getDraftContent: (draftId: string | number) => Record<string, DraftField>
  connectEditor: (editorId: string, draftId?: string | number) => void
  disconnectEditor: (editorId: string) => void
}

const ConnectContext = createContext<ConnectContextType>()

export const ConnectProvider = (props: { children: JSX.Element }) => {
  const { session } = useSession()

  // SSE состояние
  const [status, setStatus] = createSignal<ConnectionStatus>('disconnected')
  const [handlers, setHandlers] = createSignal<Array<(data: SSEMessage) => void>>([])

  // Service Worker состояние
  const [isRegistered, setIsRegistered] = createSignal(false)
  const [isConnected, setIsConnected] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [version, setVersion] = createSignal<string | null>(null)
  const [lastPong, setLastPong] = createSignal<number | null>(null)
  const [lastSSEMessage, setLastSSEMessage] = createSignal<SSEMessage | null>(null)

  // Awareness состояние
  const [awarenessProviders] = createSignal<Map<string, { doc: Doc; awareness: Awareness }>>(new Map())
  const [draftFieldCache] = createSignal<Map<string, string>>(new Map())

  let serviceWorker: ServiceWorker | null = null
  const messageHandlers = new Map<string, (data: ServiceWorkerMessage) => void>()

  // Проверяем поддержку Service Worker
  const isSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator

  // Безопасная отправка сообщений в Service Worker
  const sendMessage = (type: string, data?: unknown): Promise<ServiceWorkerMessage> => {
    return new Promise((resolve, reject) => {
      if (!serviceWorker) {
        reject(new Error('Service Worker не зарегистрирован'))
        return
      }

      try {
        const messageId = Date.now().toString()
        const timeoutId = setTimeout(() => {
          messageHandlers.delete(messageId)
          reject(new Error('Timeout: Service Worker не ответил'))
        }, 5000)

        messageHandlers.set(messageId, (response) => {
          clearTimeout(timeoutId)
          messageHandlers.delete(messageId)
          resolve(response)
        })

        serviceWorker.postMessage({ type, data, messageId })
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  // Обработка сообщений от Service Worker
  const handleMessage = (event: MessageEvent) => {
    try {
      const { type, data, messageId } = event.data || {}

      // Обрабатываем ответы на запросы
      if (messageId && messageHandlers.has(messageId)) {
        const handler = messageHandlers.get(messageId)
        if (handler) {
          handler(event.data)
          return
        }
      }

      // Обрабатываем события
      switch (type) {
        case 'PONG':
          setLastPong(data?.timestamp || Date.now())
          break

        case 'VERSION':
          setVersion(data?.version || null)
          break

        case 'SSE_CONNECTED': {
          setIsConnected(true)
          setError(null)
          setStatus('connected')
          console.log('[Connect] SSE подключен через Service Worker')
          break
        }

        case 'SSE_MESSAGE': {
          setLastSSEMessage(data as SSEMessage)
          console.log('[Connect] SSE сообщение:', data)

          // Вызываем все обработчики SSE сообщений
          handlers().forEach((handler) => handler(data as SSEMessage))
          break
        }

        case 'REQUEST_TOKEN': {
          // Service Worker запрашивает токен для SSE
          console.log('[Connect] Service Worker запрашивает токен')
          const currentToken = session()?.token
          if (currentToken) {
            setToken(currentToken)
          }
          break
        }

        case 'CACHE_CLEARED':
          console.log('[Connect] Кеш очищен')
          break

        case 'CACHE_CLEAR_FAILED': {
          console.error('[Connect] Ошибка очистки кеша:', data?.error)
          setError(`Ошибка очистки кеша: ${data?.error}`)
          break
        }

        default:
          console.log('[Connect] Неизвестное сообщение:', type, data)
      }
    } catch (error) {
      console.error('[Connect] Ошибка обработки сообщения:', error)
      setError(`Ошибка обработки сообщения: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Регистрация Service Worker
  const register = async (): Promise<void> => {
    if (!isSupported()) {
      throw new Error('Service Worker не поддерживается')
    }

    try {
      setError(null)

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      console.log('[Connect] Service Worker зарегистрирован:', registration.scope)

      // Получаем активный Service Worker
      serviceWorker = registration.active || registration.waiting || registration.installing

      if (serviceWorker) {
        setIsRegistered(true)

        // Слушаем сообщения
        navigator.serviceWorker.addEventListener('message', handleMessage)

        // Проверяем версию
        try {
          const versionResponse = await sendMessage('GET_VERSION')
          setVersion(versionResponse.version || null)
        } catch (error) {
          console.warn('[Connect] Не удалось получить версию:', error)
        }

        // Отправляем токен если есть
        const currentToken = session()?.token
        if (currentToken) {
          setToken(currentToken)
        }
      }

      // Слушаем обновления
      registration.addEventListener('updatefound', () => {
        console.log('[Connect] Найдено обновление Service Worker')
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[Connect] Новый Service Worker активирован')
              serviceWorker = newWorker
            }
          })
        }
      })
    } catch (error) {
      console.error('[Connect] Ошибка регистрации:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`Ошибка регистрации: ${errorMessage}`)
      setStatus('error')
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // Отмена регистрации
  const unregister = async (): Promise<void> => {
    if (!isSupported()) {
      return
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations()

      for (const registration of registrations) {
        if (registration.scope.includes('/')) {
          await registration.unregister()
          console.log('[Connect] Регистрация Service Worker отменена')
        }
      }

      setIsRegistered(false)
      setIsConnected(false)
      setStatus('disconnected')
      setVersion(null)
      serviceWorker = null

      // Убираем слушатель
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    } catch (error) {
      console.error('[Connect] Ошибка отмены регистрации:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`Ошибка отмены регистрации: ${errorMessage}`)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // Ping Service Worker
  const ping = async (): Promise<boolean> => {
    try {
      const response = await sendMessage('PING')
      return response.type === 'PONG'
    } catch (error) {
      console.error('[Connect] Ping неудачен:', error)
      return false
    }
  }

  // Очистка кеша
  const clearCache = async (): Promise<void> => {
    try {
      await sendMessage('CLEAR_CACHE')
      console.log('[Connect] Запрос на очистку кеша отправлен')
    } catch (error) {
      console.error('[Connect] Ошибка очистки кеша:', error)
      throw error instanceof Error ? error : new Error(String(error))
    }
  }

  // Установка токена для SSE
  const setToken = (token: string): void => {
    if (!serviceWorker) {
      console.warn('[Connect] Service Worker не зарегистрирован, токен не установлен')
      return
    }

    try {
      serviceWorker.postMessage({
        type: 'SET_TOKEN',
        data: { token }
      })
      console.log('[Connect] Токен отправлен в Service Worker')
    } catch (error) {
      console.error('[Connect] Ошибка отправки токена:', error)
      setError(`Ошибка отправки токена: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Запрос фоновой синхронизации
  const requestBackgroundSync = (tag: string): void => {
    if (!serviceWorker) {
      console.warn('[Connect] Service Worker не зарегистрирован, синхронизация недоступна')
      return
    }

    try {
      serviceWorker.postMessage({
        type: 'REQUEST_BACKGROUND_SYNC',
        data: { tag }
      })
      console.log('[Connect] Запрос фоновой синхронизации:', tag)
    } catch (error) {
      console.error('[Connect] Ошибка запроса синхронизации:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`Ошибка запроса синхронизации: ${errorMessage}`)
    }
  }

  // === AWARENESS ФУНКЦИОНАЛЬНОСТЬ ===

  // Получить или создать Awareness провайдер для редактора
  const getAwarenessProvider = (editorId: string) => {
    const providers = awarenessProviders()

    if (!providers.has(editorId)) {
      const doc = new Doc()
      const awareness = new Awareness(doc)
      providers.set(editorId, { doc, awareness })
    }

    return providers.get(editorId)!
  }

  // Установка информации о пользователе
  const setUserInfo = (editorId: string, user: Partial<EditorState['user']>) => {
    const { awareness } = getAwarenessProvider(editorId)
    const currentState = (awareness.getLocalState() as EditorState | undefined) || {
      user: {},
      editorId,
      timestamp: Date.now()
    }

    awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState.user,
        ...user
      },
      editorId,
      timestamp: Date.now()
    } as EditorState)
  }

  // Установка позиции курсора
  const setCursorPosition = (editorId: string, anchor: number, head: number) => {
    const { awareness } = getAwarenessProvider(editorId)
    const currentState = awareness.getLocalState() as EditorState | undefined
    if (!currentState) return

    const newState = {
      ...currentState,
      cursor: { anchor, head },
      timestamp: Date.now()
    } as EditorState

    awareness.setLocalState(newState)

    // Сохраняем в localStorage
    try {
      if (typeof window !== 'undefined') {
        const storageKey = `yjs-cursor-${editorId}`
        const cursorData = {
          anchor,
          head,
          timestamp: Date.now(),
          userId: currentState.user?.id,
          editorId
        }
        localStorage.setItem(storageKey, JSON.stringify(cursorData))
      }
    } catch (e) {
      console.warn('[Connect] Failed to save cursor position to localStorage:', e)
    }
  }

  // Обновление поля черновика
  const updateDraftField = (
    editorId: string,
    draftId: number,
    fieldName: string,
    content: string,
    isEmpty?: boolean
  ) => {
    const cacheKey = `${draftId}:${fieldName}`
    const cache = draftFieldCache()
    const previousContent = cache.get(cacheKey)

    // Если содержимое не изменилось, не выполняем обновление
    if (previousContent === content) {
      console.debug(`[Connect] Content for ${cacheKey} hasn't changed, skipping update`)
      return
    }

    // Обновляем кэш
    cache.set(cacheKey, content)

    // Сохраняем в localStorage
    saveToLocalStorage(draftId, fieldName, content, isEmpty ?? false)

    const { awareness } = getAwarenessProvider(editorId)
    const currentState = awareness.getLocalState() as EditorState | undefined

    const newState: EditorState = {
      timestamp: Date.now(),
      editorId,
      user: currentState?.user || {
        id: '',
        name: '',
        color: '',
        tabId: ''
      },
      cursor: currentState?.cursor,
      draftContent: {
        draftId,
        fields: {
          [fieldName]: {
            content,
            isEmpty,
            lastUpdate: Date.now()
          } as DraftField
        }
      }
    }

    awareness.setLocalState(newState)

    // Если нет соединения, запрашиваем фоновую синхронизацию
    if (status() !== 'connected') {
      console.info(`[Connect] Not connected, requesting background sync for draft ${draftId}`)
      requestBackgroundSync('draft-sync')
    }
  }

  // Сохранение в localStorage
  const saveToLocalStorage = (
    draftId: string | number,
    fieldName: string,
    content: string,
    isEmpty: boolean
  ) => {
    if (typeof window === 'undefined') return

    try {
      const storageKey = `yjs-content-${draftId}-${fieldName}`
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          content,
          isEmpty,
          lastUpdate: Date.now(),
          draftId,
          fieldName
        })
      )
    } catch (e) {
      console.warn('[Connect] Failed to save content to localStorage:', e)
    }
  }

  // Получение подключенных пользователей
  const getConnectedUsers = (editorId: string) => {
    const { awareness } = getAwarenessProvider(editorId)
    const states = awareness.getStates()
    const users: Array<{
      clientId: number
      user: EditorState['user']
      timestamp: number
    }> = []

    states.forEach((state, clientId) => {
      const editorState = state as EditorState
      if (editorState.user && editorState.editorId === editorId) {
        users.push({
          clientId,
          user: editorState.user,
          timestamp: editorState.timestamp
        })
      }
    })

    return users
  }

  // Получение содержимого черновика
  const getDraftContent = (draftId: string | number) => {
    if (status() !== 'connected') {
      console.info(`[Connect] Not connected, skipping getDraftContent for ${draftId}`)
      return {}
    }

    const allFields: Record<string, DraftField> = {}
    const providers = awarenessProviders()

    providers.forEach(({ awareness }) => {
      const states = awareness.getStates()
      states.forEach((state) => {
        const editorState = state as EditorState
        if (editorState.draftContent && editorState.draftContent.draftId === draftId) {
          const fields = editorState.draftContent.fields

          Object.entries(fields).forEach(([fieldName, fieldData]) => {
            const existingField = allFields[fieldName]
            if (!existingField || existingField.lastUpdate < fieldData.lastUpdate) {
              allFields[fieldName] = fieldData
            }
          })
        }
      })
    })

    return allFields
  }

  // Подключение редактора
  const connectEditor = (editorId: string, draftId?: string | number) => {
    console.log(`[Connect] Connecting editor ${editorId}`)

    // Инициализируем провайдер
    getAwarenessProvider(editorId)

    // Восстанавливаем данные из localStorage если есть
    if (draftId) {
      syncFromLocalStorage(editorId, draftId)
    }
  }

  // Отключение редактора
  const disconnectEditor = (editorId: string) => {
    console.log(`[Connect] Disconnecting editor ${editorId}`)

    const providers = awarenessProviders()
    const provider = providers.get(editorId)

    if (provider) {
      // Очищаем состояние awareness
      try {
        const currentState = provider.awareness.getLocalState() as EditorState | undefined
        if (currentState) {
          provider.awareness.setLocalState(null)
        }
      } catch (e) {
        console.error('[Connect] Error cleaning up awareness:', e)
      }

      providers.delete(editorId)
    }
  }

  // Восстановление из localStorage
  const syncFromLocalStorage = (editorId: string, draftId: string | number) => {
    if (typeof window === 'undefined' || !draftId) return

    try {
      const prefix = `yjs-content-${draftId}-`
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix))

      if (keys.length === 0) {
        console.info(`[Connect] No local content found for draft ${draftId}`)
        return
      }

      const fieldsData: Record<string, DraftField> = {}

      keys.forEach((key) => {
        try {
          const savedData = JSON.parse(localStorage.getItem(key) || '')
          const fieldName = key.substring(prefix.length)

          fieldsData[fieldName] = {
            content: savedData.content,
            isEmpty: savedData.isEmpty,
            lastUpdate: savedData.lastUpdate
          }
        } catch (e) {
          console.warn(`[Connect] Error parsing localStorage data for key ${key}:`, e)
        }
      })

      if (Object.keys(fieldsData).length > 0) {
        const { awareness } = getAwarenessProvider(editorId)
        const currentState = awareness.getLocalState() as EditorState | undefined

        const newState: EditorState = {
          timestamp: Date.now(),
          editorId,
          user: currentState?.user || {
            id: '',
            name: '',
            color: '',
            tabId: ''
          },
          cursor: currentState?.cursor,
          draftContent: {
            draftId,
            fields: fieldsData
          }
        }

        awareness.setLocalState(newState)
        console.info(
          `[Connect] Restored ${Object.keys(fieldsData).length} fields from localStorage for draft ${draftId}`
        )
      }
    } catch (e) {
      console.warn('[Connect] Error syncing from localStorage:', e)
    }
  }

  // === ОБРАБОТЧИКИ СОБЫТИЙ ===

  // Добавление обработчика SSE сообщений
  const addHandler = (handler: (data: SSEMessage) => void) => {
    setHandlers((prev) => [...prev, handler])

    return () => {
      setHandlers((prev) => prev.filter((h) => h !== handler))
    }
  }

  const getStatus = () => status()

  // Автоматическая регистрация Service Worker и отправка токена
  onMount(() => {
    // Проверяем поддержку и регистрируем с защитой от ошибок
    if (isSupported()) {
      register().catch((error) => {
        console.warn('[Connect] Service Worker registration failed, continuing without it:', error)
        // Не блокируем работу приложения даже если SW не зарегистрировался
      })
    } else {
      console.info('[Connect] Service Worker not supported, running without it')
    }
  })

  // Отправляем токен в Service Worker при изменении сессии
  createEffect(
    on(
      session,
      (s) => {
        if (s?.token && serviceWorker) {
          setToken(s.token)
          console.info('[Connect] Token sent to Service Worker')
        }
      },
      { defer: false }
    )
  )

  // Обновляем статус соединения
  createEffect(() => {
    if (isConnected()) {
      setStatus('connected')
    } else if (isRegistered()) {
      setStatus('connecting')
    } else {
      setStatus('disconnected')
    }
  })

  onCleanup(() => {
    // Очищаем все awareness провайдеры
    const providers = awarenessProviders()
    providers.forEach((_, editorId) => {
      disconnectEditor(editorId)
    })
  })

  const value: ConnectContextType = {
    // SSE
    addHandler,
    getStatus,

    // Service Worker
    isRegistered,
    isConnected,
    isSupported,
    error,
    version,
    register,
    unregister,
    ping,
    clearCache,
    requestBackgroundSync,
    lastPong,
    lastSSEMessage,

    // Awareness
    setUserInfo,
    setCursorPosition,
    updateDraftField,
    getConnectedUsers,
    getDraftContent,
    connectEditor,
    disconnectEditor
  }

  return <ConnectContext.Provider value={value}>{props.children}</ConnectContext.Provider>
}

export const useConnect = () => {
  const context = useContext(ConnectContext)
  if (!context) {
    throw new Error('useConnect должен использоваться внутри ConnectProvider')
  }
  return context
}

// Хук для удобной работы с Awareness в редакторе
export const useEditorAwareness = (editorId: string, draftId?: number | string, fieldType?: string) => {
  const {
    setUserInfo,
    setCursorPosition,
    updateDraftField,
    getConnectedUsers,
    getDraftContent,
    connectEditor,
    disconnectEditor,
    getStatus
  } = useConnect()

  const { session } = useSession()

  // Подключаемся при монтировании
  onMount(() => {
    connectEditor(editorId, draftId)

    // Устанавливаем информацию о пользователе
    const userData = session()
    if (userData?.author) {
      setUserInfo(editorId, {
        id: userData.author.id || 0,
        name: (userData.author as { name?: string })?.name || 'Anonymous',
        color: getRandomColor(userData.author.id || 0),
        tabId: crypto.randomUUID().slice(0, 8)
      })
    }
  })

  onCleanup(() => {
    disconnectEditor(editorId)
  })

  return {
    connectionState: getStatus,
    updateCursorPosition: (anchor: number, head: number) => setCursorPosition(editorId, anchor, head),
    updateEditorContent: (content: string, isEmpty?: boolean) => {
      if (draftId) {
        updateDraftField(editorId, Number(draftId), fieldType || 'body', content, isEmpty)
      }
    },
    getLatestContent: () => (draftId ? getDraftContent(draftId) : null),
    getActiveUsers: () =>
      getConnectedUsers(editorId).filter((user) => user.user.id !== session()?.author?.id)
  }
}

// Генерация случайного цвета для пользователя
const getRandomColor = (userId: string | number): string => {
  const safeColors = [
    '#3498db',
    '#2ecc71',
    '#e74c3c',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#d35400',
    '#c0392b',
    '#16a085',
    '#8e44ad',
    '#27ae60',
    '#2980b9',
    '#f1c40f'
  ]

  const hash = String(userId)
    .split('')
    .reduce((a, b) => {
      const aa = (a << 5) - a + b.charCodeAt(0)
      return aa & aa
    }, 0)

  return safeColors[Math.abs(hash) % safeColors.length]
}
