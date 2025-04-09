import { useSearchParams } from '@solidjs/router'
import type { Accessor, JSX } from 'solid-js'
import { createContext, createEffect, createSignal, on, useContext } from 'solid-js'

import { ButtonVariant } from '../components/_shared/Button/Button'
import { delay } from '../utils/delay'

const DEFAULT_DURATION = 3000 // 3 sec
export const DEFAULT_HEADER_OFFSET = 80 // 80px for header

const messagesToShow: SnackbarMessage[] = []
let currentCheckMessagesPromise: void | PromiseLike<void> | null = null

type SnackbarMessage = {
  type?: 'success' | 'error'
  body: string | JSX.Element
  duration?: number
}

export type SnackbarContextType = {
  snackbarMessage: Accessor<SnackbarMessage | null | undefined>
  showSnackbar: (message: SnackbarMessage) => Promise<void>
}

export const SnackbarContext = createContext<SnackbarContextType>({
  snackbarMessage: () => undefined,
  showSnackbar: async (_m: SnackbarMessage) => undefined
} as SnackbarContextType)

export function useSnackbar() {
  return useContext(SnackbarContext)
}

export const SnackbarProvider = (props: { children: JSX.Element }) => {
  const [snackbarMessage, setSnackbarMessage] = createSignal<SnackbarMessage | null>()

  const checkMessages = async () => {
    if (messagesToShow.length === 0) {
      currentCheckMessagesPromise = null
      return
    }

    setSnackbarMessage(messagesToShow[0])
    await delay(messagesToShow[0].duration || DEFAULT_DURATION)
    setSnackbarMessage(null)
    await delay(1000)
    messagesToShow.shift()
    await checkMessages()
  }

  const showSnackbar = async (message: SnackbarMessage): Promise<void> => {
    const messageToShow = {
      type: message.type ?? 'success',
      body: message.body,
      duration: message.duration ?? DEFAULT_DURATION
    }

    messagesToShow.push(messageToShow)

    if (!currentCheckMessagesPromise) {
      currentCheckMessagesPromise = checkMessages()
      await currentCheckMessagesPromise
    }

    return currentCheckMessagesPromise
  }

  const value: SnackbarContextType = { snackbarMessage, showSnackbar }

  return <SnackbarContext.Provider value={value}>{props.children}</SnackbarContext.Provider>
}

export type ModalSource =
  | 'discussions'
  | 'vote'
  | 'subscribe'
  | 'bookmark'
  | 'follow'
  | 'create'
  | 'authguard'
  | 'edit'
  | 'profile'

export type ModalType =
  | 'auth'
  | 'subscribe'
  | 'feedback'
  | 'thank'
  | 'confirm'
  | 'donate'
  | 'uploadImage'
  | 'editorUploadImage'
  | 'uploadCoverImage'
  | 'editorInsertLink'
  | 'followers'
  | 'following'
  | 'search'
  | 'inviteMembers'
  | 'share'
  | 'cropImage'
  | 'insertVideo'
  | 'uploadAudio'
  | 'insertLink'
  | ''

export const MODALS: Record<ModalType, ModalType> = {
  auth: 'auth',
  subscribe: 'subscribe',
  feedback: 'feedback',
  thank: 'thank',
  confirm: 'confirm',
  donate: 'donate',
  inviteMembers: 'inviteMembers',
  uploadImage: 'uploadImage',
  editorUploadImage: 'editorUploadImage',
  uploadCoverImage: 'uploadCoverImage',
  editorInsertLink: 'editorInsertLink',
  followers: 'followers',
  following: 'following',
  search: 'search',
  share: 'share',
  cropImage: 'cropImage',
  insertVideo: 'insertVideo',
  uploadAudio: 'uploadAudio',
  insertLink: 'insertLink',
  '': ''
}

type ConfirmMessage = {
  confirmBody?: string | JSX.Element
  confirmButtonLabel?: string
  confirmButtonVariant?: ButtonVariant
  declineButtonLabel?: string
  declineButtonVariant?: ButtonVariant
}

type UIContextType = {
  modal: Accessor<ModalType | null>
  showModal: (m: ModalType, source?: ModalSource) => void
  hideModal: () => void
  confirmMessage: Accessor<ConfirmMessage>
  showConfirm: (message?: ConfirmMessage) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
}

const UIContext = createContext<UIContextType>({} as UIContextType)

export function useUI() {
  return useContext(UIContext)
}

export const UIProvider = (props: { children: JSX.Element }) => {
  const [, setSearchParams] = useSearchParams<Record<string, string>>()
  const [modal, setModal] = createSignal<ModalType | null>(null)
  const [confirmMessage, setConfirmMessage] = createSignal<ConfirmMessage>({} as ConfirmMessage)
  // Monitor URL changes to control modal state
  createEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const modalParam = searchParams.get('m')
    if (modalParam) {
      showModal(modalParam as ModalType)
    } else {
      hideModal()
    }
  })

  let resolveFn: (value: boolean) => void
  const showConfirm = (message = {} as ConfirmMessage): Promise<boolean> => {
    const messageToShow = { ...message }

    setConfirmMessage(messageToShow)
    showModal('confirm')

    return new Promise((resolve) => {
      resolveFn = resolve
    })
  }

  const resolveConfirm = (value: boolean) => {
    resolveFn(value)
    hideModal()
  }

  const showModal = (modalType: ModalType, modalSource?: ModalSource) => {
    // console.log('[context.ui] showModal()', modalType)
    if (modalSource) {
      setSearchParams({ source: modalSource })
    }
    setModal(modalType)
  }

  const hideModal = () => {
    // console.log('[context.ui] hideModal()', modal())
    setTimeout(() => setModal(null), 1) // NOTE: modal rerender fix
    setSearchParams({ source: undefined, m: undefined, mode: undefined })
  }

  const [searchParams] = useSearchParams()

  createEffect(
    on(
      [modal, () => searchParams?.m || ''],
      ([m1, m2]) => {
        const m = m1 || m2 || ''
        m1 && console.log('[context.ui] search params change', m1)
        if (m) {
          showModal(m as ModalType)
        } else {
          setModal(null)
        }
      },
      {}
    )
  )

  const value: UIContextType = {
    confirmMessage,
    showConfirm,
    resolveConfirm,
    modal,
    showModal,
    hideModal
  }

  return (
    <UIContext.Provider value={value}>
      <SnackbarProvider>{props.children}</SnackbarProvider>
    </UIContext.Provider>
  )
}
