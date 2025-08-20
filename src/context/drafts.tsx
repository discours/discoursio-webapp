import { OperationResult } from '@urql/core'
import { Accessor, batch, createContext, createSignal, JSX, onCleanup, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
// Импортируем функции из storage.ts вместо дублирования
import {
  clearAllDraftKeys,
  getAllDraftFields,
  getAllDraftsFromStorage,
  getDraftField,
  getDraftFromStorage,
  getStorageStats,
  getSyncStatus,
  parseJsonContent,
  performPeriodicCleanup,
  removeDraftFromStorage,
  type SyncStatus,
  saveDraftField as saveDraftFieldStorage,
  saveEntireDraft
} from '~/components/SimpleRichEditor/lib/storage'
import { EditorData } from '~/components/SimpleRichEditor/lib/types'
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
} from '~/graphql/generated/graphql'
import unpublishShoutMutation from '~/graphql/mutation/core/article-unpublish'
import createDraftMutation from '~/graphql/mutation/core/draft-create'
import deleteDraftMutation from '~/graphql/mutation/core/draft-delete'
import publishDraftMutation from '~/graphql/mutation/core/draft-publish'
import updateDraftMutation from '~/graphql/mutation/core/draft-update'
import loadShoutQuery from '~/graphql/query/core/article-load'
import loadDraftsQuery from '~/graphql/query/core/drafts-load'
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
    console.warn(`[drafts] Invalid timestamp detected: ${new Date(ts).toISOString()}, using current time instead`)
    return now
  }

  return ts
}

const EDITOR_KEY_REGEX = /draft-(\d+)-([a-z]+)/

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
  clearAllLocalDrafts: () => number
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
  const [validationErrors, setValidationErrors] = createSignal<Partial<Record<keyof DraftInput, string>>>({})
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
    // Получаем локальные данные
    const localDraftData = getDraftFromStorage(draftId)

    try {
      // Для черновика без локальных данных просто возвращаем текущий объект
      if (!localDraftData && currentDraftObj) {
        console.log(
          `[DraftsProvider] Не найдены локальные данные для черновика #${draftId}, используем серверную версию`
        )
        return currentDraftObj
      }

      // Определяем более свежую версию (по timestamp)
      const serverTimestamp = currentDraftObj?.updated_at ? processServerTimestamp(currentDraftObj.updated_at) : 0
      const localTimestamp = validateTimestamp(localDraftData?.timestamp || 0)

      // Выводим подробную информацию о timestamp для отладки
      console.log(`[DraftsProvider] Сравнение timestamp черновика #${draftId}:`, {
        serverTimestamp: new Date(serverTimestamp).toLocaleString(),
        localTimestamp: new Date(localTimestamp).toLocaleString(),
        isLocalNewer: localTimestamp > serverTimestamp
      })

      let baseDraft: ExtendedDraft

      // Оба черновика существуют, нужно сравнить их
      if (currentDraftObj && localDraftData) {
        // Если есть slug, используем его для определения связи между черновиками
        if (currentDraftObj.slug && localDraftData.fields?.slug) {
          console.log('[DraftsProvider] Обнаружены slug для сравнения:', {
            serverSlug: currentDraftObj.slug,
            localSlug: localDraftData.fields.slug
          })

          // Если slug совпадают, это один и тот же черновик
          if (currentDraftObj.slug === localDraftData.fields.slug) {
            console.log('[DraftsProvider] Slug совпадают, это один и тот же черновик')

            // Проверяем timestamp, чтобы определить более свежую версию
            if (localTimestamp > serverTimestamp) {
              console.log(
                `[DraftsProvider] Локальная версия черновика #${draftId} новее. Используем локальную как базу.`
              )
              // Создаем базовый черновик с данными из сервера, но только с нужными полями
              baseDraft = {
                ...currentDraftObj,
                local_id: `local-${draftId}`,
                updated_at: localTimestamp
              } as ExtendedDraft

              // Переносим все поля из локального хранилища
              const localFields = localDraftData.fields || {}
              Object.keys(localFields).forEach((key) => {
                if (key in baseDraft) {
                  // Используем индексированный доступ через as с неявным приведением
                  // biome-ignore lint/suspicious/noExplicitAny: Необходимо для динамического доступа к свойствам ExtendedDraft
                  ;(baseDraft as any)[key] = parseJsonContent(localFields[key])
                }
              })
            } else {
              console.log(
                `[DraftsProvider] Серверная версия черновика #${draftId} новее или равна локальной. Не синхронизируем.`
              )
              // Добавляем только необходимые поля ExtendedDraft
              baseDraft = {
                ...currentDraftObj,
                local_id: `local-${draftId}`
              } as ExtendedDraft
              return baseDraft
            }
          } else {
            // Разные slug - разные черновики
            console.log('[DraftsProvider] Slug не совпадают, это разные черновики:', {
              serverSlug: currentDraftObj.slug,
              localSlug: localDraftData.fields.slug
            })
            baseDraft = {
              ...currentDraftObj,
              local_id: `local-${draftId}`
            } as ExtendedDraft
            return baseDraft
          }
        } else {
          // Нет slug, используем timestamp
          if (localTimestamp > serverTimestamp) {
            console.log(
              `[DraftsProvider] Локальная версия черновика #${draftId} новее (по timestamp). Используем локальную как базу.`
            )
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
                created_by: { id: 0, slug: '' }
              },
              created_by: { id: 0, slug: '' },
              title: '',
              slug: '',
              layout: 'article',
              topics: [],
              authors: []
            }

            baseDraft = {
              ...serverBase,
              local_id: `local-${draftId}`,
              updated_at: localTimestamp
            } as ExtendedDraft

            // Применяем поля из localStorage
            const localFields = getAllDraftFields(draftId) || {}
            Object.keys(localFields).forEach((key) => {
              const fieldName = key as keyof typeof localFields
              // Индексированный доступ
              // biome-ignore lint/suspicious/noExplicitAny: Необходимо для динамического доступа к свойствам ExtendedDraft
              ;(baseDraft as any)[fieldName] = localFields[fieldName]
            })

            // Проверяем наличие метки публикации, сохраняем её
            if (currentDraftObj?.published_at) {
              baseDraft.published_at = processServerTimestamp(currentDraftObj.published_at)
            }
          } else {
            console.log(
              `[DraftsProvider] Серверная версия черновика #${draftId} новее или равна. Добавляем возможность переключения.`
            )
            if (!currentDraftObj) {
              console.error(
                `[DraftsProvider] Серверная версия новее для черновика #${draftId}, но не найдена в состоянии!`
              )
              return undefined // Не можем продолжить без серверных данных
            }
            baseDraft = {
              ...currentDraftObj,
              local_id: `local-${draftId}`
            } as ExtendedDraft

            // Добавляем информацию о наличии несинхронизированной локальной версии
            console.log(`[DraftsProvider] Для черновика #${draftId} доступно переключение между версиями`)
            return baseDraft
          }
        }
      } else if (currentDraftObj) {
        // Только серверный черновик - добавляем только минимальные поля ExtendedDraft
        baseDraft = {
          ...currentDraftObj,
          local_id: `local-${draftId}`
        } as ExtendedDraft
      } else if (localDraftData) {
        // Только локальный черновик
        console.log(`[DraftsProvider] Найден только локальный черновик #${draftId}`)

        baseDraft = {
          id: draftId,
          local_id: `local-${draftId}`,
          created_at: localDraftData.timestamp,
          updated_at: localDraftData.timestamp,
          created_by: { id: 0, slug: '', name: '' },
          community: {
            id: 0,
            slug: '',
            name: '',
            pic: '',
            created_at: 0,
            created_by: { id: 0, slug: '', name: '' }
          },
          title: parseJsonContent(localDraftData.fields.title || ''),
          slug: parseJsonContent(localDraftData.fields.slug || ''),
          layout: parseJsonContent(localDraftData.fields.layout || '') || 'article',
          topics: [],
          authors: []
        } as ExtendedDraft

        // Копируем все поля из localStorage
        const localFields = localDraftData.fields || {}
        Object.keys(localFields).forEach((key) => {
          if (key !== 'title' && key !== 'slug' && key !== 'layout') {
            // Индексированный доступ
            // biome-ignore lint/suspicious/noExplicitAny: Необходимо для динамического доступа к свойствам ExtendedDraft
            ;(baseDraft as any)[key] = parseJsonContent(localFields[key])
          }
        })
      } else {
        // Ни серверного, ни локального черновика
        console.error(`[DraftsProvider] Не найден ни серверный, ни локальный черновик #${draftId}`)
        return undefined
      }

      // Применяем темы из состояния (localStorage хранит только ID)
      if (currentDraftObj?.topics) {
        baseDraft.topics = currentDraftObj.topics
      }
      // Обеспечиваем наличие массива topics
      if (!baseDraft.topics) {
        baseDraft.topics = []
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

      // Проверяем потенциальное переполнение хранилища
      checkStorageQuotaWarning()

      return baseDraft // Возвращаем лучшую версию (локальную или серверную)
    } catch (error) {
      console.error(`[DraftsProvider] Ошибка при синхронизации черновика #${draftId}:`, error)
      return currentDraftObj // В случае ошибки возвращаем текущий объект, если есть
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
          const filteredTopics = topics.filter((topic): topic is Topic => Boolean(topic?.id && topicIds.has(topic.id)))

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
        .filter((d) => d.draft_id)
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
          created_by: { id: 0, slug: '', name: '' },
          community: {
            id: 0,
            slug: '',
            name: '',
            pic: '',
            created_at: 0,
            created_by: { id: 0, slug: '', name: '' }
          },
          // Специальное поле для локальных черновиков
          local_id: String(draftIdNum),
          isLocalOnly: true
        }
      })
  }

  /**
   * Удаляет черновик из localStorage.
   * @param draftId ID черновика для удаления.
   * @returns true если удаление успешно.
   */
  const removeLocalDraft = (draftId: number): boolean => {
    console.log(`[DraftsProvider] Начинаем удаление локального черновика #${draftId}`)

    // Для отладки: найдем черновик перед удалением
    const draftToRemove = drafts().find((d) => (!d.draft_id || d.isLocalOnly) && d.id === draftId)
    if (draftToRemove) {
      console.log(`[DraftsProvider] Найден черновик для удаления: ${draftToRemove.title}`)
    } else {
      console.warn(`[DraftsProvider] Черновик #${draftId} не найден в текущем состоянии`)
    }

    // Определим слаг для каскадного удаления всех дубликатов локального черновика
    const slugToRemove = draftToRemove?.slug?.trim() || ''

    // Удаляем из состояния все локальные версии с тем же ID или тем же slug
    setDrafts((prev) => {
      const newDrafts = prev.filter((d) => {
        const isSameIdLocal = (!d.draft_id || d.isLocalOnly) && d.id === draftId
        const isSameSlugLocal = (!d.draft_id || d.isLocalOnly) && slugToRemove && d.slug === slugToRemove
        return !(isSameIdLocal || isSameSlugLocal)
      })
      console.log(
        `[DraftsProvider] Удален локальный черновик #${draftId}${slugToRemove ? ` (slug=${slugToRemove})` : ''}`
      )
      return newDrafts
    })

    // Сбрасываем текущий черновик, если это он
    const cur = currentDraft()
    if (cur && !cur.draft_id && cur.id === draftId) {
      console.log(`[DraftsProvider] Сбрасываем текущий черновик, так как он удаляется: ${draftId}`)
      setCurrentDraft(undefined)
    }

    // Удаляем из localStorage основной черновик
    const primaryRemoved = removeDraftFromStorage(draftId)

    // Если известен slug, удалим все локальные drafts с тем же slug
    if (slugToRemove) {
      try {
        const allLocal = getAllDraftsFromStorage()
        const duplicates = allLocal.filter((m) => {
          const fields = m.fields || {}
          const storedSlug = (fields.slug as unknown as string) || ''
          return storedSlug.trim() === slugToRemove
        })
        for (const dup of duplicates) {
          if (String(dup.id) !== String(draftId)) {
            removeDraftFromStorage(dup.id)
          }
        }
      } catch (e) {
        console.warn('[DraftsProvider] Ошибка при каскадном удалении локальных дубликатов по slug:', e)
      }
    }

    const result = primaryRemoved
    console.log(`[DraftsProvider] Результат удаления из localStorage: ${result ? 'успешно' : 'ошибка'}`)

    return result
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
   * Загружает черновики с сервера и объединяет их с локальными
   * @returns Promise с массивом черновиков
   */
  const loadDrafts = async (): Promise<ExtendedDraft[]> => {
    if (isServer) return []

    setLoading(true)
    console.log('[DraftsProvider] Начинаем загрузку черновиков')

    try {
      // Получаем локальные черновики
      const localDrafts = await loadLocalDraftsAsFallback()
      console.log(`[DraftsProvider] Загружено ${localDrafts.length} локальных черновиков`)

      // Пытаемся получить черновики с сервера
      if (client() && session()?.token) {
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
            console.log(`[DraftsProvider] Загружено ${serverDrafts.length} черновиков с сервера`)

            // Используем новую функцию синхронизации по slug
            const mergedDrafts = syncDraftsBySlug(serverDrafts, localDrafts)

            // Обновляем состояние
            setDrafts(mergedDrafts)

            // Проверяем квоту хранилища
            checkStorageQuotaWarning()

            return mergedDrafts
          }

          console.warn('[DraftsProvider] Сервер вернул пустой список черновиков')
        } catch (error) {
          console.error('[DraftsProvider] Ошибка при загрузке черновиков с сервера:', error)
        }
      } else {
        console.log('[DraftsProvider] Клиент или токен не доступны, используем только локальные черновики')
      }

      // Если не удалось загрузить с сервера, используем только локальные
      setDrafts(localDrafts)

      // Проверяем квоту хранилища
      checkStorageQuotaWarning()

      return localDrafts
    } catch (error) {
      console.error('[DraftsProvider] Ошибка при загрузке черновиков:', error)
      return []
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
        created_by: { id: 0, slug: '', name: '' },
        community: {
          id: 0,
          slug: '',
          name: '',
          pic: '',
          created_at: 0,
          created_by: { id: 0, slug: '', name: '' }
        },
        local_id: String(draftId),
        isLocalOnly: true
      }

      // Проверяем публикацию
      if (draft.slug) {
        try {
          draft.published_at = (await checkPublishedVersion(draft.slug)) ? Date.now() : null
        } catch (_e) {
          draft.published_at = null
        }
      }

      localDraftsFallback.push(draft)
    }

    return localDraftsFallback
  }

  const createDraft = async (draft: DraftInput): Promise<OperationResult<CreateDraftMutationMutation> | undefined> => {
    console.log('[DraftsProvider] Начинаем создание черновика:', draft)

    // Проверяем наличие client только если не создаем локальный черновик
    if (!client()) {
      console.warn('[DraftsProvider] Client не инициализирован, создание локального черновика')
      // Создаем локальный черновик с временным ID
      const tempId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      console.log(`[DraftsProvider] Генерируем временный ID для локального черновика: ${tempId}`)

      // Создаем базовую структуру локального черновика
      const localDraft: ExtendedDraft = {
        id: Number(tempId.split('-')[1]), // Используем timestamp как числовой ID
        local_id: tempId,
        title: draft.title || 'Новый черновик',
        subtitle: draft.subtitle || '',
        lead: draft.lead || '',
        body: draft.body || '',
        slug: draft.slug || '',
        cover: draft.cover || '',
        cover_caption: draft.cover_caption || '',
        layout: draft.layout || 'article',
        topics: [],
        authors: [],
        created_at: Date.now(),
        updated_at: Date.now(),
        created_by: { id: 0, slug: '', name: '' },
        community: {
          id: 0,
          slug: '',
          name: '',
          pic: '',
          created_at: 0,
          created_by: { id: 0, slug: '', name: '' }
        }
      }

      // Сохраняем в localStorage
      console.log('[DraftsProvider] Сохраняем локальный черновик в localStorage:', localDraft)
      // Используем saveEntireDraft из storage.ts
      saveEntireDraft(localDraft as Draft)

      // Обновляем список черновиков
      setDrafts([...drafts(), localDraft])

      // Возвращаем моковый ответ для совместимости
      return {
        data: {
          create_draft: {
            draft: localDraft
          }
        }
      } as unknown as OperationResult<CreateDraftMutationMutation>
    }

    // Проверяем токен авторизации для серверного запроса
    if (!session()?.token) {
      console.error('[DraftsProvider] Отсутствует токен авторизации')
      return Promise.reject(new Error('No auth token available'))
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
        const localDrafts = loadLocalDrafts()
        const matchingLocalDraft = localDrafts.find(
          (d) => !d.draft_id && (d.slug === newDraft.slug || d.title === newDraft.title)
        )

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
          removeLocalDraft(Number(matchingLocalDraft.id))
        }
      }

      return response as OperationResult<CreateDraftMutationMutation>
    } catch (error) {
      console.error('[DraftsProvider] Ошибка при создании черновика на сервере:', error)
      throw error
    }
  }

  const updateDraft = async (draft: DraftInput): Promise<OperationResult<UpdateDraftMutationMutation>> => {
    const response = await client()
      ?.mutation(updateDraftMutation, {
        draft_id: draft.id,
        draft_input: draft
      })
      .toPromise()
    if (response?.data?.update_draft?.draft) {
      setDrafts(drafts().map((d) => (d.id === draft.id ? response.data.update_draft.draft : d)))
    }
    return response as OperationResult<UpdateDraftMutationMutation>
  }

  /**
   * FIXME: Черновики сами по себе не «публикуются». Публикуемыми являются шаута.
   * Поэтому удаляем черновик напрямую без каких‑либо попыток unpublish_draft.
   */
  const deleteDraft = async (draftId: number): Promise<OperationResult<DeleteDraftMutationMutation>> => {
    if (!draftId) {
      throw new Error('deleteDraft: draftId is required')
    }
    if (!client()) {
      throw new Error('deleteDraft: GraphQL client is not initialized')
    }
    if (!session()?.token) {
      throw new Error('deleteDraft: No auth token available')
    }

    const response = await client()!.mutation(deleteDraftMutation, { draft_id: draftId }).toPromise()

    if (response?.error) {
      console.error('[DraftsProvider] GraphQL error on delete_draft:', response.error)
      return response as OperationResult<DeleteDraftMutationMutation>
    }

    const apiError = response?.data?.delete_draft?.error
    if (apiError) {
      console.error('[DraftsProvider] API reported error on delete_draft:', apiError)
      return response as OperationResult<DeleteDraftMutationMutation>
    }

    // Успех — обновляем состояние и чистим локальные ключи этого черновика
    setDrafts(drafts().filter((d) => d.id !== draftId))
    try {
      removeDraftFromStorage(draftId)
    } catch (_e) {}

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
          ? draftToPublish.topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id)
          : [],
        main_topic_id:
          draftToPublish.topics && draftToPublish.topics.length > 0 && draftToPublish.topics[0]
            ? draftToPublish.topics[0].id
            : null,
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
      const response = await client()?.mutation(publishDraftMutation, { draft_id: draftId }).toPromise()

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

  const unpublishShout = async (shoutId: number): Promise<OperationResult<UnpublishShoutMutationMutation>> => {
    try {
      // Перед снятием с публикации отображаем статус загрузки
      console.log(`[DraftsProvider] Снимаем с публикации статью #${shoutId}...`)

      // Выполняем запрос на снятие с публикации
      const response = await client()?.mutation(unpublishShoutMutation, { shout_id: shoutId }).toPromise()

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
      main_topic_id: draft.topics && draft.topics.length > 0 && draft.topics[0] ? draft.topics[0].id : null,
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
   * Проверяет объем использованного хранилища и устанавливает предупреждение если нужно
   */
  const checkStorageQuotaWarning = () => {
    if (isServer) return

    try {
      // Проверяем заполнение localStorage
      const localStorageUsage = calculateLocalStorageUsage()
      const localStorageLimit = 5 * 1024 * 1024 // Примерно 5МБ (обычный лимит)
      const usedPercentage = (localStorageUsage / localStorageLimit) * 100

      console.log(
        `[DraftsProvider] Проверка заполнения localStorage: ${(usedPercentage).toFixed(2)}% (${Math.round(localStorageUsage / 1024)} KB из ~5MB)`
      )

      // Устанавливаем предупреждение если использовано более 80%
      if (usedPercentage > 80) {
        console.warn(
          `[DraftsProvider] Внимание: localStorage заполнен на ${usedPercentage.toFixed(2)}%! Рекомендуется удалить ненужные черновики.`
        )
        setStorageQuotaWarning(true)
      } else {
        setStorageQuotaWarning(false)
      }
    } catch (error) {
      console.error('[DraftsProvider] Ошибка при проверке квоты localStorage:', error)
    }
  }

  /**
   * Рассчитывает примерное использование localStorage в байтах
   * @returns Размер в байтах
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
      console.error('[DraftsProvider] Ошибка при расчете использования localStorage:', e)
    }
    return total
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

  /**
   * Сравнивает черновики по slug и updated_at для определения, какой из них актуальнее
   * @param serverDraft Черновик с сервера
   * @param localDraft Локальный черновик
   * @returns Объект с флагами сравнения
   */
  const compareDraftVersions = (
    serverDraft: Draft | ExtendedDraft | null | undefined,
    localDraft: ExtendedDraft | null | undefined
  ): {
    isLocalNewer: boolean
    isServerNewer: boolean
    hasDifferences: boolean
  } => {
    // Если одного из черновиков нет, то другой считается новее
    if (!serverDraft && localDraft) {
      return { isLocalNewer: true, isServerNewer: false, hasDifferences: true }
    }
    if (serverDraft && !localDraft) {
      return { isLocalNewer: false, isServerNewer: true, hasDifferences: true }
    }
    if (!serverDraft && !localDraft) {
      return { isLocalNewer: false, isServerNewer: false, hasDifferences: false }
    }

    // Проверяем метки времени
    const serverUpdatedAt = serverDraft?.updated_at || 0
    const localUpdatedAt = localDraft?.updated_at || 0

    console.log('[DraftsProvider] Сравниваем версии черновика:', {
      serverSlug: serverDraft?.slug,
      localSlug: localDraft?.slug,
      serverUpdatedAt: new Date(serverUpdatedAt).toISOString(),
      localUpdatedAt: new Date(localUpdatedAt).toISOString()
    })

    // Сравниваем основные поля для определения различий
    const hasDifferences =
      serverDraft?.title !== localDraft?.title ||
      serverDraft?.subtitle !== localDraft?.subtitle ||
      serverDraft?.lead !== localDraft?.lead ||
      serverDraft?.body !== localDraft?.body ||
      serverDraft?.slug !== localDraft?.slug

    return {
      isLocalNewer: localUpdatedAt > serverUpdatedAt,
      isServerNewer: serverUpdatedAt > localUpdatedAt,
      hasDifferences
    }
  }

  /**
   * Синхронизирует черновики по slug, проверяя метки времени updated_at
   * @param serverDrafts Массив черновиков с сервера
   * @param localDrafts Массив локальных черновиков
   * @returns Объединенный массив черновиков с метками о версиях
   */
  const syncDraftsBySlug = (serverDrafts: Draft[], localDrafts: ExtendedDraft[]): ExtendedDraft[] => {
    console.log(
      `[DraftsProvider] Начинаем синхронизацию по slug: ${serverDrafts.length} серверных и ${localDrafts.length} локальных черновиков`
    )

    // Результирующий массив
    const resultDrafts: ExtendedDraft[] = []

    // Обрабатываем серверные черновики
    for (const serverDraft of serverDrafts) {
      if (!serverDraft.slug) {
        // Если у серверного черновика нет slug, просто добавляем его
        resultDrafts.push({
          ...serverDraft,
          local_id: `server-${serverDraft.id}`
        } as ExtendedDraft)
        continue
      }

      // Ищем локальный черновик с таким же slug
      const localDraft = localDrafts.find((d) => d.slug === serverDraft.slug)

      // Если локального черновика нет, просто добавляем серверный
      if (!localDraft) {
        resultDrafts.push({
          ...serverDraft,
          local_id: `server-${serverDraft.id}`
        } as ExtendedDraft)
        continue
      }

      // Сравниваем версии
      const { isLocalNewer, isServerNewer, hasDifferences } = compareDraftVersions(serverDraft, localDraft)

      if (hasDifferences) {
        if (isLocalNewer) {
          // Если локальная версия новее, добавляем её с пометкой о наличии серверной версии
          const enhancedLocalDraft: ExtendedDraft = {
            ...localDraft,
            draft_id: serverDraft.id
          }
          resultDrafts.push(enhancedLocalDraft)

          // Также добавляем серверную версию с пометкой
          const enhancedServerDraft: ExtendedDraft = {
            ...(serverDraft as Draft),
            local_id: `server-${serverDraft.id}`
          }
          resultDrafts.push(enhancedServerDraft)

          console.log(
            `[DraftsProvider] Обнаружены различия для slug "${serverDraft.slug}". Локальная версия новее, добавлены обе версии.`
          )
        } else if (isServerNewer) {
          // Если серверная версия новее, добавляем её с пометкой о наличии локальной версии
          const enhancedServerDraft: ExtendedDraft = {
            ...(serverDraft as Draft),
            local_id: `server-${serverDraft.id}`
          }
          resultDrafts.push(enhancedServerDraft)

          console.log(`[DraftsProvider] Обнаружены различия для slug "${serverDraft.slug}". Серверная версия новее.`)
        } else {
          // Если версии одинаковые по времени, но есть различия, добавляем обе
          const enhancedLocalDraft: ExtendedDraft = {
            ...localDraft,
            draft_id: serverDraft.id
          }
          resultDrafts.push(enhancedLocalDraft)

          const enhancedServerDraft: ExtendedDraft = {
            ...(serverDraft as Draft),
            local_id: `local-${localDraft.id}`
          }
          resultDrafts.push(enhancedServerDraft)

          console.log(
            `[DraftsProvider] Обнаружены различия для slug "${serverDraft.slug}". Версии имеют одинаковые метки времени, добавлены обе.`
          )
        }
      } else {
        // Если различий нет, добавляем серверную версию
        resultDrafts.push({
          ...serverDraft,
          local_id: `server-${serverDraft.id}`
        } as ExtendedDraft)
      }
    }

    // Добавляем локальные черновики, которых нет на сервере
    for (const localDraft of localDrafts) {
      // Проверяем, есть ли черновик с таким slug на сервере
      const hasServerDraft = serverDrafts.some((d) => d.slug === localDraft.slug)

      if (!hasServerDraft) {
        // Если на сервере нет черновика с таким slug, добавляем локальный
        if (!localDraft.local_id) {
          localDraft.local_id = `local-${Date.now()}-${localDraft.id}`
        }
        resultDrafts.push(localDraft)

        console.log(
          `[DraftsProvider] Добавлен локальный черновик без серверной версии: ${localDraft.slug || 'без slug'}`
        )
      }
    }

    console.log(`[DraftsProvider] Синхронизация завершена. Итого ${resultDrafts.length} черновиков.`)
    return resultDrafts
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
    clearAllLocalDrafts: () => clearAllDraftKeys(),
    performMaintenanceTasks
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
