import { OperationResult } from '@urql/core'
import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { debounce } from 'throttle-debounce'

import { sanitizeHtml } from '~/components/SimpleRichEditor/lib/sanitize'
import {
  getAllDraftFields,
  getAllDraftsFromStorage,
  getDraftField,
  getDraftFieldsVersion,
  removeDraftFromStorage,
  saveDraftField,
  saveEditorContent,
  updateLastSync
} from '~/components/SimpleRichEditor/lib/storage'
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
import { tryParseJson } from '~/utils/tryjson'
import { useSession } from './session'
import { useTopics } from './topics'

export const AUTO_SAVE_DELAY = 1000

/**
 * Проверяет валидность временной метки
 *
 * @param timestamp Временная метка для проверки
 * @returns Валидированная метка времени или текущее время
 */
const validateTimestamp = (timestamp: number): number => {
  const now = Date.now()
  const minValidDate = new Date('2020-01-01').getTime() // Минимальная валидная дата (1 января 2020)
  const maxValidDate = now + 86400000 // Максимальная валидная дата (сегодня + 1 день)

  // Проверяем, находится ли метка в разумных пределах
  if (!timestamp || timestamp < minValidDate || timestamp > maxValidDate) {
    console.warn(
      `[drafts] Invalid timestamp detected: ${new Date(timestamp).toISOString()}, using current time instead`
    )
    return now
  }

  return timestamp
}

// Интерфейс для расширенной информации о черновике
export interface ExtendedDraft extends Draft {
  isLocalOnly?: boolean
  localId?: string
  hasPublishedVersion?: boolean // Флаг, указывающий наличие опубликованной версии с тем же слагом
  // FIXME: это должно быть поле самой публикации
  published_at?: number // Timestamp публикации статьи
}

type DraftsContextType = {
  drafts: Accessor<ExtendedDraft[]>
  currentDraft: Accessor<ExtendedDraft | undefined>
  setCurrentDraft: (draft: ExtendedDraft | undefined) => void
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
  // содержимое всех редакторов
  const [editorsContent, setEditorsContent] = createSignal<Record<string, string>>({})
  // видимость панели редактора
  const [isEditorPanelVisible, setIsEditorPanelVisible] = createSignal(true)

  // Создаем дебаунсированную функцию сохранения контента редактора
  const debouncedSaveContent = debounce(AUTO_SAVE_DELAY, (editorId: string, content: string) => {
    const match = editorId.match(DRAFT_EDITOR_ID_REGEX)
    if (match) {
      const draftId = match[1]
      const fieldType = match[2]
      saveEditorContent(editorId, fieldType as EditorFieldType, content, content === '')
      console.log(
        `[DraftsProvider] Debounced save for editor ${editorId} with draftId ${draftId} and fieldType ${fieldType}`
      )
    }
  })

  // Очистка ресурсов при размонтировании
  onCleanup(() => {
    // Отменяем отложенные сохранения
    debouncedSaveContent.cancel()
  })

  // Функция для синхронизации черновика между компонентами
  const syncDraft = async (draftId: number): Promise<ExtendedDraft | undefined> => {
    if (!draftId) return undefined

    try {
      console.log(`[DraftsProvider] Syncing draft ${draftId}`)

      // Получаем текущий черновик из состояния
      const currentDraftObj = drafts().find((d) => d.id === draftId)
      if (!currentDraftObj) {
        console.warn(`[DraftsProvider] Draft ${draftId} not found in state`)
        return undefined
      }

      // Получаем локальные изменения
      const localFieldsVersion = getDraftFieldsVersion(draftId)
      const localFields = getAllDraftFields(draftId)

      console.log(`[DraftsProvider] Local fields for draft ${draftId}:`, localFields)

      // Если локальных изменений нет, просто возвращаем текущий черновик
      if (!localFields) {
        return currentDraftObj
      }

      // Создаем новый объект с применением локальных изменений
      const updatedDraft = {
        ...localFields,
        ...currentDraftObj
      }

      // Особенно проверяем поля body и lead
      const bodyContent = getDraftField(draftId, 'body')
      if (bodyContent) {
        updatedDraft.body = bodyContent
      }

      const leadContent = getDraftField(draftId, 'lead')
      if (leadContent) {
        updatedDraft.lead = leadContent
      }

      // Обновляем currentDraft
      setCurrentDraft(updatedDraft)

      // Если время последней синхронизации устарело, синхронизируем с сервером
      if (
        localFieldsVersion &&
        (!localFieldsVersion.lastSync || localFieldsVersion.timestamp > localFieldsVersion.lastSync)
      ) {
        console.log(`[DraftsProvider] Syncing draft ${draftId} with server`)

        // Подготавливаем объект для отправки
        const draftInput: DraftInput = {
          id: updatedDraft.id,
          layout: updatedDraft.layout || 'article',
          title: updatedDraft.title || '',
          subtitle: updatedDraft.subtitle || '',
          lead: updatedDraft.lead || '',
          slug: updatedDraft.slug || '',
          body: updatedDraft.body || '',
          cover: updatedDraft.cover || '',
          cover_caption: updatedDraft.cover_caption || '',
          topic_ids: updatedDraft.topics
            ? updatedDraft.topics
                .filter((topic): topic is Topic => Boolean(topic?.id))
                .map((topic) => topic.id)
            : []
        }

        // Отправляем на сервер
        await updateDraft(draftInput)

        // Обновляем время последней синхронизации
        updateLastSync(draftId)
      }

      return updatedDraft
    } catch (error) {
      console.error(`[DraftsProvider] Error syncing draft ${draftId}:`, error)
      return undefined
    }
  }

  const getEditorContent = (editorId: string) => {
    // Проверка наличия контента в хранилище
    if (!(editorId in editorsContent())) {
      return ''
    }

    // Возвращаем содержимое как есть, без излишней фильтрации
    return editorsContent()[editorId]
  }

  const setEditorContent = (editorId: string, content: string) => {
    // Сохраняем контент как есть, без дополнительной обработки
    // Если content не строка, преобразуем ее в строку для безопасности
    const safeContent = content != null ? String(content) : ''

    // Обновляем состояние
    setEditorsContent({ ...editorsContent(), [editorId]: safeContent })

    // Запускаем дебаунсированное сохранение
    if (editorId && safeContent) {
      debouncedSaveContent(editorId, safeContent)
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
      // Если это EditorData, используем поле content и санитизируем
      cleanValue = String(sanitizeHtml(value.content))
    } else if (typeof value === 'string') {
      // Если это строка, санитизируем её
      cleanValue = String(sanitizeHtml(value))
    } else {
      // Иначе используем пустую строку
      cleanValue = ''
    }

    // 2. Сохраняем чистое значение в editorContentMap (если нужно)
    if (isEditorUpdate && (fieldName === 'body' || fieldName === 'lead')) {
      const editorId = `draft-${draftId}-${fieldName}`
      setEditorContent(editorId, cleanValue) // Сохраняем чистый HTML
      console.log(`[DraftsProvider] Updated editor content map for ${editorId}`)
    }

    // 3. Сохраняем значение в localStorage с JSON-оберткой для lead/body
    if (fieldName === 'lead' || fieldName === 'body') {
      const contentObject = {
        content: cleanValue, // Чистый HTML внутри JSON
        timestamp: validateTimestamp(Date.now()),
        source: 'local'
      }
      saveDraftField(draftId, fieldName, JSON.stringify(contentObject))
      console.log(`[DraftsProvider] Saved ${fieldName} as JSON object to localStorage for draft ${draftId}`)
    } else if (
      fieldName === 'title' ||
      fieldName === 'subtitle' ||
      fieldName === 'slug' ||
      fieldName === 'cover' ||
      fieldName === 'cover_caption' ||
      fieldName === 'layout' ||
      fieldName === 'topic_ids' ||
      fieldName === 'main_topic_id' ||
      fieldName === 'author_ids'
    ) {
      // Сохраняем строковые или числовые поля как есть (преобразуя в строку)
      saveDraftField(draftId, fieldName, String(cleanValue))
      console.log(`[DraftsProvider] Saved field ${fieldName} to localStorage for draft ${draftId}`)
    }

    // 4. Обновляем центральное состояние черновика (если необходимо)
    // Этот шаг зависит от того, как управляется состояние drafts в провайдере.
    // Если drafts() - это основной источник истины, нужно его обновить.
    // Пример:
    /*
    setDrafts(prevDrafts => prevDrafts.map(draft => {
      if (draft.id === draftId) {
        return { ...draft, [fieldName]: cleanValue };
      }
      return draft;
    }));
    */

    // 5. Отправляем обновления через awareness (если необходимо)
    // const awarenessProvider = getProvider();
    // awarenessProvider.updateDraftField(
    //   draftId,
    //   fieldName,
    //   cleanValue,
    //   fieldName === 'body' || fieldName === 'lead' ? isEmptyContent(cleanValue) : false
    // );

    // 6. (Опционально) Запускаем дебаунсированное сохранение на сервер,
    // если это изменение не пришло из setEditorContent (которое уже дебаунсировано)
    // if (!isEditorUpdate) { debouncedSaveToServer(draftId); }
  }

  /**
   * Загружает локальные черновики из localStorage
   * @returns Массив локальных черновиков
   */
  const loadLocalDrafts = (): ExtendedDraft[] => {
    try {
      // Получаем все черновики из localStorage
      const storedDrafts = getAllDraftsFromStorage()
      if (!storedDrafts.length) return []

      console.log(`[DraftsProvider] Найдено ${storedDrafts.length} локальных черновиков`)

      // Преобразуем в формат ExtendedDraft
      const localDrafts: ExtendedDraft[] = storedDrafts.map((storedDraft) => {
        // Получаем все поля из localStorage
        const fields = storedDraft.fields || {}

        // Создаем идентификатор из строки (если это строка) или используем как есть (если число)
        const draftId =
          typeof storedDraft.id === 'string' ? Number.parseInt(storedDraft.id, 10) : storedDraft.id

        // Валидируем временную метку
        const validTimestamp = validateTimestamp(storedDraft.timestamp || 0)

        // Создаем объект черновика
        const localDraft: ExtendedDraft = {
          id: draftId,
          title: fields.title || 'Без названия',
          subtitle: fields.subtitle || '',
          lead: fields.lead || '',
          body: fields.body || '',
          slug: fields.slug || '',
          cover: fields.cover || '',
          cover_caption: fields.cover_caption || '',
          layout: fields.layout || 'article',
          topics: [],
          isLocalOnly: true,
          // Добавляем другие обязательные поля из Draft
          created_at: validTimestamp, // Используем валидированный timestamp из хранилища или текущее время
          updated_at: validTimestamp, // Используем валидированный timestamp из хранилища или текущее время
          created_by: {
            // Минимальные требования для поля created_by
            id: 0,
            slug: '',
            user: ''
          },
          community: {
            // Минимальные требования для поля community
            id: 0,
            slug: '',
            name: '',
            pic: '',
            created_at: 0,
            created_by: {
              id: 0,
              slug: '',
              user: ''
            }
          }
        }

        // Проверяем, существует ли черновик на сервере
        const serverDraft = drafts().find((d) => d.id === localDraft.id && !d.isLocalOnly)
        if (serverDraft) {
          // Если черновик существует на сервере, помечаем его как не только локальный
          localDraft.isLocalOnly = false
        }

        return localDraft
      })

      // Фильтруем черновики, которые существуют только локально
      const localOnlyDrafts = localDrafts.filter((d) => d.isLocalOnly)
      console.log(
        `[DraftsProvider] Найдено ${localOnlyDrafts.length} черновиков, доступных только локально`
      )

      return localOnlyDrafts
    } catch (error) {
      console.error('[DraftsProvider] Ошибка при загрузке локальных черновиков:', error)
      return []
    }
  }

  /**
   * Удаляет локальный черновик
   * @param draftId Идентификатор черновика
   * @returns true в случае успеха
   */
  const removeLocalDraft = (draftId: number): boolean => {
    try {
      // Удаляем из localStorage
      const result = removeDraftFromStorage(draftId)

      if (result) {
        // Удаляем из состояния drafts
        setDrafts((prev) => prev.filter((d) => !(d.id === draftId && d.isLocalOnly)))

        // Если это текущий черновик, сбрасываем его
        if (currentDraft()?.id === draftId && currentDraft()?.isLocalOnly) {
          setCurrentDraft(undefined)
        }

        console.log(`[DraftsProvider] Локальный черновик #${draftId} успешно удален`)
      }

      return result
    } catch (error) {
      console.error(`[DraftsProvider] Ошибка при удалении локального черновика #${draftId}:`, error)
      return false
    }
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
      console.error(`[DraftsProvider] Ошибка проверки публикации для слага ${slug}:`, error)
      return false
    }
  }

  /**
   * Загрузка черновиков с проверкой опубликованных версий
   */
  const loadDrafts = async () => {
    if (!client()) {
      console.warn('[drafts] client is not ready')
      return
    }
    console.log('[drafts] loading drafts, session:', !!session()?.access_token)

    const currentClient = client()
    if (!currentClient) {
      console.warn('[drafts] client is null')
      return
    }

    try {
      // 1. Загружаем черновики с сервера
      const serverResponse = await currentClient.query(
        loadDraftsQuery,
        {},
        {
          fetchPolicy: 'network-only',
          requestPolicy: 'network-only'
        }
      )

      let serverDrafts: ExtendedDraft[] = []
      if (
        serverResponse?.data?.load_drafts?.drafts &&
        Array.isArray(serverResponse.data.load_drafts.drafts)
      ) {
        serverDrafts = serverResponse.data.load_drafts.drafts
      } else {
        // biome-ignore lint/style/useCollapsedElseIf: ok
        if (serverResponse?.error) {
          console.error('[drafts] GraphQL error loading server drafts:', serverResponse.error)
        } else {
          console.warn(
            '[drafts] server drafts data is missing or not an array:',
            serverResponse?.data?.load_drafts?.drafts
          )
        }
        // Продолжаем с пустым массивом серверных черновиков
      }

      console.log(`[drafts] Loaded ${serverDrafts.length} drafts from server.`)

      // 2. Загружаем метаданные локальных черновиков
      // getAllDraftsFromStorage должна возвращать массив объектов типа { id: number | string, timestamp: number }
      const localDraftMetas = getAllDraftsFromStorage()
      console.log(`[drafts] Found ${localDraftMetas.length} local draft storages.`)

      // 3. Создаем Map для быстрого доступа к серверным черновикам
      const serverDraftsMap = new Map<number, ExtendedDraft>()
      serverDrafts.forEach((draft) => {
        if (draft?.id) {
          // Добавлена проверка на существование draft и draft.id
          serverDraftsMap.set(draft.id, { ...draft, isLocalOnly: false })
        }
      })

      const finalDrafts: ExtendedDraft[] = []

      // 4. Итерируем по локальным метаданным
      for (const localMeta of localDraftMetas) {
        if (!localMeta?.id) {
          // Пропускаем, если нет ID
          console.warn('[drafts] Local meta entry missing ID:', localMeta)
          continue
        }
        const draftId = typeof localMeta.id === 'string' ? Number.parseInt(localMeta.id, 10) : localMeta.id
        if (Number.isNaN(draftId)) {
          console.warn('[drafts] Invalid local draft ID found:', localMeta.id)
          continue
        }

        const serverDraft = serverDraftsMap.get(draftId)
        // Загружаем полные локальные данные ТОЛЬКО когда они нужны
        const localFields = getAllDraftFields(draftId) as DraftInput & { [key: string]: string | number }
        const localTimestamp = validateTimestamp(localMeta.timestamp || 0)

        if (serverDraft) {
          // Черновик есть и локально, и на сервере
          console.log(`[drafts] Draft ${draftId} found both locally and on server.`)
          const serverTimestamp = validateTimestamp(serverDraft.updated_at || 0)

          // Создаем базовый объединенный черновик из серверной версии
          const mergedDraft: ExtendedDraft = { ...serverDraft }

          // Если локальные данные (поля) существуют И локальное время новее серверного
          if (localFields && localTimestamp > serverTimestamp) {
            console.log(
              `[drafts] Applying newer local fields to draft ${draftId}. Local: ${new Date(localTimestamp).toISOString()}, Server: ${new Date(serverTimestamp).toISOString()}`
            )
            Object.entries(localFields).forEach(([key, value]) => {
              if (key === 'id')
                return // Не перезаписываем ID
                // biome-ignore lint/suspicious/noExplicitAny: Merging draft fields
              ;(mergedDraft as any)[key] = tryParseJson(value, key)
            })
            // Обновляем updated_at на локальное время
            mergedDraft.updated_at = localTimestamp
            mergedDraft.isLocalOnly = false // Убеждаемся, что флаг снят
          } else if (localFields && localTimestamp === serverTimestamp) {
            console.log(
              `[drafts] Local and server timestamps are equal for draft ${draftId}. Preferring local fields.`
            )
            // Применяем локальные поля при равенстве временных меток
            Object.entries(localFields).forEach(([key, value]) => {
              if (key === 'id') return // biome-ignore lint/suspicious/noExplicitAny: Merging draft fields
              ;(mergedDraft as any)[key] = tryParseJson(value, key)
            })
            mergedDraft.isLocalOnly = false
          } else {
            console.log(
              `[drafts] Server version is newer for draft ${draftId}, or no local fields found. Using server version.`
            )
          }

          finalDrafts.push(mergedDraft)
          serverDraftsMap.delete(draftId) // Удаляем из карты, так как обработали
        } else {
          // Черновик есть только локально
          console.log(`[drafts] Draft ${draftId} found only locally.`)
          if (localFields) {
            // Создаем полный объект черновика на основе локальных данных
            // Применяем tryParseJson ко всем полям, которые могут быть JSON
            const localDraft: ExtendedDraft = {
              id: draftId,
              title: tryParseJson(localFields.title, 'title') || 'Без названия',
              subtitle: tryParseJson(localFields.subtitle, 'subtitle') || '',
              lead: tryParseJson(localFields.lead, 'lead') || '',
              body: tryParseJson(localFields.body, 'body') || '',
              slug: tryParseJson(localFields.slug, 'slug') || '',
              cover: tryParseJson(localFields.cover, 'cover') || '',
              cover_caption: tryParseJson(localFields.cover_caption, 'cover_caption') || '',
              layout: tryParseJson(localFields.layout, 'layout') || 'article',
              // Пытаемся получить topics/mainTopic из разных возможных ключей
              topics: (tryParseJson(localFields.topic_ids || localFields.topics, 'topics') || []).map(
                (tid: number) => ({
                  id: tid,
                  name: '',
                  slug: '',
                  pic: '',
                  created_at: 0
                })
              ),
              // Добавляем минимальные заглушки для обязательных полей типа Draft
              created_at: localTimestamp, // Use local timestamp
              updated_at: localTimestamp,
              created_by: { id: 0, slug: '', user: '' }, // Placeholder
              community: {
                id: 0,
                slug: '',
                name: '',
                pic: '',
                created_at: 0,
                created_by: { id: 0, slug: '', user: '' }
              }, // Placeholder
              isLocalOnly: true
            }
            finalDrafts.push(localDraft)
          } else {
            console.warn(`[drafts] Local draft ${draftId} has metadata but no fields found in storage.`)
            // Можно решить удалить такой "пустой" локальный черновик
            removeDraftFromStorage(draftId)
          }
        }
      }

      // 5. Добавляем оставшиеся черновики с сервера (те, которых не было локально)
      serverDraftsMap.forEach((serverDraft) => {
        console.log(`[drafts] Adding server-only draft ${serverDraft.id}.`)
        finalDrafts.push(serverDraft)
      })

      // 6. Проверяем наличие опубликованных версий для всех итоговых черновиков
      const draftsWithPublishedCheck = await Promise.all(
        finalDrafts.map(async (draft) => {
          if (draft.slug) {
            try {
              draft.hasPublishedVersion = await checkPublishedVersion(draft.slug)
            } catch (checkError) {
              console.error(`[drafts] Error checking published version for slug ${draft.slug}:`, checkError)
              draft.hasPublishedVersion = false // Считаем, что нет, если проверка упала
            }
          }
          return draft
        })
      )

      // 7. Обновляем список черновиков
      console.log('[drafts] Setting final merged and deduplicated drafts:', draftsWithPublishedCheck)
      setDrafts(draftsWithPublishedCheck)
    } catch (error) {
      console.error('[drafts] Critical error in loadDrafts:', error)
      // В случае ошибки пытаемся загрузить только локальные, если список пуст
      if (!drafts()?.length) {
        try {
          // Переиспользуем логику создания чисто локальных черновиков
          const localDraftsFallback: ExtendedDraft[] = []
          const localMetasFallback = getAllDraftsFromStorage()
          for (const localMeta of localMetasFallback) {
            const draftId =
              typeof localMeta.id === 'string' ? Number.parseInt(localMeta.id, 10) : localMeta.id
            if (Number.isNaN(draftId)) continue
            const localFields = getAllDraftFields(draftId) as DraftInput & {
              [key: string]: string | number
            }
            if (localFields) {
              const validTimestamp = validateTimestamp(localMeta.timestamp || 0)
              const localDraft: ExtendedDraft = {
                /* ... структура как в шаге 4 ... */
                id: draftId,
                title: tryParseJson(localFields.title, 'title') || 'Без названия',
                subtitle: tryParseJson(localFields.subtitle, 'subtitle') || '',
                lead: tryParseJson(localFields.lead, 'lead') || '',
                body: tryParseJson(localFields.body, 'body') || '',
                slug: tryParseJson(localFields.slug, 'slug') || '',
                cover: tryParseJson(localFields.cover, 'cover') || '',
                cover_caption: tryParseJson(localFields.cover_caption, 'cover_caption') || '',
                layout: tryParseJson(localFields.layout, 'layout') || 'article',
                topics: (tryParseJson(localFields.topic_ids || localFields.topics, 'topics') || []).map(
                  (tid: number) => topicEntities()[tid]
                ),
                created_at: validTimestamp,
                updated_at: validTimestamp,
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
              localDraftsFallback.push(localDraft)
            }
          }

          if (localDraftsFallback.length) {
            console.log(
              '[drafts] Loaded local drafts as fallback after critical error:',
              localDraftsFallback
            )
            // Проверяем публикации и для них
            const fallbackWithCheck = await Promise.all(
              localDraftsFallback.map(async (draft) => {
                if (draft.slug) {
                  try {
                    draft.hasPublishedVersion = await checkPublishedVersion(draft.slug)
                  } catch (_e) {
                    draft.hasPublishedVersion = false
                  }
                }
                return draft
              })
            )
            setDrafts(fallbackWithCheck)
          }
        } catch (localError) {
          console.error('[drafts] Error loading local drafts as fallback:', localError)
        }
      }
    }
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
      // Дополнительная проверка черновика перед публикацией
      // Находим черновик в общем списке
      const draftToPublish = drafts().find((d) => d.id === draftId)

      if (!draftToPublish) {
        console.error(`[DraftsProvider] Не удалось найти черновик #${draftId} перед публикацией`)
        throw new Error(`Черновик #${draftId} не найден`)
      }

      // Проверяем наличие темы перед публикацией
      // У Draft нет свойства topic_ids, нужно извлекать идентификаторы из массива topics
      const topicIds = draftToPublish.topics
        ? draftToPublish.topics
            .filter((topic): topic is Topic => Boolean(topic?.id))
            .map((topic) => topic.id)
        : []

      if (topicIds.length) {
        console.log(
          `[DraftsProvider] У черновика #${draftId} найдено ${topicIds.length} тем: ${topicIds.join(', ')}`
        )
      } else {
        console.warn(
          `[DraftsProvider] У черновика #${draftId} отсутствуют темы, пытаемся использовать резервные варианты`
        )

        // Пробуем сначала использовать темы из объекта Draft
        if (draftToPublish.topics && draftToPublish.topics.length > 0) {
          // Проверяем наличие тем в массиве topics
          console.log(
            `[DraftsProvider] У черновика #${draftId} найдены темы в массиве topics, используем их`
          )

          // Извлекаем идентификаторы тем с дополнительной проверкой
          const extractedTopicIds = draftToPublish.topics
            .filter((topic): topic is Topic => Boolean(topic?.id))
            .map((topic) => topic.id)
            .filter((id) => id > 0)

          if (extractedTopicIds.length > 0) {
            console.log(
              `[DraftsProvider] Восстановлено ${extractedTopicIds.length} тем для черновика #${draftId}`
            )

            // Создаем обновленный объект черновика
            const updatedDraft: DraftInput = {
              id: draftId,
              topic_ids: extractedTopicIds,
              main_topic_id: extractedTopicIds[0]
            }

            // Обновляем черновик перед публикацией
            console.log(`[DraftsProvider] Обновляем темы черновика #${draftId} перед публикацией`)
            await updateDraft(updatedDraft)
          } else {
            console.warn(
              `[DraftsProvider] Не удалось восстановить темы для черновика #${draftId}, публикация может завершиться с ошибкой`
            )
          }
        } else {
          console.warn(
            `[DraftsProvider] У черновика #${draftId} отсутствуют темы, публикация может завершиться с ошибкой`
          )
        }
      }

      // Непосредственно публикуем черновик
      const response = await client()?.mutation(publishDraftMutation, { draft_id: draftId })

      console.log(`[DraftsProvider] Результат публикации черновика #${draftId}:`, {
        success: !!response?.data?.publish_draft?.draft,
        error: response?.data?.publish_draft?.error || null,
        draftData: response?.data?.publish_draft?.draft ? 'получен' : 'отсутствует'
      })

      if (response?.data?.publish_draft?.draft) {
        setDrafts(drafts().map((d) => (d.id === draftId ? response.data.publish_draft.draft : d)))
        console.log(`[DraftsProvider] Обновлен список черновиков после публикации #${draftId}`)
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
      setDrafts(drafts().map((d) => (d.id === shoutId ? response.data.unpublish_shout : d)))
    }
    return response as OperationResult<UnpublishShoutMutationMutation>
  }

  const toggleEditorPanel = () => setIsEditorPanelVisible(!isEditorPanelVisible())
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
    checkPublishedVersion
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}

// Экспортируем тип DraftInput для использования в других компонентах
export type { DraftInput } from '~/graphql/schema/core.gen'
