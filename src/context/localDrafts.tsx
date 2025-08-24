import { Accessor, createContext, createSignal, JSX, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'
import type { Author, Draft, DraftInput, Topic } from '~/graphql/generated/graphql'
import { validateTimestamp } from '~/utils/timestamp'

// Интерфейс для локального черновика
export interface LocalDraft {
  id: number
  local_id: string
  title: string
  subtitle: string
  lead: string
  body: string
  slug: string
  cover: string
  cover_caption: string
  layout: Draft['layout']
  topics: Topic[]
  authors: Author[]
  created_at: number
  updated_at: number
  isLocalOnly: true
  published_at?: number | null
}

// Storage interfaces moved from storage.ts
interface DraftStorage {
  id: string | number
  fields: Record<string, string>
  timestamp: number
  lastSync?: number
  source: 'server' | 'local'
}

interface SyncStatus {
  status: 'synced' | 'pending' | 'failed' | 'conflict'
  lastAttempt?: number
  failures: number
  errorMessage?: string
}

// Storage constants
const DRAFT_PREFIX = 'draft-fields-'
const STORAGE_METADATA_KEY = 'drafts-storage-metadata'

// Storage metadata interface
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

type LocalDraftsContextType = {
  // Основные операции
  localDrafts: Accessor<LocalDraft[]>
  loadLocalDrafts: () => LocalDraft[]
  createLocalDraft: (draft: DraftInput) => LocalDraft
  updateLocalDraft: (draftId: number, updates: Partial<LocalDraft>) => void
  removeLocalDraft: (draftId: number) => boolean
  syncLocalDraft: (draftId: number, serverDraft?: Draft) => LocalDraft | undefined

  // Вспомогательные функции
  getLocalDraft: (draftId: number) => LocalDraft | undefined
  getLocalDraftBySlug: (slug: string) => LocalDraft | undefined
  hasLocalDraft: (draftId: number) => boolean
  getLocalDraftContent: (draftId: number, field: keyof DraftInput) => string

  // Управление хранилищем
  clearAllLocalDrafts: () => number
  getStorageStats: () => {
    quota: { used: number; total: number; percentage: number; warning: boolean }
    metadata: StorageMetadata
    draftsCount: number
    syncPending: number
    syncFailed: number
  }
  getSyncStatus: (draftId: string | number) => SyncStatus
  performMaintenance: () => void

  // Проверки
  checkPublishedVersion: (slug: string) => Promise<boolean>
  isDraftPublished: (draftId: number) => boolean

  // Новые функции из storage.ts
  checkStorageQuota: () => { used: number; total: number; percentage: number; warning: boolean }
  checkStorageQuotaWarning: () => void
  calculateLocalStorageUsage: () => number
  removeDraftByKey: (key: string) => boolean
  checkDraftExistsOnServer: (draftId: number) => Promise<boolean>
}

const LocalDraftsContext = createContext<LocalDraftsContextType>({} as LocalDraftsContextType)

export const LocalDraftsProvider = (props: { children: JSX.Element }) => {
  const [localDrafts, setLocalDrafts] = createSignal<LocalDraft[]>([])

  // Storage utility functions moved from storage.ts
  const getDraftKey = (draftId: string | number): string => {
    return `${DRAFT_PREFIX}${draftId}`
  }

  const getDraftFromStorage = (draftId: string | number): DraftStorage | null => {
    if (!draftId || isServer) return null

    try {
      const key = getDraftKey(draftId)
      const data = localStorage.getItem(key)
      if (!data) return null

      return JSON.parse(data) as DraftStorage
    } catch (e) {
      console.error('[LocalDraftsProvider] Error getting draft from storage:', e)
      return null
    }
  }

  const getAllDraftsFromStorage = (): DraftStorage[] => {
    if (isServer) return []

    try {
      const drafts: DraftStorage[] = []
      const prefix = DRAFT_PREFIX

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(prefix)) continue

        try {
          const data = localStorage.getItem(key)
          if (!data) continue

          const draft = JSON.parse(data) as DraftStorage
          drafts.push(draft)
        } catch (parseError) {
          console.error(`[LocalDraftsProvider] Error parsing draft data for key ${key}:`, parseError)
        }
      }

      return drafts
    } catch (e) {
      console.error('[LocalDraftsProvider] Error getting all drafts from storage:', e)
      return []
    }
  }

  const removeDraftFromStorage = (draftId: string | number): boolean => {
    if (!draftId || isServer) return false

    try {
      const key = getDraftKey(draftId)
      localStorage.removeItem(key)
      console.log(`[LocalDraftsProvider] Removed draft ${draftId} from storage`)
      return true
    } catch (e) {
      console.error('[LocalDraftsProvider] Error removing draft from storage:', e)
      return false
    }
  }

  const clearAllDraftKeys = (): number => {
    if (isServer) return 0

    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        if (key.startsWith('draft-fields-') || key === STORAGE_METADATA_KEY) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach((k) => {
        localStorage.removeItem(k)
      })

      console.log(`[LocalDraftsProvider] Cleared ${keysToRemove.length} draft-related keys`)
      return keysToRemove.length
    } catch (e) {
      console.error('[LocalDraftsProvider] Error clearing draft keys:', e)
      return 0
    }
  }

  const parseJsonContent = (content?: string): string => {
    if (!content) return ''

    if (content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content)
        if (parsed && typeof parsed === 'object' && 'content' in parsed) {
          return parsed.content || ''
        }
        if (typeof parsed === 'string') {
          return parsed
        }
        return JSON.stringify(parsed) === '{}' ? '' : String(parsed)
      } catch (e) {
        console.warn('[LocalDraftsProvider] Failed to parse JSON, using raw content:', e)
        if (content.includes('\\"')) {
          return content.replace(/\\"/g, '"')
        }
        return content
      }
    }

    if (content.includes('\\"')) {
      return content.replace(/\\"/g, '"')
    }

    return content
  }

  const saveEntireDraft = (draft: Draft): boolean => {
    if (!draft || !draft.id) return false

    try {
      const storedDraft: DraftStorage = {
        id: draft.id,
        fields: {},
        timestamp: Date.now(),
        source: 'local'
      }

      // Сохраняем все строковые поля
      Object.entries(draft).forEach(([key, value]) => {
        if (typeof value === 'string') {
          if ((key === 'body' || key === 'lead') && value) {
            storedDraft.fields[key] = parseJsonContent(value)
          } else {
            storedDraft.fields[key] = value
          }
        }
      })

      const key = getDraftKey(draft.id)
      localStorage.setItem(key, JSON.stringify(storedDraft))

      console.log(`[LocalDraftsProvider] Saved entire draft ${draft.id}`)
      return true
    } catch (error) {
      console.error('[LocalDraftsProvider] Error saving entire draft:', error)
      return false
    }
  }

  const getStorageStatsFromLib = () => {
    const quota = checkStorageQuota()
    const metadata = getDefaultMetadata()
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

  const getSyncStatusFromLib = (draftId: string | number): SyncStatus => {
    const draft = getDraftFromStorage(draftId)
    if (!draft) {
      return { status: 'failed', failures: 0, errorMessage: 'Draft not found' }
    }

    const metadata = getDefaultMetadata()
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

  const performPeriodicCleanup = (): number => {
    if (isServer) return 0

    try {
      const allDrafts = getAllDraftsFromStorage()
      const now = Date.now()
      const MAX_DRAFT_AGE_DAYS = 500
      const cutoffTime = now - MAX_DRAFT_AGE_DAYS * 24 * 60 * 60 * 1000
      let deletedCount = 0

      allDrafts.forEach((draft) => {
        if (draft.timestamp < cutoffTime && (!draft.lastSync || draft.lastSync < cutoffTime)) {
          removeDraftFromStorage(draft.id)
          deletedCount++
        }
      })

      if (deletedCount > 0) {
        console.log(`[LocalDraftsProvider] Cleaned up ${deletedCount} old drafts`)
      }

      return deletedCount
    } catch (e) {
      console.error('[LocalDraftsProvider] Error during periodic cleanup:', e)
      return 0
    }
  }

  /**
   * Создает базовую структуру локального черновика
   */
  const createBaseLocalDraft = (draftId: number, localId: string): LocalDraft => {
    return {
      id: draftId,
      local_id: localId,
      title: '',
      subtitle: '',
      lead: '',
      body: '',
      slug: '',
      cover: '',
      cover_caption: '',
      layout: 'article',
      topics: [],
      authors: [],
      created_at: Date.now(),
      updated_at: Date.now(),
      isLocalOnly: true
    }
  }

  /**
   * Загружает локальные черновики из localStorage
   */
  const loadLocalDrafts = (): LocalDraft[] => {
    if (isServer) return []

    const localDraftsData = getAllDraftsFromStorage()
    console.log(`[LocalDraftsProvider] Found ${localDraftsData.length} drafts in localStorage`)

    const drafts = localDraftsData.map((local): LocalDraft => {
      const fields = local.fields || {}
      const draftIdNum = Number(local.id)
      const timestampMs = validateTimestamp(local.timestamp)

      const localDraft = createBaseLocalDraft(draftIdNum, String(draftIdNum))
      Object.assign(localDraft, {
        title: fields.title || '',
        subtitle: fields.subtitle || '',
        slug: fields.slug || '',
        layout: (fields.layout as Draft['layout']) || 'article',
        body: parseJsonContent(fields.body || ''),
        lead: parseJsonContent(fields.lead || ''),
        cover: fields.cover || '',
        cover_caption: fields.cover_caption || '',
        created_at: timestampMs,
        updated_at: timestampMs
      })

      return localDraft
    })

    setLocalDrafts(drafts)
    return drafts
  }

  /**
   * Создает новый локальный черновик
   */
  const createLocalDraft = (draft: DraftInput): LocalDraft => {
    const tempId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const draftId = Number(tempId.split('-')[1])

    const localDraft = createBaseLocalDraft(draftId, tempId)
    Object.assign(localDraft, {
      title: draft.title || 'Новый черновик',
      subtitle: draft.subtitle || '',
      lead: draft.lead || '',
      body: draft.body || '',
      slug: draft.slug || '',
      cover: draft.cover || '',
      cover_caption: draft.cover_caption || '',
      layout: draft.layout || 'article'
    })

    // Сохраняем в localStorage
    saveEntireDraft(localDraft as unknown as Draft)

    // Добавляем в состояние
    setLocalDrafts([...localDrafts(), localDraft])

    return localDraft
  }

  /**
   * Обновляет локальный черновик
   */
  const updateLocalDraft = (draftId: number, updates: Partial<LocalDraft>): void => {
    setLocalDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, ...updates, updated_at: Date.now() } : d)))
  }

  /**
   * Удаляет локальный черновик
   */
  const removeLocalDraft = (draftId: number): boolean => {
    console.log(`[LocalDraftsProvider] Удаляем локальный черновик #${draftId}`)

    const draftToRemove = localDrafts().find((d) => d.id === draftId)
    if (!draftToRemove) {
      console.warn(`[LocalDraftsProvider] Черновик #${draftId} не найден`)
      return false
    }

    // Удаляем из состояния
    setLocalDrafts((prev) => prev.filter((d) => d.id !== draftId))

    // Удаляем из localStorage
    const result = removeDraftFromStorage(draftId)

    if (result) {
      console.log(`[LocalDraftsProvider] Черновик #${draftId} успешно удален`)
    } else {
      console.error(`[LocalDraftsProvider] Ошибка при удалении черновика #${draftId}`)
    }

    return result
  }

  /**
   * Синхронизирует локальный черновик с серверным
   */
  const syncLocalDraft = (draftId: number, serverDraft?: Draft): LocalDraft | undefined => {
    if (isServer) return undefined

    const localDraftData = getDraftFromStorage(draftId)
    if (!localDraftData) return undefined

    const localTimestamp = validateTimestamp(localDraftData.timestamp)
    const serverTimestamp = serverDraft?.updated_at ? validateTimestamp(serverDraft.updated_at) : 0

    // Если локальная версия новее, используем её
    if (localTimestamp > serverTimestamp) {
      const localDraft = createBaseLocalDraft(draftId, `local-${draftId}`)
      Object.assign(localDraft, {
        created_at: localTimestamp,
        updated_at: localTimestamp,
        title: parseJsonContent(localDraftData.fields.title || ''),
        slug: parseJsonContent(localDraftData.fields.slug || ''),
        layout: parseJsonContent(localDraftData.fields.layout || '') || 'article',
        body: parseJsonContent(localDraftData.fields.body || ''),
        lead: parseJsonContent(localDraftData.fields.lead || ''),
        cover: parseJsonContent(localDraftData.fields.cover || ''),
        cover_caption: parseJsonContent(localDraftData.fields.cover_caption || '')
      })

      return localDraft
    }

    return undefined
  }

  /**
   * Получает локальный черновик по ID
   */
  const getLocalDraft = (draftId: number): LocalDraft | undefined => {
    return localDrafts().find((d) => d.id === draftId)
  }

  /**
   * Получает локальный черновик по slug
   */
  const getLocalDraftBySlug = (slug: string): LocalDraft | undefined => {
    return localDrafts().find((d) => d.slug === slug)
  }

  /**
   * Проверяет существование локального черновика
   */
  const hasLocalDraft = (draftId: number): boolean => {
    return localDrafts().some((d) => d.id === draftId)
  }

  /**
   * Получает содержимое поля локального черновика
   */
  const getLocalDraftContent = (draftId: number, field: keyof DraftInput): string => {
    const draft = getDraftFromStorage(draftId)
    if (!draft || !draft.fields) return ''

    const content = draft.fields[field]
    if (!content) return ''

    if (field === 'body' || field === 'lead') {
      return parseJsonContent(content)
    }

    return content
  }

  /**
   * Очищает все локальные черновики
   */
  const clearAllLocalDrafts = (): number => {
    const count = localDrafts().length
    setLocalDrafts([])
    clearAllDraftKeys()
    console.log(`[LocalDraftsProvider] Очищено ${count} локальных черновиков`)
    return count
  }

  /**
   * Получает статистику хранилища
   */
  const getStorageStats = () => {
    return getStorageStatsFromLib()
  }

  /**
   * Получает статус синхронизации
   */
  const getSyncStatus = (draftId: string | number): SyncStatus => {
    return getSyncStatusFromLib(draftId)
  }

  /**
   * Выполняет периодическое обслуживание
   */
  const performMaintenance = () => {
    const deletedCount = performPeriodicCleanup()
    if (deletedCount > 0) {
      loadLocalDrafts() // Перезагружаем после очистки
    }
  }

  /**
   * Проверяет наличие опубликованной версии
   */
  const checkPublishedVersion = async (slug: string): Promise<boolean> => {
    if (!slug || isServer) return false

    // Здесь можно добавить проверку через API, если нужно
    // Пока возвращаем false для локальных черновиков
    return false
  }

  /**
   * Проверяет, опубликован ли черновик
   */
  const isDraftPublished = (draftId: number): boolean => {
    const draft = getLocalDraft(draftId)
    return !!draft?.published_at
  }

  /**
   * Проверяет квоту localStorage и возвращает статистику использования
   */
  const checkStorageQuota = (): {
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
        warning: percentage > 0.8 // 80% от квоты
      }
    } catch (e) {
      console.error('[LocalDraftsProvider] Error checking storage quota:', e)
      return { used: 0, total: 0, percentage: 0, warning: false }
    }
  }

  /**
   * Проверяет объем использованного хранилища и устанавливает предупреждение если нужно
   */
  const checkStorageQuotaWarning = () => {
    if (isServer) return

    try {
      const quota = checkStorageQuota()
      if (quota.warning) {
        console.warn(
          `[LocalDraftsProvider] Внимание: localStorage заполнен на ${(quota.percentage * 100).toFixed(2)}%! Рекомендуется удалить ненужные черновики.`
        )
      }
    } catch (error) {
      console.error('[LocalDraftsProvider] Ошибка при проверке квоты localStorage:', error)
    }
  }

  /**
   * Рассчитывает примерное использование localStorage в байтах
   */
  const calculateLocalStorageUsage = (): number => {
    let total = 0
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // Получаем размер ключа и значения
        const value = localStorage.getItem(key) || ''
        total += (key.length + value.length) * 2 // Умножаем на 2, т.к. JavaScript использует UTF-16 (2 байта на символ)
      }
    } catch (e) {
      console.error('[LocalDraftsProvider] Ошибка при расчете использования localStorage:', e)
    }
    return total
  }

  /**
   * Удаляет черновик из localStorage по строковому ключу
   */
  const removeDraftByKey = (key: string): boolean => {
    if (isServer || !key) return false

    // Проверяем, начинается ли ключ с ожидаемого префикса для безопасности
    if (!key.startsWith('draft-fields-')) {
      console.warn(`[LocalDraftsProvider] Attempted to remove item with unexpected key: ${key}`)
      return false
    }

    try {
      localStorage.removeItem(key)
      console.debug(`[LocalDraftsProvider] Removed item with key ${key} from storage.`)
      return true
    } catch (e) {
      console.error(`[LocalDraftsProvider] Error removing item with key ${key} from storage:`, e)
      return false
    }
  }

  /**
   * Проверяет, существует ли черновик на сервере
   */
  const checkDraftExistsOnServer = async (_draftId: number): Promise<boolean> => {
    // Эта функция должна быть реализована в основном DraftsContext
    // Здесь возвращаем false для локальных черновиков
    return false
  }

  const value: LocalDraftsContextType = {
    localDrafts,
    loadLocalDrafts,
    createLocalDraft,
    updateLocalDraft,
    removeLocalDraft,
    syncLocalDraft,
    getLocalDraft,
    getLocalDraftBySlug,
    hasLocalDraft,
    getLocalDraftContent,
    clearAllLocalDrafts,
    getStorageStats,
    getSyncStatus,
    performMaintenance,
    checkPublishedVersion,
    isDraftPublished,
    checkStorageQuota,
    checkStorageQuotaWarning,
    calculateLocalStorageUsage,
    removeDraftByKey,
    checkDraftExistsOnServer
  }

  return <LocalDraftsContext.Provider value={value}>{props.children}</LocalDraftsContext.Provider>
}

export const useLocalDrafts = () => {
  return useContext(LocalDraftsContext)
}
