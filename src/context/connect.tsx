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

import { EventSource as ExtendedEventSource } from 'extended-eventsource'
import { createContext, createEffect, createSignal, type JSX, on, onCleanup, onMount, useContext } from 'solid-js'
import { Awareness } from 'y-protocols/awareness.js'
import { Doc } from 'yjs'
import { useSession } from '~/context/session'

// === ТИПЫ ===

export interface SSEMessage {
  id: string
  entity: string // follower | shout | reaction | draft | message | cursor
  action: string // create | delete | update | join | follow | seen
  // biome-ignore lint/suspicious/noExplicitAny: ok
  payload: any
  created_at?: number // unixtime x1000
  seen?: boolean
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'degraded'

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

export type ConnectContextType = {
  // SSE функциональность
  addHandler: (handler: (data: SSEMessage) => void) => () => void
  getStatus: () => ConnectionStatus
  connect: () => Promise<void>
  disconnect: () => void
  reconnect: () => Promise<void>
  error: () => string | null
  lastMessage: () => SSEMessage | null

  // Awareness функциональность
  setUserInfo: (editorId: string, user: Partial<EditorState['user']>) => void
  setCursorPosition: (editorId: string, anchor: number, head: number) => void
  updateDraftField: (editorId: string, draftId: number, fieldName: string, content: string, isEmpty?: boolean) => void
  getConnectedUsers: (editorId: string) => Array<{ clientId: number; user: EditorState['user']; timestamp: number }>
  getDraftContent: (draftId: string | number) => Record<string, DraftField>
  connectEditor: (editorId: string, draftId?: string | number) => void
  disconnectEditor: (editorId: string) => void
}

const ConnectContext = createContext<ConnectContextType>()

export const ConnectProvider = (props: { children: JSX.Element }) => {
  const { session, isSessionLoaded, isSessionValidating } = useSession()

  // SSE состояние
  const [status, setStatus] = createSignal<ConnectionStatus>('disconnected')
  const [handlers, setHandlers] = createSignal<Array<(data: SSEMessage) => void>>([])
  const [error, setError] = createSignal<string | null>(null)
  const [lastMessage, setLastMessage] = createSignal<SSEMessage | null>(null)

  // Awareness состояние
  const [awarenessProviders] = createSignal<Map<string, { doc: Doc; awareness: Awareness }>>(new Map())

  // SSE соединение
  let sseConnection: { close: () => void } | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  // === SSE ФУНКЦИОНАЛЬНОСТЬ ===

  const connect = async (): Promise<void> => {
    const token = session()?.token
    if (!token) {
      console.warn('[Connect] Токен не найден, SSE соединение недоступно')
      return
    }

    try {
      setError(null)
      setStatus('connecting')

      // Закрываем существующее соединение если есть
      if (sseConnection) {
        sseConnection.close()
        sseConnection = null
      }

      console.log('[Connect] Устанавливаем SSE соединение...')

      // Используем ExtendedEventSource для поддержки Authorization заголовка
      const eventSource = new ExtendedEventSource(
        import.meta.env.PUBLIC_REALTIME_EVENTS || 'https://connect.dscrs.site',
        {
          headers: { Authorization: `Bearer ${token}` },
          // Отключаем встроенное переподключение, используем свое
          retry: 0,
          // Отключаем логирование
          disableLogger: false,
          // Включаем CORS
          withCredentials: true
        }
      )

      // Обработчики событий
      eventSource.onopen = () => {
        console.log('[Connect] SSE соединение установлено')
        setStatus('connected')
        setError(null)
        reconnectAttempts = 0
      }

      eventSource.onmessage = (event) => {
        try {
          if (event.data && event.data !== '[DONE]') {
            const data = JSON.parse(event.data)
            console.log('[Connect] Получено SSE сообщение:', data)

            setLastMessage(data)

            // Вызываем все обработчики
            handlers().forEach((handler) => {
              try {
                handler(data)
              } catch (handlerError) {
                console.error('[Connect] Ошибка в обработчике SSE сообщения:', handlerError)
              }
            })
          }
        } catch (parseError) {
          console.error('[Connect] Ошибка парсинга SSE сообщения:', parseError, 'Data:', event.data)
        }
      }

      eventSource.onerror = (_error) => {
        // 💋 Graceful: уменьшаем шум в консоли
        if (reconnectAttempts === 0) {
          console.warn('[Connect] SSE сервис недоступен, работаем в degraded режиме')
        } else if (reconnectAttempts < maxReconnectAttempts) {
          console.debug(`[Connect] SSE переподключение ${reconnectAttempts}/${maxReconnectAttempts}`)
        }

        setStatus(reconnectAttempts >= maxReconnectAttempts ? 'degraded' : 'error')
        setError(reconnectAttempts >= maxReconnectAttempts ? null : 'Попытка переподключения...')

        // Закрываем соединение и инициируем переподключение
        eventSource.close()
        sseConnection = null
        handleReconnect()
      }

      // Сохраняем ссылку на соединение
      sseConnection = eventSource
    } catch (connectError) {
      console.error('[Connect] Ошибка подключения SSE:', connectError)
      setStatus('error')
      setError(`Ошибка подключения: ${connectError instanceof Error ? connectError.message : String(connectError)}`)
      throw connectError instanceof Error ? connectError : new Error(String(connectError))
    }
  }

  const disconnect = () => {
    if (sseConnection) {
      sseConnection.close()
      sseConnection = null
    }

    setStatus('disconnected')
    setError(null)
    reconnectAttempts = maxReconnectAttempts // Предотвращаем автоматическое переподключение
  }

  const reconnect = async (): Promise<void> => {
    console.log('[Connect] Переподключение SSE...')
    disconnect()

    // Небольшая задержка перед переподключением
    await new Promise((resolve) => setTimeout(resolve, 1000))

    reconnectAttempts = 0
    await connect()
  }

  const handleReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('[Connect] Достигнут лимит попыток переподключения')
      setStatus('error')
      setError('Не удалось восстановить соединение')
      return
    }

    const delay = Math.min(baseReconnectDelay * 2 ** reconnectAttempts, 30000)
    reconnectAttempts++

    console.log(`[Connect] Переподключение через ${delay}ms (попытка ${reconnectAttempts}/${maxReconnectAttempts})`)

    setTimeout(() => {
      if (session()?.token && reconnectAttempts <= maxReconnectAttempts) {
        connect().catch((error) => {
          console.error('[Connect] Ошибка автоматического переподключения:', error)
        })
      }
    }, delay)
  }

  // === AWARENESS ФУНКЦИОНАЛЬНОСТЬ ===

  const getAwarenessProvider = (editorId: string) => {
    const providers = awarenessProviders()

    if (!providers.has(editorId)) {
      const doc = new Doc()
      const awareness = new Awareness(doc)
      providers.set(editorId, { doc, awareness })
    }

    return providers.get(editorId)!
  }

  const setUserInfo = (editorId: string, user: Partial<EditorState['user']>) => {
    try {
      const provider = getAwarenessProvider(editorId)
      const currentState = (provider.awareness.getLocalState() as EditorState) || {}

      const newState: EditorState = {
        ...currentState,
        user: { ...currentState.user, ...user } as EditorState['user'],
        editorId,
        timestamp: Date.now()
      }

      provider.awareness.setLocalState(newState)
      console.log(`[Connect] Обновлена информация о пользователе для редактора ${editorId}`)
    } catch (error) {
      console.error('[Connect] Ошибка обновления информации о пользователе:', error)
    }
  }

  const setCursorPosition = (editorId: string, anchor: number, head: number) => {
    try {
      const provider = getAwarenessProvider(editorId)
      const currentState = (provider.awareness.getLocalState() as EditorState) || {}

      const newState: EditorState = {
        ...currentState,
        cursor: { anchor, head },
        timestamp: Date.now()
      }

      provider.awareness.setLocalState(newState)
      console.log(`[Connect] Обновлена позиция курсора для редактора ${editorId}: ${anchor}-${head}`)
    } catch (error) {
      console.error('[Connect] Ошибка обновления позиции курсора:', error)
    }
  }

  const updateDraftField = (
    editorId: string,
    draftId: number,
    fieldName: string,
    content: string,
    isEmpty?: boolean
  ) => {
    try {
      const provider = getAwarenessProvider(editorId)
      const currentState = (provider.awareness.getLocalState() as EditorState) || {}

      const draftContent = currentState.draftContent || { draftId, fields: {} }

      // Обновляем поле
      draftContent.fields[fieldName] = {
        content,
        isEmpty: isEmpty || false,
        lastUpdate: Date.now()
      }

      const newState: EditorState = {
        ...currentState,
        draftContent,
        timestamp: Date.now()
      }

      provider.awareness.setLocalState(newState)

      // Сохраняем в localStorage для офлайн режима
      saveToLocalStorage(draftId, fieldName, content, isEmpty || false)

      console.log(`[Connect] Обновлено поле ${fieldName} черновика ${draftId} (${content.length} символов)`)
    } catch (error) {
      console.error('[Connect] Ошибка обновления поля черновика:', error)
    }
  }

  const saveToLocalStorage = (draftId: string | number, fieldName: string, content: string, isEmpty: boolean) => {
    try {
      const key = `draft-${draftId}-${fieldName}`
      const data = {
        content,
        isEmpty,
        timestamp: Date.now()
      }
      localStorage.setItem(key, JSON.stringify(data))
      console.log(`[Connect] Сохранено в localStorage: ${key}`)
    } catch (error) {
      console.error('[Connect] Ошибка сохранения в localStorage:', error)
    }
  }

  const getConnectedUsers = (editorId: string) => {
    try {
      const provider = getAwarenessProvider(editorId)
      const states = provider.awareness.getStates()

      const users: Array<{ clientId: number; user: EditorState['user']; timestamp: number }> = []

      // biome-ignore lint/suspicious/noExplicitAny: ok
      states.forEach((state: any, clientId: number) => {
        const editorState = state as EditorState
        if (editorState?.user && editorState.editorId === editorId) {
          users.push({
            clientId,
            user: editorState.user,
            timestamp: editorState.timestamp || Date.now()
          })
        }
      })

      return users
    } catch (error) {
      console.error('[Connect] Ошибка получения подключенных пользователей:', error)
      return []
    }
  }

  const getDraftContent = (draftId: string | number) => {
    try {
      // Пытаемся найти в awareness провайдерах
      const providers = awarenessProviders()
      for (const provider of providers.values()) {
        const states = provider.awareness.getStates()
        for (const state of states.values()) {
          const editorState = state as EditorState
          if (editorState?.draftContent?.draftId === draftId) {
            return editorState.draftContent.fields
          }
        }
      }

      return {}
    } catch (error) {
      console.error('[Connect] Ошибка получения содержимого черновика:', error)
      return {}
    }
  }

  const connectEditor = (editorId: string, draftId?: string | number) => {
    try {
      console.log(`[Connect] Подключаем редактор ${editorId} к черновику ${draftId}`)

      const _provider = getAwarenessProvider(editorId)

      // Синхронизируем с localStorage если есть draftId
      if (draftId) {
        syncFromLocalStorage(editorId, draftId)
      }

      console.log(`[Connect] Редактор ${editorId} подключен`)
    } catch (error) {
      console.error('[Connect] Ошибка подключения редактора:', error)
    }
  }

  const disconnectEditor = (editorId: string) => {
    try {
      console.log(`[Connect] Отключаем редактор ${editorId}`)

      const providers = awarenessProviders()
      const provider = providers.get(editorId)

      if (provider) {
        provider.awareness.destroy()
        provider.doc.destroy()
        providers.delete(editorId)
      }

      console.log(`[Connect] Редактор ${editorId} отключен`)
    } catch (error) {
      console.error('[Connect] Ошибка отключения редактора:', error)
    }
  }

  const syncFromLocalStorage = (editorId: string, draftId: string | number) => {
    try {
      const provider = getAwarenessProvider(editorId)
      const fieldNames = ['title', 'subtitle', 'lead', 'body', 'media']
      const fieldsData: Record<string, DraftField> = {}

      fieldNames.forEach((fieldName) => {
        const key = `draft-${draftId}-${fieldName}`
        const stored = localStorage.getItem(key)

        if (stored) {
          try {
            const data = JSON.parse(stored)
            fieldsData[fieldName] = {
              content: data.content || '',
              isEmpty: data.isEmpty || false,
              lastUpdate: data.timestamp || Date.now()
            }
          } catch (parseError) {
            console.warn(`[Connect] Не удалось распарсить данные из localStorage для ${key}:`, parseError)
          }
        }
      })

      if (Object.keys(fieldsData).length > 0) {
        const currentState = (provider.awareness.getLocalState() as EditorState) || {}

        const newState: EditorState = {
          ...currentState,
          editorId,
          timestamp: Date.now(),
          draftContent: {
            draftId,
            fields: fieldsData
          }
        }

        provider.awareness.setLocalState(newState)
        console.info(
          `[Connect] Восстановлено ${Object.keys(fieldsData).length} полей из localStorage для черновика ${draftId}`
        )
      }
    } catch (e) {
      console.warn('[Connect] Ошибка синхронизации из localStorage:', e)
    }
  }

  // === ОБРАБОТЧИКИ СОБЫТИЙ ===

  const addHandler = (handler: (data: SSEMessage) => void) => {
    setHandlers((prev) => [...prev, handler])

    return () => {
      setHandlers((prev) => prev.filter((h) => h !== handler))
    }
  }

  const getStatus = () => status()

  // Автоматическое подключение при наличии токена
  onMount(() => {
    console.log('[Connect] Инициализация ConnectProvider с прямым SSE')
  })

  // Подключаемся при изменении токена
  createEffect(
    on(
      [() => session()?.token, isSessionLoaded, isSessionValidating],
      ([token]) => {
        if (token && isSessionLoaded() && !isSessionValidating()) {
          console.log('[Connect] Токен получен и сессия загружена, подключаемся к SSE')
          connect().catch((error) => {
            console.error('[Connect] Ошибка автоматического подключения:', error)
          })
        } else {
          console.log('[Connect] Нет готовой сессии/токена, отключаемся от SSE')
          disconnect()
        }
      },
      { defer: false }
    )
  )

  // Переподключение при восстановлении сети
  onMount(() => {
    const handleOnline = () => {
      console.log('[Connect] Сеть восстановлена, переподключаемся')
      if (session()?.token) {
        reconnect().catch((error) => {
          console.error('[Connect] Ошибка переподключения при восстановлении сети:', error)
        })
      }
    }

    const handleOffline = () => {
      console.log('[Connect] Сеть отключена')
      setStatus('disconnected')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    onCleanup(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    })
  })

  onCleanup(() => {
    // Отключаем SSE
    disconnect()

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
    connect,
    disconnect,
    reconnect,
    error,
    lastMessage,

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
    getActiveUsers: () => getConnectedUsers(editorId).filter((user) => user.user.id !== session()?.author?.id)
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
