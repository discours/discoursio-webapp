import { OperationResult } from '@urql/core'
import { Accessor, batch, createContext, createSignal, JSX, onCleanup, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
import { EditorData } from '~/components/SimpleRichEditor/lib/types'

import { handleGraphQLError } from '~/graphql/client'
import type {
  Author,
  CreateDraftMutationMutation,
  DeleteDraftMutationMutation,
  Draft,
  DraftInput,
  Maybe,
  PublishDraftMutationMutation,
  Topic,
  UnpublishShoutMutationMutation,
  UpdateDraftMutationMutation
} from '~/graphql/generated/graphql'
import unpublishShoutMutation from '~/graphql/mutation/core/article-unpublish'
import createDraftMutation from '~/graphql/mutation/core/draft-create'
import deleteDraftMutation from '~/graphql/mutation/core/draft-delete'
import publishDraftMutation from '~/graphql/mutation/core/draft-publish'
import updateDraftMutation from '~/graphql/mutation/core/draft-update'
import loadDraftsQuery from '~/graphql/query/core/drafts-load'
import { slugify } from '~/intl/translit'
import { validateDraftForPublishing } from '~/lib/validateDraft'
import { useLocalDrafts } from './localDrafts'
import { useSession } from './session'
import { useTopics } from './topics'

export const AUTO_SAVE_DELAY = 1000
const DRAFT_EDITOR_ID_REGEX = /draft-(\d+)-([a-z]+)/

// Storage utility functions moved from storage.ts
const getDraftField = (draftId: string | number, fieldName: string): string | null => {
  if (!draftId || !fieldName || isServer) return null

  try {
    const key = `draft-fields-${draftId}`
    const data = localStorage.getItem(key)
    if (!data) return null

    const draft = JSON.parse(data)
    if (!draft || !draft.fields) return null

    return draft.fields[fieldName] || null
  } catch (e) {
    console.error('[DraftsProvider] Error getting draft field:', e)
    return null
  }
}

const parseJsonContent = (content?: string): string => {
  if (!content) return ''

  // 🔧  Более осторожная обработка HTML контента
  // Не парсим как JSON если контент содержит HTML теги
  if (content.includes('<') && content.includes('>')) {
    // Это HTML контент, возвращаем как есть с минимальной обработкой
    if (content.includes('\\"')) {
      return content.replace(/\\"/g, '"')
    }
    return content
  }

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
      console.warn('[DraftsProvider] Failed to parse JSON, using raw content:', e)
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

const saveDraftFieldStorage = (
  draftId: string | number,
  fieldName: string,
  fieldValue: string | null | undefined,
  onSlugGenerated?: (slug: string) => void
): boolean => {
  if (!draftId || !fieldName || isServer) return false

  // Если значение null/undefined, не сохраняем
  if (fieldValue === null || fieldValue === undefined) {
    return false
  }

  // 🔧  Разрешаем пустые строки для очистки полей
  // Пустые строки нужны для очистки содержимого редактора

  try {
    const key = `draft-fields-${draftId}`

    // Получаем текущий черновик или создаем новый
    let draft: { id: string | number; fields: Record<string, string>; timestamp: number; source: string } | null = null
    try {
      const existingData = localStorage.getItem(key)
      if (existingData) {
        draft = JSON.parse(existingData)
      }
    } catch (_e) {
      // Игнорируем ошибки парсинга
    }

    if (!draft) {
      draft = {
        id: draftId,
        fields: {},
        timestamp: Date.now(),
        source: 'local'
      }
    }

    // Преобразуем значение в строку
    const valueToStore = String(fieldValue)

    // Обновляем поле
    draft.fields[fieldName] = valueToStore
    draft.timestamp = Date.now()

    // 🔧 АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ SLUG при изменении title
    if (fieldName === 'title' && valueToStore && valueToStore.trim() !== '') {
      // 🔧 Генерируем slug ТОЛЬКО если его нет или он пустой
      const existingSlug = draft.fields['slug'] || ''
      if (!existingSlug || existingSlug.trim() === '') {
        const generatedSlug = slugify(valueToStore)
        draft.fields['slug'] = generatedSlug

        console.log(`🔧 [AUTO-SLUG] Сгенерирован slug для черновика #${draftId}:`, {
          title: valueToStore.substring(0, 50),
          slug: generatedSlug,
          hasCallback: !!onSlugGenerated
        })

        // 🔧 УВЕДОМЛЯЕМ о сгенерированном slug через callback
        if (onSlugGenerated) {
          onSlugGenerated(generatedSlug)
        }
      } else {
        console.log(`🔧 [AUTO-SLUG] Сохраняем существующий слаг для черновика #${draftId}:`, existingSlug)
      }
    }

    // Сохраняем обновленный черновик
    localStorage.setItem(key, JSON.stringify(draft))

    console.log(`[DraftsProvider] Saved field "${fieldName}" for draft ${draftId}`)
    return true
  } catch (e) {
    console.error('[DraftsProvider] Error saving draft field:', e)
    return false
  }
}

// Интерфейс для расширенной информации о черновике
export interface ExtendedDraft extends Draft {
  // Обязательное поле для идентификации в localStorage
  local_id: string

  // Опциональные поля для связи
  draft_id?: number | null
  shout_id?: number | null
  published_at?: number | null
  // Локальный черновик (существует только в браузере)
  isLocalOnly?: boolean
}

type DraftsContextType = {
  drafts: Accessor<ExtendedDraft[]>
  currentDraft: Accessor<ExtendedDraft | undefined>
  setCurrentDraft: (draft?: ExtendedDraft) => undefined
  getEditorContent: (editorId: string) => string
  setEditorContent: (editorId: string, content: string) => undefined
  loadDrafts: () => Promise<ExtendedDraft[]>
  createDraft: (draft: DraftInput) => Promise<OperationResult<CreateDraftMutationMutation> | undefined>
  updateDraft: (draft: DraftInput) => Promise<OperationResult<UpdateDraftMutationMutation> | undefined>
  deleteDraft: (id: number) => Promise<OperationResult<DeleteDraftMutationMutation> | undefined>
  publishDraft: (draftId: number) => Promise<OperationResult<PublishDraftMutationMutation> | undefined>
  unpublishShout: (shoutId: number) => Promise<OperationResult<UnpublishShoutMutationMutation> | undefined>
  isEditorPanelVisible: Accessor<boolean>
  toggleEditorPanel: () => boolean
  setIsEditorPanelVisible: (visible: boolean) => undefined
  syncDraft: (draftId: number) => Promise<ExtendedDraft | undefined>
  updateDraftField: (
    draftId: number,
    fieldName: keyof DraftInput,
    value: string | EditorData | number[],
    isEditorUpdate: boolean
  ) => undefined
  validationErrors: Accessor<Partial<Record<keyof DraftInput, string>>>
  validateCurrentDraft: () => Promise<boolean>
  clearValidationErrors: () => undefined
  loading: Accessor<boolean>
  // Вспомогательные функции
  canDeleteDraft: (draftId: number) => boolean
  isDraftPublished: (draftId: number) => boolean
  getDraftStatus: (draftId: number) => 'draft' | 'published' | 'unpublished' | 'local'
  getDraftStatusText: (draftId: number) => string
  getDraftStatusInfo: (draftId: number) => {
    status: 'draft' | 'published' | 'unpublished' | 'local'
    text: string
    canDelete: boolean
    canPublish: boolean
    canUnpublish: boolean
    hasHistory: boolean
    shoutId?: number | null
    publishedAt?: number | null
    lastModified?: number | null
  }
  // Функции для работы с локальными черновиками
  removeDraftByKey: (key: string) => boolean
  checkDraftExistsOnServer: (draftId: number) => Promise<boolean>
  checkStorageQuotaWarning: () => void
  // Восстановленные функции
  getOfflineStorageStats: () => {
    // biome-ignore lint/suspicious/noExplicitAny: localStorage
    quota: any
    // biome-ignore lint/suspicious/noExplicitAny: localStorage
    metadata: any
    draftsCount: number
    syncPending: number
    syncFailed: number
  }
  getDraftSyncStatus: (draftId: string | number) => { status: string; failures: number; errorMessage?: string }
  performMaintenanceTasks: () => void
  compareDraftVersions: (localDraft: ExtendedDraft, serverDraft: ExtendedDraft) => string
  syncDraftsBySlug: (drafts: ExtendedDraft[]) => ExtendedDraft[]
}

/**
 * Контекст для управления черновиками
 *
 * ВАЖНОЕ ПРИМЕЧАНИЕ О ПРОИЗВОДИТЕЛЬНОСТИ:
 * Были внесены следующие оптимизации для предотвращения потери фокуса и экранирования строк:
 * 1. Сокращены избыточные преобразования контента между JSON и строками
 * 2. Уменьшено количество обновлений состояния, особенно при вводе текста в редакторе
 * 3. Убраны ненужные санитизации для полей, не содержащих HTML
 * 4. Оптимизировано хранение в localStorage без дополнительных трансформаций
 *
 * При дальнейших модификациях важно сохранять эти оптимизации!
 */
export const DraftsContext = createContext<DraftsContextType>({} as DraftsContextType)
export const DraftsProvider = (props: { children: JSX.Element }) => {
  const { client, session, isSessionLoaded, isSessionValidating, refreshClient } = useSession()
  const {
    localDrafts: getLocalDrafts,
    loadLocalDrafts: loadLocalDraftsFromContext,
    createLocalDraft: createLocalDraftInContext,
    removeLocalDraft: removeLocalDraftFromContext,
    checkStorageQuotaWarning: checkStorageQuotaWarningFromContext,
    removeDraftByKey: removeDraftByKeyFromContext,

    getStorageStats: getStorageStatsFromContext,
    getSyncStatus: getSyncStatusFromContext,
    performMaintenance: performMaintenanceFromContext
  } = useLocalDrafts()

  // все доступные для редактирования черновики
  const [drafts, setDrafts] = createSignal<ExtendedDraft[]>([])
  // текущий редактируемый черновик
  const [currentDraft, setCurrentDraft] = createSignal<ExtendedDraft>()
  // содержимое всех редакторов (для быстрого доступа UI, но источник правды - localStorage/сервер)
  const [editorsContent, setEditorsContent] = createSignal<Record<string, string>>({})
  // видимость панели редактора
  const [isEditorPanelVisible, setIsEditorPanelVisible] = createSignal(true)
  // состояние загрузки черновиков
  const [loading, setLoading] = createSignal(false)
  // Сигнал для хранения ошибок валидации
  const [validationErrors, setValidationErrors] = createSignal<Partial<Record<keyof DraftInput, string>>>({})

  // Создаем дебаунсированную функцию сохранения контента редактора в localStorage
  const debouncedSaveContent = debounce(AUTO_SAVE_DELAY, (editorId: string, content: string) => {
    // Извлекаем draftId и fieldType из editorId
    const match = editorId.match(DRAFT_EDITOR_ID_REGEX)
    if (!match) {
      console.error(`[DraftsProvider] Could not extract draftId and fieldType from editorId: ${editorId}`)
      return
    }

    const draftId = match[1]
    const fieldType = match[2]

    // 🔧 CALLBACK для обновления slug при изменении title
    const onSlugGenerated = (slug: string) => {
      if (fieldType === 'title') {
        const currentDraftObj = currentDraft()
        if (currentDraftObj && currentDraftObj.id === Number(draftId)) {
          // Обновляем slug в currentDraft
          setCurrentDraft({ ...currentDraftObj, slug })

          // 🔧 ОБНОВЛЯЕМ slug в массиве drafts
          setDrafts((prev) => prev.map((d) => (d.id === Number(draftId) ? { ...d, slug } : d)))

          console.log('🔧 [AUTO-SLUG] Обновлен slug в currentDraft и drafts:', slug)
        }
      }
    }

    // Сохраняем контент напрямую в localStorage
    const saved = saveDraftFieldStorage(draftId, fieldType, content, onSlugGenerated)
    console.log(`[DraftsProvider] Debounced save for ${editorId}: ${saved ? 'SUCCESS' : 'FAILED'}`)
  })

  // Очистка ресурсов при размонтировании
  onCleanup(() => {
    // Отменяем отложенные сохранения
    debouncedSaveContent.cancel()
  })

  /**
   * Синхронизирует черновик между локальным и серверным хранилищем
   * @param draftId ID черновика для синхронизации
   * @returns Синхронизированный черновик или undefined при ошибке
   */
  const syncDraft = async (draftId: number): Promise<ExtendedDraft | undefined> => {
    if (isServer) return undefined

    console.log(`[DraftsProvider] Начинаем синхронизацию черновика #${draftId}`)

    // Проверяем наличие черновика в текущем состоянии
    const currentDraftObj = drafts().find((d) => d.id === draftId)
    if (!currentDraftObj) {
      console.warn(`[DraftsProvider] Черновик #${draftId} не найден в состоянии`)
      return undefined
    }

    // Создаем обновленную версию черновика, загружая актуальные данные из localStorage
    const syncedDraft = { ...currentDraftObj }

    // 🔍 ДИАГНОСТИКА: Синхронизируем контент редактора из localStorage
    console.log(`🔍 [SYNC DEBUG] Синхронизация контента для черновика #${draftId}`)

    const bodyFromStorage = getDraftField(draftId, 'body')
    console.log('🔍 [SYNC DEBUG] Body из localStorage:', {
      hasBodyInStorage: !!bodyFromStorage,
      bodyStorageLength: bodyFromStorage?.length || 0,
      bodyStoragePreview: bodyFromStorage?.substring(0, 100),
      currentBodyLength: syncedDraft.body?.length || 0,
      currentBodyPreview: syncedDraft.body?.substring(0, 100)
    })

    if (bodyFromStorage) {
      const parsedBody = parseJsonContent(bodyFromStorage)
      console.log('🔍 [SYNC DEBUG] Парсинг body:', {
        originalLength: bodyFromStorage.length,
        parsedLength: parsedBody?.length || 0,
        parsedPreview: parsedBody?.substring(0, 100),
        isDifferent: parsedBody !== syncedDraft.body,
        isEmpty: !parsedBody || parsedBody.trim() === '',
        isOnlyBr: parsedBody === '<br>'
      })

      if (parsedBody && parsedBody !== syncedDraft.body) {
        console.log(`🔍 [SYNC DEBUG] ✅ Обновляем body из localStorage для черновика #${draftId}`)
        syncedDraft.body = parsedBody
      }
    }

    const leadFromStorage = getDraftField(draftId, 'lead')
    console.log('🔍 [SYNC DEBUG] Lead из localStorage:', {
      hasLeadInStorage: !!leadFromStorage,
      leadStorageLength: leadFromStorage?.length || 0,
      leadStoragePreview: leadFromStorage?.substring(0, 100),
      currentLeadLength: syncedDraft.lead?.length || 0,
      currentLeadPreview: syncedDraft.lead?.substring(0, 100)
    })

    if (leadFromStorage) {
      const parsedLead = parseJsonContent(leadFromStorage)
      console.log('🔍 [SYNC DEBUG] Парсинг lead:', {
        originalLength: leadFromStorage.length,
        parsedLength: parsedLead?.length || 0,
        parsedPreview: parsedLead?.substring(0, 100),
        isDifferent: parsedLead !== syncedDraft.lead
      })

      if (parsedLead && parsedLead !== syncedDraft.lead) {
        console.log(`🔍 [SYNC DEBUG] ✅ Обновляем lead из localStorage для черновика #${draftId}`)
        syncedDraft.lead = parsedLead
      }
    }

    // Синхронизируем другие поля
    const titleFromStorage = getDraftField(draftId, 'title')
    if (titleFromStorage && titleFromStorage !== syncedDraft.title) {
      console.log(`[DraftsProvider] Обновляем title из localStorage для черновика #${draftId}`)
      syncedDraft.title = titleFromStorage
    }

    // Обновляем состояние
    setCurrentDraft(syncedDraft)
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? syncedDraft : d)))

    console.log(`[DraftsProvider] Синхронизация черновика #${draftId} завершена:`, {
      id: syncedDraft.id,
      title: syncedDraft.title,
      bodyLength: syncedDraft.body?.length,
      leadLength: syncedDraft.lead?.length
    })

    return syncedDraft
  }

  const getEditorContent = (editorId: string): string => {
    // 1. Попробовать получить из editorsContent (для мгновенного отклика UI)
    const localUiContent = editorsContent()[editorId]
    if (localUiContent !== undefined) {
      return localUiContent
    }

    // 2. Если нет в UI, извлечь из localStorage
    const match = editorId.match(DRAFT_EDITOR_ID_REGEX)
    if (match) {
      const draftId = match[1]
      const fieldType = match[2]

      const storageContent = getDraftField(draftId, fieldType) // Используем новую внутреннюю функцию
      if (storageContent !== null) {
        // Парсим JSON для body/lead
        const parsedContent =
          fieldType === 'body' || fieldType === 'lead' ? parseJsonContent(storageContent) : storageContent

        // Обновляем editorsContent для кэширования
        setEditorsContent((prev) => ({ ...prev, [editorId]: parsedContent }))
        return parsedContent
      }
    }

    // 3. Если нет нигде, берем из currentDraft (если он есть)
    const draft = currentDraft()
    if (draft && match) {
      const fieldName = match[2] as keyof Draft
      if (fieldName in draft) {
        const draftContent = (draft[fieldName] as string) || ''
        // Обновляем editorsContent для кэширования
        setEditorsContent((prev) => ({ ...prev, [editorId]: draftContent }))
        return draftContent
      }
    }

    return ''
  }

  const setEditorContent = (editorId: string, content: string): undefined => {
    // Сохраняем контент как есть, без дополнительных преобразований
    const safeContent = content != null ? String(content) : ''

    console.log(`🔍 [DEBUG] setEditorContent: ${editorId} = "${safeContent.substring(0, 50)}..."`)

    // 1. Обновляем локальное состояние UI для мгновенного отклика
    setEditorsContent((prev) => ({ ...prev, [editorId]: safeContent }))

    // 2. Запускаем дебаунсированное сохранение в localStorage
    debouncedSaveContent(editorId, safeContent)

    // 3. НЕ обновляем currentDraft здесь, чтобы избежать лишних ререндеров
    // Это будет делаться через updateDraftField при необходимости
    return undefined
  }

  // Функция для обновления поля черновика с обработкой EditorData и сохранением
  const updateDraftField = (
    draftId: number,
    fieldName: keyof DraftInput,
    value: string | EditorData | number[],
    isEditorUpdate: boolean
  ): undefined => {
    if (!draftId) return undefined

    let contentValue: string

    // 1. Правильная обработка значения в зависимости от типа
    if (typeof value === 'object' && value !== null && 'content' in value) {
      // Для объекта EditorData берем уже санитизированный контент
      contentValue = value.content
    } else if (Array.isArray(value)) {
      // Для массивов (например, topic_ids) преобразуем в JSON-строку
      contentValue = JSON.stringify(value)

      // Если это topic_ids, также обновляем topics в currentDraft для синхронизации UI
      if (fieldName === 'topic_ids') {
        // Находим соответствующие темы по их ID
        const draft = currentDraft()
        if (draft && draft.id === draftId) {
          // Обновляем topics в черновике, если он загружен
          const topics = Array.isArray(draft.topics) ? [...draft.topics] : []
          const topicIds = new Set(value as number[])

          // Фильтруем topics, оставляя только те, которые есть в topicIds
          const filteredTopics = topics.filter((topic): topic is Topic => Boolean(topic?.id && topicIds.has(topic.id)))

          // Обновляем черновик с отфильтрованными темами, сохраняя все остальные поля
          setCurrentDraft((prevDraft) => {
            if (!prevDraft || prevDraft.id !== draftId) return prevDraft
            return { ...prevDraft, topics: filteredTopics }
          })

          // Синхронизируем с сервером
          batch(async () => {
            try {
              const draftInput: DraftInput = {
                id: draftId,
                topic_ids: value as number[]
              }
              const response = await updateDraft(draftInput)
              if (response?.data?.update_draft?.error) {
                console.error(
                  '[DraftsProvider] Ошибка при синхронизации тем с сервером:',
                  response.data.update_draft.error
                )
              }
            } catch (error) {
              console.error('[DraftsProvider] Ошибка при синхронизации тем с сервером:', error)
            }
          })
        }
      }
    } else if (typeof value === 'string') {
      // Для строковых значений не делаем лишней санитизации
      contentValue = value
    } else {
      // Для других типов просто конвертируем в строку
      contentValue = String(value)
    }

    // 2. Сохранение в localStorage
    // Важно: не делаем дополнительную обработку для HTML полей, сохраняем как есть
    const saved = saveDraftFieldStorage(draftId, fieldName, contentValue)

    if (!saved) {
      console.error(`[DraftsProvider] Failed to save field "${fieldName}" for draft ${draftId} to storage.`)
      return undefined
    }

    // 3. Обновляем локальный кэш редакторов для мгновенного отображения
    // но только если это действительно обновление от редактора
    // чтобы избежать потери фокуса при каждом вводе символа
    if (isEditorUpdate && (fieldName === 'body' || fieldName === 'lead')) {
      const editorId = `draft-${draftId}-${fieldName}`
      setEditorsContent((prev) => ({ ...prev, [editorId]: contentValue }))
    }

    // 4. Обновляем текущий черновик для всех полей
    // Для редакторных полей НЕ обновляем currentDraft при каждом символе чтобы избежать потери фокуса
    // Вместо этого полагаемся на syncDraft() перед публикацией
    if (isEditorUpdate && (fieldName === 'body' || fieldName === 'lead')) {
      console.log(
        `[DraftsProvider] Пропускаем обновление currentDraft для ${fieldName} при isEditorUpdate для стабильности фокуса`
      )
      // НЕ обновляем currentDraft при каждом вводе символа в редакторе
      // Контент сохраняется в localStorage и будет загружен через syncDraft() перед публикацией
    } else {
      // Для не-редакторных полей обновляем сразу
      setCurrentDraft((prev) => {
        if (!prev || prev.id !== draftId) return prev

        // Для topic_ids обновляем только если на этом шаге еще не обновили
        if (fieldName === 'topic_ids' && Array.isArray(value)) {
          // Уже обновлено выше, просто возвращаем prev
          return prev
        }

        return { ...prev, [fieldName]: contentValue }
      })
    }

    // 5. Интеграция с Awareness Provider - пока отключена
    return undefined
  }

  // Функция loadLocalDrafts теперь находится в LocalDraftsContext

  // Функция removeLocalDraft теперь находится в LocalDraftsContext

  // Функция checkPublishedVersion теперь находится в LocalDraftsContext

  /**
   * Загружает черновики с сервера и объединяет их с локальными
   * @returns Promise с массивом черновиков
   */
  const loadDrafts = async (): Promise<ExtendedDraft[]> => {
    if (isServer) return []

    setLoading(true)
    console.log('[DraftsProvider] Начинаем загрузку черновиков')

    try {
      // Получаем локальные черновики через LocalDraftsContext
      const localDrafts = loadLocalDraftsFromContext()

      // Пытаемся получить черновики с сервера
      const sessionReady = isSessionReadyForServer()

      if (sessionReady) {
        try {
          const result = await client()!.query(loadDraftsQuery, {}).toPromise()

          if (result.error) {
            console.error('[DraftsProvider] GraphQL error при загрузке черновиков:', result.error)
          }

          // Совместимость: поддерживаем как новую схему load_drafts { drafts }, так и плоскую drafts
          // biome-ignore lint/suspicious/noExplicitAny: GraphQL ответ динамический
          const apiDrafts = (result.data as any)?.load_drafts?.drafts || (result.data as any)?.drafts

          if (Array.isArray(apiDrafts)) {
            const serverDrafts = apiDrafts as Draft[]

            // Объединяем серверные и локальные черновики
            const mergedDrafts = [
              ...serverDrafts.map((d) => ({ ...d, local_id: `server-${d.id}` }) as ExtendedDraft),
              ...localDrafts.map((d) => d as ExtendedDraft)
            ]

            // Обновляем состояние
            setDrafts(mergedDrafts)
            return mergedDrafts
          }

          console.warn('[DraftsProvider] Сервер вернул пустой список черновиков')
        } catch (error) {
          console.error('[DraftsProvider] Ошибка при загрузке черновиков с сервера:', error)
        }
      }

      // Если не удалось загрузить с сервера, используем только локальные
      const finalDrafts = localDrafts.map((d) => d as ExtendedDraft)
      setDrafts(finalDrafts)
      return finalDrafts
    } catch (error) {
      console.error('[DraftsProvider] Ошибка при загрузке черновиков:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  // Функция loadLocalDraftsAsFallback теперь находится в LocalDraftsContext

  const createDraft = async (draft: DraftInput): Promise<OperationResult<CreateDraftMutationMutation> | undefined> => {
    console.log('[DraftsProvider] Начинаем создание черновика:', draft)

    // Проверяем наличие client только если не создаем локальный черновик
    if (!client()) {
      console.warn('[DraftsProvider] Client не инициализирован, создание локального черновика')

      // Создаем локальный черновик через LocalDraftsContext
      const localDraft = createLocalDraftInContext(draft)

      // Добавляем в список черновиков
      setDrafts([...drafts(), localDraft as ExtendedDraft])

      // Возвращаем моковый ответ для совместимости
      return {
        data: {
          create_draft: {
            draft: localDraft
          }
        }
      } as unknown as OperationResult<CreateDraftMutationMutation>
    }

    // Проверяем готовность сессии для серверного запроса
    if (!isSessionReadyForServer()) {
      console.error('[DraftsProvider] Сессия не готова для создания черновика на сервере')
      return Promise.reject(new Error('Session not ready for server request'))
    }

    // Отправляем черновик на сервер
    console.log('[DraftsProvider] Отправляем черновик на сервер:', draft)
    const currentClient = client()
    if (!currentClient) {
      console.error('[DraftsProvider] Client все еще не инициализирован после проверки')
      return Promise.reject(new Error('Client is still not initialized after refresh'))
    }

    try {
      const response = await currentClient.mutation(createDraftMutation, { draft_input: draft }).toPromise()
      console.log('[DraftsProvider] Ответ сервера при создании черновика:', response)

      if (response?.data?.create_draft?.draft) {
        const newDraft = response.data.create_draft.draft
        console.log('[DraftsProvider] Получен новый черновик от сервера:', newDraft)

        // Добавляем в список черновиков
        setDrafts([...drafts(), newDraft])

        // Если у нас был локальный черновик с таким же slug, синхронизируем их
        const localDrafts = getLocalDrafts()
        const matchingLocalDraft = localDrafts.find((d) => d.slug === newDraft.slug || d.title === newDraft.title)

        if (matchingLocalDraft) {
          console.log(`[DraftsProvider] Найден локальный черновик с похожими данными: ${matchingLocalDraft.id}`)

          // Переносим данные из локального черновика в серверный при необходимости
          if (!newDraft.body && matchingLocalDraft.body) {
            console.log('[DraftsProvider] Переносим body из локального черновика в серверный')
            updateDraftField(newDraft.id, 'body', matchingLocalDraft.body, false)
          }

          if (!newDraft.lead && matchingLocalDraft.lead) {
            console.log('[DraftsProvider] Переносим lead из локального черновика в серверный')
            updateDraftField(newDraft.id, 'lead', matchingLocalDraft.lead, false)
          }

          // Удаляем локальный черновик
          console.log(`[DraftsProvider] Удаляем локальный черновик после переноса данных: ${matchingLocalDraft.id}`)
          removeLocalDraftFromContext(matchingLocalDraft.id)
        }
      }

      return response as OperationResult<CreateDraftMutationMutation>
    } catch (error) {
      console.error('[DraftsProvider] Ошибка при создании черновика на сервере:', error)
      throw error
    }
  }

  const updateDraft = async (draft: DraftInput): Promise<OperationResult<UpdateDraftMutationMutation>> => {
    // Проверяем готовность сессии перед обновлением
    if (!isSessionReadyForServer()) {
      throw new Error('Сессия не готова для обновления черновика')
    }

    const response = await client()!
      .mutation(updateDraftMutation, {
        draft_id: draft.id,
        draft_input: draft
      })
      .toPromise()

    if (response?.data?.update_draft?.draft && draft.id) {
      updateDraftInState(draft.id, response.data.update_draft.draft)
    }

    return response as OperationResult<UpdateDraftMutationMutation>
  }

  /**
   * Удаляет черновик. ВНИМАНИЕ: опубликованные черновики нельзя удалять!
   * Для опубликованных черновиков сначала нужно снять публикацию через unpublishShout,
   * а затем уже можно удалить сам черновик.
   */
  const deleteDraft = async (draftId: number): Promise<OperationResult<DeleteDraftMutationMutation>> => {
    if (!draftId) {
      throw new Error('deleteDraft: draftId is required')
    }
    if (!client()) {
      throw new Error('deleteDraft: GraphQL client is not initialized')
    }
    if (!isSessionReadyForServer()) {
      throw new Error('deleteDraft: Session not ready')
    }

    // Проверяем, опубликован ли черновик
    const draftToDelete = drafts().find((d) => d.id === draftId)
    const isPublished = draftToDelete?.shout?.published_at || draftToDelete?.published_at

    if (isPublished) {
      // Опубликованные черновики нельзя удалять!
      const errorMessage =
        'Опубликованный черновик нельзя удалить. Сначала снимите публикацию, а затем удалите черновик.'
      console.error(`[DraftsProvider] ${errorMessage}`)

      return {
        error: {
          name: 'PublishedDraftError',
          message: errorMessage,
          graphQLErrors: [],
          networkError: null
        },
        data: {
          delete_draft: {
            error: errorMessage
          }
        },
        operation: null,
        stale: false,
        hasNext: false
      } as unknown as OperationResult<DeleteDraftMutationMutation>
    }

    console.log(`[DraftsProvider] Удаляем неопубликованный черновик #${draftId}`)

    try {
      const response = await client()!.mutation(deleteDraftMutation, { draft_id: draftId }).toPromise()

      if (handleGraphQLError(response, 'delete_draft')) {
        return response as OperationResult<DeleteDraftMutationMutation>
      }

      const apiError = response?.data?.delete_draft?.error
      if (apiError) {
        // Если сервер сообщает, что черновик не существует,
        // удаляем его из локального состояния как fallback
        if (
          apiError.includes('не существует') ||
          apiError.includes('not found') ||
          apiError.includes('does not exist')
        ) {
          // Удаляем из локального состояния
          removeDraftFromState(draftId)

          // Очищаем локальные данные через LocalDraftsContext
          try {
            removeLocalDraftFromContext(draftId)
          } catch (_e) {}

          // Возвращаем успешный результат, так как черновик фактически удален
          return {
            data: {
              delete_draft: {
                error: null
              }
            }
          } as unknown as OperationResult<DeleteDraftMutationMutation>
        }

        return response as OperationResult<DeleteDraftMutationMutation>
      }

      // Успех — удаляем черновик из списка и чистим локальные данные
      removeDraftFromState(draftId)

      try {
        removeLocalDraftFromContext(draftId)
      } catch (_e) {}

      return response as OperationResult<DeleteDraftMutationMutation>
    } catch (error) {
      console.error(`[DraftsProvider] Ошибка при удалении черновика #${draftId}:`, error)

      // При сетевых ошибках пытаемся удалить локально как fallback
      if (
        error instanceof Error &&
        (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('timeout'))
      ) {
        console.log(`[DraftsProvider] Сетевая ошибка при удалении черновика #${draftId}, удаляем локально как fallback`)

        // Удаляем из локального состояния
        removeDraftFromState(draftId)

        // Очищаем локальные данные через LocalDraftsContext
        try {
          removeLocalDraftFromContext(draftId)
        } catch (_e) {}

        // Возвращаем успешный результат, так как черновик фактически удален
        return {
          data: {
            delete_draft: {
              error: null
            }
          }
        } as unknown as OperationResult<DeleteDraftMutationMutation>
      }

      throw error
    }
  }

  /* 
      Публикация черновика 
    
      - проверяем наличие mainTopic или selectedTopics
    */
  const publishDraft = async (draftId: number): Promise<OperationResult<PublishDraftMutationMutation>> => {
    console.log(`[DraftsProvider] Публикация черновика #${draftId}`)

    try {
      // Находим черновик в общем списке
      const draftToPublish = drafts().find((d) => d.id === draftId)
      if (!draftToPublish) {
        console.error(`[DraftsProvider] Не удалось найти черновик #${draftId} перед публикацией`)
        throw new Error(`Черновик #${draftId} не найден`)
      }

      console.log('[DraftsProvider] Found draft for publishing:', {
        id: draftToPublish.id,
        title: draftToPublish.title,
        topics: draftToPublish.topics,
        topicIds: draftToPublish.topics?.map((t) => t?.id),
        body: `${draftToPublish.body?.substring(0, 100)}...`,
        slug: draftToPublish.slug
      })

      // Синхронизируем темы из localStorage
      const finalTopics = syncTopicsFromStorage(draftId, draftToPublish.topics || [])
      if (finalTopics !== draftToPublish.topics) {
        draftToPublish.topics = finalTopics
      }

      // Синхронизируем черновик перед публикацией чтобы получить актуальный контент
      console.log('[DraftsProvider] Синхронизируем черновик перед публикацией...')
      const syncedDraft = await syncDraft(draftId)
      const finalDraftToPublish = syncedDraft || draftToPublish

      // Создаем DraftInput для валидации
      const draftInput = createDraftInput(finalDraftToPublish)
      console.log('[DraftsProvider] 🔍 DraftInput for publishing:', {
        id: draftInput.id,
        topicIds: draftInput.topic_ids,
        mainTopicId: draftInput.main_topic_id,
        title: draftInput.title,
        body: `${draftInput.body?.substring(0, 100)}...`,
        bodyLength: draftInput.body?.length,
        slug: draftInput.slug,
        slugLength: draftInput.slug?.length || 0,
        hasSlug: !!(draftInput.slug && draftInput.slug.trim() !== ''),
        hasTitle: !!(draftInput.title && draftInput.title.trim() !== ''),
        hasBody: !!(draftInput.body && draftInput.body.trim() !== ''),
        hasTopics: !!(draftInput.topic_ids && draftInput.topic_ids.length > 0)
      })

      // Проводим валидацию перед публикацией
      const validationResult = validateDraftForPublishing(draftInput)
      console.log('[DraftsProvider] Pre-publish validation result:', validationResult)

      if (!validationResult.isValid) {
        console.error(`[DraftsProvider] Черновик #${draftId} не прошел валидацию:`, validationResult.errors)

        // Формируем объект с ошибками
        const errorsMap: Partial<Record<keyof DraftInput, string>> = {}
        validationResult.errors.forEach((error) => {
          if (error.field) {
            errorsMap[error.field] = error.message
          }
        })

        setValidationErrors(errorsMap)
        return {
          data: {
            publish_draft: {
              error: 'Пожалуйста исправьте ошибки',
              draft: null
            }
          }
        } as OperationResult<PublishDraftMutationMutation>
      }

      clearValidationErrors()

      // Проверяем готовность сессии
      if (!isSessionReadyForServer()) {
        console.error('[DraftsProvider] Session not ready for publishing')
        throw new Error('Сессия не готова для публикации')
      }

      // Обновляем клиент с актуальным токеном
      console.log('[DraftsProvider] Refreshing client with current token...')
      await refreshClient()

      // Получаем обновленный клиент после refreshClient
      const currentClient = client()
      if (!currentClient) {
        throw new Error('Client is still not initialized after refresh')
      }

      console.log('[DraftsProvider] Session ready, calling GraphQL mutation...')

      // 🔍 ФИНАЛЬНАЯ ДИАГНОСТИКА: Логируем что отправляем на сервер
      console.log('[DraftsProvider] 🚀 Отправляем publish_draft мутацию на сервер:', {
        draft_id: draftId,
        mutation: 'publish_draft',
        timestamp: new Date().toISOString()
      })

      // Публикуем черновик с обновленным клиентом
      const response = await currentClient.mutation(publishDraftMutation, { draft_id: draftId }).toPromise()
      console.log('[DraftsProvider] GraphQL response:', response)

      if (response?.data?.publish_draft?.draft) {
        const publishedDraft = response.data.publish_draft.draft
        console.log(`[DraftsProvider] ✅ Успешно опубликован черновик #${draftId}:`, {
          draftId: publishedDraft.id,
          slug: publishedDraft.slug,
          publishedAt: publishedDraft.published_at,
          shoutId: publishedDraft.shout?.id
        })

        // 🔍 ДИАГНОСТИКА БАГА: Логируем детали для расследования проблемы с фидами
        console.log('📝 Детали опубликованной статьи:', {
          id: publishedDraft.id,
          title: publishedDraft.title,
          slug: publishedDraft.slug,
          published_at: publishedDraft.published_at,
          featured_at: publishedDraft.featured_at,
          topics: publishedDraft.topics?.map((t: Topic) => ({ id: t?.id, title: t?.title, slug: t?.slug })),
          authors: publishedDraft.authors?.map((a: Author) => ({ id: a?.id, name: a?.name, slug: a?.slug })),
          hasBody: !!publishedDraft.body,
          bodyLength: publishedDraft.body?.length || 0
        })
        console.log('⚠️ ВАЖНО: Проверьте, появится ли эта статья в load_shouts_by запросах!')
        console.log('🔗 Прямая ссылка для проверки:', `/${publishedDraft.slug}`)
        console.log(
          '📊 Ожидаемое поведение: статья должна появиться в фидах в течение 30 минут (после инвалидации кеша)'
        )
        console.groupEnd()

        // Обновляем черновик в состоянии
        updateDraftInState(draftId, publishedDraft)
      } else if (handleGraphQLError(response, 'publish_draft')) {
        console.error(`[DraftsProvider] Ошибка при публикации черновика #${draftId}`)
      }

      return response as OperationResult<PublishDraftMutationMutation>
    } catch (error) {
      console.error(`[DraftsProvider] Критическая ошибка при публикации черновика #${draftId}:`, error)
      throw error
    }
  }

  /**
   * Снимает публикацию с опубликованной статьи (shout).
   * После снятия публикации черновик остается в системе как неопубликованный
   * и может быть отредактирован или удален.
   */
  const unpublishShout = async (shoutId: number): Promise<OperationResult<UnpublishShoutMutationMutation>> => {
    try {
      // Перед снятием с публикации отображаем статус загрузки
      console.log(`[DraftsProvider] Снимаем с публикации статью #${shoutId}...`)

      // Проверяем готовность сессии перед снятием публикации
      if (!isSessionReadyForServer()) {
        throw new Error('Сессия не готова для снятия публикации')
      }

      // Выполняем запрос на снятие с публикации
      const response = await client()!.mutation(unpublishShoutMutation, { shout_id: shoutId }).toPromise()

      // Проверяем наличие данных в ответе
      if (response?.data?.unpublish_shout) {
        // Получаем shout из ответа
        const shoutData = response.data.unpublish_shout.shout

        // Проверяем наличие ошибки
        if (response.data.unpublish_shout.error) {
          console.error(
            `[DraftsProvider] Ошибка при снятии с публикации для статьи #${shoutId}:`,
            response.data.unpublish_shout.error
          )
          return response as OperationResult<UnpublishShoutMutationMutation>
        }

        // Проверяем, что получили корректный ответ с данными черновика
        if (shoutData) {
          console.log(`[DraftsProvider] Получен ответ на снятие публикации: ${shoutData.id}`)

          // Загружаем черновики с сервера для получения актуальных данных
          await loadDrafts()

          // Находим обновленный черновик в списке
          const updatedDraft = drafts().find((d) => d.id === shoutId)

          if (updatedDraft) {
            console.log(`[DraftsProvider] Найден черновик в списке после снятия публикации: ${updatedDraft.id}`)

            // Обновляем черновик в состоянии, устанавливая published_at в null
            updateDraftInState(shoutId, {
              published_at: null,
              shout: updatedDraft.shout ? { ...updatedDraft.shout, published_at: null } : null
            })

            return response as OperationResult<UnpublishShoutMutationMutation>
          }

          console.warn(`[DraftsProvider] После loadDrafts() не найден черновик с ID=${shoutId} в списке drafts`)
        } else {
          console.error('[DraftsProvider] Ответ на снятие публикации не содержит данных shout')
        }
      } else if (response?.error) {
        console.error(`[DraftsProvider] Ошибка при снятии публикации для статьи #${shoutId}:`, response.error)
      }

      return response as OperationResult<UnpublishShoutMutationMutation>
    } catch (error) {
      console.error(`[DraftsProvider] Критическая ошибка при снятии публикации статьи #${shoutId}:`, error)
      throw error
    }
  }

  const toggleEditorPanel = () => setIsEditorPanelVisible(!isEditorPanelVisible())

  /**
   * Удаляет черновик из localStorage по строковому ключу.
   * @param key Ключ черновика в localStorage (например, "draft-123-comment-new").
   * @returns true в случае успеха, false при ошибке.
   */
  const removeDraftByKey = (key: string): boolean => {
    return removeDraftByKeyFromContext(key)
  }

  /**
   * Проверяет, существует ли черновик на сервере
   * @param draftId ID черновика для проверки
   * @returns Promise<boolean> true если черновик существует, false если нет
   */
  const checkDraftExistsOnServer = async (draftId: number): Promise<boolean> => {
    // Проверяем, есть ли черновик в текущем состоянии drafts
    // Это включает как локальные, так и серверные черновики
    const currentDrafts = drafts()

    console.log(`[DraftsProvider] 🔍 Проверка существования черновика #${draftId} на сервере`)
    console.log('[DraftsProvider] 📊 Всего черновиков в состоянии:', currentDrafts.length)
    console.log(
      '[DraftsProvider] 📋 Список всех черновиков:',
      currentDrafts.map((d) => ({
        id: d.id,
        title: d.title,
        isLocalOnly: d.isLocalOnly
      }))
    )

    const foundDraft = currentDrafts.find((d) => d.id === draftId)
    console.log(`[DraftsProvider] 🎯 Найденный черновик #${draftId}:`, foundDraft)

    if (foundDraft) {
      const isServerDraft = !foundDraft.isLocalOnly
      console.log(
        `[DraftsProvider] ✅ Черновик #${draftId} найден, isLocalOnly:`,
        foundDraft.isLocalOnly,
        '→ Серверный:',
        isServerDraft
      )
      return isServerDraft
    } else {
      console.log(`[DraftsProvider] ❌ Черновик #${draftId} НЕ найден в состоянии`)
      return false
    }
  }

  /**
   * Проверяет объем использованного хранилища и устанавливает предупреждение если нужно
   */
  const checkStorageQuotaWarning = () => {
    checkStorageQuotaWarningFromContext()
  }

  /**
   * Получает статистику offline хранилища
   */
  const getOfflineStorageStats = () => {
    // Используем LocalDraftsContext для получения статистики
    return getStorageStatsFromContext()
  }

  /**
   * Получает статус синхронизации черновика
   */
  const getDraftSyncStatus = (draftId: string | number) => {
    return getSyncStatusFromContext(draftId)
  }

  /**
   * Выполняет периодическое обслуживание
   */
  const performMaintenanceTasks = () => {
    performMaintenanceFromContext()
  }

  /**
   * Сравнивает версии черновиков для определения конфликтов
   */
  const compareDraftVersions = (localDraft: ExtendedDraft, serverDraft: ExtendedDraft) => {
    if (!localDraft || !serverDraft) return 'no-comparison'

    const localTimestamp = localDraft.updated_at || localDraft.created_at || 0
    const serverTimestamp = serverDraft.updated_at || serverDraft.created_at || 0

    if (localTimestamp > serverTimestamp) return 'local-newer'
    if (serverTimestamp > localTimestamp) return 'server-newer'
    return 'same-version'
  }

  /**
   * Синхронизирует черновики по slug для объединения дубликатов
   */
  const syncDraftsBySlug = (drafts: ExtendedDraft[]) => {
    const slugMap = new Map<string, ExtendedDraft[]>()

    // Группируем черновики по slug
    drafts.forEach((draft) => {
      if (draft.slug) {
        if (!slugMap.has(draft.slug)) {
          slugMap.set(draft.slug, [])
        }
        slugMap.get(draft.slug)!.push(draft)
      }
    })

    // Обрабатываем конфликты
    const syncedDrafts: ExtendedDraft[] = []
    slugMap.forEach((draftsWithSameSlug, _slug) => {
      if (draftsWithSameSlug.length === 1) {
        syncedDrafts.push(draftsWithSameSlug[0])
      } else {
        // Если есть несколько черновиков с одинаковым slug, берем самый новый
        const newestDraft = draftsWithSameSlug.reduce((newest, current) => {
          const newestTime = newest.updated_at || newest.created_at || 0
          const currentTime = current.updated_at || current.created_at || 0
          return currentTime > newestTime ? current : newest
        })
        syncedDrafts.push(newestDraft)
      }
    })

    return syncedDrafts
  }

  /**
   * Валидирует текущий черновик и обновляет состояние ошибок.
   * @returns {Promise<boolean>} true если черновик валиден, иначе false.
   */
  const validateCurrentDraft = async (): Promise<boolean> => {
    const draft = currentDraft()
    if (!draft) {
      console.warn('[DraftsProvider] No current draft to validate.')
      setValidationErrors({})
      return false
    }

    // Сначала синхронизируем черновик чтобы получить актуальный контент
    console.log('[DraftsProvider] Синхронизируем черновик перед валидацией...')
    const syncedDraft = await syncDraft(draft.id)
    const finalDraft = syncedDraft || draft

    console.log('[DraftsProvider] Starting validation for draft:', {
      id: finalDraft.id,
      title: finalDraft.title,
      topics: finalDraft.topics,
      topicIds: finalDraft.topics?.map((t) => t?.id),
      body: `${finalDraft.body?.substring(0, 100)}...`,
      bodyLength: finalDraft.body?.length,
      slug: finalDraft.slug
    })

    // Создаем DraftInput из синхронизированного черновика
    const draftInput = createDraftInput(finalDraft)

    console.log('[DraftsProvider] DraftInput for validation:', {
      draftId: finalDraft.id,
      topicIds: draftInput.topic_ids,
      mainTopicId: draftInput.main_topic_id,
      title: draftInput.title,
      body: `${draftInput.body?.substring(0, 100)}...`,
      bodyLength: draftInput.body?.length,
      slug: draftInput.slug
    })

    const validationResult = validateDraftForPublishing(draftInput)
    console.log('[DraftsProvider] Validation result:', validationResult)

    if (validationResult.isValid) {
      console.log('[DraftsProvider] Валидация успешна')
      setValidationErrors({}) // Очищаем ошибки при успехе
      return true
    } else {
      // Преобразуем массив ошибок в объект для сигнала
      const errorsMap: Partial<Record<keyof DraftInput, string>> = {}
      validationResult.errors.forEach((error) => {
        if (error.field) {
          // Сохраняем только первую ошибку для каждого поля
          const fieldKey = error.field as keyof DraftInput
          if (!errorsMap[fieldKey]) {
            errorsMap[fieldKey] = error.message
          }
        }
      })
      console.warn('[DraftsProvider] Ошибки валидации:', errorsMap)
      setValidationErrors(errorsMap)
      return false
    }
  }

  /**
   * Очищает ошибки валидации.
   */
  const clearValidationErrors = (): undefined => {
    setValidationErrors({})
    return undefined
  }

  /**
   * Проверяет, опубликован ли черновик
   * @param draftId ID черновика
   * @returns true если черновик опубликован
   */
  const isDraftPublished = (draftId: number): boolean => {
    const draft = drafts().find((d) => d.id === draftId)
    return !!(draft?.shout?.published_at || draft?.published_at)
  }

  /**
   * Проверяет, можно ли удалить черновик
   * @param draftId ID черновика
   * @returns true если черновик можно удалить (не опубликован)
   */
  const canDeleteDraft = (draftId: number): boolean => {
    return !isDraftPublished(draftId)
  }

  /**
   * Определяет статус черновика для отображения в UI
   * @param draftId ID черновика
   * @returns Статус черновика: 'draft' | 'published' | 'unpublished' | 'local'
   */
  const getDraftStatus = (draftId: number): 'draft' | 'published' | 'unpublished' | 'local' => {
    const draft = drafts().find((d) => d.id === draftId)

    if (!draft) return 'draft'

    // Локальный черновик (только в браузере)
    if (draft.isLocalOnly) return 'local'

    // Проверяем наличие shout и его статус публикации
    if (draft.shout) {
      if (draft.shout.published_at) {
        return 'published' // Опубликован
      } else {
        return 'unpublished' // Снят с публикации
      }
    }

    // Проверяем прямое поле published_at
    if (draft.published_at) {
      return 'published' // Опубликован
    }

    return 'draft' // Обычный черновик
  }

  /**
   * Получает текст статуса для отображения в UI
   * @param draftId ID черновика
   * @returns Текст статуса на русском языке
   */
  const getDraftStatusText = (draftId: number): string => {
    const status = getDraftStatus(draftId)

    switch (status) {
      case 'published':
        return 'Опубликован'
      case 'unpublished':
        return 'Снят с публикации'
      case 'local':
        return 'Локальный'
      default:
        return 'Черновик'
    }
  }

  /**
   * Получает детальную информацию о статусе черновика для отображения в UI
   * @param draftId ID черновика
   * @returns Объект с информацией о статусе
   */
  const getDraftStatusInfo = (draftId: number) => {
    const draft = drafts().find((d) => d.id === draftId)
    const status = getDraftStatus(draftId)

    if (!draft) {
      return {
        status,
        text: getDraftStatusText(draftId),
        canDelete: true,
        canPublish: false,
        canUnpublish: false,
        hasHistory: false
      }
    }

    const canDelete = canDeleteDraft(draftId)
    const canPublish = status === 'draft' || status === 'unpublished'
    const canUnpublish = status === 'published'
    const hasHistory = status === 'unpublished' || status === 'published'

    return {
      status,
      text: getDraftStatusText(draftId),
      canDelete,
      canPublish,
      canUnpublish,
      hasHistory,
      // Дополнительная информация для UI
      shoutId: draft.shout?.id,
      publishedAt: draft.shout?.published_at || draft.published_at,
      lastModified: draft.updated_at
    }
  }

  // Функция getOfflineStorageStats теперь находится в LocalDraftsContext

  // Функции compareDraftVersions и syncDraftsBySlug теперь находятся в LocalDraftsContext

  // Функция checkDraftExistsOnServer теперь находится в LocalDraftsContext

  // 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УСТРАНЕНИЯ ДУБЛИРОВАНИЯ

  /**
   * Проверяет готовность сессии для серверных операций
   */
  const isSessionReadyForServer = (): boolean => {
    const hasClient = !!client()
    const hasToken = !!session()?.token
    const sessionLoaded = isSessionLoaded()
    const sessionNotValidating = !isSessionValidating()
    const notServer = !isServer

    const isReady = hasClient && hasToken && sessionLoaded && sessionNotValidating && notServer

    return isReady
  }

  /**
   * Создает DraftInput из черновика (устраняет дублирование)
   */
  const createDraftInput = (draft: ExtendedDraft): DraftInput => {
    // 🔧  Автоматически генерируем slug если его нет
    let slug = draft.slug || ''
    if (!slug || slug.trim() === '') {
      slug = slugify(draft.title || '')
      console.log(`🔧 [AUTO-FIX] Сгенерирован slug для черновика #${draft.id}:`, slug)
    }

    return {
      id: draft.id,
      layout: draft.layout || 'article',
      title: draft.title || '',
      subtitle: draft.subtitle || '',
      lead: draft.lead || '',
      body: draft.body || '',
      slug: slug,
      cover: draft.cover || '',
      cover_caption: draft.cover_caption || '',
      topic_ids: Array.isArray(draft.topics)
        ? draft.topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id)
        : [],
      main_topic_id: draft.topics && draft.topics.length > 0 && draft.topics[0] ? draft.topics[0].id : null,
      seo: draft.seo || '',
      author_ids: draft.authors?.map((a) => a?.id).filter((id): id is number => !!id) || []
    }
  }

  /**
   * Синхронизирует темы из localStorage с черновиком (устраняет дублирование)
   */
  const syncTopicsFromStorage = (draftId: number, currentTopics: Maybe<Topic>[]): Topic[] => {
    const storedTopics = getDraftField(draftId, 'topic_ids')
    if (!storedTopics) return currentTopics.filter((t): t is Topic => Boolean(t))

    try {
      const storedTopicIds = JSON.parse(storedTopics) as number[]
      if (!Array.isArray(storedTopicIds) || storedTopicIds.length === 0)
        return currentTopics.filter((t): t is Topic => Boolean(t))

      const { sortedTopics } = useTopics()
      const allTopics = sortedTopics()
      const foundTopics = allTopics.filter((topic: Topic) => storedTopicIds.includes(topic.id))

      if (foundTopics.length > 0) {
        console.log('[DraftsProvider] Synced topics from storage:', foundTopics)
        return foundTopics
      }
    } catch (error) {
      console.error('[DraftsProvider] Error parsing stored topics:', error)
    }

    return currentTopics.filter((t): t is Topic => Boolean(t))
  }

  /**
   * Обновляет черновик в состоянии (устраняет дублирование)
   */
  const updateDraftInState = (draftId: number, updates: Partial<ExtendedDraft>): void => {
    setDrafts(drafts().map((d) => (d.id === draftId ? { ...d, ...updates } : d)))

    const current = currentDraft()
    if (current?.id === draftId) {
      setCurrentDraft({ ...current, ...updates })
    }
  }

  /**
   * Удаляет черновик из состояния (устраняет дублирование)
   */
  const removeDraftFromState = (draftId: number): void => {
    setDrafts(drafts().filter((d) => d.id !== draftId))

    if (currentDraft()?.id === draftId) {
      setCurrentDraft(undefined)
    }
  }

  const value = {
    drafts,
    currentDraft,
    setCurrentDraft,
    getEditorContent,
    setEditorContent,
    loadDrafts,
    createDraft,
    updateDraft,
    deleteDraft,
    publishDraft,
    unpublishShout,
    isEditorPanelVisible,
    toggleEditorPanel,
    setIsEditorPanelVisible,
    syncDraft,
    updateDraftField,
    validationErrors,
    validateCurrentDraft,
    clearValidationErrors,
    loading,
    // Вспомогательные функции
    canDeleteDraft,
    isDraftPublished,
    getDraftStatus,
    getDraftStatusText,
    getDraftStatusInfo,
    removeDraftByKey,
    checkDraftExistsOnServer,
    checkStorageQuotaWarning,
    // Восстановленные функции
    getOfflineStorageStats,
    getDraftSyncStatus,
    performMaintenanceTasks,
    compareDraftVersions,
    syncDraftsBySlug
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}

// Экспортируем тип DraftInput для использования в других компонентах
export type { DraftInput } from '~/graphql/generated/graphql'

/**
 * Преобразует список тем-объектов в массив их идентификаторов для DraftInput
 *
 * @param {Array<Partial<Topic> | null | undefined>} topics - Массив объектов тем или Maybe<Topic>[]
 * @returns {number[]} Массив идентификаторов тем
 */
export const topicsToTopicIds = (topics?: Array<Partial<Topic> | null | undefined> | null): number[] => {
  if (!Array.isArray(topics)) return []

  return topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id)
}
