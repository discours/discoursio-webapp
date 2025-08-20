import { createEffect, createSignal, For } from 'solid-js'

import { useInbox } from '~/context/inbox'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import type { Author } from '~/graphql/generated/graphql'
import { Button } from '../_shared/Button/Button' // Импорт вашего компонента Button
import styles from './CreateModalContent.module.scss'
import InviteUser from './InviteUser'

type inviteUser = Author & { selected: boolean }
type Props = {
  users: Author[]
}

const CreateModalContent = (props: Props) => {
  const { t } = useLocalize()
  const { hideModal } = useUI()
  const inviteUsers: inviteUser[] = props.users.map((user) => ({ ...user, selected: false }))
  const [chatTitle, setChatTitle] = createSignal<string>('')
  const [usersId, setUsersId] = createSignal<number[]>([])
  const [collectionToInvite, setCollectionToInvite] = createSignal<inviteUser[]>(inviteUsers)
  const { createChat, loadChats } = useInbox()

  let textInput: HTMLInputElement

  const reset = () => {
    setChatTitle('')
    setUsersId([])
    hideModal()
  }

  createEffect(() => {
    setUsersId(() => {
      const s = collectionToInvite()
        .filter((user) => {
          return user.selected === true
        })
        .map((user) => {
          return user.id
        })
      return [...s]
    })
  })

  const handleSetTitle = () => {
    setChatTitle((_) => (textInput.value.length > 0 && textInput.value) || '')
  }

  const handleClick = (user: inviteUser) => {
    setCollectionToInvite((userCollection) => {
      return userCollection.map((clickedUser) =>
        user.id === clickedUser.id ? { ...clickedUser, selected: !clickedUser.selected } : clickedUser
      )
    })
  }

  const handleCreate = async () => {
    try {
      const result = await createChat(usersId(), chatTitle())
      console.debug('[components.Inbox] create chat result:', result)
      hideModal()
      await loadChats()
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div class={styles.CreateModalContent}>
      <h4>{t('Create Chat')}</h4>
      {usersId().length > 1 && (
        <input
          ref={(el) => (textInput = el)}
          onInput={handleSetTitle}
          type="text"
          required={true}
          class={styles.chatTitleInput}
          placeholder={t('Chat Title')}
        />
      )}

      <div class="invite-recipients" style={{ height: '400px', overflow: 'auto' }}>
        <For each={collectionToInvite()}>
          {(author) => <InviteUser onClick={() => handleClick(author)} author={author} selected={author.selected} />}
        </For>
      </div>

      <div class={styles.footer}>
        <Button type="button" value={t('Cancel')} variant="danger" size="L" onClick={reset} />
        <Button
          type="button"
          value={usersId().length > 1 ? t('New group') : t('Create Chat')}
          variant="primary"
          size="L"
          onClick={handleCreate}
          disabled={usersId().length === 0}
        />
      </div>
    </div>
  )
}

export default CreateModalContent
