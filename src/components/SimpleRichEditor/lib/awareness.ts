/**
 * YJS провайдер через SSE соединение
 *
 * Особенности:
 * - Использует существующее SSE соединение
 * - Поддерживает awareness для курсоров
 * - Батчинг обновлений для оптимизации
 */

import { createSignal, onCleanup, onMount } from 'solid-js'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness.js'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import { sseUrl } from '~/config'
import { SSEMessage, useConnect } from '~/context/connect'
import { useSession } from '~/context/session'

const BATCH_TIMEOUT = 500 // ms

// Типы для состояний и обновлений
export type EditorState = {
  user: {
    id: string | number
    name: string
    color: string
    tabId: string
  }
  editorId: string
  timestamp: number
}

export type AwarenessUpdate = {
  type: 'sync' | 'update' | 'awareness'
  editorId: string
  data: string
  origin?: string
}

type ConnectionState = 'connected' | 'disconnected' | 'connecting'

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

const sendUpdate = async (update: Uint8Array, token: string) => {
  if (!token) return
  const response = await fetch(sseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      Authorization: token
    },
    body: update
  })
  if (!response.ok) {
    console.error('[AwarenessProvider] Failed to send update', response)
    throw new Error(`Failed to send update ${response.statusText}`)
  }
}

export function createAwarenessProvider(doc: Doc, awareness: Awareness) {
  let isSynced = false
  const { addHandler } = useConnect()
  const { session } = useSession()
  const token = () => session()?.access_token || ''
  const [_connectionState, setConnectionState] = createSignal<'connected' | 'disconnected'>('disconnected')

  const handleError = (error: Error) => {
    console.error('[AwarenessProvider] Error:', error)
    setConnectionState('disconnected')
    // Trigger reconnection logic if needed
  }

  const handleUpdate = (update: SSEMessage | AwarenessUpdate) => {
    try {
      const message = update as AwarenessUpdate
      const data: Uint8Array = base64ToUint8Array(message.data)

      switch (message.type) {
        case 'sync': {
          if (!isSynced) {
            applyUpdate(doc, data)
            isSynced = true
            setConnectionState('connected')
          }
          break
        }

        case 'update': {
          applyUpdate(doc, data)
          break
        }

        case 'awareness': {
          const updateId = crypto.randomUUID() // More reliable than Math.random
          applyAwarenessUpdate(awareness, data, updateId)
          break
        }

        default: {
          console.warn('[AwarenessProvider] Unknown message type:', message.type)
          break
        }
      }
    } catch (error) {
      handleError(error as Error)
    }
  }

  const handleAwarenessUpdate = ({
    added,
    updated,
    removed
  }: {
    added: number[]
    updated: number[]
    removed: number[]
  }) => {
    try {
      const changedClients = Array.from(new Set([...added, ...updated, ...removed]))
      const update = encodeAwarenessUpdate(awareness, changedClients)
      sendUpdate(update, token())
    } catch (error) {
      handleError(error as Error)
    }
  }

  // Add update batching to prevent flooding
  let updateTimeout: number | null = null
  const batchedSendUpdate = (update: Uint8Array) => {
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }
    updateTimeout = window.setTimeout(() => {
      sendUpdate(update, token())
      updateTimeout = null
    }, BATCH_TIMEOUT)
  }

  const handleDocUpdate = (update: Uint8Array) => {
    if (isSynced) {
      batchedSendUpdate(update)
    }
  }

  onMount(() => {
    awareness.on('update', handleAwarenessUpdate)
    doc.on('update', handleDocUpdate)
    addHandler(handleUpdate)
  })

  onCleanup(() => {
    awareness.off('update', handleAwarenessUpdate)
    doc.off('update', handleDocUpdate)
  })
}

export class AwarenessProvider {
  private doc: Doc
  private awareness: Awareness
  private isSynced = false
  private updateInterval = 500
  private updateTimeout: ReturnType<typeof setTimeout> | null = null
  private connectionState: ConnectionState = 'disconnected'
  private onConnectionStateChange?: (state: ConnectionState) => void

  constructor(doc: Doc) {
    this.doc = doc
    this.awareness = new Awareness(doc)
  }

  // Создаем отдельное пространство имен для каждого редактора
  getEditor(editorId: string) {
    return this.doc.getText(`editors/${editorId}`)
  }

  setEditorState(editorId: string, user: Partial<EditorState['user']>) {
    this.awareness.setLocalState({
      user,
      editorId,
      timestamp: Date.now()
    } as EditorState)
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state
    this.onConnectionStateChange?.(state)
  }

  connect(editorId: string) {
    const { addHandler } = useConnect()
    const { session } = useSession()
    const origin = crypto.randomUUID()

    this.setConnectionState('connecting')

    // Отправка обновлений на сервер
    const sendToServer = async (message: AwarenessUpdate) => {
      try {
        const response = await fetch(sseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: session()?.access_token || ''
          },
          body: JSON.stringify(message)
        })

        if (!response.ok) {
          throw new Error(`Failed to send update: ${response.statusText}`)
        }
      } catch (error) {
        console.error('[AwarenessProvider] Send error:', error)
        this.setConnectionState('disconnected')
      }
    }

    // Обработка входящих сообщений
    const handleMessage = (sseMessage: SSEMessage) => {
      try {
        const message = sseMessage as unknown as AwarenessUpdate

        if (message.editorId !== editorId) return

        if (message.type === 'sync') {
          const update = base64ToUint8Array(message.data)
          applyUpdate(this.doc, update)
          this.isSynced = true
          this.setConnectionState('connected')

          // Отправляем текущее состояние awareness после синхронизации
          const awarenessUpdate = encodeAwarenessUpdate(
            this.awareness,
            Array.from(this.awareness.getStates().keys())
          )
          sendToServer({
            type: 'awareness',
            editorId,
            data: uint8ArrayToBase64(awarenessUpdate),
            origin
          })
        } else if (message.type === 'update' && this.isSynced) {
          const update = base64ToUint8Array(message.data)
          applyUpdate(this.doc, update)
        } else if (message.type === 'awareness' && this.isSynced) {
          const update = base64ToUint8Array(message.data)
          applyAwarenessUpdate(this.awareness, update, origin)
        }
      } catch (error) {
        console.error('[AwarenessProvider] Message handling error:', error)
      }
    }

    // Отправка обновлений с батчингом
    const sendUpdate = (update: Uint8Array) => {
      if (!this.isSynced) return

      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout)
      }

      this.updateTimeout = setTimeout(() => {
        sendToServer({
          type: 'update',
          editorId,
          data: uint8ArrayToBase64(update),
          origin
        })
      }, this.updateInterval)
    }

    // Подписываемся на обновления
    this.doc.on('update', sendUpdate)
    this.awareness.on('update', (update: Uint8Array, origin: string) => {
      if (origin !== 'server') {
        sendToServer({
          type: 'awareness',
          editorId,
          data: uint8ArrayToBase64(update),
          origin
        })
      }
    })

    // Добавляем обработчик SSE сообщений
    addHandler(handleMessage)

    // Отправляем начальное состояние
    const initialUpdate = encodeStateAsUpdate(this.doc)
    sendToServer({
      type: 'sync',
      editorId,
      data: uint8ArrayToBase64(initialUpdate)
    })

    onCleanup(() => {
      this.doc.off('update', sendUpdate)
      this.awareness.off('update', sendUpdate)
      this.isSynced = false
      this.setConnectionState('disconnected')
    })
  }
}

// Синглтон провайдера
let provider: AwarenessProvider | null = null

export const getProvider = () => {
  if (!provider) {
    const doc = new Doc()
    provider = new AwarenessProvider(doc)
  }
  return provider
}

export const destroyProvider = (editorId: string) => {
  if (provider) {
    provider.setEditorState(editorId, {
      id: undefined,
      name: undefined,
      color: undefined,
      tabId: undefined
    })
    provider = null
  }
}
