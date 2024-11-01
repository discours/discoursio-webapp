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
import { slugify } from '~/intl/translit'
import { useFeed } from '../context/feed'
import { useLocalize } from './localize'
import { useSession } from './session'

export const AUTO_SAVE_DELAY = 3000
const yDocs: Record<string, Doc> = {}
const providers: Record<string, HocuspocusProvider> = {}

export type WordCounter = {
  characters: number
  words: number
}

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

export type EditorContextType = {
  isEditorPanelVisible: Accessor<boolean>
  wordCounter: Accessor<WordCounter>
  form: ShoutForm
  formErrors: Record<keyof ShoutForm, string>
  saveShout: (form: ShoutForm) => Promise<void>
  saveDraft: (form: ShoutForm) => Promise<void>
  saveDraftToLocalStorage: (form: ShoutForm) => void
  getDraftFromLocalStorage: (shoutId: number) => ShoutForm
  publishShout: (form: ShoutForm) => Promise<void>
  publishShoutById: (shoutId: number) => Promise<void>
  deleteShout: (shoutId: number) => Promise<boolean>
  toggleEditorPanel: () => void
  countWords: (value: WordCounter) => void
  setForm: SetStoreFunction<ShoutForm>
  setFormErrors: SetStoreFunction<Record<keyof ShoutForm, string>>
  editing: Accessor<Editor | undefined>
  setEditing: SetStoreFunction<Editor | undefined>
  isCollabMode: Accessor<boolean>
  setIsCollabMode: SetStoreFunction<boolean>
  handleInputChange: (key: keyof ShoutForm, value: string) => void
  saving: Accessor<boolean>
  hasChanges: Accessor<boolean>
}

export const EditorContext = createContext<EditorContextType>({} as EditorContextType)

export function useEditorContext() {
  return useContext(EditorContext)
}

const topic2topicInput = (topic: Topic): TopicInput => {
  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title
  }
}

const saveDraftToLocalStorage = (formToSave: ShoutForm) => {
  localStorage?.setItem(`shout-${formToSave.shoutId}`, JSON.stringify(formToSave))
}
const getDraftFromLocalStorage = (shoutId: number) => {
  return JSON.parse(localStorage?.getItem(`shout-${shoutId}`) || '{}')
}

const removeDraftFromLocalStorage = (shoutId: number) => {
  localStorage?.removeItem(`shout-${shoutId}`)
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
  const { addFeed } = useFeed()
  const snackbar = useSnackbar()
  const [isEditorPanelVisible, setIsEditorPanelVisible] = createSignal<boolean>(false)
  const [form, setForm] = createStore<ShoutForm>(defaultForm)
  const [formErrors, setFormErrors] = createStore({} as Record<keyof ShoutForm, string>)
  const [wordCounter, setWordCounter] = createSignal<WordCounter>({ characters: 0, words: 0 })
  const toggleEditorPanel = () => setIsEditorPanelVisible((value) => !value)
  const [isCollabMode, setIsCollabMode] = createSignal<boolean>(false)

  // current publishing editor instance to connect settings, panel and editor
  const [editing, setEditing] = createSignal<Editor | undefined>(undefined)
  const [saving, setSaving] = createSignal(false)
  const [hasChanges, setHasChanges] = createSignal(false)

  const countWords = (value: WordCounter) => setWordCounter(value)
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
    if (!formToUpdate.shoutId && formToUpdate.body) {
      console.debug('[updateShout] no shoutId, but body:', formToUpdate)
      const resp = await client()
        ?.mutation(createShoutMutation, { shout: { layout: formToUpdate.layout, body: formToUpdate.body } })
        .toPromise()
      return resp?.data?.create_shout
    }
    const resp = await client()?.mutation(updateShoutMutation, {
      shout_id: formToUpdate.shoutId,
      shout_input: {
        body: formToUpdate.body,
        topics: formToUpdate.selectedTopics.map((topic) => topic2topicInput(topic)), // NOTE: first is main
        // authors?: InputMaybe<Array<InputMaybe<Scalars['String']>>>
        // community?: InputMaybe<Scalars['Int']>
        // mainTopic: topic2topicInput(formToUpdate.mainTopic),
        slug: formToUpdate.slug,
        subtitle: formToUpdate.subtitle,
        title: formToUpdate.title,
        lead: formToUpdate.lead,
        description: formToUpdate.description,
        cover: formToUpdate.coverImageUrl,
        media: formToUpdate.media
      },
      publish
    })
    return resp?.data?.update_shout
  }

  const saveShout = async (formToSave: ShoutForm) => {
    isEditorPanelVisible() && toggleEditorPanel()

    if ((matchEdit() && !validate()) || (matchEditSettings() && !validateSettings())) {
      return
    }

    try {
      const { shout, error } = await updateShout(formToSave, { publish: false })
      if (error) {
        snackbar?.showSnackbar({ type: 'error', body: localize?.t(error) || '' })
        return
      }
      removeDraftFromLocalStorage(formToSave.shoutId)
      navigate(shout?.published_at ? `/article/${shout.slug}` : '/edit')
    } catch (error) {
      console.error('[saveShout]', error)
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error') || '' })
    }
  }

  const saveDraft = async (draftForm: ShoutForm) => {
    const { error } = await updateShout(draftForm, { publish: false })
    if (error) {
      snackbar?.showSnackbar({ type: 'error', body: localize?.t(error) || '' })
      return
    }
  }

  const publishShout = async (formToPublish: ShoutForm) => {
    isEditorPanelVisible() && toggleEditorPanel()

    if ((matchEdit() && !validate()) || (matchEditSettings() && !validateSettings())) {
      return
    }

    if (matchEdit()) {
      const slug = slugify(form.title)
      setForm('slug', slug)
      navigate(`/edit/${form.shoutId}/settings`)
      const { error } = await updateShout(formToPublish, { publish: false })
      if (error) {
        snackbar?.showSnackbar({ type: 'error', body: localize?.t(error) || '' })
        return
      }
    }

    try {
      const { error } = await updateShout(formToPublish, { publish: true })
      if (error) {
        snackbar?.showSnackbar({ type: 'error', body: localize?.t(error) || '' })
        return
      }
      navigate('/feed')
    } catch (error) {
      console.error('[publishShout]', error)
      snackbar?.showSnackbar({ type: 'error', body: localize?.t('Error') || '' })
    }
  }

  const publishShoutById = async (shout_id: number) => {
    if (!shout_id) {
      console.error(`shout_id is ${shout_id}`)
      return
    }
    try {
      const resp = await client()?.mutation(deleteShoutMutation, { shout_id, publish: true }).toPromise()
      const result = resp?.data?.update_shout
      if (result) {
        const { shout: newShout, error } = result
        if (error) {
          console.error(error)
          snackbar?.showSnackbar({ type: 'error', body: error })
          return
        }
        if (newShout) {
          addFeed([newShout])
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
    console.log('autoSave called')
    if (hasChanges()) {
      console.debug('saving draft', form)
      setSaving(true)
      saveDraftToLocalStorage(form)
      await saveDraft(form)
      setSaving(false)
      setHasChanges(false)
    }
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
    console.log(`[handleInputChange] ${key}: ${value}`)
    setForm(key, value)
    setHasChanges(true)
    debouncedAutoSave()
  }

  const actions = {
    saveShout,
    saveDraft,
    saveDraftToLocalStorage,
    getDraftFromLocalStorage,
    publishShout,
    publishShoutById,
    deleteShout,
    toggleEditorPanel,
    countWords,
    setForm,
    setFormErrors,
    setEditing,
    isCollabMode,
    setIsCollabMode,
    handleInputChange,
    saving,
    hasChanges
  }

  const value: EditorContextType = {
    ...actions,
    form,
    formErrors,
    isEditorPanelVisible,
    wordCounter,
    editing
  }

  return <EditorContext.Provider value={value}>{props.children}</EditorContext.Provider>
}
