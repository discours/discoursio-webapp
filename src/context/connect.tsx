import type { JSX } from 'solid-js'
import type { Author, Reaction, Shout, Topic } from '~/graphql/schema/core.gen'

import { EventSource } from 'extended-eventsource'
import { createContext, createEffect, createSignal, on, onCleanup, useContext } from 'solid-js'

import { Chat, Message } from '~/graphql/schema/chat.gen'
import { sseUrl } from '../config'
import { useSession } from './session'

const RECONNECT_TIMES = 2

export interface SSEMessage {
  id: string
  entity: string // follower | shout | reaction
  action: string // create | delete | update | join | follow | seen
  payload: Author | Shout | Topic | Reaction | Chat | Message
  created_at?: number // unixtime x1000
  seen?: boolean
}

export type MessageHandler = (m: SSEMessage) => void

export interface ConnectContextType {
  addHandler: (handler: MessageHandler) => void
  connected: boolean
  reconnect: () => void
}

const noop = () => undefined

const ConnectContext = createContext<ConnectContextType>({
  addHandler: noop,
  connected: false,
  reconnect: noop
})

export const ConnectProvider = (props: { children: JSX.Element }) => {
  const [messageHandlers, setHandlers] = createSignal<MessageHandler[]>([])
  const [connected, setConnected] = createSignal(false)
  const { session } = useSession()
  const [retried, setRetried] = createSignal<number>(0)
  const [eventSource, setEventSource] = createSignal<EventSource | null>(null)

  const addHandler = (handler: MessageHandler) => {
    setHandlers((hhh) => [...hhh, handler])
  }

  const initConnection = async (token: string) => {
    if (!sseUrl) return
    if (!token) return

    try {
      if (eventSource()) {
        eventSource()?.close()
      }

      console.info('[context.connect] init SSE connection')

      const newEventSource = new EventSource(sseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token
        },
        retry: 3000
      })

      setEventSource(newEventSource)

      newEventSource.onopen = (ev) => {
        console.log('[context.connect] SSE connection opened', ev)
        setConnected(true)
        setRetried(0)
      }

      newEventSource.onmessage = (event: MessageEvent) => {
        const m: SSEMessage = JSON.parse(event.data || '{}')
        console.debug('[context.connect] Received message:', m)
        messageHandlers().forEach((handler) => handler(m))
      }

      newEventSource.onerror = (error) => {
        console.error('[context.connect] SSE connection error:', error)
        setConnected(false)
        if (retried() < RECONNECT_TIMES) {
          setRetried((r) => r + 1)
        } else {
          newEventSource.close()
          console.warn('[context.connect] Max reconnection attempts reached')
        }
      }
    } catch (error) {
      console.error('[context.connect] SSE init failed:', error)
    }
  }

  const reconnectFn = () => {
    const token = session()?.token
    if (token) {
      console.log('[context.connect] Manual reconnection triggered')
      setRetried(0)
      initConnection(token)
    } else {
      console.warn('[context.connect] Cannot reconnect - no token available')
    }
  }

  createEffect(
    on(
      () => session()?.token,
      (tkn) => {
        if (!tkn) {
          if (eventSource()) {
            eventSource()?.close()
            setEventSource(null)
          }
          setConnected(false)
          return
        }

        if (!connected() && retried() <= RECONNECT_TIMES) {
          initConnection(tkn)
        }
      }
    )
  )

  onCleanup(() => {
    if (eventSource()) {
      eventSource()?.close()
    }
  })

  const value: ConnectContextType = {
    addHandler,
    connected: connected(),
    reconnect: reconnectFn
  }

  return <ConnectContext.Provider value={value}>{props.children}</ConnectContext.Provider>
}

export const useConnect = () => {
  const context = useContext(ConnectContext)

  // Обеспечиваем, что reconnect всегда будет функцией
  if (!context.reconnect || typeof context.reconnect !== 'function') {
    console.warn('[useConnect] reconnect is not a function, providing fallback')
    return {
      ...context,
      reconnect: () => console.warn('[useConnect] Using fallback reconnect function')
    }
  }

  return context
}
