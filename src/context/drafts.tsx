import { OperationResult } from '@urql/core'
import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'

import { sanitizeHtml } from '~/components/SimpleRichEditor/lib/sanitize'
import { EditorData, EditorFieldType } from '~/components/SimpleRichEditor/lib/types'
import unpublishShoutMutation from '~/graphql/mutation/core/article-unpublish'
import createDraftMutation from '~/graphql/mutation/core/draft-create'
import deleteDraftMutation from '~/graphql/mutation/core/draft-delete'
import publishDraftMutation from '~/graphql/mutation/core/draft-publish'
import updateDraftMutation from '~/graphql/mutation/core/draft-update'
import loadShoutQuery from '~/graphql/query/core/article-load'
import loadDraftsQuery from '~/graphql/query/core/drafts-load'
import type {
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

const DRAFT_PREFIX = 'draft-fields-' // Префикс для хранения черновиков

/**
 * Интерфейс для полного черновика в localStorage
 */
interface DraftStorage {
  id: string | number
  fields: Record<string, string>
  timestamp: number
  lastSync?: number
  source: 'server' | 'local'
}

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

/**
 * Очищает строку от JSON-обертки и извлекает чистый контент
 * @param content Строка с контентом, возможно в JSON формате
 * @returns Очищенный контент без JSON-обертки
 */
const cleanupJsonContent = (content: string | null | undefined | Record<string, unknown>): string => {
  if (content === null || content === undefined) return ''

  // Если это не строка, пробуем преобразовать
  if (typeof content !== 'string') {
    // Если это объект с полем content, сразу извлекаем его
    if (content && typeof content === 'object' && 'content' in content) {
      return cleanupJsonContent(content.content as string | null | undefined)
    }

    // Пробуем преобразовать в строку
    try {
      return String(content)
    } catch (_e) {
      return ''
    }
  }

  // Убедимся, что работаем со строкой
  const contentStr = String(content)

  // Проверяем, не начинается ли строка с фрагмента HTML
  // Если это очевидно HTML, возвращаем как есть
  if (contentStr.trim().startsWith('<') && contentStr.trim().endsWith('>')) {
    return contentStr
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
          return cleanupJsonContent(parsed.content)
        }

        // Проверяем, может быть это массив с первым элементом, содержащим content
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          typeof parsed[0] === 'object' &&
          'content' in parsed[0]
        ) {
          return cleanupJsonContent(parsed[0].content)
        }
      }
    }
  } catch (_parseError) {
    // В случае ошибки парсинга JSON, возвращаем как есть
  }

  return contentStr
}

/**
 * Пытается распарсить JSON, но возвращает исходную строку при ошибке.
 * @param content Строка, возможно JSON.
 * @returns Распарсенный объект или исходная строка.
 */
const parseJsonContent = (content?: string): string => {
  if (!content) return ''
  return cleanupJsonContent(content)
}

/**
 * Формирует ключ для хранения черновика в localStorage.
 * @param draftId ID черновика.
 * @returns Ключ для localStorage.
 */
const getDraftKey = (draftId: string | number): string => {
  return `${DRAFT_PREFIX}${draftId}`
}

/**
 * Получает полный объект черновика из localStorage.
 * @param draftId ID черновика.
 * @returns Объект DraftStorage или null.
 */
const getDraftFromStorage = (draftId: string | number): DraftStorage | null => {
  if (isServer || !draftId) return null
  try {
    const key = getDraftKey(draftId)
    const data = localStorage.getItem(key)
    if (!data) return null
    return JSON.parse(data) as DraftStorage
  } catch (e) {
    console.error(`[DraftsProvider] Error getting draft ${draftId} from storage:`, e)
    return null
  }
}

/**
 * Сохраняет полный объект черновика в localStorage.
 * @param draft Объект DraftStorage для сохранения.
 * @returns true в случае успеха, false при ошибке.
 */
const saveDraftToStorage = (draft: DraftStorage): boolean => {
  if (isServer || !draft?.id) return false
  try {
    const key = getDraftKey(draft.id)
    localStorage.setItem(key, JSON.stringify(draft))
    return true
  } catch (e) {
    console.error(`[DraftsProvider] Error saving draft ${draft.id} to storage:`, e)
    return false
  }
}

/**
 * Получает значение конкретного поля черновика из localStorage.
 * @param draftId ID черновика.
 * @param fieldName Имя поля.
 * @returns Значение поля (строка) или null.
 */
const getDraftField = (draftId: string | number, fieldName: string): string | null => {
  if (isServer || !draftId || !fieldName) return null
  const draft = getDraftFromStorage(draftId)
  return draft?.fields?.[fieldName] || null
}

/**
 * Сохраняет значение конкретного поля черновика в localStorage.
 * Если черновика нет, создает его.
 * @param draftId ID черновика.
 * @param fieldName Имя поля.
 * @param fieldValue Значение поля (строка).
 * @returns true в случае успеха, false при ошибке.
 */
const saveDraftFieldInternal = (
  draftId: string | number,
  fieldName: string,
  fieldValue: string | null | undefined
): boolean => {
  if (isServer || !draftId || !fieldName) return false

  // Приводим ID к числу для консистентности
  const draftIdNum = Number(draftId)
  if (Number.isNaN(draftIdNum)) {
    console.error(`[DraftsProvider] Invalid draftId: ${draftId}`)
    return false
  }

  try {
    const draft = getDraftFromStorage(draftIdNum) || {
      id: draftIdNum,
      fields: {},
      timestamp: Date.now(),
      source: 'local'
    }

    const currentTimestamp = Date.now()
    let updated = false

    if (fieldValue === null || fieldValue === undefined) {
      // Удаление поля
      if (draft.fields[fieldName]) {
        delete draft.fields[fieldName]
        updated = true
      }
    } else {
      // Обновление или добавление поля
      const valueStr = String(fieldValue)
      if (draft.fields[fieldName] !== valueStr) {
        draft.fields[fieldName] = valueStr
        updated = true
      }
    }

    if (updated) {
      draft.timestamp = currentTimestamp // Обновляем общую временную метку черновика
      return saveDraftToStorage(draft)
    }

    return true // Поле не изменилось, считаем успехом
  } catch (e) {
    console.error(`[DraftsProvider] Error saving field "${fieldName}" for draft ${draftIdNum}:`, e)
    return false
  }
}

/**
 * Получает все поля черновика из localStorage как объект DraftInput.
 * ВАЖНО: Этот метод возвращает только поля, хранящиеся в localStorage.
 * Он НЕ объединяет их с данными из серверного состояния.
 * @param draftId ID черновика.
 * @returns Объект DraftInput со значениями полей или null.
 */
const getAllDraftFields = (draftId: string | number): DraftInput | null => {
  if (isServer || !draftId) return null
  const draftIdNum = Number(draftId)
  if (Number.isNaN(draftIdNum)) return null

  const draft = getDraftFromStorage(draftIdNum)
  if (!draft || !draft.fields) return null

  // Преобразуем в формат DraftInput
  const fields: Partial<DraftInput> = {}
  for (const key in draft.fields) {
    if (Object.hasOwnProperty.call(draft.fields, key)) {
      if (key === 'body' || key === 'lead') {
        // biome-ignore lint/suspicious/noExplicitAny: Используем типизацию для обхода ошибки индексации
        ;(fields as any)[key] = parseJsonContent(draft.fields[key])
      } else if (key !== 'topics' && key !== 'mainTopic') {
        // biome-ignore lint/suspicious/noExplicitAny: Используем типизацию для обхода ошибки индексации
        ;(fields as any)[key] = draft.fields[key]
      }
    }
  }

  return fields as DraftInput
}

/**
 * Обновляет временную метку последней синхронизации черновика в localStorage.
 * @param draftId ID черновика.
 * @returns true в случае успеха, false при ошибке.
 */
const updateLastSync = (draftId: string | number): boolean => {
  if (isServer || !draftId) return false
  try {
    const draft = getDraftFromStorage(draftId)
    if (!draft) {
      console.warn(`[DraftsProvider] Draft ${draftId} not found in storage to update lastSync.`)
      return false
    }
    draft.lastSync = Date.now()
    draft.timestamp = draft.lastSync // Обновляем и общую метку
    return saveDraftToStorage(draft)
  } catch (e) {
    console.error(`[DraftsProvider] Error updating lastSync for draft ${draftId}:`, e)
    return false
  }
}

/**
 * Проверяет, есть ли у черновика в localStorage несинхронизированные изменения.
 * Сравнивает `timestamp` и `lastSync`.
 * @param draftId ID черновика.
 * @returns true, если есть несинхронизированные изменения, иначе false.
 */
const hasUnsyncedChanges = (draftId: string | number): boolean => {
  if (isServer || !draftId) return false
  const draft = getDraftFromStorage(draftId)
  if (!draft) return false
  return !draft.lastSync || draft.timestamp > draft.lastSync
}

/**
 * Сохраняет полный объект Draft (из GraphQL) в localStorage.
 * Перезаписывает существующие поля.
 * @param draft Объект Draft.
 * @returns true в случае успеха, false при ошибке.
 */
const saveEntireDraft = (draft: Draft): boolean => {
  if (isServer || !draft?.id) return false
  try {
    const draftId = draft.id
    const storageDraft: DraftStorage = {
      id: draftId,
      fields: {},
      timestamp: Date.now(),
      source: 'server', // Помечаем как данные с сервера
      lastSync: Date.now() // Считаем свежесинхронизированным
    }

    // Копируем все поля из Draft в fields, кроме вложенных объектов/массивов
    for (const key in draft) {
      if (Object.hasOwnProperty.call(draft, key)) {
        const value = draft[key as keyof Draft]
        if (key !== 'id' && key !== '__typename' && typeof value !== 'object' && value !== null) {
          storageDraft.fields[key] = String(value)
        } else if (key === 'topics' && Array.isArray(value)) {
          // Сериализуем topics как JSON строку id тем
          // Фильтруем null/undefined элементы перед маппингом
          storageDraft.fields['topics'] = JSON.stringify(
            value.filter((t): t is Topic => !!t).map((t) => ({ id: t.id, title: t.title, slug: t.slug }))
          )
        } else if (key === 'main_topic' && value && typeof value === 'object' && 'id' in value) {
          // Явно проверяем наличие id, title, slug перед использованием
          const mainTopic = value as Topic // Приведение типа для доступа к полям
          if (mainTopic.id) {
            storageDraft.fields['mainTopic'] = JSON.stringify({
              id: mainTopic.id,
              title: mainTopic.title || '',
              slug: mainTopic.slug || ''
            })
          }
        }
        // Добавить обработку других специфичных полей при необходимости
      }
    }

    // Устанавливаем source и lastSync
    storageDraft.source = 'server'
    storageDraft.lastSync = Date.now()
    storageDraft.timestamp = storageDraft.lastSync // Обновляем timestamp

    console.debug(`[DraftsProvider] Saving entire draft ${draftId} from server to storage.`)
    return saveDraftToStorage(storageDraft)
  } catch (e) {
    console.error(`[DraftsProvider] Error saving entire draft ${draft.id} to storage:`, e)
    return false
  }
}

/**
 * Получает все черновики, сохраненные в localStorage.
 * @returns Массив объектов DraftStorage.
 */
const getAllDraftsFromStorage = (): DraftStorage[] => {
  if (isServer) return []
  const drafts: DraftStorage[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(DRAFT_PREFIX)) {
        const draftId = key.substring(DRAFT_PREFIX.length)
        const draft = getDraftFromStorage(draftId)
        if (draft) {
          drafts.push(draft)
        }
      }
    }
  } catch (e) {
    console.error('[DraftsProvider] Error getting all drafts from storage:', e)
  }
  return drafts
}

/**
 * Удаляет черновик из localStorage.
 * @param draftId ID черновика.
 * @returns true в случае успеха, false при ошибке.
 */
const removeDraftFromStorage = (draftId: string | number): boolean => {
  if (isServer || !draftId) return false
  try {
    const key = getDraftKey(draftId)
    localStorage.removeItem(key)
    console.debug(`[DraftsProvider] Removed draft ${draftId} from storage.`)
    return true
  } catch (e) {
    console.error(`[DraftsProvider] Error removing draft ${draftId} from storage:`, e)
    return false
  }
}

const EDITOR_KEY_REGEX = /draft-(\d+)-([a-z]+)/

/**
 * Сохраняет контент конкретного поля редактора.
 * @param editorId ID редактора (например, "draft-123-body")
 * @param fieldType Тип поля ("body", "lead")
 * @param content Контент для сохранения
 * @param isEmpty Флаг, пустое ли содержимое
 * @returns true в случае успеха
 */
const saveEditorContent = (
  editorId: string,
  fieldType: EditorFieldType,
  content: string,
  isEmpty: boolean
): boolean => {
  const match = editorId.match(EDITOR_KEY_REGEX)
  if (!match) {
    console.error(`[DraftsProvider] Could not extract draftId and fieldType from editorId: ${editorId}`)
    return false
  }

  const draftId = match[1]
  const actualFieldType = match[2] // Используем тип из ID

  // Проверяем соответствие fieldType, если он передан
  if (fieldType && fieldType !== actualFieldType) {
    console.warn(
      `[DraftsProvider] Mismatch between editorId field (${actualFieldType}) and provided fieldType (${fieldType}) for ${editorId}.`
    )
  }

  // Сохраняем пустую строку, если isEmpty true, иначе сам контент
  return saveDraftFieldInternal(draftId, actualFieldType, isEmpty ? '' : content)
}

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
  setCurrentDraft: (draft?: ExtendedDraft) => void
  getEditorContent: (editorId: string) => string
  setEditorContent: (editorId: string, content: string) => void
  loadDrafts: () => Promise<void>
  createDraft: (draft: DraftInput) => Promise<OperationResult<CreateDraftMutationMutation>>
  updateDraft: (draft: DraftInput) => Promise<OperationResult<UpdateDraftMutationMutation>>
  deleteDraft: (id: number) => Promise<OperationResult<DeleteDraftMutationMutation>>
  publishDraft: (draftId: number) => Promise<OperationResult<PublishDraftMutationMutation>>
  unpublishShout: (shoutId: number) => Promise<OperationResult<UnpublishShoutMutationMutation>>
  isEditorPanelVisible: Accessor<boolean>
  toggleEditorPanel: () => void
  setIsEditorPanelVisible: (visible: boolean) => void
  syncDraft: (draftId: number) => Promise<ExtendedDraft | undefined>
  updateDraftField: (
    draftId: number,
    fieldName: keyof DraftInput,
    value: string | EditorData,
    isEditorUpdate: boolean
  ) => void
  loadLocalDrafts: () => ExtendedDraft[]
  removeLocalDraft: (draftId: number) => boolean
  checkPublishedVersion: (slug: string) => Promise<boolean>
  removeDraftByKey: (key: string) => boolean
  validationErrors: Accessor<Partial<Record<keyof DraftInput, string>>>
  validateCurrentDraft: () => Promise<boolean>
  clearValidationErrors: () => void
  loading: Accessor<boolean>
}

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

  // Создаем дебаунсированную функцию сохранения контента редактора в localStorage
  const debouncedSaveContent = debounce(AUTO_SAVE_DELAY, (editorId: string, content: string) => {
    // Используем новую внутреннюю функцию saveEditorContent
    saveEditorContent(editorId, '' as EditorFieldType, content, content === '') // fieldType здесь не так важен, т.к. он извлекается из editorId
    console.log(`[DraftsProvider] Debounced save for editor ${editorId}`)
    // Здесь НЕ вызываем updateDraft, т.к. это делается в updateDraftField
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
          topic_ids: baseDraft.topics
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

  const setEditorContent = (editorId: string, content: string) => {
    const safeContent = content != null ? String(content) : ''

    // 1. Обновляем локальное состояние UI (editorsContent)
    setEditorsContent((prev) => ({ ...prev, [editorId]: safeContent }))

    // 2. Запускаем дебаунсированное сохранение в localStorage
    debouncedSaveContent(editorId, safeContent)

    // 3. Обновляем поле в currentDraft для консистентности (опционально, т.к. syncDraft должен все поправить)
    const match = editorId.match(DRAFT_EDITOR_ID_REGEX)
    if (match && currentDraft()) {
      const draftId = Number(match[1])
      const fieldName = match[2] as keyof DraftInput

      if (currentDraft()?.id === draftId) {
        setCurrentDraft((prev) => {
          if (!prev || !(fieldName in prev)) return prev
          // Не используем parseJsonContent здесь, храним как пришло из редактора
          return { ...prev, [fieldName]: safeContent }
        })
      }
    }
  }

  // Функция для обновления поля черновика с обработкой EditorData и сохранением
  const updateDraftField = (
    draftId: number,
    fieldName: keyof DraftInput,
    value: string | EditorData,
    isEditorUpdate: boolean
  ) => {
    if (!draftId) return

    let cleanValue: string

    // 1. Обработка/санитизация значения
    if (typeof value === 'object' && value !== null && 'content' in value) {
      // Если это EditorData, извлекаем и санитизируем HTML
      cleanValue = sanitizeHtml(value.content) // Санитизация здесь
    } else if (typeof value === 'string') {
      // Если это строка, санитизируем ее (на всякий случай, если это HTML)
      // Пропускаем санитизацию для slug и других не-HTML полей
      if (
        fieldName === 'body' ||
        fieldName === 'lead' ||
        fieldName === 'subtitle' /* добавь другие HTML поля */
      ) {
        cleanValue = sanitizeHtml(value)
      } else {
        cleanValue = value // Не санитизируем title, slug, cover и т.д.
      }
    } else {
      // Для других типов (например, number для topic_ids) преобразуем в строку
      cleanValue = String(value)
    }

    // 2. Сохранение в localStorage через внутреннюю функцию
    // Используем parseJsonContent перед сохранением body/lead, чтобы сохранить чистый HTML
    const valueToStore =
      fieldName === 'body' || fieldName === 'lead'
        ? parseJsonContent(cleanValue) // Парсим/очищаем от JSON перед сохранением
        : cleanValue
    const saved = saveDraftFieldInternal(draftId, fieldName, valueToStore) // Используем новую внутреннюю

    if (!saved) {
      console.error(`[DraftsProvider] Failed to save field "${fieldName}" for draft ${draftId} to storage.`)
      // Можно добавить обработку ошибки, например, toast
      return
    }

    // 3. Обновление локального состояния (currentDraft)
    setCurrentDraft((prev) => {
      if (!prev || prev.id !== draftId) return prev
      // Обновляем поле в текущем черновике. Используем cleanValue для UI.
      return { ...prev, [fieldName]: cleanValue }
    })

    // 4. Обновление состояния editorsContent, если это поле редактора
    if (isEditorUpdate && (fieldName === 'body' || fieldName === 'lead')) {
      const editorId = `draft-${draftId}-${fieldName}`
      // Используем cleanValue, т.к. editorsContent для UI
      setEditorsContent((prev) => ({ ...prev, [editorId]: cleanValue }))
    }

    // 5. TODO: Интеграция с Awareness Provider - отправка обновлений
    // const awarenessProvider = getProvider(); // Получить провайдер
    // if (awarenessProvider && awarenessProvider.getConnectionState() === 'connected') {
    //   awarenessProvider.updateDraftField(
    //     draftId,
    //     fieldName,
    //     cleanValue, // Отправляем очищенное значение
    //     (fieldName === 'body' || fieldName === 'lead') ? isEmptyContent(cleanValue) : false // isEmptyContent нужно будет перенести или импортировать
    //   );
    // }

    // 6. Запуск (неявный) синхронизации с сервером, т.к. saveDraftFieldInternal обновил timestamp
    // syncDraft будет вызван при необходимости (например, при переключении черновика или принудительно)
    // Можно добавить явный вызов debounced server sync здесь, если нужно чаще сохранять на сервер
    // debouncedSyncToServer(draftId); // Потребуется создать такую функцию
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
          created_by: { id: 0, slug: '', user: '' }, // Заглушка
          community: {
            // Заглушка
            id: 0,
            slug: '',
            name: '',
            pic: '',
            created_at: 0,
            created_by: { id: 0, slug: '', user: '' }
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
    if (isServer || !session()?.access_token) {
      if (!isServer) {
        console.warn('[DraftsProvider] Not loading drafts: user not logged in')
      }
      return
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
        created_by: { id: 0, slug: '', user: '' },
        community: {
          id: 0,
          slug: '',
          name: '',
          pic: '',
          created_at: 0,
          created_by: { id: 0, slug: '', user: '' }
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

  const createDraft = async (draft: DraftInput): Promise<OperationResult<CreateDraftMutationMutation>> => {
    console.log('[drafts] creating draft', draft)
    const response = await client()?.mutation(createDraftMutation, { draft_input: draft })
    console.log('[drafts] create response:', JSON.stringify(response, null, 2))
    if (response?.data?.create_draft?.draft) {
      const newDraft = response.data.create_draft.draft
      console.log('[drafts] setting drafts with new draft:', newDraft)
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

      // Извлекаем идентификаторы тем
      const topicIds =
        draftToPublish.topics
          ?.filter((topic): topic is Topic => Boolean(topic?.id))
          .map((topic) => topic.id) || []

      // Проверяем наличие тем перед публикацией
      if (topicIds.length) {
        console.log(
          `[DraftsProvider] У черновика #${draftId} найдено ${topicIds.length} тем: ${topicIds.join(', ')}`
        )
      } else {
        console.warn(`[DraftsProvider] У черновика #${draftId} отсутствуют темы, пытаемся добавить`)

        // Получаем все доступные темы через useTopics
        const availableTopics = Object.values(topicEntities())
        if (availableTopics.length) {
          // Берем первую доступную тему как запасной вариант
          const defaultTopicId = availableTopics[0].id
          console.log(
            `[DraftsProvider] Используем тему по умолчанию ID=${defaultTopicId} для черновика #${draftId}`
          )

          // Обновляем черновик с темой по умолчанию
          const updatedDraft: DraftInput = {
            id: draftId,
            topic_ids: [defaultTopicId],
            main_topic_id: defaultTopicId
          }

          await updateDraft(updatedDraft)
        } else {
          console.warn(
            `[DraftsProvider] Нет доступных тем для черновика #${draftId}, публикация может завершиться ошибкой`
          )
        }
      }

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
    const response = await client()?.mutation(unpublishShoutMutation, { shout_id: shoutId })

    if (response?.data?.unpublish_shout) {
      // Получаем shout из ответа
      const shoutData = response.data.unpublish_shout.shout

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

          return response as OperationResult<UnpublishShoutMutationMutation>
        }

        console.warn(
          `[DraftsProvider] После loadDrafts() не найден черновик с ID=${shoutId} в списке drafts`
        )
      } else {
        console.error('[DraftsProvider] Ответ на снятие публикации не содержит данных shout')
      }
    } else if (response?.error) {
      console.error(`[DraftsProvider] Ошибка при снятии публикации для статьи #${shoutId}:`, response.error)
    }

    return response as OperationResult<UnpublishShoutMutationMutation>
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
    if (!key.startsWith(DRAFT_PREFIX)) {
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
      topic_ids:
        draft.topics?.map((t) => t?.id).filter((id): id is number => typeof id === 'number' && id > 0) ||
        [],
      main_topic_id: draft.mainTopic?.id || null,
      seo: draft.seo || '',
      author_ids: draft.authors?.map((a) => a?.id).filter((id): id is number => !!id) || []
    }

    const validationResult = validateDraftForPublishing(draftInput)

    if (validationResult.isValid) {
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
      setValidationErrors(errorsMap)
      return false
    }
  }

  /**
   * Очищает ошибки валидации.
   */
  const clearValidationErrors = () => {
    setValidationErrors({})
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
    loading
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}

// Экспортируем тип DraftInput для использования в других компонентах
export type { DraftInput } from '~/graphql/schema/core.gen'
