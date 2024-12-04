import type { Accessor, JSX } from 'solid-js'
import { createContext, createSignal, useContext } from 'solid-js'
import createChatMutation from '~/graphql/mutation/chat/chat-create'
import createMessageMutation from '~/graphql/mutation/chat/chat-message-create'
import loadChatMessagesQuery from '~/graphql/query/chat/chat-messages-load-by'
import loadChatsQuery from '~/graphql/query/chat/chats-load'
import type { Chat, Message, MessagesBy, MutationCreate_MessageArgs } from '~/graphql/schema/chat.gen'
import { Author } from '~/graphql/schema/core.gen'
import { useAuthors } from '../context/authors'
import { SSEMessage, useConnect } from './connect'
import { useSession } from './session'

type InboxContextType = {
  chats: Accessor<Chat[]>
  messages?: Accessor<Message[]>
  setMessages: (mmm: Message[]) => void
  createChat: (members: number[], title: string) => Promise<{ chat: Chat }>
  loadChats: () => Promise<Chat[]>
  loadRecipients: () => Author[]
  loadMessages: (by: MessagesBy, limit: number, offset: number) => Promise<Message[]>
  getMessages?: (chatId: string) => Promise<Message[]>
  sendMessage?: (args: MutationCreate_MessageArgs) => void
}

export type CreateChatSearchParams = {
  inbox: number
}

const InboxContext = createContext<InboxContextType>({} as InboxContextType)

export function useInbox() {
  return useContext(InboxContext)
}

export const InboxProvider = (props: { children: JSX.Element }) => {
  const [chats, setChats] = createSignal<Chat[]>([])
  const [messages, setMessages] = createSignal<Message[]>([])
  const { authorsSorted } = useAuthors()
  const { client } = useSession()

  const handleMessage = (sseMessage: SSEMessage) => {
    // handling all action types: create update delete join left seen
    if (sseMessage.entity === 'message') {
      console.debug('[context.inbox]:', sseMessage.payload)
      const relivedMessage: Message = sseMessage.payload as Message
      setMessages((prev) => [...prev, relivedMessage])
    } else if (sseMessage.entity === 'chat') {
      console.debug('[context.inbox]:', sseMessage.payload)
      const relivedChat: Chat = sseMessage.payload as Chat
      setChats((prev) => [...prev, relivedChat])
    }
  }

  const { addHandler } = useConnect()
  addHandler(handleMessage)

  const loadMessages = async (by: MessagesBy, limit = 50, offset = 0): Promise<Message[]> => {
    const resp = await client()?.query(loadChatMessagesQuery, { by, limit, offset })
    const result = resp?.data?.load_chat_messages || []
    setMessages((mmm) => [...new Set([...mmm, ...result])])
    return result
  }
  const loadChats = async () => {
    const resp = await client()?.query(loadChatsQuery, { limit: 50, offset: 0 }).toPromise()
    const result = resp?.data?.load_chats || []
    setChats(result)
    return result
  }

  const getMessages = async (chatId: string) => {
    if (!chatId) return []
    try {
      const msgs: Message[] = await loadMessages({ chat: chatId })
      setMessages(msgs)
      return msgs || []
    } catch (error) {
      console.error('Error loading messages:', error)
    }
    return []
  }

  const sendMessage = async (args: MutationCreate_MessageArgs) => {
    const resp = await client()?.mutation(createMessageMutation, args).toPromise()
    const result = resp?.data?.create_message
    if (result) {
      const { message, error } = result
      if (error) console.warn(error)
      setMessages((prev) => [...prev, message])
      const currentChat = chats().find((chat: Chat) => chat.id === args.chat_id)
      if (currentChat) {
        const createdAt: number = message.created_at || Date.now() // Ensure createdAt is correctly typed
        setChats((prevChats) => [
          ...prevChats.filter((c: Chat) => c.id !== currentChat.id),
          { ...currentChat, updated_at: createdAt }
        ])
      }
    }
  }

  const createChat = async (members: number[], title: string) => {
    try {
      const resp = await client()?.mutation(createChatMutation, { members, title }).toPromise()
      const result = resp?.data?.create_chat
      if (result) {
        const { chat, error } = result
        if (error) console.warn(error)
        setChats((prevChats) => [chat, ...prevChats])
        return chat
      }
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  const actions = {
    createChat,
    loadChats,
    loadMessages,
    loadRecipients: authorsSorted,
    getMessages,
    sendMessage,
    setMessages
  }

  const value: InboxContextType = { chats, messages, ...actions }

  return <InboxContext.Provider value={value}>{props.children}</InboxContext.Provider>
}
