import type { JSX } from 'solid-js'
import type { Author, Reaction, Shout, Topic } from '~/graphql/schema/core.gen'

import { EventSource } from 'extended-eventsource'
import { createContext, createEffect, createSignal, on, onCleanup, useContext } from 'solid-js'

import { Chat, Message } from '~/graphql/schema/chat.gen'
import { sseUrl } from '../config'
import { useSession } from './session'

// Увеличиваем количество попыток переподключения
const RECONNECT_TIMES = 5
// Максимальная задержка переподключения в мс
const MAX_RECONNECT_DELAY = 30000

export interface SSEMessage {
  id: string
  entity: string // follower | shout | reaction
  action: string // create | delete | update | join | follow | seen
  payload: Author | Shout | Topic | Reaction | Chat | Message
  created_at?: number // unixtime x1000
  seen?: boolean
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export type ConnectContextType = {
  addHandler: (handler: (data: SSEMessage) => void) => () => void
  getStatus: () => ConnectionStatus
}

const ConnectContext = createContext<ConnectContextType>({
  addHandler: () => () => {},
  getStatus: () => 'disconnected' as ConnectionStatus
})

export const ConnectProvider = (props: { children: JSX.Element }) => {
  const { session } = useSession()
  const [status, setStatus] = createSignal<ConnectionStatus>('disconnected')
  const [handlers, setHandlers] = createSignal<Array<(data: SSEMessage) => void>>([])
  // Хранит ID обработанных сообщений для дедупликации
  const [processedMessageIds] = createSignal<Set<string>>(new Set())
  
  let eventSource: EventSource | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Расчет задержки переподключения с экспоненциальным увеличением
  const calculateReconnectDelay = () => {
    const baseDelay = 1000; // 1 секунда
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
    console.debug(`[context.connect] Reconnect delay: ${delay}ms (attempt ${reconnectAttempt + 1}/${RECONNECT_TIMES})`);
    return delay;
  };

  const initConnection = (token: string | undefined) => {
    if (!token) {
      console.warn('[context.connect] No token provided, connection aborted')
      return
    }

    closeConnection()

    try {
      setStatus('connecting')
      
      // Создаем заголовки
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
      
      // Опции подключения
      const options = {
        withCredentials: true, // Разрешаем передачу cookies
        headers
      }

      eventSource = new EventSource(sseUrl, options)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEMessage
          
          // Проверяем на дубликаты
          if (data.id && processedMessageIds().has(data.id)) {
            console.debug(`[context.connect] Skipping duplicate message: ${data.id}`)
            return
          }
          
          // Добавляем ID в список обработанных
          if (data.id) {
            processedMessageIds().add(data.id)
            
            // Ограничиваем размер кэша ID до 1000 элементов
            if (processedMessageIds().size > 1000) {
              const iterator = processedMessageIds().values()
              processedMessageIds().delete(iterator.next()?.value || '')
            }
          }
          
          console.debug(`[context.connect] Received event: ${data.entity}:${data.action}`, data)
          
          // Вызываем все обработчики
          handlers().forEach((handler) => handler(data))
        } catch (e) {
          console.error('[context.connect] Error parsing event data', e, event.data)
        }
      }

      eventSource.onopen = () => {
        console.info('[context.connect] SSE connection opened')
        setStatus('connected')
        reconnectAttempt = 0
      }

      eventSource.onerror = (e) => {
        console.error('[context.connect] SSE connection error', e)
        handleConnectionError()
      }
    } catch (error) {
      console.error('[context.connect] Failed to establish SSE connection', error)
      handleConnectionError()
    }
  }

  const handleConnectionError = () => {
    setStatus('error')
    closeConnection()
    
    // Пытаемся переподключиться с увеличивающейся задержкой
    if (reconnectAttempt < RECONNECT_TIMES) {
      reconnectAttempt++
      const delay = calculateReconnectDelay()
      
      console.info(`[context.connect] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${RECONNECT_TIMES})`)
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      
      reconnectTimer = setTimeout(() => {
        console.info('[context.connect] Attempting to reconnect...')
        const currentToken = session()?.token
        if (currentToken) {
          initConnection(currentToken)
        }
      }, delay)
    } else {
      console.error(`[context.connect] Maximum reconnect attempts (${RECONNECT_TIMES}) reached, giving up`)
    }
  }

  const closeConnection = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    setStatus('disconnected')
  }

  const addHandler = (handler: (data: SSEMessage) => void) => {
    setHandlers((prev) => [...prev, handler])
    return () => {
      setHandlers((prev) => prev.filter((h) => h !== handler))
    }
  }

  const getStatus = () => status()

  createEffect(
    on(
      session,
      (s) => {
        if (s?.token) {
          initConnection(s.token)
        } else {
          closeConnection()
        }
      },
      { defer: false }
    )
  )

  onCleanup(() => {
    closeConnection()
  })

  const value = {
    addHandler,
    getStatus
  }

  return <ConnectContext.Provider value={value}>{props.children}</ConnectContext.Provider>
}

export const useConnect = () => {
  return useContext(ConnectContext)
}
