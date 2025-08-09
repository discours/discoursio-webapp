import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, on, onMount, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Popover } from '~/components/_shared/Popover'
import QuotedMessage from '~/components/Inbox/QuotedMessage'
import { useInbox } from '~/context/inbox'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import type { Author } from '~/graphql/generated/graphql'
import type {
  Chat,
  ChatMember,
  CreateMessageMutationVariables,
  Message as MessageType
} from '~/graphql/generated/inbox/graphql'
import { getShortDate } from '~/lib/fromPeriod'
import styles from '~/styles/views/Inbox.module.scss'
import { Button } from '../_shared/Button'
import { Modal } from '../_shared/Modal'
import DialogCard from '../Inbox/DialogCard'
import DialogHeader from '../Inbox/DialogHeader'
import { Message } from '../Inbox/Message'
import MessagesFallback from '../Inbox/MessagesFallback'
import Search from '../Inbox/Search'
import { EditorData } from '../SimpleRichEditor/lib/types'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'

const userSearch = (array: Author[], keyword: string) => {
  return array.filter((value) => new RegExp(keyword.trim(), 'gi').test(value.name || ''))
}

export const InboxView = (props: { authors: Author[]; chat?: Chat }) => {
  const { t } = useLocalize()
  const { chats, messages, setMessages, loadChats, getMessages, sendMessage } = useInbox()
  const [recipients, setRecipients] = createSignal<Author[]>(props.authors)
  const [sortByGroup, setSortByGroup] = createSignal(false)
  const [sortByPerToPer, setSortByPerToPer] = createSignal(false)
  const [currentDialog, setCurrentDialog] = createSignal<Chat>()
  const [messageToReply, setMessageToReply] = createSignal<MessageType | null>(null)
  const [isScrollToNewVisible, setIsScrollToNewVisible] = createSignal(false)
  const { session } = useSession()
  const authorId = createMemo<number>(() => session()?.author?.id || 0)
  const { showModal } = useUI()
  const handleOpenInviteModal = () => showModal('inviteMembers')
  let messagesContainerRef: HTMLDivElement | null

  const getQuery = (query: () => string) => {
    if (query().length >= 2) {
      const match = userSearch(recipients(), query())
      setRecipients(match)
    }
  }
  const navigate = useNavigate()
  const handleOpenChat = async (chat: Chat) => {
    setCurrentDialog(chat)
    navigate(`/inbox/${chat.id}`)
    try {
      const mmm = await getMessages?.(chat.id)
      if (mmm) {
        setMessages(mmm)
      }
    } catch (error) {
      console.error('[getMessages]', error)
    } finally {
      messagesContainerRef?.scroll({
        top: messagesContainerRef?.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleSubmit = async (message: string): Promise<boolean> => {
    try {
      await sendMessage?.({
        body: message,
        reply_to: messageToReply()?.id,
        chat_id: currentDialog()?.id || ''
      } as CreateMessageMutationVariables)
      setMessageToReply(null)
      if (messagesContainerRef)
        (messagesContainerRef as HTMLDivElement).scrollTop = messagesContainerRef?.scrollHeight || 0
      return true
    } catch (error) {
      console.error('Failed to submit message:', error)
      return false
    }
  }

  const handleMessageChange = (value: EditorData) => {
    const msg = {
      body: value.content,
      reply_to: messageToReply()?.id,
      chat_id: currentDialog()?.id || ''
    } as MessageType
    setMessageToReply(msg)
  }

  createEffect(
    on([() => props.chat, currentDialog], ([c, current]) => {
      if (c?.id !== current?.id) {
        void handleOpenChat(c as Chat)
      }
    })
  )

  const chatsToShow = () => {
    if (!chats()) return
    const sorted = chats().sort((a: Chat, b: Chat) => {
      return (b?.updated_at || 0) - (a?.updated_at || 0)
    })
    if (sortByPerToPer()) {
      return sorted.filter((chat) => (chat.title || '').trim().length === 0)
    }
    if (sortByGroup()) {
      return sorted.filter((chat) => (chat.title || '').trim().length > 0)
    }
    return sorted
  }

  const findToReply = (messageId: number) => {
    return (messages?.() || []).find((message: MessageType) => message.id === messageId)
  }

  createEffect(
    on(
      () => messages?.() || [],
      (_mmm) => {
        if (!messagesContainerRef) return
        if (messagesContainerRef.scrollTop >= messagesContainerRef.scrollHeight) return
        if (messagesContainerRef) {
          messagesContainerRef?.scroll({
            top: messagesContainerRef.scrollHeight,
            behavior: 'smooth'
          })
        }
      }
    )
  )
  const handleScrollMessageContainer = () => {
    if (
      (messagesContainerRef?.scrollHeight || 0) - (messagesContainerRef?.scrollTop || 0) >
      (messagesContainerRef?.clientHeight || 0) * 1.5
    ) {
      setIsScrollToNewVisible(true)
    } else {
      setIsScrollToNewVisible(false)
    }
  }
  const handleScrollToNew = () => {
    messagesContainerRef?.scroll({
      top: messagesContainerRef?.scrollHeight,
      behavior: 'smooth'
    })
    setIsScrollToNewVisible(false)
  }

  onMount(async () => {
    props.chat && setCurrentDialog(props.chat)
    await loadChats()
  })

  const InboxNav = () => (
    <div class={clsx(styles.chatList, 'col-md-8')}>
      <div class={styles.sidebarHeader}>
        <Search placeholder="Поиск" onChange={getQuery} />
        <button type="button" onClick={handleOpenInviteModal}>
          <Icon name="plus-button" style={{ width: '40px', height: '40px' }} />
        </button>
      </div>

      <Show when={chatsToShow()}>
        <ul class="view-switcher">
          <li
            class={clsx({
              'view-switcher__item--selected': !(sortByPerToPer() || sortByGroup())
            })}
          >
            <button
              onClick={() => {
                setSortByPerToPer(false)
                setSortByGroup(false)
              }}
            >
              {t('All')}
            </button>
          </li>
          <li
            class={clsx({
              'view-switcher__item--selected': sortByPerToPer()
            })}
          >
            <button
              onClick={() => {
                setSortByPerToPer(true)
                setSortByGroup(false)
              }}
            >
              {t('Personal')}
            </button>
          </li>
          <li
            class={clsx({
              'view-switcher__item--selected': sortByGroup()
            })}
          >
            <button
              onClick={() => {
                setSortByGroup(true)
                setSortByPerToPer(false)
              }}
            >
              {t('Groups')}
            </button>
          </li>
        </ul>
      </Show>
      <div class={styles.holder}>
        <div class={styles.dialogs}>
          <For each={chatsToShow()}>
            {(chat) => (
              <DialogCard
                onClick={() => handleOpenChat(chat)}
                isOpened={chat.id === currentDialog()?.id}
                members={chat?.members as ChatMember[]}
                ownId={authorId()}
                lastUpdate={chat.updated_at || Date.now()}
                counter={chat.unread || 0}
                message={chat.messages?.pop()?.body || ''}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  )

  return (
    <div class={clsx('container', styles.Inbox)}>
      <Modal variant="medium" name="inviteMembers">
        <InviteMembers title={t('Create Chat')} variant={'recipients'} />
      </Modal>
      {/*<CreateModalContent users={recipients()} />*/}
      <div class={clsx('row', styles.row)}>
        <InboxNav />

        <div class={clsx('col-md-16', styles.conversation)}>
          <Show
            keyed={true}
            when={currentDialog()}
            fallback={
              <MessagesFallback
                message={t('Choose who you want to write to')}
                onClick={handleOpenInviteModal}
                actionText={t('Start conversation')}
              />
            }
          >
            <DialogHeader ownId={authorId()} chat={currentDialog() as Chat} />
            <div class={styles.conversationMessages}>
              <Show when={isScrollToNewVisible()}>
                <Popover content={t('To new messages')}>
                  {(triggerRef: (el: HTMLElement) => void) => (
                    <div ref={triggerRef} class={styles.scrollToNew} onClick={handleScrollToNew}>
                      <Icon name="arrow-right" class={styles.icon} />
                    </div>
                  )}
                </Popover>
              </Show>
              <div
                class={styles.messagesContainer}
                ref={(el) => (messagesContainerRef = el)}
                onScroll={handleScrollMessageContainer}
              >
                <For each={messages?.() || []}>
                  {(m) => (
                    <Message
                      content={m}
                      ownId={authorId()}
                      members={currentDialog()?.members as ChatMember[]}
                      replyBody={(m?.reply_to && findToReply(m?.reply_to || 0)?.body) || ''}
                      replyClick={() => setMessageToReply(m)}
                    />
                  )}
                </For>
                <Show when={currentDialog()?.created_at}>
                  <small>
                    <time>{getShortDate(new Date(currentDialog()?.created_at || 0))}</time>
                  </small>
                </Show>
              </div>
            </div>

            <div class={styles.messageForm}>
              <Show when={messageToReply()?.body}>
                <QuotedMessage
                  variant="reply"
                  author={
                    currentDialog()?.members?.find(
                      (member: ChatMember) => member?.id === Number(messageToReply()?.created_by)
                    )?.name
                  }
                  body={messageToReply()?.body || ''}
                  cancel={() => setMessageToReply(null)}
                />
              </Show>
              <div class={styles.wrapper}>
                <SimpleRichEditor
                  placeholder={t('New message')}
                  onChange={handleMessageChange}
                  commands={['bold', 'italic', 'link', 'image', 'video', 'audio', 'blockquote']}
                />
              </div>
              <Button
                variant="primary"
                value={t('Send')}
                onClick={() => handleSubmit(messageToReply()?.body || '')}
              />
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
