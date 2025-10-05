import { Accessor, createContext, createEffect, createSignal, JSX, on, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Author, ProfileInput } from '~/graphql/generated/graphql'
import updateAuthorMuatation from '~/graphql/mutation/core/author-update'
import { useAuthors } from './authors'
import { useSession } from './session'

type ProfileContextType = {
  author: Accessor<Author>
  setAuthor: (a: Author) => void
  form: ProfileInput
  setForm: (profile: ProfileInput) => void
  submit: (profile: ProfileInput) => Promise<Author | undefined>
  updateFormField: (fieldName: string, value: string, remove?: boolean) => void
  isUploadingAvatar: Accessor<boolean>
  setIsUploadingAvatar: (loading: boolean) => void
}

const ProfileContext = createContext<ProfileContextType>({} as ProfileContextType)

export function useProfile() {
  return useContext(ProfileContext)
}

const filterProfileInput = (profile: ProfileInput): ProfileInput => {
  const filtered = {
    name: profile.name || '',
    slug: profile.slug || '',
    bio: profile.bio || '',
    about: profile.about || '',
    pic: profile.pic || '',
    links: Array.isArray(profile.links) ? (profile.links.filter(Boolean) as string[]) : []
  }
  console.log('Filtered profile input:', filtered)
  return filtered
}

export const ProfileProvider = (props: { children: JSX.Element }) => {
  const { session, client } = useSession()
  const { addAuthor } = useAuthors()
  const [form, setForm] = createStore<ProfileInput>({} as ProfileInput)
  const [author, setAuthor] = createSignal<Author>({} as Author)
  const [isUploadingAvatar, setIsUploadingAvatar] = createSignal(false)

  // when session is loaded
  createEffect(
    on(
      () => session()?.author,
      (author?: Author) => {
        if (author) {
          setAuthor(author)
          addAuthor(author)
        }
      },
      { defer: true }
    )
  )

  const submit = async (profile: ProfileInput) => {
    try {
      const filteredProfile = filterProfileInput(profile)
      console.log('Submitting profile:', {
        original: profile,
        filtered: filteredProfile
      })

      const response = await client()
        ?.mutation(updateAuthorMuatation, {
          profile: filteredProfile
        })
        .toPromise()

      if (response?.error) {
        console.error('GraphQL error:', response.error)
        throw response.error
      }
      return response?.data?.update_author?.author
    } catch (error) {
      console.error('Submit error:', error)
      throw error
    }
  }

  createEffect(() => {
    if (author()) {
      const currentAuthor = author()
      setForm({
        name: currentAuthor.name,
        slug: currentAuthor.slug,
        bio: currentAuthor.bio,
        about: currentAuthor.about,
        pic: currentAuthor.pic || '',
        links: currentAuthor.links
      })
    }
  })

  // TODO: validation error for `!` and `@`

  const updateFormField = (fieldName: string, value: string, remove?: boolean) => {
    console.log(`Updating form field ${fieldName}:`, value)
    let val = value
    if (fieldName === 'slug' && value.startsWith('@')) val = value.substring(1)
    if (fieldName === 'slug' && value.startsWith('!')) val = value.substring(1)
    if (fieldName === 'links') {
      setForm((prev) => {
        const updatedLinks = remove ? (prev.links || []).filter((item) => item !== val) : [...(prev.links || []), val]
        return { ...prev, links: updatedLinks }
      })
    } else {
      setForm((prev) => ({ ...prev, [fieldName]: val }))
    }
  }

  const value: ProfileContextType = {
    author,
    setAuthor,
    form,
    setForm: (profile: ProfileInput) => {
      const filteredProfile = filterProfileInput(profile)
      setForm((prev) => ({ ...prev, ...filteredProfile }))
    },
    submit,
    updateFormField,
    isUploadingAvatar,
    setIsUploadingAvatar
  }

  return <ProfileContext.Provider value={value}>{props.children}</ProfileContext.Provider>
}
