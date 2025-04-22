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

    // Создаем объект нового состояния
    const newState = {
      ...currentState,
      cursor: {
        anchor,
        head
      },
      timestamp: Date.now()
    } as EditorState

    // Всегда обновляем локальное состояние awareness
    this.awareness.setLocalState(newState)

    // В дополнение, сохраняем также в offline хранилище
    try {
      if (typeof window !== 'undefined' && currentState.editorId) {
        const storageKey = `yjs-cursor-${currentState.editorId}`
        const cursorData = {
          anchor,
          head,
          timestamp: Date.now(),
          userId: currentState.user?.id,
          editorId: currentState.editorId
        }
        localStorage.setItem(storageKey, JSON.stringify(cursorData))
      }
    } catch (e) {
      console.warn('[AwarenessProvider] Failed to save cursor position to localStorage:', e)
    }
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

    // Всегда сохраняем в offline хранилище (localStorage)
    this.saveToLocalStorage(draftId, fieldName, content, isEmpty ?? false)

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
    // но все равно обновляем локальное состояние awareness (для последующей синхронизации)
    this.awareness.setLocalState(newState)

    // Если соединение активно, дебаунсим отправку изменений
    if (this.connectionState === 'connected') {
      // Дебаунсинг отправки обновлений на сервер
      this.debouncedAwarenessUpdate(newState)
    } else {
      console.info(`[Awareness] Not connected, stored content for ${fieldName} in localStorage`)
    }
  }

  // Сохранение данных в localStorage для offline режима
  private saveToLocalStorage(
    draftId: string | number,
    fieldName: string,
    content: string,
    isEmpty: boolean
  ) {
    if (typeof window === 'undefined') return

    try {
      // Сохраняем в собственном формате для YJS
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

      // Также используем существующий механизм OfflineStorage, если доступен
      interface OfflineStorageInterface {
        addToLocalStorage?: (draftId: string, fieldName: string, content: string, isEmpty: boolean) => void
      }

      interface WindowWithOfflineStorage extends Window {
        OfflineStorage?: OfflineStorageInterface
      }

      const { addToLocalStorage } = (window as WindowWithOfflineStorage).OfflineStorage || {}
      if (typeof addToLocalStorage === 'function') {
        // Конвертируем draftId в строку, так как это может быть число
        addToLocalStorage(String(draftId), fieldName, content, isEmpty)
      }
    } catch (e) {
      console.warn('[AwarenessProvider] Failed to save content to localStorage:', e)
    }
  }

  // Восстановление контента из localStorage при отсутствии сетевого соединения
  syncFromLocalStorage(editorId: string, draftId?: string | number) {
    if (typeof window === 'undefined' || !draftId) return

    try {
      // Находим все сохраненные поля для этого черновика
      const prefix = `yjs-content-${draftId}-`
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix))

      if (keys.length === 0) {
        console.info(`[Awareness] No local content found for draft ${draftId}`)
        return
      }

      // Обновляем состояние из localStorage
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
          console.warn(`[Awareness] Error parsing localStorage data for key ${key}:`, e)
        }
      })

      // Если нашли данные, обновляем состояние awareness
      if (Object.keys(fieldsData).length > 0) {
        const currentState = this.awareness.getLocalState() as EditorState | undefined

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

        this.awareness.setLocalState(newState)
        console.info(
          `[Awareness] Restored ${Object.keys(fieldsData).length} fields from localStorage for draft ${draftId}`
        )
      }

      // Восстанавливаем позицию курсора, если она была сохранена
      this.restoreCursorPosition(editorId)
    } catch (e) {
      console.warn('[Awareness] Error syncing from localStorage:', e)
    }
  }

  // Восстановление позиции курсора из localStorage
  private restoreCursorPosition(editorId: string) {
    if (typeof window === 'undefined') return

    try {
      const cursorKey = `yjs-cursor-${editorId}`
      const cursorData = localStorage.getItem(cursorKey)

      if (cursorData) {
        const { anchor, head } = JSON.parse(cursorData)
        // Используем полученные данные для установки курсора
        this.setCursorPosition(anchor, head)
        console.info(`[Awareness] Restored cursor position for editor ${editorId}`)
      }
    } catch (e) {
      console.warn('[Awareness] Error restoring cursor position:', e)
    }
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
    // Если нет соединения, возвращаем пустой объект, чтобы избежать
    // попытки синхронизации с устаревшими данными
    if (this.connectionState !== 'connected') {
      console.info(`[AwarenessProvider] Not connected, skipping getDraftContent for ${draftId}`)
      return {}
    }

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

  connect(editorId: string, draftId?: string | number) {
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

    // Восстанавливаем данные из localStorage до подключения
    this.syncFromLocalStorage(editorId, draftId)

    this.setConnectionState('connecting')

    // Проверяем, активно ли SSE-соединение
    const isConnected = typeof window !== 'undefined' && window.navigator.onLine && !!this.addHandler

    if (!isConnected) {
      console.warn('[AwarenessProvider] No SSE connection available, working in offline mode')
      this.setConnectionState('disconnected')
      // Даже если нет соединения, все равно восстанавливаем из localStorage
      this.syncFromLocalStorage(editorId, draftId)
      return
    }

    // Отправка обновлений на сервер
    const sendToServer = async (message: AwarenessUpdate) => {
      try {
        // Проверяем состояние подключения перед попыткой отправки
        if (this.connectionState !== 'connected') {
          // Не пытаемся отправить сообщение, если нет подключения
          console.info('[AwarenessProvider] Skipping update send - not connected')
          return
        }

        // Также проверяем онлайн-статус браузера
        if (typeof window !== 'undefined' && !window.navigator.onLine) {
          console.warn('[AwarenessProvider] Browser is offline, skipping update')
          this.setConnectionState('disconnected')
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

    // Добавляем слушатель сетевого состояния
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        console.log('[AwarenessProvider] Browser went online')
        this.setConnectionState('connecting')
        // Пытаемся переподключиться и отправить sync
        sendToServer({
          type: 'sync',
          editorId,
          data: uint8ArrayToBase64(initialUpdate)
        })
      }

      const handleOffline = () => {
        console.log('[AwarenessProvider] Browser went offline')
        this.setConnectionState('disconnected')
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      onCleanup(() => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      })
    }

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

/**
 * Хук для интеграции Awareness в редактор
 *
 * Предоставляет удобное API для работы с позициями курсоров и содержимым
 * редактора через Y.js awareness
 *
 * @param editorId Уникальный идентификатор редактора
 * @param draftId Идентификатор черновика (опционально)
 * @param fieldType Тип поля (опционально)
 */
export const useEditorAwareness = (editorId: string, draftId?: number | string, fieldType?: string) => {
  // Получаем существующий или создаем новый провайдер
  const provider = getProvider()
  const awareness = provider.getAwareness()

  // Состояние подключения
  const [connectionState, setConnectionState] = createSignal<ConnectionState>(provider.getConnectionState())

  // Позиции курсоров всех пользователей
  const [cursors, setCursors] = createSignal<
    Map<
      number,
      {
        anchor: number
        head: number
        user: EditorState['user']
        timestamp: number
      }
    >
  >(new Map())

  // Обработчик обновления awareness
  const handleAwarenessUpdate = () => {
    // Обновляем курсоры
    const cursorsMap = new Map()

    awareness.getStates().forEach((state, clientId) => {
      const editorState = state as EditorState

      // Проверяем, что это состояние для нашего редактора
      if (editorState.editorId === editorId && editorState.cursor) {
        cursorsMap.set(clientId, {
          anchor: editorState.cursor.anchor,
          head: editorState.cursor.head,
          user: editorState.user,
          timestamp: editorState.timestamp
        })
      }
    })

    setCursors(cursorsMap)
  }

  // Подключаемся к Awareness при монтировании
  onMount(() => {
    // Подключаемся к редактору
    provider.connect(editorId, draftId)

    // Устанавливаем пользовательские данные
    try {
      const { session } = useSession()
      const userData = session()

      if (userData?.user) {
        provider.setUserInfo(editorId, {
          id: userData.user.id || 0,
          name: (userData.user as { name?: string })?.name || 'Anonymous',
          color: getRandomColor(userData.user.id || 0),
          tabId: crypto.randomUUID().slice(0, 8)
        })
      }
    } catch (e) {
      console.warn('[useEditorAwareness] Error setting user info:', e)
    }

    // Следим за обновлениями awareness
    const cleanupAwareness = provider.onAwarenessChange(handleAwarenessUpdate)

    // Следим за изменениями состояния подключения
    provider.onConnectionStateChanged((state) => {
      setConnectionState(state)
    })

    onCleanup(() => {
      cleanupAwareness()
    })
  })

  /**
   * Обновляет позицию курсора в редакторе
   */
  const updateCursorPosition = (anchor: number, head: number) => {
    provider.setCursorPosition(anchor, head)
  }

  /**
   * Обновляет содержимое поля редактора
   */
  const updateEditorContent = (content: string, isEmpty?: boolean) => {
    if (draftId) {
      provider.updateDraftField(Number(draftId), fieldType || 'body', content, isEmpty)
    }
  }

  /**
   * Получает актуальное содержимое полей от всех пользователей
   */
  const getLatestContent = () => {
    if (!draftId) return null

    return provider.getDraftContent(draftId)
  }

  /**
   * Получает список пользователей, работающих над редактором
   */
  const getActiveUsers = () => {
    const { session: sessionData } = useSession()
    const userData = sessionData()
    const currentUserId = userData?.user?.id

    return provider.getConnectedUsers().filter((user) => user.user.id !== currentUserId)
  }

  // Возвращаем API
  return {
    connectionState,
    updateCursorPosition,
    updateEditorContent,
    getLatestContent,
    getActiveUsers,
    cursors,
    provider
  }
}

/**
 * Генерирует случайный цвет на основе идентификатора пользователя
 */
const getRandomColor = (userId: string | number): string => {
  // Предопределенные безопасные цвета
  const safeColors = [
    '#3498db', // Синий
    '#2ecc71', // Зеленый
    '#e74c3c', // Красный
    '#f39c12', // Оранжевый
    '#9b59b6', // Фиолетовый
    '#1abc9c', // Бирюзовый
    '#d35400', // Темно-оранжевый
    '#c0392b', // Темно-красный
    '#16a085', // Темно-бирюзовый
    '#8e44ad', // Темно-фиолетовый
    '#27ae60', // Темно-зеленый
    '#2980b9', // Темно-синий
    '#f1c40f' // Желтый
  ]

  // Хешируем ID пользователя для выбора цвета
  const hash = String(userId)
    .split('')
    .reduce((a, b) => {
      const aa = (a << 5) - a + b.charCodeAt(0)
      return aa & aa
    }, 0)

  // Выбираем цвет из палитры
  return safeColors[Math.abs(hash) % safeColors.length]
}
