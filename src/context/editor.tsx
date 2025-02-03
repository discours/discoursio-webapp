import { HocuspocusProvider } from '@hocuspocus/provider'
import { useMatch, useNavigate } from '@solidjs/router'
import { Editor } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import type { JSX } from 'solid-js'
import { Accessor, createContext, createEffect, createSignal, on, onCleanup, useContext } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { debounce } from 'throttle-debounce'
import uniqolor from 'uniqolor'
import { Doc } from 'yjs'
import { useSnackbar } from '~/context/ui'
import createShoutMutation from '~/graphql/mutation/core/article-create'
import deleteShoutMutation from '~/graphql/mutation/core/article-delete'
import updateShoutMutation from '~/graphql/mutation/core/article-update'
import { MediaItem, Topic, TopicInput } from '~/graphql/schema/core.gen'
import { useFeed } from '../context/feed'
import { useLocalize } from './localize'
import { useSession } from './session'

export const AUTO_SAVE_DELAY = 3000
const yDocs: Record<string, Doc> = {}
const providers: Record<string, HocuspocusProvider> = {}

export type ShoutForm = {
  layout?: string
  shoutId: number
  slug: string
  title: string
  subtitle?: string
  lead?: string
  description?: string
  selectedTopics: Topic[]
  mainTopic?: Topic
  body: string
  coverImageUrl?: string
  media?: MediaItem[]
}

type EditorId = {
  type: 'shout' | 'author' | 'comment' | 'remark'
  entityId: number
  field: 'body' | 'subtitle' | 'lead' | 'bio' | 'footnote' | 'remark'
  index?: number
}

export type EditorContextType = {
  isEditorPanelVisible: Accessor<boolean>
  toggleEditorPanel: () => void
  publishShoutById: (shout_id: number) => Promise<void>
  handleInputChange: (key: keyof ShoutForm, value: string) => void
  form: ShoutForm
  formErrors: Record<keyof ShoutForm, string>
  updateContent: (editorId: EditorId, content: string) => void
  getContent: (editorId: EditorId) => string
  markEditorDirty: () => void
  resetEditorState: () => void
  saveShout: (form: ShoutForm) => Promise<void>
  saveDraft: (form: ShoutForm) => Promise<void>
  publishShout: (form: ShoutForm) => Promise<void>
  deleteShout: (shoutId: number) => Promise<boolean>
  setForm: SetStoreFunction<ShoutForm>
  setFormErrors: SetStoreFunction<Record<keyof ShoutForm, string>>
  editing: Accessor<Editor | undefined>
  setEditing: SetStoreFunction<Editor | undefined>
  isCollabMode: Accessor<boolean>
  setIsCollabMode: SetStoreFunction<boolean>
  saving: Accessor<boolean>
  hasChanges: Accessor<boolean>
  isReady: Accessor<boolean>
}

export const EditorContext = createContext<EditorContextType>({} as EditorContextType)

export function useEditorContext() {
  return useContext(EditorContext)
}

const topic2topicInput = (topic: Topic): TopicInput | null => {
  if (!topic) return null
  if (!(topic?.id && topic.slug && topic.title)) {
    console.warn('Invalid topic - missing required fields:', {
      id: topic?.id,
      slug: topic?.slug,
      title: topic?.title
    })
    return null
  }
  return {
    id: Number(topic.id),
    slug: String(topic.slug),
    title: String(topic.title)
  }
}

const defaultForm: ShoutForm = {
  body: '',
  slug: '',
  shoutId: 0,
  title: '',
  selectedTopics: []
}

export const EditorProvider = (props: { children: JSX.Element }) => {
  const localize = useLocalize()
  const navigate = useNavigate()
  const matchEdit = useMatch(() => '/edit')
  const matchEditSettings = useMatch(() => '/editSettings')
  const { client, session } = useSession()
  const { addShoutsToFeed } = useFeed()
  const snackbar = useSnackbar()
  const [isEditorPanelVisible, setIsEditorPanelVisible] = createSignal<boolean>(false)
  const [form, setForm] = createStore<ShoutForm>(defaultForm)
  const [formErrors, setFormErrors] = createStore({} as Record<keyof ShoutForm, string>)
  const toggleEditorPanel = () => setIsEditorPanelVisible((value) => !value)
  const [isCollabMode, setIsCollabMode] = createSignal<boolean>(false)

  // current publishing editor instance to connect settings, panel and editor
  const [editing, setEditing] = createSignal<Editor | undefined>(undefined)
  const [saving, setSaving] = createSignal(false)
  const [hasChanges, setHasChanges] = createSignal(false)
  const [isReady, setIsReady] = createSignal(false)
  const [editorsContent, setEditorsContent] = createSignal<Record<string, string>>({})

  const generateEditorId = ({ type, entityId, field, index }: EditorId): string => {
    const base = `${type}-${entityId}-${field}`
    return index !== undefined ? `${base}-${index}` : base
  }

  createEffect(() => {
    setIsReady(!!session() && !!client())
  })

  const updateContent = (editorId: EditorId, content: string) => {
    const id = generateEditorId(editorId)
    setEditorsContent((prev) => ({ ...prev, [id]: content }))
    setHasChanges(true)
    debouncedAutoSave()
  }

  const getContent = (editorId: EditorId) => {
    const id = generateEditorId(editorId)
    return editorsContent()[id] || ''
  }

  const resetEditorState = () => {
    setHasChanges(false)
    setSaving(false)
  }

  const validate = () => {
    if (!form.title) {
      setFormErrors('title', localize?.t('Please, set the article title') || '')
      return false
    }

    const parsedMedia = (form.media || []) as MediaItem[]
    if (form.layout === 'video' && !parsedMedia[0]) {
      snackbar?.showSnackbar({
        type: 'error',
        body: localize?.t('Looks like you forgot to upload the video')
      })
      return false
    }

    return true
  }

  const validateSettings = () => {
    if (form.selectedTopics.length === 0) {
      setFormErrors('selectedTopics', localize?.t('Required') || '')
      return false
    }

    return true
  }

  const updateShout = async (formToUpdate: ShoutForm, { publish }: { publish: boolean }) => {
    console.group('[updateShout]')
    console.log('Initial form data:', {
      selectedTopics: formToUpdate.selectedTopics,
      mainTopic: formToUpdate.mainTopic,
      existingFormTopics: form.selectedTopics,
      existingMainTopic: form.mainTopic,
      lead: formToUpdate.lead,
      body: formToUpdate.body?.length,
      subtitle: formToUpdate.subtitle?.length,
      title: formToUpdate.title?.length
    })

    // Convert topics array, ensuring it's never null
    const selectedTopics = (formToUpdate.selectedTopics || [])
      .map((topic) => {
        const converted = topic2topicInput(topic)
        console.log('Converting selected topic:', { original: topic, converted })
        return converted
      })
      .filter((t): t is TopicInput => t !== null)
    console.log('Converted selectedTopics:', selectedTopics)

    const mainTopic = formToUpdate.mainTopic ? topic2topicInput(formToUpdate.mainTopic) : null
    console.log('Converted mainTopic:', mainTopic)

    // Ensure topics is always an array, keeping existing topics if available
    const existingTopics = form.selectedTopics
      .map((topic) => {
        const converted = topic2topicInput(topic)
        console.log('Converting existing topic:', { original: topic, converted })
        return converted
      })
      .filter((t): t is TopicInput => t !== null)
    console.log('Converted existingTopics:', existingTopics)

    const topics = selectedTopics.length
      ? selectedTopics
      : mainTopic
        ? [mainTopic]
        : existingTopics.length
          ? existingTopics
          : []
    console.log('Final topics array:', topics)

    // Проверяем наличие хотя бы одного топика для любого сохранения
    if (!topics.length) {
      console.warn('Save rejected: no topics selected')
      console.groupEnd()
      return { error: 'Please select at least one topic' }
    }

    const shoutInput = {
      slug: formToUpdate.slug || form.slug,
      subtitle: formToUpdate.subtitle || form.subtitle || '',
      title: formToUpdate.title || form.title,
      body: formToUpdate.body || form.body || '',
      lead: formToUpdate.lead || form.lead || '',
      layout: formToUpdate.layout || form.layout || 'article',
      description: formToUpdate.description || form.description || '',
      cover: formToUpdate.coverImageUrl || form.coverImageUrl || '',
      media: Array.isArray(formToUpdate.media)
        ? JSON.stringify(formToUpdate.media)
        : formToUpdate.media || form.media
          ? JSON.stringify(form.media)
          : '[]',
      topics: topics.map((t) => ({
        id: Number(t.id),
        slug: String(t.slug),
        title: String(t.title)
      }))
    }

    console.log('Prepared shoutInput:', {
      ...shoutInput,
      bodyLength: shoutInput.body.length,
      leadLength: shoutInput.lead.length,
      topics_count: shoutInput.topics.length,
      topics_details: shoutInput.topics.map((t) => `${t.id}:${t.slug}`)
    })

    const variables = formToUpdate.shoutId
      ? {
          shout_id: formToUpdate.shoutId,
          shout_input: shoutInput,
          publish
        }
      : {
          shout: shoutInput
        }

    console.log('GraphQL mutation:', formToUpdate.shoutId ? 'UpdateShoutMutation' : 'CreateShoutMutation')
    console.log('Variables structure:', {
      has_shout_id: !!variables.shout_id,
      has_shout_input: !!variables.shout_input,
      has_shout: !!variables.shout,
      topics_included: variables.shout_input ? !!variables.shout_input.topics : !!variables.shout?.topics
    })
    console.log('Full mutation variables:', JSON.stringify(variables, null, 2))

    const mutation = formToUpdate.shoutId ? updateShoutMutation : createShoutMutation
    const resp = await client()?.mutation(mutation, variables).toPromise()

    console.log('Raw GraphQL response:', resp)
    if (resp?.data) {
      console.log('Response data structure:', {
        hasUpdateShout: 'update_shout' in resp.data,
        hasCreateShout: 'create_shout' in resp.data,
        updateShoutKeys: resp.data.update_shout ? Object.keys(resp.data.update_shout) : null,
        createShoutKeys: resp.data.create_shout ? Object.keys(resp.data.create_shout) : null,
        error: resp.data.update_shout?.error || resp.data.create_shout?.error,
        shout_topics: resp.data.update_shout?.shout?.topics || resp.data.create_shout?.shout?.topics
      })
    }

    if (resp?.error) {
      console.error('GraphQL error:', resp.error)
      return { error: 'Server error occurred' }
    }

    const result = resp?.data?.create_shout || resp?.data?.update_shout
    console.log('Parsed mutation result:', result)

    if (result?.error) {
      console.error('Operation error:', result.error)
      return { error: result.error }
    }

    if (!result?.shout) {
      console.error('No shout data in response')
      return { error: 'Failed to save shout' }
    }

    console.groupEnd()
    return { shout: result.shout, error: null }
  }

  const saveShout = async (formToSave: ShoutForm) => {
    console.group('[saveShout]')
    console.log('Saving form:', formToSave)

    isEditorPanelVisible() && toggleEditorPanel()

    if ((matchEdit() && !validate()) || (matchEditSettings() && !validateSettings())) {
      console.warn('Validation failed')
      console.groupEnd()
      return
    }

    try {
      const { shout, error } = await updateShout(formToSave, { publish: false })
      console.log('Save result:', { shout, error })

      if (error) {
        console.error('Save error:', error)
        snackbar?.showSnackbar({ type: 'error', body: localize?.t(error) || '' })
        console.groupEnd()
        return
      }

      localStorage.removeItem(`shout-${formToSave.shoutId}`)
      console.log('Navigating to:', shout?.published_at ? `/${shout.slug}` : '/edit')
      navigate(shout?.published_at ? `/${shout.slug}` : '/edit')
    } catch (error) {
      console.error('Save failed:', error)
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error') || '' })
    }
    console.groupEnd()
  }

  const saveDraft = async (draftForm: ShoutForm) => {
    try {
      console.group('[saveDraft]')
      // Get the latest editor content
      const currentBody = editing()?.getHTML() || ''

      const dataToSave = {
        ...draftForm,
        body: currentBody, // Include latest editor content
        lead: draftForm.lead || form.lead // Ensure lead is included
      }

      console.log('Saving draft:', {
        bodyLength: dataToSave.body.length,
        leadLength: dataToSave.lead?.length,
        shoutId: dataToSave.shoutId
      })

      const { error, shout } = await updateShout(dataToSave, { publish: false })

      if (error) {
        console.error('Draft save error:', error)
        snackbar?.showSnackbar({ type: 'error', body: localize?.t(error) || '' })
        console.groupEnd()
        return
      }

      // Update form with saved data
      if (shout) {
        setForm((prev) => ({
          ...prev,
          body: shout.body || prev.body,
          lead: shout.lead || prev.lead
        }))
      }

      // Обновляем ID материала после первого сохранения
      if (shout?.id && !draftForm.shoutId) {
        console.log('Updating shout ID after initial save:', shout.id)
        setForm('shoutId', shout.id)
      }

      console.groupEnd()
    } catch (error) {
      console.error('[saveDraft] error:', error)
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error saving draft') || '' })
    }
  }

  const publishShout = async (formToPublish: ShoutForm) => {
    console.group('[publishShout]')
    console.log('Publishing form:', formToPublish)

    try {
      console.log('Publishing shout...')
      const result = await updateShout(formToPublish, { publish: true })

      if (result?.error) {
        console.error('Publish error:', result.error)
        snackbar?.showSnackbar({ type: 'error', body: localize?.t(result.error) || '' })
        console.groupEnd()
        return
      }

      if (result?.shout) {
        console.log('Publication successful, adding to feed:', result.shout)
        addShoutsToFeed([result.shout], 'recent')
        navigate('/feed')
      } else {
        console.error('No shout data in response')
        snackbar?.showSnackbar({ type: 'error', body: localize?.t('Failed to publish') || '' })
      }
    } catch (error) {
      console.error('Publication failed:', error)
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error') || '' })
    }
    console.groupEnd()
  }

  const publishShoutById = async (shout_id: number) => {
    if (!shout_id) {
      console.error(`shout_id is ${shout_id}`)
      return
    }
    try {
      const resp = await client()?.mutation(updateShoutMutation, { shout_id, publish: true }).toPromise()
      const result = resp?.data?.update_shout
      if (result) {
        const { shout: newShout, error } = result
        if (error) {
          console.error(error)
          snackbar?.showSnackbar({ type: 'error', body: error })
          return
        }
        if (newShout) {
          addShoutsToFeed([newShout], 'recent')
          navigate('/feed')
        } else {
          console.error('[publishShoutById] no shout returned:', newShout)
        }
      }
    } catch (error) {
      console.error('[publishShoutById]', error)
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error') || '' })
    }
  }

  const deleteShout = async (shout_id: number) => {
    try {
      const resp = await client()?.mutation(deleteShoutMutation, { shout_id }).toPromise()
      return resp?.data?.delete_shout
    } catch {
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error') || '' })
      return false
    }
  }

  const debouncedAutoSave = debounce(AUTO_SAVE_DELAY, async () => {
    console.group('[autoSave]')
    console.log('Auto-save triggered, hasChanges:', hasChanges())

    if (hasChanges()) {
      const data = {
        ...form,
        body: editing()?.getHTML() || '',
        lead: form.lead
      }
      console.debug('Saving draft data:', data)
      setSaving(true)

      try {
        // Сохраняем в localStorage только если есть ID
        if (data.shoutId) {
          localStorage.setItem(`shout-${data.shoutId}`, JSON.stringify(data))
        }

        await saveDraft(data)
      } finally {
        setSaving(false)
        setHasChanges(false)
      }
    }

    console.groupEnd()
  })
  onCleanup(debouncedAutoSave.cancel)

  createEffect(
    on(
      isCollabMode,
      (x?: boolean) => () => {
        const editorInstance = editing()
        if (!editorInstance) return
        try {
          const docName = `shout-${form.shoutId}`
          const token = session()?.access_token || ''
          const profile = session()?.user?.app_data?.profile

          if (!(token && profile)) {
            throw new Error('Missing authentication data')
          }

          if (!yDocs[docName]) {
            yDocs[docName] = new Doc()
          }

          if (!providers[docName]) {
            providers[docName] = new HocuspocusProvider({
              url: 'wss://hocuspocus.discours.io',
              name: docName,
              document: yDocs[docName],
              token
            })
            console.log(`[collab mode] HocuspocusProvider connected for ${docName}`)
          }
          if (x) {
            const newExtensions = [
              Collaboration.configure({ document: yDocs[docName] }),
              CollaborationCursor.configure({
                provider: providers[docName],
                user: { name: profile.name, color: uniqolor(profile.slug).color }
              })
            ]
            const extensions = editing()?.options.extensions.concat(newExtensions)
            editorInstance.setOptions({ ...editorInstance.options, extensions })
            providers[docName].connect()
          } else if (editorInstance) {
            providers[docName].disconnect()
            const updatedExtensions = editorInstance.options.extensions.filter(
              (ext) => ext.name !== 'collaboration' && ext.name !== 'collaborationCursor'
            )
            editorInstance.setOptions({
              ...editorInstance.options,
              extensions: updatedExtensions
            })
          }
        } catch (error) {
          console.error('[collab mode] error', error)
        }
      },
      { defer: true }
    )
  )

  const handleInputChange = (key: keyof ShoutForm, value: string) => {
    // console.log(`[handleInputChange] ${key}: ${value}`)
    setForm(key, value)
    setHasChanges(true)
    debouncedAutoSave()
  }

  const value: EditorContextType = {
    isEditorPanelVisible,
    form,
    formErrors,
    saveShout,
    saveDraft,
    publishShout,
    publishShoutById,
    deleteShout,
    toggleEditorPanel,
    setForm,
    setFormErrors,
    editing,
    setEditing,
    isCollabMode,
    setIsCollabMode,
    handleInputChange,
    saving,
    hasChanges,
    updateContent,
    getContent,
    markEditorDirty: () => setHasChanges(true),
    resetEditorState,
    isReady
  }

  return <EditorContext.Provider value={value}>{props.children}</EditorContext.Provider>
}
