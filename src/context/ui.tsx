import { useSearchParams } from '@solidjs/router'
import type { Accessor, JSX } from 'solid-js'
import { createContext, createEffect, createSignal, on, useContext } from 'solid-js'

import { ButtonVariant } from '../components/_shared/Button/Button'

export const DEFAULT_HEADER_OFFSET = 80 // 80px for header

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
  | 'embedChoice'
  | 'previewChoice'
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
  embedChoice: 'embedChoice',
  previewChoice: 'previewChoice',
  '': ''
}

type ConfirmMessage = {
  confirmBody?: string | JSX.Element
  confirmButtonLabel?: string
  confirmButtonVariant?: ButtonVariant
  declineButtonLabel?: string
  declineButtonVariant?: ButtonVariant
}

type ModalCallbacks = {
  // biome-ignore lint/suspicious/noExplicitAny: true
  onSuccess?: (data?: any) => void
  onCancel?: () => void
  // biome-ignore lint/suspicious/noExplicitAny: true
  data?: any
}

type UIContextType = {
  modal: Accessor<ModalType | null>
  showModal: (m: ModalType, source?: ModalSource, callbacks?: ModalCallbacks) => void
  hideModal: () => void
  confirmMessage: Accessor<ConfirmMessage>
  showConfirm: (message?: ConfirmMessage) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
  modalCallbacks: Accessor<ModalCallbacks | null>
}

const UIContext = createContext<UIContextType>({} as UIContextType)

export function useUI() {
  return useContext(UIContext)
}

export const UIProvider = (props: { children: JSX.Element }) => {
  const [, setSearchParams] = useSearchParams<Record<string, string>>()
  const [modal, setModal] = createSignal<ModalType | null>(null)
  const [confirmMessage, setConfirmMessage] = createSignal<ConfirmMessage>({} as ConfirmMessage)
  const [modalCallbacks, setModalCallbacks] = createSignal<ModalCallbacks | null>(null)

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

  const showModal = (modalType: ModalType, modalSource?: ModalSource, callbacks?: ModalCallbacks) => {
    // console.log('[context.ui] showModal()', modalType)
    if (modalSource) {
      setSearchParams({ source: modalSource })
    }
    setModal(modalType)
    setModalCallbacks(callbacks || null)
  }

  const hideModal = () => {
    // console.log('[context.ui] hideModal()', modal())
    setTimeout(() => setModal(null), 1) // NOTE: modal rerender fix
    setSearchParams({ source: undefined, m: undefined, mode: undefined })
    setModalCallbacks(null)
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
    hideModal,
    modalCallbacks
  }

  return <UIContext.Provider value={value}>{props.children}</UIContext.Provider>
}
