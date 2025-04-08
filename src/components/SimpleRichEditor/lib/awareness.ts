/**
 * YJS провайдер через SSE соединение
 *
 * Особенности:
 * - Использует существующее SSE соединение
 * - Поддерживает awareness для курсоров и синхронизации черновиков
 * - Батчинг обновлений для оптимизации
 */

import { createSignal, onCleanup, onMount } from 'solid-js'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness.js'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import { sseUrl } from '~/config'
import { MessageHandler, SSEMessage, useConnect } from '~/context/connect'
import { useSession } from '~/context/session'

const BATCH_TIMEOUT = 500 // ms
const AWARENESS_UPDATE_INTERVAL = 2000 // ms для дебаунсинга awareness обновлений

// Типы для состояний и обновлений
export type DraftField = {
  content: string
  isEmpty?: boolean
  lastUpdate: number
}

export type DraftContent = {
  draftId: string | number
  fields: Record<string, DraftField> // ключ -> содержимое поля
}

export type EditorState = {
  // Информация о пользователе
  user: {
    id: string | number
    name: string
    color: string
    tabId: string
  }
  // Идентификатор редактора
  editorId: string
  // Временная метка обновления
  timestamp: number
  // Содержимое черновика
  draftContent?: DraftContent
  // Позиция курсора (для отображения курсоров соавторов)
  cursor?: {
    anchor: number
    head: number
    // Можно добавить информацию о выделении текста
  }
}

export type AwarenessUpdate = {
  type: 'sync' | 'update' | 'awareness'
  editorId: string
  data: string
  origin?: string
}

type ConnectionState = 'connected' | 'disconnected' | 'connecting'

// Вспомогательные функции для кодирования/декодирования
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

// Отправка обновлений на сервер
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

// Функция для создания awareness провайдера
export function createAwarenessProvider(doc: Doc, awareness: Awareness) {
  let isSynced = false

  // Попытка получить addHandler из контекста
  let addHandlerFunction: ((handler: MessageHandler) => void) | undefined
  try {
    const { addHandler } = useConnect()
    addHandlerFunction = addHandler
  } catch (err) {
    console.error('[AwarenessProvider] Error getting addHandler from context:', err)
    addHandlerFunction = undefined
  }

  const { session } = useSession()
  const token = () => session()?.access_token || ''
  const [_connectionState, setConnectionState] = createSignal<'connected' | 'disconnected'>('disconnected')

  const handleError = (error: Error) => {
    console.error('[AwarenessProvider] Error:', error)
    setConnectionState('disconnected')
    // Trigger reconnection logic if needed
  }

  // Обработка входящих сообщений
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

  // Обработка awareness обновлений
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

    // Проверяем доступность addHandler перед вызовом
    if (addHandlerFunction) {
      addHandlerFunction(handleUpdate)
    } else {
      console.error('[AwarenessProvider] addHandler is not available in createAwarenessProvider')
    }
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

  // Кэш для отслеживания изменений в полях черновика
  private draftFieldCache: Map<string, string> = new Map()

  // Таймер дебаунсинга обновлений awareness
  private awarenessUpdateTimeout: ReturnType<typeof setTimeout> | null = null

  // Функция обработки сообщений от сервера
  private addHandler?: (handler: MessageHandler) => void

  constructor(doc: Doc) {
    this.doc = doc
    this.awareness = new Awareness(doc)
  }

  // Создаем отдельное пространство имен для каждого редактора
  getEditor(editorId: string) {
    return this.doc.getText(`editors/${editorId}`)
  }

  // Установка базовой информации о пользователе
  setUserInfo(editorId: string, user: Partial<EditorState['user']>) {
    // Получаем текущее состояние
    const currentState = (this.awareness.getLocalState() as EditorState | undefined) || {
      user: {},
      editorId,
      timestamp: Date.now()
    }

    this.awareness.setLocalState({
      ...currentState,
      user: {
        ...currentState.user,
        ...user
      },
      editorId,
      timestamp: Date.now()
    } as EditorState)
  }

  // Метод для установки позиции курсора
  setCursorPosition(anchor: number, head: number) {
    const currentState = this.awareness.getLocalState() as EditorState | undefined
    if (!currentState) return

    this.awareness.setLocalState({
      ...currentState,
      cursor: {
        anchor,
        head
      },
      timestamp: Date.now()
    } as EditorState)
  }

  // Обновление поля черновика через awareness
  updateDraftField(draftId: number, fieldName: string, content: string, isEmpty?: boolean) {
    // Локальное кэширование состояния для обнаружения изменений
    const cacheKey = `${draftId}:${fieldName}`
    const previousContent = this.draftFieldCache.get(cacheKey)

    // Если содержимое не изменилось, не выполняем обновление
    if (previousContent === content) {
      console.debug(`[Awareness] Content for ${cacheKey} hasn't changed, skipping update`)
      return
    }

    // Обновляем кэш
    this.draftFieldCache.set(cacheKey, content)

    const currentState = this.awareness.getLocalState() as EditorState | undefined
    const newState: EditorState = {
      timestamp: Date.now(),
      editorId: currentState?.editorId || '',
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

    // Если соединение отсутствует, только обновляем локальное хранилище,
    // но не пытаемся отправить на сервер
    if (this.connectionState !== 'connected') {
      console.info(`[Awareness] Not connected, updating only local state for ${fieldName}`)

      // Обработка данных для локального хранения
      // Типизируем window с расширением OfflineStorage
      interface OfflineStorageInterface {
        addToLocalStorage?: (draftId: string, fieldName: string, content: string, isEmpty: boolean) => void
      }

      interface WindowWithOfflineStorage extends Window {
        OfflineStorage?: OfflineStorageInterface
      }

      const { addToLocalStorage } = (window as WindowWithOfflineStorage).OfflineStorage || {}
      if (typeof addToLocalStorage === 'function') {
        // Конвертируем draftId в строку, так как это может быть число
        // Используем false как значение по умолчанию для isEmpty, если оно undefined
        addToLocalStorage(String(draftId), fieldName, content, isEmpty ?? false)
      }

      return
    }

    // Дебаунсинг отправки обновлений
    this.debouncedAwarenessUpdate(newState)
  }

  // Метод для дебаунсированного обновления awareness
  private debouncedAwarenessUpdate(state: EditorState) {
    if (this.awarenessUpdateTimeout) {
      clearTimeout(this.awarenessUpdateTimeout)
    }

    this.awarenessUpdateTimeout = setTimeout(() => {
      this.awareness.setLocalState(state)
      console.log('[Awareness] Updating awareness state with draft content', {
        draftId: state.draftContent?.draftId,
        fields: Object.keys(state.draftContent?.fields || {})
      })
    }, AWARENESS_UPDATE_INTERVAL)
  }

  // Получить все присутствующие пользователи
  getConnectedUsers() {
    const states = this.awareness.getStates()
    const users: Array<{
      clientId: number
      user: EditorState['user']
      timestamp: number
    }> = []

    states.forEach((state, clientId) => {
      const editorState = state as EditorState
      if (editorState.user) {
        users.push({
          clientId,
          user: editorState.user,
          timestamp: editorState.timestamp
        })
      }
    })

    return users
  }

  // Получить актуальное содержимое полей черновика от всех пользователей
  getDraftContent(draftId: string | number) {
    const states = this.awareness.getStates()
    const allFields: Record<string, DraftField> = {}

    states.forEach((state) => {
      const editorState = state as EditorState
      if (editorState.draftContent && editorState.draftContent.draftId === draftId) {
        // Получаем поля этого пользователя
        const fields = editorState.draftContent.fields

        // Для каждого поля проверяем, является ли оно более новым
        Object.entries(fields).forEach(([fieldName, fieldData]) => {
          const existingField = allFields[fieldName]

          // Если поле не существует или текущее обновление новее - обновляем
          if (!existingField || existingField.lastUpdate < fieldData.lastUpdate) {
            allFields[fieldName] = fieldData
          }
        })
      }
    })

    return allFields
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state
    this.onConnectionStateChange?.(state)
  }

  // Подписаться на изменения awareness
  onAwarenessChange(
    callback: (params: {
      added: number[]
      updated: number[]
      removed: number[]
    }) => void
  ) {
    this.awareness.on('update', callback)
    return () => {
      this.awareness.off('update', callback)
    }
  }

  connect(editorId: string) {
    // Получаем обработчик сообщений из контекста, если свойство еще не установлено
    if (!this.addHandler) {
      try {
        const { addHandler } = useConnect()
        this.addHandler = addHandler
      } catch (err) {
        console.error('[AwarenessProvider] Error getting addHandler:', err)
      }
    }

    const { session } = useSession()
    const origin = crypto.randomUUID()

    this.setConnectionState('connecting')

    // Отправка обновлений на сервер
    const sendToServer = async (message: AwarenessUpdate) => {
      try {
        // Проверяем состояние подключения перед попыткой отправки
        if (this.connectionState !== 'connected') {
          // Не пытаемся отправить сообщение, если нет подключения
          console.info('[AwarenessProvider] Skipping update send - not connected')
          return
        }

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

    // Обработчик обновлений awareness
    const handleAwarenessUpdate = () => {
      // Проверяем состояние подключения
      if (this.connectionState !== 'connected') {
        console.info('[AwarenessProvider] Skipping awareness update - not connected')
        return
      }

      const update = encodeAwarenessUpdate(this.awareness, Array.from(this.awareness.getStates().keys()))

      sendToServer({
        type: 'awareness',
        editorId,
        data: uint8ArrayToBase64(update),
        origin
      })
    }

    // Подписываемся на обновления
    this.doc.on('update', sendUpdate)
    this.awareness.on('update', handleAwarenessUpdate)

    // Добавляем обработчик SSE сообщений
    if (this.addHandler) {
      this.addHandler(handleMessage)
      console.log('[AwarenessProvider] Successfully registered message handler')
    } else {
      console.error('[AwarenessProvider] addHandler is not available')
    }

    // Отправляем начальное состояние
    const initialUpdate = encodeStateAsUpdate(this.doc)
    sendToServer({
      type: 'sync',
      editorId,
      data: uint8ArrayToBase64(initialUpdate)
    })

    onCleanup(() => {
      this.doc.off('update', sendUpdate)
      this.awareness.off('update', handleAwarenessUpdate)

      // Очищаем таймеры
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout)
      }
      if (this.awarenessUpdateTimeout) {
        clearTimeout(this.awarenessUpdateTimeout)
      }

      this.isSynced = false
      this.setConnectionState('disconnected')
    })
  }

  // Делаем awareness доступным для destroyProvider через геттер
  getAwareness(): Awareness {
    return this.awareness
  }

  /**
   * Получить текущее состояние подключения
   * @returns Текущее состояние подключения ('connected', 'disconnected', 'connecting')
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Установить обработчик изменения состояния подключения
   * @param callback Функция обратного вызова, получающая новое состояние подключения
   */
  onConnectionStateChanged(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChange = callback
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

export const destroyProvider = (_editorId: string) => {
  if (provider) {
    // Очищаем состояние awareness перед уничтожением
    try {
      const awareness = provider.getAwareness()
      const currentState = awareness.getLocalState() as EditorState | undefined
      if (currentState) {
        awareness.setLocalState(null)
      }
    } catch (e) {
      console.error('[Awareness] Error cleaning up provider', e)
    }
    provider = null
  }
}

/**
 * TODO: На сервере необходимо реализовать:
 *
 * 1. Обработчик awareness-сообщений (тип 'awareness'), который будет:
 *    - Декодировать awareness update из base64
 *    - Сохранять текущее состояние awareness
 *    - Распространять сообщение всем подключенным к документу клиентам
 *
 * 2. Периодическое сохранение содержимого черновика из awareness состояния в базу данных
 *    - Извлекать данные полей из awareness состояния (draftContent.fields)
 *    - Обновлять соответствующие записи в базе данных
 *    - По возможности, дебаунсить запросы и обновлять только измененные поля
 *
 * 3. Для повышения надежности в будущем:
 *    - Реализовать механизм восстановления содержимого из последнего сохраненного состояния
 *    - Добавить проверку прав доступа перед применением изменений
 *    - Добавить систему логирования изменений для аудита
 */
