import { OperationResult } from '@urql/core'
import { Accessor, JSX, batch, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
// Импортируем функции из storage.ts вместо дублирования
import {
  type SyncStatus,
  checkStorageQuota,
  getAllDraftFields,
  getAllDraftsFromStorage,
  getDraftField,
  getDraftFromStorage,
  getStorageStats,
  getSyncStatus,
  hasUnsyncedChanges,
  parseJsonContent,
  performPeriodicCleanup,
  removeDraftFromStorage,
  saveDraftField as saveDraftFieldStorage,
  saveEntireDraft,
  updateLastSync
} from '~/components/SimpleRichEditor/lib/storage'
import { EditorData } from '~/components/SimpleRichEditor/lib/types'
import unpublishShoutMutation from '~/graphql/mutation/core/article-unpublish'
import createDraftMutation from '~/graphql/mutation/core/draft-create'
import deleteDraftMutation from '~/graphql/mutation/core/draft-delete'
import publishDraftMutation from '~/graphql/mutation/core/draft-publish'
import updateDraftMutation from '~/graphql/mutation/core/draft-update'
import loadShoutQuery from '~/graphql/query/core/article-load'
import loadDraftsQuery from '~/graphql/query/core/drafts-load'
import type {
  Author,
  CreateDraftMutationMutation,
  DeleteDraftMutationMutation,
  Draft,
  DraftInput,
  PublishDraftMutationMutation,
  Topic,
  UnpublishShoutMutationMutation,
  UpdateDraftMutationMutation
} from '~/graphql/schema/core.gen'
import { validateDraftForPublishing } from '~/lib/validateDraft'
import { tryParseJson } from '~/utils/tryjson'
import { useSession } from './session'
import { useTopics } from './topics'

export const AUTO_SAVE_DELAY = 1000

/**
 * Проверяет валидность временной метки и конвертирует из UNIX timestamp при необходимости
 *
 * @param timestamp Временная метка для проверки (может быть как в секундах из Python, так и в миллисекундах)
 * @returns Валидированная метка времени в миллисекундах или текущее время
 */
const validateTimestamp = (timestamp: number | undefined | null): number => {
  const now = Date.now()
  const minValidDate = new Date('2020-01-01').getTime() // Минимальная валидная дата (1 января 2020)
  const maxValidDate = now + 86400000 // Максимальная валидная дата (сегодня + 1 день)

  // Если timestamp отсутствует, используем текущее время
  if (timestamp === undefined || timestamp === null) {
    return now
  }

  // Преобразуем UNIX timestamp (секунды) в миллисекунды, если нужно
  // Если timestamp меньше определенного порога (например, 2147483648 - 01/19/2038),
  // то считаем, что это секунды, а не миллисекунды
  const ts = timestamp < 2147483648 ? timestamp * 1000 : timestamp

  // Проверяем, находится ли метка в разумных пределах
  if (ts < minValidDate || ts > maxValidDate) {
    console.warn(
      `[drafts] Invalid timestamp detected: ${new Date(ts).toISOString()}, using current time instead`
    )
    return now
  }

  return ts
}

const EDITOR_KEY_REGEX = /draft-(\d+)-([a-z]+)/

// Интерфейс для расширенной информации о черновике
export interface ExtendedDraft extends Draft {
  isLocalOnly?: boolean
  localId?: string
  hasPublishedVersion?: boolean // Флаг, указывающий наличие опубликованной версии с тем же слагом
  published_at?: number | null // Timestamp публикации статьи (может быть null)
  mainTopic?: Topic | null // Явно добавляем поле, которое используется ниже
  authors: Draft['authors'] // Добавляем обязательное поле для исправления ошибки типа
}

type DraftsContextType = {
  drafts: Accessor<ExtendedDraft[]>
  currentDraft: Accessor<ExtendedDraft | undefined>
  setCurrentDraft: (draft?: ExtendedDraft) => undefined
  getEditorContent: (editorId: string) => string
  setEditorContent: (editorId: string, content: string) => undefined
  loadDrafts: () => Promise<undefined>
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
  loadLocalDrafts: () => ExtendedDraft[]
  removeLocalDraft: (draftId: number) => boolean
  checkPublishedVersion: (slug: string) => Promise<boolean>
  removeDraftByKey: (key: string) => boolean
  validationErrors: Accessor<Partial<Record<keyof DraftInput, string>>>
  validateCurrentDraft: () => Promise<boolean>
  clearValidationErrors: () => undefined
  loading: Accessor<boolean>
  // Новые функции для работы с OfflineStatus
  storageQuotaWarning: Accessor<boolean>
  getDraftSyncStatus: (draftId: string | number) => SyncStatus
  getOfflineStorageStats: () => ReturnType<typeof getStorageStats>
  performMaintenanceTasks: () => void
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
const DRAFT_EDITOR_ID_REGEX = /draft-(\d+)-([a-z]+)/
export const DraftsProvider = (props: { children: JSX.Element }) => {
  const { client, session } = useSession()
  const { topicEntities } = useTopics()
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
  const [validationErrors, setValidationErrors] = createSignal<Partial<Record<keyof DraftInput, string>>>(
    {}
  )
  // Сигналы для OfflineStatus
  const [storageQuotaWarning, setStorageQuotaWarning] = createSignal(false)

  // Создаем дебаунсированную функцию сохранения контента редактора в localStorage
  const debouncedSaveContent = debounce(AUTO_SAVE_DELAY, (editorId: string, content: string) => {
    // Извлекаем draftId и fieldType из editorId
    const match = editorId.match(EDITOR_KEY_REGEX)
    if (!match) {
      console.error(`[DraftsProvider] Could not extract draftId and fieldType from editorId: ${editorId}`)
      return
    }

    const draftId = match[1]
    const fieldType = match[2]

    // Сохраняем контент напрямую в localStorage
    saveDraftFieldStorage(draftId, fieldType, content)
    console.log(`[DraftsProvider] Debounced save for ${editorId}`)
  })

  // Очистка ресурсов при размонтировании
  onCleanup(() => {
    // Отменяем отложенные сохранения
    debouncedSaveContent.cancel()
  })

  /**
   * Обрабатывает временную метку, полученную с сервера
   * @param timestamp Временная метка в любом формате (секунды или миллисекунды)
   * @returns Валидированная временная метка в миллисекундах
   */
  const processServerTimestamp = (timestamp: number | undefined | null): number => {
    // Используем validateTimestamp, которая уже содержит логику конвертации
    return validateTimestamp(timestamp)
  }

  // Функция для синхронизации черновика между компонентами
  const syncDraft = async (draftId: number): Promise<ExtendedDraft | undefined> => {
    if (isServer) return undefined

    console.log(`[DraftsProvider] Synchronizing draft: ${draftId}`)
    // Проверяем наличие черновика в текущем состоянии
    const currentDraftObj = drafts().find((d) => d.id === draftId)
    // Получаем локальные данные
    const localDraftData = getDraftFromStorage(draftId)

    try {
      // Для черновика без локальных данных просто возвращаем текущий объект
      if (!localDraftData && currentDraftObj) {
        console.log(`[DraftsProvider] No local data for draft ${draftId}, using server version`)
        return currentDraftObj
      }

      // Определяем более свежую версию (по timestamp)
      const serverTimestamp = currentDraftObj?.updated_at
        ? processServerTimestamp(currentDraftObj.updated_at)
        : 0
      const localTimestamp = validateTimestamp(localDraftData?.timestamp || 0)

      let baseDraft: ExtendedDraft
      let fieldsToApply: Record<string, string> | null = null

      if (localTimestamp > serverTimestamp) {
        console.log(`[DraftsProvider] Local version of draft ${draftId} is newer. Using local as base.`)
        // Создаем минимальный Draft-совместимый объект, если currentDraftObj пуст
        const serverBase = currentDraftObj || {
          id: draftId,
          created_at: 0,
          community: {
            id: 0,
            slug: '',
            name: '',
            pic: '',
            created_at: 0,
            created_by: { id: 0, slug: '', user: '' }
          },
          created_by: { id: 0, slug: '', user: '' },
          title: '',
          slug: '',
          layout: 'article',
          topics: [], // Добавляем пустой массив для topics
          authors: [] // Добавляем пустой массив для authors
        }

        baseDraft = {
          ...serverBase,
          updated_at: localTimestamp, // Используем локальную метку (число)
          // Другие поля, которые нужно специально обработать
          ...(localDraftData ? getAllDraftFields(draftId) : {})
        } as ExtendedDraft

        // Проверяем наличие метки публикации, сохраняем её
        if (currentDraftObj?.published_at) {
          baseDraft.published_at = processServerTimestamp(currentDraftObj.published_at)
        }
      } else {
        console.log(
          `[DraftsProvider] Server version of draft ${draftId} is newer or equal. Using server as base.`
        )
        if (!currentDraftObj) {
          console.error(
            `[DraftsProvider] Server version is newer for ${draftId}, but draft not found in state!`
          )
          return undefined // Не можем продолжить без серверных данных
        }
        baseDraft = { ...currentDraftObj }
        // Проверяем только несинхронизированные данные
        fieldsToApply =
          localDraftData && (!localDraftData.lastSync || localDraftData.timestamp > localDraftData.lastSync)
            ? localDraftData.fields
            : null
        if (fieldsToApply) {
          console.log(
            `[DraftsProvider] Server version is base for ${draftId}, but local changes exist and seem unsynced. Will try to sync them.`
          )
        }
      }

      // Применяем темы из состояния (localStorage хранит только ID)
      if (currentDraftObj?.topics) {
        baseDraft.topics = currentDraftObj.topics
      }
      // Используем mainTopic (camelCase) как в ExtendedDraft
      if (currentDraftObj?.mainTopic) {
        baseDraft.mainTopic = currentDraftObj.mainTopic
      }
      // Обрабатываем JSON поля body и lead из локального хранилища, если они там есть
      if (localDraftData?.fields?.body) {
        baseDraft.body = parseJsonContent(localDraftData.fields.body)
      }
      if (localDraftData?.fields?.lead) {
        baseDraft.lead = parseJsonContent(localDraftData.fields.lead)
      }

      // Обновляем состояние currentDraft
      setCurrentDraft(baseDraft)
      // Обновляем и список drafts
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? baseDraft : d)))

      // Проверяем необходимость синхронизации с сервером
      if (fieldsToApply && hasUnsyncedChanges(draftId)) {
        console.log(`[DraftsProvider] Syncing unsynced changes for draft ${draftId} with server`)

        // Подготавливаем объект для отправки, используя ПОЛЯ ИЗ fieldsToApply
        const draftInput: DraftInput = {
          id: draftId, // Всегда используем ID
          layout: fieldsToApply.layout || baseDraft.layout || 'article',
          title: fieldsToApply.title || baseDraft.title || '',
          subtitle: fieldsToApply.subtitle || baseDraft.subtitle || '',
          // Используем parseJsonContent для body и lead перед отправкой
          lead: parseJsonContent(fieldsToApply.lead || baseDraft.lead || ''),
          slug: fieldsToApply.slug || baseDraft.slug || '',
          body: parseJsonContent(fieldsToApply.body || baseDraft.body || ''),
          cover: fieldsToApply.cover || baseDraft.cover || '',
          cover_caption: fieldsToApply.cover_caption || baseDraft.cover_caption || '',
          // Темы берем из baseDraft, так как localStorage хранит только сериализованные ID
          topic_ids: Array.isArray(baseDraft.topics)
            ? baseDraft.topics
                .filter((topic): topic is Topic => Boolean(topic?.id))
                .map((topic) => topic.id)
            : [],
          // Используем mainTopic (camelCase) как в ExtendedDraft
          main_topic_id: baseDraft.mainTopic?.id || undefined // Используем ID главной темы из baseDraft
          // Добавить author_ids если нужно
        }

        try {
          // Отправляем на сервер
          const result = await updateDraft(draftInput) // updateDraft должен вернуть обновленный черновик
          if (result.data?.update_draft?.draft) {
            console.log(`[DraftsProvider] Successfully synced draft ${draftId} with server.`)
            // Обновляем время последней синхронизации ВНУТРИ КОНТЕКСТА
            updateLastSync(draftId)
            // Сохраняем обновленный с сервера черновик в localStorage
            saveEntireDraft(result.data.update_draft.draft as Draft)
            // Обновляем состояние еще раз данными с сервера
            const serverDraft = {
              ...result.data.update_draft.draft,
              published_at: baseDraft.published_at
            } as ExtendedDraft // Сохраняем published_at если был
            setCurrentDraft(serverDraft)
            setDrafts((prev) => prev.map((d) => (d.id === draftId ? serverDraft : d)))
            return serverDraft
          } else {
            console.error(`[DraftsProvider] Failed to sync draft ${draftId} with server:`, result.error)
            // Не обновляем lastSync, оставляем как есть для повторной попытки
            return baseDraft // Возвращаем текущую лучшую версию
          }
        } catch (syncError) {
          console.error(`[DraftsProvider] Error during server sync for draft ${draftId}:`, syncError)
          // Не обновляем lastSync
          return baseDraft
        }
      }

      return baseDraft // Возвращаем лучшую версию (локальную или серверную)
    } catch (error) {
      console.error(`[DraftsProvider] General error syncing draft ${draftId}:`, error)
      return drafts().find((d) => d.id === draftId) // Возвращаем то, что есть в состоянии
    }
  }

  const getEditorContent = (editorId: string): string => {
    // 1. Попробовать получить из editorsContent (для мгновенного отклика UI)
    const localUiContent = editorsContent()[editorId]
    if (localUiContent !== undefined) {
      // console.log(`[DraftsProvider] getEditorContent ${editorId}: Found in UI state.`);
      return localUiContent
    }

    // 2. Если нет в UI, извлечь из localStorage
    const match = editorId.match(DRAFT_EDITOR_ID_REGEX)
    if (match) {
      const draftId = match[1]
      const fieldType = match[2]
      const storageContent = getDraftField(draftId, fieldType) // Используем новую внутреннюю функцию
      if (storageContent !== null) {
        // console.log(`[DraftsProvider] getEditorContent ${editorId}: Found in localStorage.`);
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
        // console.log(`[DraftsProvider] getEditorContent ${editorId}: Found in currentDraft state.`);
        const draftContent = (draft[fieldName] as string) || ''
        // Обновляем editorsContent для кэширования
        setEditorsContent((prev) => ({ ...prev, [editorId]: draftContent }))
        return draftContent
      }
    }

    // console.log(`[DraftsProvider] getEditorContent ${editorId}: Not found, returning empty.`);
    return ''
  }

  const setEditorContent = (editorId: string, content: string): undefined => {
    // Сохраняем контент как есть, без дополнительных преобразований
    const safeContent = content != null ? String(content) : ''

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
        console.log(`[DraftsProvider] Обновление topic_ids для черновика #${draftId}:`, value)

        // Находим соответствующие темы по их ID
        const draft = currentDraft()
        if (draft && draft.id === draftId) {
          // Обновляем topics в черновике, если он загружен
          const topics = Array.isArray(draft.topics) ? [...draft.topics] : []
          const topicIds = new Set(value as number[])

          // Фильтруем topics, оставляя только те, которые есть в topicIds
          const filteredTopics = topics.filter((topic): topic is Topic =>
            Boolean(topic?.id && topicIds.has(topic.id))
          )

          // Обновляем черновик с отфильтрованными темами
          setCurrentDraft({ ...draft, topics: filteredTopics })

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

    // 4. Обновляем текущий черновик только для не-редакторных полей
    // или для существенных изменений в редакторе
    // чтобы избежать потери фокуса при каждом вводе символа
    if (!isEditorUpdate || (isEditorUpdate && fieldName !== 'body' && fieldName !== 'lead')) {
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

  /**
   * Загружает черновики, которые есть только в localStorage.
   * @returns Массив локальных черновиков.
   */
  const loadLocalDrafts = (): ExtendedDraft[] => {
    const localDraftsData = getAllDraftsFromStorage()
    console.log(`[DraftsProvider] Found ${localDraftsData.length} drafts in localStorage`)

    // Фильтруем локальные черновики, чтобы не дублировать те, что уже есть в drafts()
    const serverDraftIds = new Set(
      drafts()
        .filter((d) => !d.isLocalOnly)
        .map((d) => d.id)
    )

    return localDraftsData
      .filter((local) => !serverDraftIds.has(Number(local.id))) // Отбираем те, которых нет в drafts()
      .map((local): ExtendedDraft => {
        // Преобразуем DraftStorage в ExtendedDraft
        const fields = local.fields || {}
        // ID всегда будет числом после фильтрации
        const draftIdNum = Number(local.id)

        // Обрабатываем timestamp, конвертируя его из секунд в миллисекунды при необходимости
        const timestampMs = validateTimestamp(local.timestamp)

        return {
          // Заполняем поля из fields, преобразуя JSON где нужно
          id: draftIdNum, // Используем числовой ID
          title: fields.title || '',
          subtitle: fields.subtitle || '',
          slug: fields.slug || '',
          layout: (fields.layout as Draft['layout']) || 'article',
          body: parseJsonContent(fields.body || ''),
          lead: parseJsonContent(fields.lead || ''),
          cover: fields.cover || '',
          cover_caption: fields.cover_caption || '',
          created_at: timestampMs, // Используем конвертированный timestamp
          updated_at: timestampMs, // Используем конвертированный timestamp
          // Обязательные поля
          topics: [],
          authors: [], // Добавляем пустой массив для обязательного поля authors
          mainTopic: null, // Локально mainTopic не храним в нужном формате
          // Оставляем только поля, которые есть в Draft/ExtendedDraft
          // Добавляем обязательные поля из Draft, если они нужны
          created_by: { id: 0, slug: '' }, // Заглушка
          community: {
            // Заглушка
            id: 0,
            slug: '',
            name: '',
            pic: '',
            created_at: 0,
            created_by: { id: 0, slug: '' }
          },
          // Специальное поле для локальных черновиков
          isLocalOnly: true,
          // Используем строковое представление ID как localId
          localId: String(draftIdNum)
        }
      })
  }

  /**
   * Удаляет черновик из localStorage.
   * @param draftId ID черновика для удаления.
   * @returns true если удаление успешно.
   */
  const removeLocalDraft = (draftId: number): boolean => {
    // Удаляем из состояния, если он там есть (хотя не должен быть, если он isLocalOnly)
    setDrafts((prev) => prev.filter((d) => !(d.isLocalOnly && d.id === draftId)))
    if (currentDraft()?.isLocalOnly && currentDraft()?.id === draftId) {
      setCurrentDraft(undefined)
    }
    // Удаляем из localStorage
    return removeDraftFromStorage(draftId) // Используем новую внутреннюю функцию
  }

  /**
   * Проверка наличия опубликованной версии с тем же слагом
   * @param {string} slug - Слаг для проверки
   * @returns {Promise<boolean>} - Результат проверки
   */
  const checkPublishedVersion = async (slug: string): Promise<boolean> => {
    if (!slug) return false

    try {
      // Используем запрос get_shout, который возвращает опубликованный материал по слагу
      const response = await client()?.query(loadShoutQuery, { slug })
      return !!response?.data?.get_shout
    } catch (error) {
      console.error(`[DraftsProvider] Ошибка проверки публикации для слага ${slug}: ${error}`)
      return false
    }
  }

  /**
   * Загрузка черновиков с проверкой опубликованных версий
   */
  const loadDrafts = async () => {
    if (isServer || !session()?.token) {
      if (!isServer) {
        console.warn('[DraftsProvider] Not loading drafts: user not logged in')
      }
      return undefined
    }

    setLoading(true)

    try {
      const client_instance = client()
      if (!client_instance) {
        console.error('[DraftsProvider] Client is not initialized')
        setLoading(false)
        return
      }

      const result = await client_instance.query(loadDraftsQuery, {}).toPromise()

      if (result.error || !result.data || !result.data.load_drafts || !result.data.load_drafts.drafts) {
        console.error(
          `[DraftsProvider] Error loading drafts: ${result.error?.message || 'No drafts data received'}`
        )
        // Пытаемся загрузить локальные черновики как фолбэк
        const localDrafts = await loadLocalDraftsAsFallback()
        setDrafts([...localDrafts])
        setLoading(false)
        return
      }

      const draftsData = result.data.load_drafts.drafts
      console.log(`[DraftsProvider] Loaded ${draftsData.length} drafts from server`)

      const serverDrafts = draftsData.map((draft: Draft) => {
        // Обрабатываем даты соответствующим образом
        const created_at = processServerTimestamp(draft.created_at)
        const updated_at = processServerTimestamp(draft.updated_at)

        // ExtendedDraft может содержать published_at
        const extended: ExtendedDraft = {
          ...draft,
          created_at,
          updated_at
        }

        // Обрабатываем published_at, если он есть в данных
        if ('published_at' in draft && draft.published_at !== undefined) {
          // Убеждаемся, что published_at - это число, прежде чем обрабатывать
          const publishedAt = typeof draft.published_at === 'number' ? draft.published_at : undefined
          extended.published_at = processServerTimestamp(publishedAt)
        }

        return extended
      })

      // Загружаем локальные черновики, которых нет в серверных
      const localOnlyDrafts = loadLocalDrafts()

      // Совместно загружаем слитые локальные черновики
      const mergedServerDrafts = await Promise.all(
        serverDrafts.map(async (serverDraft: ExtendedDraft) => {
          // Проверяем локальную версию, если есть
          const localData = getDraftFromStorage(serverDraft.id)
          if (!localData) {
            if (serverDraft.slug) {
              serverDraft.hasPublishedVersion = await checkPublishedVersion(serverDraft.slug)
            }
            return serverDraft
          }

          // Сверяем временные метки
          const localTimestamp = validateTimestamp(localData.timestamp)
          const serverTimestamp = processServerTimestamp(serverDraft.updated_at)

          // Если локальные данные новее, применяем их
          if (localTimestamp > serverTimestamp) {
            const localFields = getAllDraftFields(serverDraft.id) as Partial<Draft>
            return {
              ...serverDraft,
              ...localFields,
              updated_at: localTimestamp
            } as ExtendedDraft
          }

          // Проверяем наличие публикации
          if (serverDraft.slug) {
            serverDraft.hasPublishedVersion = await checkPublishedVersion(serverDraft.slug)
          }

          return serverDraft
        })
      )

      // Объединяем серверные и только локальные черновики
      const allDrafts = [...mergedServerDrafts, ...localOnlyDrafts]

      console.log(`[DraftsProvider] Total drafts after merging: ${allDrafts.length}`)
      setDrafts(allDrafts)
    } catch (error) {
      console.error('[DraftsProvider] Critical error in loadDrafts:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Загружает только локальные черновики как запасной вариант при ошибке сервера
   */
  const loadLocalDraftsAsFallback = async (): Promise<ExtendedDraft[]> => {
    const localDraftsFallback: ExtendedDraft[] = []
    const localMetas = getAllDraftsFromStorage()

    for (const meta of localMetas) {
      const draftId = typeof meta.id === 'string' ? Number.parseInt(meta.id, 10) : meta.id
      if (Number.isNaN(draftId)) continue

      const fields = getAllDraftFields(draftId) as DraftInput & { [key: string]: string | number }
      if (!fields) continue

      const timestamp = validateTimestamp(meta.timestamp || 0)
      const draft: ExtendedDraft = {
        id: draftId,
        title: tryParseJson(fields.title, 'title') || 'Без названия',
        subtitle: tryParseJson(fields.subtitle, 'subtitle') || '',
        lead: tryParseJson(fields.lead, 'lead') || '',
        body: tryParseJson(fields.body, 'body') || '',
        slug: tryParseJson(fields.slug, 'slug') || '',
        cover: tryParseJson(fields.cover, 'cover') || '',
        cover_caption: tryParseJson(fields.cover_caption, 'cover_caption') || '',
        layout: tryParseJson(fields.layout, 'layout') || 'article',
        topics: (tryParseJson(fields.topic_ids || fields.topics, 'topics') || [])
          .map((tid: number) => topicEntities()[tid])
          .filter(Boolean),
        authors: [],
        created_at: timestamp,
        updated_at: timestamp,
        created_by: { id: 0, slug: '' },
        community: {
          id: 0,
          slug: '',
          name: '',
          pic: '',
          created_at: 0,
          created_by: { id: 0, slug: '' }
        },
        isLocalOnly: true
      }

      // Проверяем публикацию
      if (draft.slug) {
        try {
          draft.hasPublishedVersion = await checkPublishedVersion(draft.slug)
        } catch (_e) {
          draft.hasPublishedVersion = false
        }
      }

      localDraftsFallback.push(draft)
    }

    return localDraftsFallback
  }

  const createDraft = async (
    draft: DraftInput
  ): Promise<OperationResult<CreateDraftMutationMutation> | undefined> => {
    console.log('[drafts] creating draft', draft)

    // Проверяем наличие клиента и авторизации
    if (!client()) return Promise.reject(new Error('Client is not initialized'))

    // Проверяем токен авторизации
    if (!session()?.token) return Promise.reject(new Error('No auth token available'))

    // Получаем обновленный клиент после refreshClient
    const currentClient = client()
    if (!currentClient) {
      return Promise.reject(new Error('Client is still not initialized after refresh'))
    }

    const response = await currentClient.mutation(createDraftMutation, { draft_input: draft })
    // console.log('[drafts] create response:', JSON.stringify(response, null, 2))
    if (response?.data?.create_draft?.draft) {
      const newDraft = response.data.create_draft.draft
      // console.log('[drafts] setting drafts with new draft:', newDraft)
      setDrafts([...drafts(), newDraft])
    }
    return response as OperationResult<CreateDraftMutationMutation>
  }

  const updateDraft = async (draft: DraftInput): Promise<OperationResult<UpdateDraftMutationMutation>> => {
    const response = await client()?.mutation(updateDraftMutation, {
      draft_id: draft.id,
      draft_input: draft
    })
    if (response?.data?.update_draft?.draft) {
      setDrafts(drafts().map((d) => (d.id === draft.id ? response.data.update_draft.draft : d)))
    }
    return response as OperationResult<UpdateDraftMutationMutation>
  }

  const deleteDraft = async (draftId: number): Promise<OperationResult<DeleteDraftMutationMutation>> => {
    const response = await client()?.mutation(deleteDraftMutation, { draft_id: draftId })
    if (response?.data?.delete_draft) {
      setDrafts(drafts().filter((d) => d.id !== draftId))
    }
    return response as OperationResult<DeleteDraftMutationMutation>
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

      // Создаем DraftInput для валидации
      const draftInput: DraftInput = {
        id: draftId,
        layout: draftToPublish.layout || 'article',
        title: draftToPublish.title || '',
        subtitle: draftToPublish.subtitle || '',
        lead: draftToPublish.lead || '',
        body: draftToPublish.body || '',
        slug: draftToPublish.slug || '',
        cover: draftToPublish.cover || '',
        cover_caption: draftToPublish.cover_caption || '',
        topic_ids: Array.isArray(draftToPublish.topics)
          ? draftToPublish.topics
              .filter((topic): topic is Topic => Boolean(topic?.id))
              .map((topic) => topic.id)
          : [],
        main_topic_id: draftToPublish.mainTopic?.id || null,
        seo: draftToPublish.seo || '',
        author_ids: draftToPublish.authors?.map((a) => a?.id).filter((id): id is number => !!id) || []
      }

      // Проводим валидацию перед публикацией
      const validationResult = validateDraftForPublishing(draftInput)
      if (!validationResult.isValid) {
        console.error(`[DraftsProvider] Черновик #${draftId} не прошел валидацию:`, validationResult.errors)

        // Формируем объект с ошибками для поддержки уже существующего кода
        const errorsMap: Partial<Record<keyof DraftInput, string>> = {}
        validationResult.errors.forEach((error) => {
          if (error.field) {
            errorsMap[error.field] = error.message
          }
        })

        // Устанавливаем ошибки в состояние для отображения
        setValidationErrors(errorsMap)

        // Возвращаем объект с ошибкой для обработки в компоненте
        return {
          data: {
            publish_draft: {
              error: 'Пожалуйста исправьте ошибки',
              draft: null
            }
          }
        } as OperationResult<PublishDraftMutationMutation>
      }

      // Очищаем ошибки валидации перед публикацией
      clearValidationErrors()

      // Публикуем черновик
      const response = await client()?.mutation(publishDraftMutation, { draft_id: draftId })

      if (response?.data?.publish_draft?.draft) {
        setDrafts(drafts().map((d) => (d.id === draftId ? response.data.publish_draft.draft : d)))
        console.log(`[DraftsProvider] Успешно опубликован черновик #${draftId}`)
      } else if (response?.data?.publish_draft?.error) {
        console.error(
          `[DraftsProvider] Ошибка при публикации черновика #${draftId}:`,
          response.data.publish_draft.error
        )
      }

      return response as OperationResult<PublishDraftMutationMutation>
    } catch (error) {
      console.error(`[DraftsProvider] Критическая ошибка при публикации черновика #${draftId}:`, error)
      throw error
    }
  }

  const unpublishShout = async (
    shoutId: number
  ): Promise<OperationResult<UnpublishShoutMutationMutation>> => {
    try {
      // Перед снятием с публикации отображаем статус загрузки
      console.log(`[DraftsProvider] Снимаем с публикации статью #${shoutId}...`)

      // Выполняем запрос на снятие с публикации
      const response = await client()?.mutation(unpublishShoutMutation, { shout_id: shoutId })

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
            console.log(
              `[DraftsProvider] Найден черновик в списке после снятия публикации: ${updatedDraft.id}`
            )

            // Если текущий черновик имеет тот же ID, обновляем его
            if (currentDraft()?.id === shoutId) {
              setCurrentDraft(updatedDraft)
            }

            // Обновляем список черновиков, устанавливая published_at в null
            setDrafts(
              drafts().map((d) => {
                if (d.id === shoutId) {
                  return {
                    ...d,
                    published_at: null,
                    publication: d.publication ? { ...d.publication, published_at: null } : null
                  } as ExtendedDraft
                }
                return d
              })
            )

            return response as OperationResult<UnpublishShoutMutationMutation>
          }

          console.warn(
            `[DraftsProvider] После loadDrafts() не найден черновик с ID=${shoutId} в списке drafts`
          )
        } else {
          console.error('[DraftsProvider] Ответ на снятие публикации не содержит данных shout')
        }
      } else if (response?.error) {
        console.error(
          `[DraftsProvider] Ошибка при снятии публикации для статьи #${shoutId}:`,
          response.error
        )
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
  const removeDraftByKeyFromStorage = (key: string): boolean => {
    if (isServer || !key) return false
    // Проверяем, начинается ли ключ с ожидаемого префикса для безопасности
    if (!key.startsWith('draft-fields-')) {
      console.warn(`[DraftsProvider] Attempted to remove item with unexpected key: ${key}`)
      return false
    }
    try {
      localStorage.removeItem(key)
      console.debug(`[DraftsProvider] Removed item with key ${key} from storage.`)
      return true
    } catch (e) {
      console.error(`[DraftsProvider] Error removing item with key ${key} from storage:`, e)
      return false
    }
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

    // Собираем DraftInput из текущего черновика
    const draftInput: DraftInput = {
      id: draft.id,
      layout: draft.layout || 'article',
      title: draft.title || '',
      subtitle: draft.subtitle || '',
      lead: draft.lead || '',
      body: draft.body || '',
      slug: draft.slug || '',
      cover: draft.cover || '',
      cover_caption: draft.cover_caption || '',
      // Убеждаемся, что topic_ids - это массив чисел
      topic_ids: Array.isArray(draft.topics)
        ? draft.topics
            .filter((t): t is Topic => t !== null && t !== undefined && typeof t.id === 'number')
            .map((t) => t.id)
        : [],
      main_topic_id: draft.mainTopic?.id || null,
      seo: draft.seo || '',
      author_ids: Array.isArray(draft.authors)
        ? draft.authors
            .filter((a): a is Author => a !== null && a !== undefined && typeof a.id === 'number')
            .map((a) => a.id)
        : []
    }

    console.log('[DraftsProvider] Валидация черновика:', {
      draftId: draft.id,
      topicIds: draftInput.topic_ids,
      mainTopicId: draftInput.main_topic_id
    })

    const validationResult = validateDraftForPublishing(draftInput)

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
   * Проверяет квоту хранилища и обновляет предупреждения
   */
  const checkStorageQuotaWarning = () => {
    const quota = checkStorageQuota()
    setStorageQuotaWarning(quota.warning)

    if (quota.warning) {
      console.warn(`[DraftsProvider] Storage quota warning: ${(quota.percentage * 100).toFixed(1)}% used`)
    }
  }

  /**
   * Получает статус синхронизации черновика
   * @param draftId ID черновика
   * @returns Статус синхронизации
   */
  const getDraftSyncStatus = (draftId: string | number): SyncStatus => {
    return getSyncStatus(draftId)
  }

  /**
   * Выполняет периодическую очистку и обновление статистики
   */
  const performMaintenanceTasks = () => {
    // Периодическая очистка старых черновиков
    const deletedCount = performPeriodicCleanup()
    if (deletedCount > 0) {
      // Обновляем список черновиков после очистки
      loadLocalDrafts()
    }

    // Проверяем квоту хранилища
    checkStorageQuotaWarning()
  }

  /**
   * Получает детальную статистику хранилища
   * @returns Статистика offline хранилища
   */
  const getOfflineStorageStats = () => {
    return getStorageStats()
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
    loadLocalDrafts,
    removeLocalDraft,
    checkPublishedVersion,
    removeDraftByKey: removeDraftByKeyFromStorage,
    validationErrors,
    validateCurrentDraft,
    clearValidationErrors,
    loading,
    // Новые функции для работы с OfflineStatus
    storageQuotaWarning,
    getDraftSyncStatus,
    getOfflineStorageStats,
    performMaintenanceTasks
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}

// Экспортируем тип DraftInput для использования в других компонентах
export type { DraftInput } from '~/graphql/schema/core.gen'

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
