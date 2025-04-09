import { Accessor, JSX, createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { debounce } from 'throttle-debounce'

import {
  getAllDraftFields,
  getDraftField,
  getDraftFieldsVersion,
  saveContent,
  updateLastSync
} from '~/components/SimpleRichEditor/lib/storage'
import { EditorFieldType } from '~/components/SimpleRichEditor/lib/types'
import publishShoutMutation from '~/graphql/mutation/core/article-publish'
import unpublishShoutMutation from '~/graphql/mutation/core/article-unpublish'
import createDraftMutation from '~/graphql/mutation/core/draft-create'
import deleteDraftMutation from '~/graphql/mutation/core/draft-delete'
import publishDraftMutation from '~/graphql/mutation/core/draft-publish'
import unpublishDraftMutation from '~/graphql/mutation/core/draft-unpublish'
import updateDraftMutation from '~/graphql/mutation/core/draft-update'
import loadDraftsQuery from '~/graphql/query/core/drafts-load'
import type { CommonResult, Draft, MediaItem, Topic } from '~/graphql/schema/core.gen'
import { useSession } from './session'

export const AUTO_SAVE_DELAY = 1000

export type DraftInput = {
  id?: number
  layout: string
  shoutId?: number
  slug?: string
  title?: string
  subtitle?: string
  lead?: string
  description?: string
  topics?: Topic[]
  mainTopic?: Topic
  body?: string
  cover?: string
  cover_caption?: string
  media?: MediaItem[]
}

type DraftsContextType = {
  drafts: Accessor<Draft[]>
  currentDraft: Accessor<Draft | undefined>
  setCurrentDraft: (draft: Draft | undefined) => void
  getEditorContent: (editorId: string) => string
  setEditorContent: (editorId: string, content: string) => void
  loadDrafts: () => Promise<void>
  createDraft: (draft: DraftInput) => Promise<CommonResult | null>
  updateDraft: (draft: DraftInput) => Promise<void>
  deleteDraft: (id: number) => Promise<boolean>
  publishDraft: (draftId: number) => Promise<void>
  unpublishDraft: (draftId: number) => Promise<void>
  publishShout: (shoutId: number) => Promise<void>
  unpublishShout: (shoutId: number) => Promise<void>
  isEditorPanelVisible: Accessor<boolean>
  toggleEditorPanel: () => void
  setIsEditorPanelVisible: (visible: boolean) => void
  syncDraft: (draftId: number) => Promise<Draft | undefined>
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
      saveContent(editorId, fieldType as EditorFieldType, content, false)
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
      const updatedDraft = { ...currentDraftObj }

      // Применяем локальные изменения
      Object.entries(localFields).forEach(([key, value]) => {
        // Проверяем, что ключ существует в типе Draft
        if (key in updatedDraft) {
          // Безопасно обновляем, учитывая возможные типы
          const draftKey = key as keyof Draft
          if (typeof updatedDraft[draftKey] === 'string') {
            ;(updatedDraft[draftKey] as unknown as string) = value
          }
        }
      })

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
          description: updatedDraft.description || '',
          slug: updatedDraft.slug || '',
          body: updatedDraft.body || '',
          cover: updatedDraft.cover || '',
          cover_caption: updatedDraft.cover_caption || '',
          topics: updatedDraft.topics
            ? updatedDraft.topics.filter((topic): topic is Topic => Boolean(topic))
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

      // Обновляем список черновиков
      console.log('[drafts] setting drafts:', serverDrafts)
      setDrafts(serverDrafts)
    } catch (error) {
      console.error('[drafts] error loading drafts:', error)
    }
  }

  const createDraft = async (draft: DraftInput) => {
    console.log('[drafts] creating draft', draft)
    const response = await client()?.mutation(createDraftMutation, { draft_input: draft })
    console.log('[drafts] create response:', JSON.stringify(response, null, 2))
    if (response?.data?.create_draft?.draft) {
      const newDraft = response.data.create_draft.draft
      console.log('[drafts] setting drafts with new draft:', newDraft)
      setDrafts([...drafts(), newDraft])
      return response.data.create_draft
    }
    console.error('[drafts] error creating draft:', response?.error)
    return null
  }

  const updateDraft = async (draft: DraftInput) => {
    const response = await client()?.mutation(updateDraftMutation, {
      draft_id: draft.id,
      draft_input: draft
    })
    if (response?.data?.update_draft) {
      setDrafts(drafts().map((d) => (d.id === draft.id ? response.data.update_draft : d)))
    }
  }

  const deleteDraft = async (draftId: number) => {
    const response = await client()?.mutation(deleteDraftMutation, { draft_id: draftId })
    if (response?.data?.delete_draft) {
      setDrafts(drafts().filter((d) => d.id !== draftId))
      return true
    }
    return false
  }

  /* 
      Публикация черновика 
    
      - проверяем наличие mainTopic или selectedTopics
    */
  const publishDraft = async (draftId: number) => {
    const response = await client()?.mutation(publishDraftMutation, { draft_id: draftId })
    if (response?.data?.publish_draft) {
      setDrafts(drafts().map((d) => (d.id === draftId ? response.data.publish_draft : d)))
    }
  }

  const unpublishDraft = async (draftId: number) => {
    const response = await client()?.mutation(unpublishDraftMutation, { draft_id: draftId })
    if (response?.data?.unpublish_draft) {
      setDrafts(drafts().map((d) => (d.id === draftId ? response.data.unpublish_draft : d)))
    }
  }

  const publishShout = async (shoutId: number) => {
    const response = await client()?.mutation(publishShoutMutation, { shout_id: shoutId })
    if (response?.data?.publish_shout) {
      setDrafts(drafts().map((d) => (d.id === shoutId ? response.data.publish_shout : d)))
    }
  }

  const unpublishShout = async (shoutId: number) => {
    const response = await client()?.mutation(unpublishShoutMutation, { shout_id: shoutId })
    if (response?.data?.unpublish_shout) {
      setDrafts(drafts().map((d) => (d.id === shoutId ? response.data.unpublish_shout : d)))
    }
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
    syncDraft
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}
