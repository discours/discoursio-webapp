import { OperationResult } from '@urql/core'
import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { debounce } from 'throttle-debounce'

import { sanitizeHtml } from '~/components/SimpleRichEditor/lib/sanitize'
import {
  getAllDraftFields,
  getDraftField,
  getDraftFieldsVersion,
  saveDraftField,
  saveEditorContent,
  updateLastSync
} from '~/components/SimpleRichEditor/lib/storage'
import { EditorData, EditorFieldType } from '~/components/SimpleRichEditor/lib/types'
import publishShoutMutation from '~/graphql/mutation/core/article-publish'
import unpublishShoutMutation from '~/graphql/mutation/core/article-unpublish'
import createDraftMutation from '~/graphql/mutation/core/draft-create'
import deleteDraftMutation from '~/graphql/mutation/core/draft-delete'
import publishDraftMutation from '~/graphql/mutation/core/draft-publish'
import unpublishDraftMutation from '~/graphql/mutation/core/draft-unpublish'
import updateDraftMutation from '~/graphql/mutation/core/draft-update'
import loadDraftsQuery from '~/graphql/query/core/drafts-load'
import type {
  CreateDraftMutationMutation,
  DeleteDraftMutationMutation,
  Draft,
  DraftInput,
  PublishDraftMutationMutation,
  Topic,
  UnpublishDraftMutationMutation,
  UpdateDraftMutationMutation
} from '~/graphql/schema/core.gen'
import { useSession } from './session'

export const AUTO_SAVE_DELAY = 1000

type DraftsContextType = {
  drafts: Accessor<Draft[]>
  currentDraft: Accessor<Draft | undefined>
  setCurrentDraft: (draft: Draft | undefined) => void
  getEditorContent: (editorId: string) => string
  setEditorContent: (editorId: string, content: string) => void
  loadDrafts: () => Promise<void>
  createDraft: (draft: DraftInput) => Promise<OperationResult<CreateDraftMutationMutation>>
  updateDraft: (draft: DraftInput) => Promise<OperationResult<UpdateDraftMutationMutation>>
  deleteDraft: (id: number) => Promise<OperationResult<DeleteDraftMutationMutation>>
  publishDraft: (draftId: number) => Promise<OperationResult<PublishDraftMutationMutation>>
  unpublishDraft: (draftId: number) => Promise<OperationResult<UnpublishDraftMutationMutation>>
  publishShout: (shoutId: number) => Promise<OperationResult<PublishDraftMutationMutation>>
  unpublishShout: (shoutId: number) => Promise<OperationResult<UnpublishDraftMutationMutation>>
  isEditorPanelVisible: Accessor<boolean>
  toggleEditorPanel: () => void
  setIsEditorPanelVisible: (visible: boolean) => void
  syncDraft: (draftId: number) => Promise<Draft | undefined>
  updateDraftField: (
    draftId: number,
    fieldName: keyof DraftInput,
    value: string | EditorData,
    isEditorUpdate: boolean
  ) => void
}

export const DraftsContext = createContext<DraftsContextType>({} as DraftsContextType)
const DRAFT_EDITOR_ID_REGEX = /draft-(\d+)-([a-z]+)/
export const DraftsProvider = (props: { children: JSX.Element }) => {
  const { client, session } = useSession()
  // все доступные для редактирования черновики
  const [drafts, setDrafts] = createSignal<Draft[]>([])
  // текущий редактируемый черновик
  const [currentDraft, setCurrentDraft] = createSignal<Draft>()
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
  const syncDraft = async (draftId: number): Promise<Draft | undefined> => {
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
            ? updatedDraft.topics.filter((topic): topic is Topic => Boolean(topic)).map((topic) => topic.id)
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
        timestamp: Date.now(),
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

  const loadDrafts = async () => {
    if (!client()) {
      console.warn('[drafts] client is not ready')
      return
    }
    console.log('[drafts] loading drafts, session:', !!session()?.access_token)

    // Проверяем состояние клиента
    const currentClient = client()
    if (!currentClient) {
      console.warn('[drafts] client is null')
      return
    }

    try {
      const response = await currentClient.query(
        loadDraftsQuery,
        {},
        {
          fetchPolicy: 'network-only',
          requestPolicy: 'network-only'
        }
      )

      // Проверяем наличие данных в ответе
      if (!response?.data) {
        console.warn('[drafts] no data in response')
        if (response.error) {
          console.error('[drafts] GraphQL error:', response.error)
        }
        return
      }

      // Проверяем структуру ответа
      const loadDraftsResponse = response.data.load_drafts
      if (!loadDraftsResponse) {
        console.warn('[drafts] no load_drafts in response data:', response.data)
        return
      }

      // Проверяем наличие массива черновиков
      const serverDrafts = loadDraftsResponse.drafts
      if (!Array.isArray(serverDrafts)) {
        console.warn('[drafts] drafts is not an array:', serverDrafts)
        return
      }

      // Если с сервера пришел пустой список, но у нас есть локальные черновики - используем их
      if (serverDrafts.length === 0 && drafts().length > 0) {
        console.log('[drafts] using local drafts:', drafts())
        return
      }

      // Перед установкой черновиков, применяем локальные изменения из localStorage
      const updatedDrafts = serverDrafts.map((draft) => {
        if (!draft.id) return draft

        // Получаем локальные изменения для этого черновика
        const localFields = getAllDraftFields(draft.id) as DraftInput & { [key: string]: string }
        if (!localFields) return draft

        console.log(`[drafts] Found local changes for draft ${draft.id}:`, localFields)

        // biome-ignore lint/suspicious/noExplicitAny: updating
        const updatedDraft = { ...draft } as { [key: string]: any }

        // Применяем локальные изменения
        Object.entries(localFields).forEach(([key, value]) => {
          // Для полей, которые могут быть в JSON-формате, пытаемся распарсить их
          if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
              const parsedValue = JSON.parse(value)
              // Применяем присваивание через индексацию для любых ключей
              updatedDraft[key] = parsedValue
              console.log(`[drafts] Successfully parsed JSON for field ${key}`)
            } catch (e) {
              console.warn(`[drafts] Failed to parse JSON for field ${key}:`, e)
              updatedDraft[key] = value
            }
          } else {
            // Обновляем поля черновика как есть
            updatedDraft[key] = value
          }
        })

        // Специальная обработка для topics - если это строка, пытаемся парсить JSON
        if (typeof localFields.topics === 'string') {
          try {
            if (localFields.topics.startsWith('[')) {
              try {
                updatedDraft.topics = JSON.parse(localFields.topics) as Topic[]
                // Проверяем, что результат действительно массив
                if (Array.isArray(updatedDraft.topics)) {
                  console.log('[drafts] Successfully parsed topics as array:', updatedDraft.topics)
                } else {
                  console.warn('[drafts] topics parsed from JSON is not an array:', updatedDraft.topics)
                  updatedDraft.topics = []
                }
              } catch (e) {
                console.warn('[drafts] Failed to parse topics as JSON:', e)
                updatedDraft.topics = []
              }
            } else {
              console.warn('[drafts] topics field is not a valid JSON array:', localFields.topics)
              updatedDraft.topics = []
            }
          } catch (e) {
            console.warn('[drafts] Failed to process topics field:', e)
            updatedDraft.topics = []
          }
        }

        // Специальная обработка для mainTopic - если это строка, пытаемся парсить JSON
        if (typeof localFields.mainTopic === 'string') {
          try {
            if (localFields.mainTopic.startsWith('{')) {
              try {
                updatedDraft.mainTopic = JSON.parse(localFields.mainTopic) as Topic
                // Проверяем, что результат действительно объект с id
                if (
                  !updatedDraft.mainTopic ||
                  typeof updatedDraft.mainTopic !== 'object' ||
                  !updatedDraft.mainTopic.id
                ) {
                  console.warn('[drafts] mainTopic parsed from JSON is not valid:', updatedDraft.mainTopic)
                  updatedDraft.mainTopic = undefined
                } else {
                  console.log('[drafts] Successfully parsed mainTopic:', updatedDraft.mainTopic)
                }
              } catch (e) {
                console.warn('[drafts] Failed to parse mainTopic as JSON:', e)
                updatedDraft.mainTopic = undefined
              }
            } else {
              console.warn('[drafts] mainTopic field is not a valid JSON object:', localFields.mainTopic)
              updatedDraft.mainTopic = undefined
            }
          } catch (e) {
            console.warn('[drafts] Failed to process mainTopic field:', e)
            updatedDraft.mainTopic = undefined
          }
        }

        // Проверяем конкретно заголовок
        if (localFields.title) {
          updatedDraft.title = localFields.title
        }

        return updatedDraft as Draft
      })

      // Обновляем список черновиков
      console.log('[drafts] setting drafts with local changes applied:', updatedDrafts)
      setDrafts(updatedDrafts)
    } catch (error) {
      console.error('[drafts] error loading drafts:', error)
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
    const response = await client()?.mutation(publishDraftMutation, { draft_id: draftId })
    if (response?.data?.publish_draft?.draft) {
      setDrafts(drafts().map((d) => (d.id === draftId ? response.data.publish_draft.draft : d)))
    }
    return response as OperationResult<PublishDraftMutationMutation>
  }

  const unpublishDraft = async (
    draftId: number
  ): Promise<OperationResult<UnpublishDraftMutationMutation>> => {
    const response = await client()?.mutation(unpublishDraftMutation, { draft_id: draftId })
    if (response?.data?.unpublish_draft) {
      setDrafts(drafts().map((d) => (d.id === draftId ? response.data.unpublish_draft : d)))
    }
    return response as OperationResult<UnpublishDraftMutationMutation>
  }

  const publishShout = async (shoutId: number): Promise<OperationResult<PublishDraftMutationMutation>> => {
    const response = await client()?.mutation(publishShoutMutation, { shout_id: shoutId })
    if (response?.data?.publish_shout) {
      setDrafts(drafts().map((d) => (d.id === shoutId ? response.data.publish_shout : d)))
    }
    return response as OperationResult<PublishDraftMutationMutation>
  }

  const unpublishShout = async (
    shoutId: number
  ): Promise<OperationResult<UnpublishDraftMutationMutation>> => {
    const response = await client()?.mutation(unpublishShoutMutation, { shout_id: shoutId })
    if (response?.data?.unpublish_shout) {
      setDrafts(drafts().map((d) => (d.id === shoutId ? response.data.unpublish_shout : d)))
    }
    return response as OperationResult<UnpublishDraftMutationMutation>
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
    unpublishDraft,
    publishShout,
    unpublishShout,
    isEditorPanelVisible,
    toggleEditorPanel,
    setIsEditorPanelVisible,
    syncDraft,
    updateDraftField
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}

// Экспортируем тип DraftInput для использования в других компонентах
export type { DraftInput } from '~/graphql/schema/core.gen'
