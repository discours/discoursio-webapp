import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
import type { Draft, DraftInput } from '~/graphql/generated/graphql'
import { sanitizeHtml } from './sanitize'
import { EditorFieldType } from './types'

/**
 * Интерфейс для данных, хранящихся в localStorage
 */
export interface StorageData {
  content: string
  timestamp: number
  source: 'server' | 'local'
}

/**
 * Интерфейс для сохраняемой версии полей черновика
 */
export interface DraftFieldsVersion {
  fields: Record<string, string>
  timestamp: number
  source: 'server' | 'local'
  lastSync?: number
}

/**
 * Интерфейс для полного черновика в localStorage
 */
export interface DraftStorage {
  id: string | number
  fields: Record<string, string>
  timestamp: number
  lastSync?: number
  source: 'server' | 'local'
}

/**
 * Интерфейс для сохраняемой версии контента
 */
export interface ContentVersion {
  content: string
  timestamp: number
  source: 'server' | 'local'
}

/**
 * Префиксы для хранения данных
 */
const DRAFT_PREFIX = 'draft-fields-'
const NETWORK_STATUS_KEY = 'network-status'
const STORAGE_METADATA_KEY = 'drafts-storage-metadata'

// Новые константы для улучшенной функциональности
const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8 // 80% от квоты
const MAX_DRAFT_AGE_DAYS = 500 // Максимальный возраст черновика в днях
const CLEANUP_INTERVAL_HOURS = 24 // Интервал очистки в часах
const COMPRESSION_MIN_SIZE = 1024 // Минимальный размер для сжатия (1KB)

/**
 * Метаданные хранилища для мониторинга и управления
 */
interface StorageMetadata {
  lastCleanup: number
  totalDrafts: number
  storageUsed: number
  syncFailures: Record<string, number>
  performanceMetrics: {
    averageSaveTime: number
    averageLoadTime: number
    totalOperations: number
  }
}

/**
 * Статус синхронизации черновика
 */
export interface SyncStatus {
  status: 'synced' | 'pending' | 'failed' | 'conflict'
  lastAttempt?: number
  failures: number
  errorMessage?: string
}

/**
 * Очищает строку от JSON-обертки и извлекает чистый контент
 * @param content Строка с контентом, возможно в JSON формате
 * @returns Очищенный контент без JSON-обертки
 */
export const cleanupJsonContent = (content: string | null | undefined | Record<string, unknown>): string => {
  if (content === null || content === undefined) return ''

  // Если это не строка, пробуем преобразовать
  if (typeof content !== 'string') {
    // Если это объект с полем content, сразу извлекаем его
    if (content && typeof content === 'object' && 'content' in content) {
      const contentField = content.content
      return cleanupJsonContent(contentField as string | null | undefined)
    }

    // Пробуем преобразовать в строку
    try {
      const jsonString = JSON.stringify(content)
      return cleanupJsonContent(jsonString)
    } catch (_e) {
      try {
        const strContent = String(content)
        return cleanupJsonContent(strContent)
      } catch (_e2) {
        return ''
      }
    }
  }

  // Убедимся, что работаем со строкой
  const contentStr = String(content)

  // Проверяем, не начинается ли строка с фрагмента HTML
  // Если это очевидно HTML, санитизируем и возвращаем
  if (contentStr.trim().startsWith('<') && contentStr.trim().endsWith('>')) {
    return sanitizeHtml(contentStr)
  }

  try {
    // Проверяем, похоже ли это на JSON строку
    if (
      (contentStr.trim().startsWith('{') && contentStr.trim().endsWith('}')) ||
      (contentStr.trim().startsWith('[') && contentStr.trim().endsWith(']'))
    ) {
      // Пытаемся распарсить как JSON
      const parsed = JSON.parse(contentStr)

      // Проверяем, есть ли поле content в объекте
      if (parsed && typeof parsed === 'object') {
        if ('content' in parsed) {
          // Рекурсивно проверяем содержимое контента, так как оно тоже может быть JSON
          return cleanupJsonContent(parsed.content)
        }

        // Проверяем, может быть это массив с первым элементом, содержащим content
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'content' in parsed[0]) {
          return cleanupJsonContent(parsed[0].content)
        }
      }
    }
  } catch (_parseError) {
    // В случае ошибки парсинга JSON, логируем и возвращаем как есть
    console.debug('[SimpleRichEditor] Content is not valid JSON, using as is')
  }

  return contentStr
}

/**
 * Получает данные из локального хранилища
 * @param key Ключ для хранилища
 * @returns Данные (контент с метаданными) или null если не найдено
 */
export const getStorageData = (key: string): StorageData | null => {
  if (!key) return null

  try {
    const data = localStorage.getItem(key)
    if (!data) return null

    // Пробуем распарсить как JSON с метаданными
    try {
      return JSON.parse(data) as StorageData
    } catch {
      // Для обратной совместимости: если это не JSON, а просто строка контента
      return {
        content: data,
        timestamp: Date.now(), // Примерная временная метка
        source: 'local'
      }
    }
  } catch (e) {
    console.error('[Storage] Error getting storage data:', e)
    return null
  }
}

/**
 * Получает контент из хранилища
 * @param key Ключ для хранилища
 * @returns Объект с содержимым и метаданными или null если не найден
 */
export const getVersionFromStorage = (key: string): ContentVersion | null => {
  const data = getStorageData(key)
  if (!data) return null

  const source = data.source || 'local'

  return {
    content: data.content,
    timestamp: data.timestamp,
    source
  }
}

/**
 * Получает временную метку из хранилища
 * @param key Ключ для хранилища
 * @returns Временная метка или null если не найдена
 */
export const getVersionTimestamp = (key: string): number | null => {
  const data = getStorageData(key)
  return data ? data.timestamp : null
}

/**
 * Получает источник данных из хранилища
 * @param key Ключ для хранилища
 * @returns Источник данных ('server' | 'local') или 'local' по умолчанию
 */
export const getVersionSource = (key: string): 'server' | 'local' => {
  const data = getStorageData(key)
  return data ? data.source : 'local'
}

/**
 * Сохраняет данные в локальное хранилище
 * @param key Ключ для хранилища
 * @param content Контент для сохранения
 * @param source Источник данных (server или local)
 */
export const saveVersionToStorage = (key: string, content: string, source: 'server' | 'local' = 'local'): void => {
  if (!key || !content) return

  const existingData = getStorageData(key)

  // Проверяем, изменился ли контент
  if (existingData && existingData.content === content && existingData.source === source) {
    return // Если данные не изменились, не сохраняем повторно
  }

  // Сохраняем данные одной записью
  const storageData: StorageData = {
    content,
    timestamp: Date.now(),
    source
  }

  localStorage.setItem(key, JSON.stringify(storageData))
}

/**
 * Удаляет данные из локального хранилища
 * @param key Ключ для хранилища
 */
export const removeLocalVersion = (key: string): void => {
  if (!key) return
  localStorage.removeItem(key)
}

/**
 * Формирует ключ хранилища на основе ID редактора и типа поля
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @returns Ключ для хранилища
 */
export const getStorageKey = (editorId?: string, fieldType?: EditorFieldType): string => {
  if (!editorId) return ''
  return fieldType ? `${editorId}:${fieldType}` : editorId
}

/**
 * Формирует ключ для серверной версии
 * @param storageKey Базовый ключ хранилища
 * @returns Ключ для серверной версии
 */
export const getServerVersionKey = (storageKey: string): string => {
  return `${storageKey}:server`
}

/**
 * Создает серверную версию контента
 * @param content Контент для сохранения
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @returns Объект с содержимым и метаданными
 */
export const createServerVersion = (
  content: string,
  editorId?: string,
  fieldType?: EditorFieldType
): { content: string; timestamp: number; source: 'server' } | null => {
  if (!content) return null

  // Очищаем контент от возможных JSON-структур перед использованием
  const cleanContent = cleanupJsonContent(content)

  const serverVersion = {
    content: cleanContent,
    timestamp: Date.now(),
    source: 'server' as const
  }

  // Сохраняем серверную версию, если указан editorId
  if (editorId) {
    const storageKey = getStorageKey(editorId, fieldType)
    const serverVersionKey = getServerVersionKey(storageKey)
    saveVersionToStorage(serverVersionKey, cleanContent, 'server')
  }

  return serverVersion
}

/**
 * Загружает версии контента для редактора
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @param incomingContent Входящий контент (с сервера)
 * @returns Объект с версиями контента и настройками отображения
 */
export const loadVersions = (
  editorId?: string,
  fieldType?: EditorFieldType,
  incomingContent?: string
): {
  contentToUse: string
  serverVersion: { content: string; timestamp: number; source: 'server' } | null
  localVersion: { content: string; timestamp: number; source: 'local' } | null
  showLocalVersionWarning: boolean
} => {
  // Формируем ключи хранилища
  const storageKey = getStorageKey(editorId, fieldType)
  const baseKey = editorId || ''

  // Получаем версии контента
  let serverVersion: { content: string; timestamp: number; source: 'server' } | null = null
  let localVersion: { content: string; timestamp: number; source: 'local' } | null = null

  // Серверная версия из входящего контента
  if (incomingContent !== undefined) {
    serverVersion = createServerVersion(incomingContent, editorId, fieldType)
  }

  // Проверяем локальную версию с учетом типа поля
  if (editorId) {
    const localContent = getVersionFromStorage(storageKey)
    const localTimestamp = getVersionTimestamp(storageKey)

    if (localContent && localTimestamp) {
      localVersion = {
        content: cleanupJsonContent(localContent.content),
        timestamp: localTimestamp,
        source: 'local'
      }
    } else {
      // Если нет версии с типом поля, проверяем базовую версию
      const baseContent = getVersionFromStorage(baseKey)
      const baseTimestamp = getVersionTimestamp(baseKey)

      if (baseContent && baseTimestamp) {
        localVersion = {
          content: cleanupJsonContent(baseContent.content),
          timestamp: baseTimestamp,
          source: 'local'
        }
      }
    }
  }

  // Определяем, какую версию использовать
  // Приоритеты: 1. Сначала локальная (если она новее серверной) 2. Серверная 3. Пустая
  let contentToUse = ''
  let showLocalVersionWarning = false

  if (localVersion && serverVersion) {
    // Если есть обе версии, проверяем, какая новее
    if (localVersion.timestamp > serverVersion.timestamp) {
      // Локальная новее, но показываем серверную с уведомлением
      contentToUse = serverVersion.content
      showLocalVersionWarning = true
      console.log(
        `[SimpleRichEditor] Local version available from ${new Date(localVersion.timestamp).toLocaleString()}`
      )
    } else {
      // Серверная новее
      contentToUse = serverVersion.content
    }
  } else if (serverVersion) {
    // Только серверная
    contentToUse = serverVersion.content
  } else if (localVersion) {
    // Только локальная
    contentToUse = localVersion.content
    console.log(`[SimpleRichEditor] Using local version from ${new Date(localVersion.timestamp).toLocaleString()}`)
  }

  return {
    contentToUse,
    serverVersion,
    localVersion,
    showLocalVersionWarning
  }
}

/**
 * Сохраняет контент редактора в локальное хранилище
 * @param editorId ID редактора
 * @param fieldType Тип поля редактора
 * @param content Контент для сохранения
 * @param isEmpty Флаг, указывающий что контент пустой
 * @returns Возвращает true, если операция выполнена успешно
 */
export const saveEditorContent = (
  editorId: string,
  fieldType: EditorFieldType,
  content: string,
  isEmpty: boolean
): boolean => {
  if (!editorId || !fieldType) return false

  const key = `draft-${editorId}-${fieldType}`

  // Если контент пустой, удаляем версию
  if (isEmpty) {
    removeLocalVersion(key)
    return true
  }

  // Сохраняем версию
  saveVersionToStorage(key, content, 'local')
  return true
}

/**
 * Очищает локальную версию контента
 * @param editorId ID редактора
 * @param fieldType Тип поля
 */
export const clearLocalVersion = (editorId?: string, fieldType?: EditorFieldType): void => {
  if (!editorId) return

  const storageKey = getStorageKey(editorId, fieldType)

  // Удаляем локальную версию из хранилища
  removeLocalVersion(storageKey)

  console.log(`[SimpleRichEditor] Cleared local version for ${storageKey}`)
}

/**
 * Загружает локальную версию контента
 * @param localVersion Локальная версия
 * @returns Очищенный контент
 */
export const loadLocalVersionContent = (
  localVersion: { content: string; timestamp?: number; source?: string } | null
): string => {
  if (!localVersion) return ''

  // Очищаем контент от JSON-строк перед использованием
  return cleanupJsonContent(localVersion.content)
}

/**
 * РАСШИРЕНИЕ ДЛЯ РАБОТЫ СО ВСЕМИ ПОЛЯМИ ЧЕРНОВИКА
 */

/**
 * Формирует ключ хранилища для черновика
 * @param draftId Идентификатор черновика
 * @returns Ключ для хранилища черновика
 */
export const getDraftKey = (draftId: string | number): string => {
  return `${DRAFT_PREFIX}${draftId}`
}

/**
 * Получает полный черновик из хранилища
 * @param draftId Идентификатор черновика
 * @returns Объект черновика или null
 */
export const getDraftFromStorage = (draftId: string | number): DraftStorage | null => {
  if (!draftId) return null
  if (isServer) return null

  const startTime = performance.now()

  try {
    const key = getDraftKey(draftId)
    const data = localStorage.getItem(key)
    if (!data) return null

    const draft = JSON.parse(data) as DraftStorage

    // Распаковываем сжатые поля
    if (draft.fields) {
      Object.keys(draft.fields).forEach((fieldName) => {
        if (['body', 'lead'].includes(fieldName)) {
          draft.fields[fieldName] = decompressText(draft.fields[fieldName])
        }
      })
    }

    const duration = performance.now() - startTime
    updatePerformanceMetrics('load', duration)

    return draft
  } catch (e) {
    console.error('[OfflineStorage] Error getting draft:', e)
    return null
  }
}

/**
 * Сохраняет полный черновик в хранилище с метриками производительности
 * @param draft Объект черновика для сохранения
 * @returns true в случае успеха
 */
export const saveDraftToStorage = (draft: DraftStorage): boolean => {
  if (!draft?.id) return false

  const startTime = performance.now()

  try {
    const key = getDraftKey(draft.id)

    // Сжимаем поля если они достаточно большие
    const compressedDraft = { ...draft }
    if (compressedDraft.fields) {
      Object.keys(compressedDraft.fields).forEach((fieldName) => {
        if (['body', 'lead'].includes(fieldName)) {
          compressedDraft.fields[fieldName] = compressText(compressedDraft.fields[fieldName])
        }
      })
    }

    localStorage.setItem(key, JSON.stringify(compressedDraft))

    const duration = performance.now() - startTime
    updatePerformanceMetrics('save', duration)

    console.log(`[OfflineStorage] Saved entire draft ${draft.id} (${duration.toFixed(2)}ms)`)

    // Периодическая очистка
    if (Math.random() < 0.1) {
      // 10% шанс на каждое сохранение
      setTimeout(() => performPeriodicCleanup(), 0)
    }

    return true
  } catch (e) {
    console.error('[OfflineStorage] Error saving draft:', e)
    return false
  }
}

/**
 * Получает значение поля черновика из хранилища
 * @param draftId Идентификатор черновика
 * @param fieldName Имя поля
 * @returns Значение поля или null
 */
export const getDraftField = (draftId: string | number, fieldName: string): string | null => {
  if (!draftId || !fieldName) return null
  if (isServer) return null

  try {
    const draft = getDraftFromStorage(draftId)
    if (!draft || !draft.fields) return null

    return draft.fields[fieldName] || null
  } catch (e) {
    console.error('[OfflineStorage] Error getting draft field:', e)
    return null
  }
}

/**
 * Сохраняет поле черновика в хранилище
 * @param draftId Идентификатор черновика
 * @param fieldName Имя поля
 * @param fieldValue Значение поля
 * @returns true в случае успеха
 */
export const saveDraftField = (
  draftId: string | number,
  fieldName: string,
  fieldValue: string | null | undefined
): boolean => {
  if (!draftId || !fieldName) return false

  // Если значение пустое, не сохраняем
  if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
    return false
  }

  try {
    // Получаем текущий черновик или создаем новый
    const draft = getDraftFromStorage(draftId) || {
      id: draftId,
      fields: {},
      timestamp: Date.now(),
      source: 'local' as const
    }

    // Преобразуем значение в строку
    const valueToStore = String(fieldValue)

    // Обновляем поле
    draft.fields[fieldName] = valueToStore
    draft.timestamp = Date.now()

    // Сохраняем обновленный черновик
    saveDraftToStorage(draft)

    console.log(`[OfflineStorage] Saved field "${fieldName}" for draft ${draftId}`)
    return true
  } catch (e) {
    console.error('[OfflineStorage] Error saving draft field:', e)
    return false
  }
}

/**
 * Получает все поля черновика
 * @param draftId Идентификатор черновика
 * @returns Объект с полями или null
 */
export const getAllDraftFields = (draftId: string | number): DraftInput | null => {
  if (!draftId) return null
  if (isServer) return null

  try {
    const draft = getDraftFromStorage(draftId)
    if (!draft || !draft.fields) return null

    return { ...draft.fields }
  } catch (e) {
    console.error('[OfflineStorage] Error getting all draft fields:', e)
    return null
  }
}

/**
 * Обновляет время последней синхронизации черновика
 * @param draftId Идентификатор черновика
 * @returns true в случае успеха
 */
export const updateLastSync = (draftId: string | number): boolean => {
  if (!draftId) return false

  try {
    const draft = getDraftFromStorage(draftId)
    if (!draft) return false

    // Обновляем время синхронизации
    draft.lastSync = Date.now()
    saveDraftToStorage(draft)

    console.log(`[OfflineStorage] Updated last sync for draft ${draftId}`)
    return true
  } catch (e) {
    console.error('[OfflineStorage] Error updating last sync:', e)
    return false
  }
}

/**
 * Проверяет наличие несинхронизированных изменений в черновике
 * @param draftId Идентификатор черновика
 * @returns true, если есть изменения
 */
export const hasUnsyncedChanges = (draftId: string | number): boolean => {
  if (!draftId) return false

  try {
    const draft = getDraftFromStorage(draftId)
    if (!draft || !draft.fields) return false

    // Если нет метки синхронизации, считаем что есть изменения
    if (!draft.lastSync) return true

    // Если черновик изменился после синхронизации
    return draft.timestamp > draft.lastSync
  } catch (e) {
    console.error('[OfflineStorage] Error checking unsynced changes:', e)
    return false
  }
}

/**
 * Сохраняет весь черновик из объекта Draft
 * @param draft Объект черновика из API
 * @returns true в случае успеха
 */
export const saveEntireDraft = (draft: Draft): boolean => {
  if (!draft || !draft.id) return false

  try {
    // Получаем текущий черновик из хранилища или создаем новый
    const storedDraft = getDraftFromStorage(draft.id) || {
      id: draft.id,
      fields: {},
      timestamp: Date.now(),
      source: 'local' as const
    }

    // Сохраняем все строковые поля
    Object.entries(draft).forEach(([key, value]) => {
      if (typeof value === 'string') {
        // Для body и lead очищаем от JSON обертки
        if ((key === 'body' || key === 'lead') && value) {
          storedDraft.fields[key] = parseJsonContent(value)
        } else {
          storedDraft.fields[key] = value
        }
      }
    })

    // Обновляем метку времени
    storedDraft.timestamp = Date.now()

    // Сохраняем в хранилище
    saveDraftToStorage(storedDraft)

    console.log(`[OfflineStorage] Saved entire draft ${draft.id}`)
    return true
  } catch (error) {
    console.error('[OfflineStorage] Error saving entire draft:', error)
    return false
  }
}

/**
 * Настраивает автоматическое сохранение контента редактора
 *
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @param onChange Функция, вызываемая при изменении для получения текущего контента
 * @param debounceTime Время задержки для дебаунса (в миллисекундах)
 * @returns Функция для отключения автосохранения
 */
export const setupAutoSave = (
  editorId: string,
  fieldType: EditorFieldType | undefined,
  onChange: () => string,
  debounceTime = 1000
): (() => void) => {
  if (!editorId) {
    console.error('[SimpleRichEditor] Cannot setup autosave without editorId')
    return () => {}
  }

  // Создаем дебаунсированную функцию сохранения
  const debouncedSave = debounce(debounceTime, () => {
    const content = onChange()

    // Получаем ключ для хранилища
    const storageKey = getStorageKey(editorId, fieldType)

    // Сохраняем в локальное хранилище только если контент не пустой
    if (content?.trim()) {
      saveVersionToStorage(storageKey, content, 'local')
      console.log(`[AutoSave] Saved ${editorId}${fieldType ? `:${fieldType}` : ''} content`)
    }
  })

  // Также слушаем события beforeunload для сохранения перед выходом
  const handleBeforeUnload = () => {
    // При выходе сразу сохраняем без дебаунса
    const content = onChange()
    if (content?.trim()) {
      const storageKey = getStorageKey(editorId, fieldType)
      saveVersionToStorage(storageKey, content, 'local')
    }
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  // Возвращаем функцию для отключения автосохранения
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    debouncedSave.cancel() // Отменяем отложенное сохранение
  }
}

// Функция для получения объекта из localStorage с парсингом JSON
export const getDraftFieldAsObject = <T>(draftId: string | number, fieldName: string): T | null => {
  if (isServer) return null
  try {
    const value = getDraftField(draftId, fieldName)
    if (!value) return null

    return JSON.parse(value) as T
  } catch (e) {
    console.error(`Error parsing JSON for draft field ${fieldName}:`, e)
    return null
  }
}

/**
 * Корректно парсит JSON-строку содержимого или возвращает исходную строку
 * Исправлена обработка кавычек в контенте
 *
 * @param content Строка содержимого, возможно в формате JSON
 * @returns Распарсенное содержимое или исходная строка
 */
export const parseJsonContent = (content?: string): string => {
  if (!content) return ''

  // Если строка начинается с '{' - это вероятно JSON объект
  if (content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content)

      // Если это объект с полем content, возвращаем его контент
      if (parsed && typeof parsed === 'object' && 'content' in parsed) {
        return parsed.content || ''
      }

      // Если это просто строка в JSON, возвращаем её
      if (typeof parsed === 'string') {
        return parsed
      }

      // В других случаях возвращаем строковое представление
      return JSON.stringify(parsed) === '{}' ? '' : String(parsed)
    } catch (e) {
      console.warn('[parseJsonContent] Failed to parse JSON, using raw content:', e)

      // Если не удалось распарсить JSON, убираем экранированные кавычки
      if (content.includes('\\"')) {
        return content.replace(/\\"/g, '"')
      }

      return content
    }
  }

  // Проверяем на экранированные кавычки в обычном тексте
  if (content.includes('\\"')) {
    return content.replace(/\\"/g, '"')
  }

  return content
}

/**
 * Получает черновой контент из хранилища
 * @param key Ключ для хранилища
 * @param serverContent Контент с сервера для сравнения
 * @param serverTimestamp Временная метка контента с сервера
 * @returns Черновой контент из хранилища или null если не найден/устарел
 */
export const getDraftContent = (key: string, serverContent?: string, serverTimestamp?: number): string | null => {
  const localContent = getVersionFromStorage(key)
  const localTimestamp = getVersionTimestamp(key)

  // Если локальной версии нет, вернем null
  if (!localContent || !localTimestamp) return null

  // Если нет серверной версии или серверной временной метки, вернем локальный контент
  if (!serverContent || !serverTimestamp) return localContent.content

  // Если локальная версия новее серверной, вернем локальный контент
  if (localTimestamp > serverTimestamp) return localContent.content

  // Если контент идентичен или локальная версия устарела, вернем null
  if (localContent.content === serverContent || localTimestamp <= serverTimestamp) {
    return null
  }

  return localContent.content
}

/**
 * Проверяет, есть ли сохраненный контент для данного ключа
 * @param key Ключ для проверки
 * @returns Булево значение наличия контента
 */
export const hasSavedContent = (key: string): boolean => {
  if (!key) return false

  const content = getVersionFromStorage(key)
  const timestamp = getVersionTimestamp(key)

  return !!content && !!timestamp
}

/**
 * Загружает содержимое из локального хранилища
 * @param key Ключ для хранилища
 * @returns Содержимое или пустая строка, если не найдено
 */
export const loadContent = (key: string): string => {
  if (!key) return ''

  try {
    const content = getVersionFromStorage(key)
    return content ? content.content : ''
  } catch (e) {
    console.error('[OfflineStorage] Error loading content:', e)
    return ''
  }
}

/**
 * Сохраняет состояние сети в localStorage
 * @param isOnline Флаг онлайн-состояния
 */
export const saveNetworkStatus = (isOnline: boolean): void => {
  try {
    localStorage.setItem(NETWORK_STATUS_KEY, isOnline ? 'online' : 'offline')
  } catch (error) {
    console.error('[OfflineStorage] Error saving network status:', error)
  }
}

/**
 * Получает сохраненное состояние сети из localStorage
 * @returns true, если последнее сохраненное состояние - онлайн
 */
export const getNetworkStatus = (): boolean => {
  try {
    const status = localStorage.getItem(NETWORK_STATUS_KEY)
    return status === 'online'
  } catch (error) {
    console.error('[OfflineStorage] Error getting network status:', error)
    return navigator.onLine // Возвращаем текущее состояние сети
  }
}

/**
 * Устанавливает обработчики событий изменения состояния сети
 * @param onOnline Функция, вызываемая при переходе в онлайн
 * @param onOffline Функция, вызываемая при переходе в оффлайн
 * @returns Функция для удаления обработчиков
 */
export const setupNetworkListeners = (onOnline: () => void, onOffline?: () => void): (() => void) => {
  // Функции-обработчики событий
  const handleOnline = () => {
    console.log('[OfflineStorage] Network is online')
    saveNetworkStatus(true)
    onOnline()
  }

  const handleOffline = () => {
    console.log('[OfflineStorage] Network is offline')
    saveNetworkStatus(false)
    onOffline?.()
  }

  // Сохраняем текущее состояние сети
  saveNetworkStatus(navigator.onLine)

  // Устанавливаем обработчики
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Возвращаем функцию для удаления обработчиков
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * Получает версию полей черновика (для совместимости с предыдущей версией API)
 * @param draftId Идентификатор черновика
 * @returns Объект версии полей черновика или null
 */
export const getDraftFieldsVersion = (draftId: string | number): DraftFieldsVersion | null => {
  if (!draftId) return null

  try {
    const draft = getDraftFromStorage(draftId)
    if (!draft) return null

    // Конвертируем в старый формат для совместимости
    return {
      fields: draft.fields,
      timestamp: draft.timestamp,
      source: draft.source,
      lastSync: draft.lastSync
    }
  } catch (error) {
    console.error('[OfflineStorage] Error getting draft fields version:', error)
    return null
  }
}

/**
 * Получает список всех черновиков из localStorage
 * @returns Массив всех DraftStorage объектов
 */
export const getAllDraftsFromStorage = (): DraftStorage[] => {
  if (isServer) return []

  try {
    const drafts: DraftStorage[] = []
    const prefix = DRAFT_PREFIX

    // Итерация по всем ключам в localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(prefix)) continue

      try {
        const data = localStorage.getItem(key)
        if (!data) continue

        const draft = JSON.parse(data) as DraftStorage
        drafts.push(draft)
      } catch (parseError) {
        console.error(`[OfflineStorage] Error parsing draft data for key ${key}:`, parseError)
      }
    }

    return drafts
  } catch (e) {
    console.error('[OfflineStorage] Error getting all drafts from storage:', e)
    return []
  }
}

/**
 * Полная очистка локального хранилища черновиков, включая ключи старого формата
 * @returns Количество удалённых ключей
 */
export const clearAllDraftKeys = (): number => {
  if (isServer) return 0

  try {
    // Сначала собираем список ключей, чтобы не нарушать индексы при удалении
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      // Удаляем все известные форматы хранения черновиков
      if (
        key.startsWith('draft-fields-') ||
        key.startsWith('draft-') ||
        key.startsWith('yjs-content-') ||
        key === STORAGE_METADATA_KEY ||
        key === NETWORK_STATUS_KEY
      ) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((k) => {
      localStorage.removeItem(k)
    })

    // Обновляем метаданные
    const metadata = getDefaultMetadata()
    metadata.storageUsed = checkStorageQuota().used
    saveStorageMetadata(metadata)

    if (keysToRemove.length > 0) {
      console.log(`[OfflineStorage] Cleared ${keysToRemove.length} local draft-related keys`)
    }

    return keysToRemove.length
  } catch (e) {
    console.error('[OfflineStorage] Error clearing local draft keys:', e)
    return 0
  }
}

/**
 * Удаляет черновик из localStorage
 * @param draftId Идентификатор черновика
 * @returns true в случае успеха
 */
export const removeDraftFromStorage = (draftId: string | number): boolean => {
  if (!draftId) return false
  if (isServer) return false

  try {
    const key = getDraftKey(draftId)
    localStorage.removeItem(key)
    console.log(`[OfflineStorage] Удаляем основной ключ черновика: ${key}`)

    // Также удаляем все связанные с этим черновиком ключи
    const keysToRemove: string[] = []

    // Собираем все ключи для удаления
    for (let i = 0; i < localStorage.length; i++) {
      const currentKey = localStorage.key(i)
      if (!currentKey) continue

      // Проверяем различные варианты префиксов для черновика
      if (
        currentKey.includes(`draft-${draftId}-`) ||
        currentKey.includes(`draft-fields-${draftId}`) ||
        currentKey.includes(`yjs-content-${draftId}-`) ||
        currentKey.includes(`draft-${draftId}.`) ||
        currentKey === `draft-${draftId}`
      ) {
        keysToRemove.push(currentKey)
      }
    }

    // Удаляем все найденные ключи
    console.log(`[OfflineStorage] Найдено ${keysToRemove.length} связанных ключей для удаления`)
    keysToRemove.forEach((k) => {
      console.log(`[OfflineStorage] Удаляем связанный ключ: ${k}`)
      localStorage.removeItem(k)
    })

    console.log(`[OfflineStorage] Removed draft ${draftId} from storage with ${keysToRemove.length} related keys`)
    return true
  } catch (e) {
    console.error('[OfflineStorage] Error removing draft:', e)
    return false
  }
}

/**
 * Сжимает текст используя простой алгоритм RLE для повторяющихся символов
 * @param text Текст для сжатия
 * @returns Сжатый текст или оригинал, если сжатие неэффективно
 */
const compressText = (text: string): string => {
  if (!text || text.length < COMPRESSION_MIN_SIZE) return text

  try {
    // Простое сжатие для HTML: убираем лишние пробелы и переносы
    const compressed = text
      .replace(/>\s+</g, '><') // Убираем пробелы между тегами
      .replace(/\s{2,}/g, ' ') // Множественные пробелы в один
      .trim()

    return compressed.length < text.length * 0.9 ? compressed : text
  } catch (e) {
    console.warn('[OfflineStorage] Compression failed:', e)
    return text
  }
}

/**
 * Распаковывает сжатый текст (заглушка для будущего реального сжатия)
 * @param compressedText Сжатый текст
 * @returns Распакованный текст
 */
const decompressText = (compressedText: string): string => {
  return compressedText // Пока просто возвращаем как есть
}

/**
 * Проверяет квоту localStorage и возвращает статистику использования
 * @returns Информация о квоте хранилища
 */
export const checkStorageQuota = (): {
  used: number
  total: number
  percentage: number
  warning: boolean
} => {
  if (isServer) return { used: 0, total: 0, percentage: 0, warning: false }

  try {
    let used = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key) || ''
        used += key.length + value.length
      }
    }

    // Примерная оценка общей квоты (обычно 5-10MB)
    const estimatedTotal = 5 * 1024 * 1024 // 5MB
    const percentage = used / estimatedTotal

    return {
      used,
      total: estimatedTotal,
      percentage,
      warning: percentage > STORAGE_QUOTA_WARNING_THRESHOLD
    }
  } catch (e) {
    console.error('[OfflineStorage] Error checking storage quota:', e)
    return { used: 0, total: 0, percentage: 0, warning: false }
  }
}

/**
 * Получает метаданные хранилища
 * @returns Объект метаданных или дефолтные значения
 */
const getStorageMetadata = (): StorageMetadata => {
  if (isServer) return getDefaultMetadata()

  try {
    const data = localStorage.getItem(STORAGE_METADATA_KEY)
    if (!data) return getDefaultMetadata()

    return { ...getDefaultMetadata(), ...JSON.parse(data) }
  } catch (e) {
    console.error('[OfflineStorage] Error getting storage metadata:', e)
    return getDefaultMetadata()
  }
}

/**
 * Сохраняет метаданные хранилища
 * @param metadata Объект метаданных для сохранения
 */
const saveStorageMetadata = (metadata: StorageMetadata): void => {
  if (isServer) return

  try {
    localStorage.setItem(STORAGE_METADATA_KEY, JSON.stringify(metadata))
  } catch (e) {
    console.error('[OfflineStorage] Error saving storage metadata:', e)
  }
}

/**
 * Возвращает дефолтные метаданные
 * @returns Объект с дефолтными метаданными
 */
const getDefaultMetadata = (): StorageMetadata => ({
  lastCleanup: Date.now(),
  totalDrafts: 0,
  storageUsed: 0,
  syncFailures: {},
  performanceMetrics: {
    averageSaveTime: 0,
    averageLoadTime: 0,
    totalOperations: 0
  }
})

/**
 * Обновляет метрики производительности
 * @param operation Тип операции ('save' | 'load')
 * @param duration Время выполнения в миллисекундах
 */
const updatePerformanceMetrics = (operation: 'save' | 'load', duration: number): void => {
  const metadata = getStorageMetadata()
  const metrics = metadata.performanceMetrics

  if (operation === 'save') {
    metrics.averageSaveTime =
      (metrics.averageSaveTime * metrics.totalOperations + duration) / (metrics.totalOperations + 1)
  } else {
    metrics.averageLoadTime =
      (metrics.averageLoadTime * metrics.totalOperations + duration) / (metrics.totalOperations + 1)
  }

  metrics.totalOperations++
  metadata.performanceMetrics = metrics

  saveStorageMetadata(metadata)
}

/**
 * Выполняет периодическую очистку старых черновиков
 * @param forceCleanup Принудительная очистка независимо от времени
 * @returns Количество удалённых черновиков
 */
export const performPeriodicCleanup = (forceCleanup = false): number => {
  if (isServer) return 0

  const metadata = getStorageMetadata()
  const now = Date.now()
  const timeSinceLastCleanup = now - metadata.lastCleanup
  const cleanupInterval = CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000

  if (!forceCleanup && timeSinceLastCleanup < cleanupInterval) {
    return 0 // Ещё рано для очистки
  }

  try {
    const allDrafts = getAllDraftsFromStorage()
    const cutoffTime = now - MAX_DRAFT_AGE_DAYS * 24 * 60 * 60 * 1000
    let deletedCount = 0

    allDrafts.forEach((draft) => {
      // Удаляем черновики старше MAX_DRAFT_AGE_DAYS без активности
      if (draft.timestamp < cutoffTime && (!draft.lastSync || draft.lastSync < cutoffTime)) {
        removeDraftFromStorage(draft.id)
        deletedCount++
      }
    })

    // Обновляем метаданные
    metadata.lastCleanup = now
    metadata.totalDrafts = allDrafts.length - deletedCount
    metadata.storageUsed = checkStorageQuota().used
    saveStorageMetadata(metadata)

    if (deletedCount > 0) {
      console.log(`[OfflineStorage] Cleaned up ${deletedCount} old drafts`)
    }

    return deletedCount
  } catch (e) {
    console.error('[OfflineStorage] Error during periodic cleanup:', e)
    return 0
  }
}

/**
 * Получает статус синхронизации черновика
 * @param draftId Идентификатор черновика
 * @returns Статус синхронизации
 */
export const getSyncStatus = (draftId: string | number): SyncStatus => {
  const draft = getDraftFromStorage(draftId)
  if (!draft) {
    return { status: 'failed', failures: 0, errorMessage: 'Draft not found' }
  }

  const metadata = getStorageMetadata()
  const failures = metadata.syncFailures[String(draftId)] || 0

  if (!draft.lastSync) {
    return { status: 'pending', failures }
  }

  if (draft.timestamp > draft.lastSync) {
    return { status: 'pending', lastAttempt: draft.lastSync, failures }
  }

  if (failures > 3) {
    return {
      status: 'failed',
      lastAttempt: draft.lastSync,
      failures,
      errorMessage: 'Multiple sync failures'
    }
  }

  return { status: 'synced', lastAttempt: draft.lastSync, failures }
}

/**
 * Обновляет статус синхронизации после попытки
 * @param draftId Идентификатор черновика
 * @param success Успешность синхронизации
 * @param errorMessage Сообщение об ошибке (если есть)
 */
export const updateSyncStatus = (draftId: string | number, success: boolean, errorMessage?: string): void => {
  const metadata = getStorageMetadata()
  const draftIdStr = String(draftId)

  if (success) {
    // Успешная синхронизация - сбрасываем счётчик ошибок
    delete metadata.syncFailures[draftIdStr]
    updateLastSync(draftId)
  } else {
    // Неудачная синхронизация - увеличиваем счётчик
    metadata.syncFailures[draftIdStr] = (metadata.syncFailures[draftIdStr] || 0) + 1
  }

  saveStorageMetadata(metadata)

  if (!success) {
    console.warn(`[OfflineStorage] Sync failed for draft ${draftId}: ${errorMessage}`)
  }
}

/**
 * Получает статистику offline хранилища
 * @returns Детальная статистика хранилища
 */
export const getStorageStats = (): {
  quota: ReturnType<typeof checkStorageQuota>
  metadata: StorageMetadata
  draftsCount: number
  syncPending: number
  syncFailed: number
} => {
  const quota = checkStorageQuota()
  const metadata = getStorageMetadata()
  const allDrafts = getAllDraftsFromStorage()

  let syncPending = 0
  let syncFailed = 0

  allDrafts.forEach((draft) => {
    const status = getSyncStatus(draft.id)
    if (status.status === 'pending') syncPending++
    if (status.status === 'failed') syncFailed++
  })

  return {
    quota,
    metadata,
    draftsCount: allDrafts.length,
    syncPending,
    syncFailed
  }
}
