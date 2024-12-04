import { Client } from '@urql/core'
import { createResource } from 'solid-js'
import createChatMutation from '~/graphql/mutation/chat/chat-create'
import deleteChatMutation from '~/graphql/mutation/chat/chat-delete'
import markAsReadMutation from '~/graphql/mutation/chat/chat-mark-as-read'
import createMessageMutation from '~/graphql/mutation/chat/chat-message-create'
import deleteMessageMutation from '~/graphql/mutation/chat/chat-message-delete'
import updateMessageMutation from '~/graphql/mutation/chat/chat-message-update'
import updateChatMutation from '~/graphql/mutation/chat/chat-update'
import loadMessagesQuery from '~/graphql/query/chat/chat-messages-load-by'
import loadChatsQuery from '~/graphql/query/chat/chats-load'

import { Chat, ChatInput, Message, MessageInput, MessagesBy } from '~/graphql/schema/chat.gen'

type ResourceArgs<T> = readonly [T, Client | undefined]

/**
 * Реактивный ресурс для загрузки сообщений чата
 * Особенности:
 * - Автоматическое обновление при изменении параметров
 * - Поддержка пагинации
 * - Требует авторизованного клиента
 *
 * @example
 * ```tsx
 * // В компоненте чата:
 * const [messages] = useMessages(
 *   { chat_id: props.chatId },
 *   20, // limit
 *   page() * 20 // offset
 * )
 *
 * return (
 *   <Show when={!messages.loading} fallback={<ChatSkeleton />}>
 *     <For each={messages()}>{message =>
 *       <MessageBubble message={message} />
 *     }</For>
 *   </Show>
 * )
 * ```
 */
export const useMessages = (by: MessagesBy, limit?: number, offset?: number, signedClient?: Client) => {
  return createResource(
    () =>
      [{ by, limit, offset }, signedClient] as ResourceArgs<{
        by: MessagesBy
        limit?: number
        offset?: number
      }>,
    async ([opts, client]) => {
      if (!client) return undefined
      const resp = await client.query(loadMessagesQuery, opts).toPromise()
      return resp?.data?.load_messages_by?.messages as Message[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки чатов пользователя
 * Особенности:
 * - Автоматическое обновление при изменении параметров
 * - Поддержка пагинации
 * - Требует авторизованного клиента
 *
 * @example
 * ```tsx
 * // В InboxView:
 * const [chats] = useChats(10, 0)
 *
 * // С бесконечной прокруткой:
 * const [page, setPage] = createSignal(0)
 * const [chats] = useChats(10, page() * 10)
 *
 * return (
 *   <Show when={!chats.loading} fallback={<Loading />}>
 *     <For each={chats()}>{chat =>
 *       <ChatPreview
 *         chat={chat}
 *         unread={chat.unread}
 *         lastMessage={chat.messages?.[0]}
 *       />
 *     }</For>
 *     <button onClick={() => setPage(p => p + 1)}>
 *       Загрузить еще
 *     </button>
 *   </Show>
 * )
 * ```
 */
export const useChats = (limit?: number, offset?: number, signedClient?: Client) => {
  return createResource(
    () => [{ limit, offset }, signedClient] as ResourceArgs<{ limit?: number; offset?: number }>,
    async ([opts, client]) => {
      if (!client) return undefined
      const resp = await client.query(loadChatsQuery, opts).toPromise()
      return resp?.data?.load_chats?.chats as Chat[]
    }
  )
}

// Мутации для работы с чатами

/**
 * Создание нового чата
 * @example
 * ```ts
 * // В ChatActions:
 * const createNewChat = async () => {
 *   const result = await createChat(
 *     'Новый чат',
 *     [user1.id, user2.id],
 *     signedClient
 *   )
 *   if (!result.error) {
 *     navigate(`/chat/${result.chat.id}`)
 *   }
 * }
 */
export const createChat = async (title: string | undefined, members: number[], signedClient: Client) => {
  const resp = await signedClient.mutation(createChatMutation, { title, members }).toPromise()
  return resp?.data?.create_chat
}

/**
 * Удаление чата
 * @param chatId - ID чата
 */
export const deleteChat = async (chatId: string, signedClient: Client) => {
  const resp = await signedClient.mutation(deleteChatMutation, { chat_id: chatId }).toPromise()
  return resp?.data?.delete_chat
}

/**
 * Обновление информации о чате
 * @param chat - Новые данные чата
 */
export const updateChat = async (chat: ChatInput, signedClient: Client) => {
  const resp = await signedClient.mutation(updateChatMutation, { chat }).toPromise()
  return resp?.data?.update_chat
}

/**
 * Создание нового сообщения
 * @param chatId - ID чата
 * @param body - Текст сообщения
 * @param replyTo - ID сообщения, на которое отвечаем (опционально)
 */
export const createMessage = async (
  chatId: string,
  body: string,
  replyTo: number | undefined,
  signedClient: Client
) => {
  const resp = await signedClient
    .mutation(createMessageMutation, {
      chat_id: chatId,
      body,
      reply_to: replyTo
    })
    .toPromise()
  return resp?.data?.create_message
}

/**
 * Удаление сообщения
 * @param chatId - ID чата
 * @param messageId - ID сообщения
 */
export const deleteMessage = async (chatId: string, messageId: number, signedClient: Client) => {
  const resp = await signedClient
    .mutation(deleteMessageMutation, {
      chat_id: chatId,
      message_id: messageId
    })
    .toPromise()
  return resp?.data?.delete_message
}

/**
 * Обновление сообщения
 * @param message - Новые данные сообщения
 */
export const updateMessage = async (message: MessageInput, signedClient: Client) => {
  const resp = await signedClient.mutation(updateMessageMutation, { message }).toPromise()
  return resp?.data?.update_message
}

/**
 * Отметить сообщение как прочитанное
 * @param chatId - ID чата
 * @param messageId - ID сообщения
 */
export const markMessageAsRead = async (chatId: string, messageId: number, signedClient: Client) => {
  const resp = await signedClient
    .mutation(markAsReadMutation, {
      chat_id: chatId,
      message_id: messageId
    })
    .toPromise()
  return resp?.data?.mark_as_read
}

// @deprecated Legacy API
// будет удалено в следующих версиях

/**
 * @deprecated Используйте useMessages
 */
export const loadMessages = (by: MessagesBy, limit?: number, offset?: number, signedClient?: Client) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadMessagesQuery, { by, limit, offset }).toPromise()
    return resp?.data?.load_messages_by?.messages as Message[]
  }
}

/**
 * @deprecated Используйте useChats
 */
export const loadChats = (limit?: number, offset?: number, signedClient?: Client) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadChatsQuery, { limit, offset }).toPromise()
    return resp?.data?.load_chats?.chats as Chat[]
  }
}
