import { Accessor, JSX, createContext, createSignal, useContext } from 'solid-js'

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

export const AUTO_SAVE_DELAY = 3000

export type DraftInput = {
  id: number
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
}

export const DraftsContext = createContext<DraftsContextType>({} as DraftsContextType)

export const DraftsProvider = (props: { children: JSX.Element }) => {
  const { client } = useSession()
  // все доступные для редактирования черновики
  const [drafts, setDrafts] = createSignal<Draft[]>([])
  // текущий редактируемый черновик
  const [currentDraft, setCurrentDraft] = createSignal<Draft>()
  // содержимое всех редакторов
  const [editorsContent, setEditorsContent] = createSignal<Record<string, string>>({})

  const getEditorContent = (editorId: string) => {
    const cachedContent = localStorage.getItem(editorId)
    if (cachedContent) {
      return cachedContent
    }
    return editorId in editorsContent() ? editorsContent()[editorId] : ''
  }

  const setEditorContent = (editorId: string, content: string) => {
    setEditorsContent({ ...editorsContent(), [editorId]: content })
    if (content) {
      localStorage.setItem(editorId, content)
    } else {
      localStorage.removeItem(editorId)
    }
  }

  const loadDrafts = async () => {
    if (!client()) {
      console.warn('[drafts] client is not ready')
      return
    }
    const response = await client()?.query(loadDraftsQuery, {}, { fetchPolicy: 'network-only' })
    if (response?.data?.drafts) {
      setDrafts(response.data.drafts)
    }
  }

  const createDraft = async (draft: DraftInput) => {
    console.log('[drafts] creating draft', draft)
    const response = await client()?.mutation(createDraftMutation, { draft_input: draft })
    console.log('[drafts] response', response)
    if (response?.data?.create_draft?.draft) {
      console.log('[drafts] setting drafts', [...drafts(), response.data.create_draft.draft])
      setDrafts([...drafts(), response.data.create_draft.draft])
      return response.data.create_draft
    }
    console.log('[drafts] error', response?.error)
    return null
  }

  const updateDraft = async (draft: DraftInput) => {
    const response = await client()?.mutation(updateDraftMutation, { draft_input: draft })
    if (response?.data?.update_draft) {
      setDrafts(drafts().map((d) => (d.id === draft.id ? response.data.update_draft : d)))
    }
  }

  const deleteDraft = async (draftId: number) => {
    const response = await client()?.mutation(deleteDraftMutation, { id: draftId })
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
  const [isEditorPanelVisible, setIsEditorPanelVisible] = createSignal(false)
  const toggleEditorPanel = () => setIsEditorPanelVisible(!isEditorPanelVisible())
  const value = {
    drafts,
    currentDraft,
    setCurrentDraft,
    loadDrafts,
    createDraft,
    updateDraft,
    deleteDraft,
    publishDraft,
    unpublishDraft,
    publishShout,
    unpublishShout,
    getEditorContent,
    setEditorContent,
    isEditorPanelVisible,
    setIsEditorPanelVisible,
    toggleEditorPanel
  }

  return <DraftsContext.Provider value={value}>{props.children}</DraftsContext.Provider>
}

export const useDrafts = () => {
  return useContext(DraftsContext)
}
