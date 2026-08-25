/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  mutation CreateChat($title: String, $members: [Int!]!) {\n    create_chat(title: $title, members: $members) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n": typeof types.CreateChatDocument,
    "\n  mutation DeleteChat($chat_id: String!) {\n    delete_chat(chat_id: $chat_id) {\n      error\n    }\n  }\n": typeof types.DeleteChatDocument,
    "\n  mutation MarkAsReadMutation($message_id: Int!, $chat_id: String!) {\n    mark_as_read(message_id: $message_id, chat_id: $chat_id) {\n      error\n    }\n  }\n": typeof types.MarkAsReadMutationDocument,
    "\n  mutation createMessage($chat_id: String!, $body: String!, $reply_to: Int) {\n    create_message(chat_id: $chat_id, body: $body, reply_to: $reply_to) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n": typeof types.CreateMessageDocument,
    "\n  mutation DeleteMessage($chat_id: String!, $message_id: Int!) {\n    delete_message(chat_id: $chat_id, message_id: $message_id) {\n      error\n    }\n  }\n": typeof types.DeleteMessageDocument,
    "\n  mutation UpdateMessage($message: MessageInput!) {\n    update_message(message: $message) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n": typeof types.UpdateMessageDocument,
    "\n  mutation UpdateChat($chat: ChatInput!) {\n    update_chat(chat: $chat) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n": typeof types.UpdateChatDocument,
    "\n  query LoadMessagesQuery($by: MessagesBy!, $limit: Int, $offset: Int) {\n    load_messages_by(by: $by, limit: $limit, offset: $offset) {\n      error\n      messages {\n        id\n        created_by\n        body\n        reply_to\n        created_at\n        updated_at\n      }\n    }\n  }\n": typeof types.LoadMessagesQueryDocument,
    "\n  query GetChatsQuery($limit: Int, $offset: Int) {\n    load_chats(limit: $limit, offset: $offset) {\n      error\n      chats {\n        id\n        title\n        admins\n        members {\n          id\n          slug\n          name\n          pic\n        }\n        unread\n        description\n        updated_at\n        messages {\n          id\n          body\n          created_by\n        }\n      }\n    }\n  }\n": typeof types.GetChatsQueryDocument,
};
const documents: Documents = {
    "\n  mutation CreateChat($title: String, $members: [Int!]!) {\n    create_chat(title: $title, members: $members) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n": types.CreateChatDocument,
    "\n  mutation DeleteChat($chat_id: String!) {\n    delete_chat(chat_id: $chat_id) {\n      error\n    }\n  }\n": types.DeleteChatDocument,
    "\n  mutation MarkAsReadMutation($message_id: Int!, $chat_id: String!) {\n    mark_as_read(message_id: $message_id, chat_id: $chat_id) {\n      error\n    }\n  }\n": types.MarkAsReadMutationDocument,
    "\n  mutation createMessage($chat_id: String!, $body: String!, $reply_to: Int) {\n    create_message(chat_id: $chat_id, body: $body, reply_to: $reply_to) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n": types.CreateMessageDocument,
    "\n  mutation DeleteMessage($chat_id: String!, $message_id: Int!) {\n    delete_message(chat_id: $chat_id, message_id: $message_id) {\n      error\n    }\n  }\n": types.DeleteMessageDocument,
    "\n  mutation UpdateMessage($message: MessageInput!) {\n    update_message(message: $message) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n": types.UpdateMessageDocument,
    "\n  mutation UpdateChat($chat: ChatInput!) {\n    update_chat(chat: $chat) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n": types.UpdateChatDocument,
    "\n  query LoadMessagesQuery($by: MessagesBy!, $limit: Int, $offset: Int) {\n    load_messages_by(by: $by, limit: $limit, offset: $offset) {\n      error\n      messages {\n        id\n        created_by\n        body\n        reply_to\n        created_at\n        updated_at\n      }\n    }\n  }\n": types.LoadMessagesQueryDocument,
    "\n  query GetChatsQuery($limit: Int, $offset: Int) {\n    load_chats(limit: $limit, offset: $offset) {\n      error\n      chats {\n        id\n        title\n        admins\n        members {\n          id\n          slug\n          name\n          pic\n        }\n        unread\n        description\n        updated_at\n        messages {\n          id\n          body\n          created_by\n        }\n      }\n    }\n  }\n": types.GetChatsQueryDocument,
};

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = gql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function gql(source: string): unknown;

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation CreateChat($title: String, $members: [Int!]!) {\n    create_chat(title: $title, members: $members) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateChat($title: String, $members: [Int!]!) {\n    create_chat(title: $title, members: $members) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation DeleteChat($chat_id: String!) {\n    delete_chat(chat_id: $chat_id) {\n      error\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteChat($chat_id: String!) {\n    delete_chat(chat_id: $chat_id) {\n      error\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation MarkAsReadMutation($message_id: Int!, $chat_id: String!) {\n    mark_as_read(message_id: $message_id, chat_id: $chat_id) {\n      error\n    }\n  }\n"): (typeof documents)["\n  mutation MarkAsReadMutation($message_id: Int!, $chat_id: String!) {\n    mark_as_read(message_id: $message_id, chat_id: $chat_id) {\n      error\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation createMessage($chat_id: String!, $body: String!, $reply_to: Int) {\n    create_message(chat_id: $chat_id, body: $body, reply_to: $reply_to) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation createMessage($chat_id: String!, $body: String!, $reply_to: Int) {\n    create_message(chat_id: $chat_id, body: $body, reply_to: $reply_to) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation DeleteMessage($chat_id: String!, $message_id: Int!) {\n    delete_message(chat_id: $chat_id, message_id: $message_id) {\n      error\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteMessage($chat_id: String!, $message_id: Int!) {\n    delete_message(chat_id: $chat_id, message_id: $message_id) {\n      error\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation UpdateMessage($message: MessageInput!) {\n    update_message(message: $message) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateMessage($message: MessageInput!) {\n    update_message(message: $message) {\n      error\n      message {\n        id\n        body\n        created_by\n        created_at\n        reply_to\n        updated_at\n      }\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  mutation UpdateChat($chat: ChatInput!) {\n    update_chat(chat: $chat) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateChat($chat: ChatInput!) {\n    update_chat(chat: $chat) {\n      error\n      chat {\n        id\n        members {\n          id\n          slug\n        }\n      }\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  query LoadMessagesQuery($by: MessagesBy!, $limit: Int, $offset: Int) {\n    load_messages_by(by: $by, limit: $limit, offset: $offset) {\n      error\n      messages {\n        id\n        created_by\n        body\n        reply_to\n        created_at\n        updated_at\n      }\n    }\n  }\n"): (typeof documents)["\n  query LoadMessagesQuery($by: MessagesBy!, $limit: Int, $offset: Int) {\n    load_messages_by(by: $by, limit: $limit, offset: $offset) {\n      error\n      messages {\n        id\n        created_by\n        body\n        reply_to\n        created_at\n        updated_at\n      }\n    }\n  }\n"];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(source: "\n  query GetChatsQuery($limit: Int, $offset: Int) {\n    load_chats(limit: $limit, offset: $offset) {\n      error\n      chats {\n        id\n        title\n        admins\n        members {\n          id\n          slug\n          name\n          pic\n        }\n        unread\n        description\n        updated_at\n        messages {\n          id\n          body\n          created_by\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetChatsQuery($limit: Int, $offset: Int) {\n    load_chats(limit: $limit, offset: $offset) {\n      error\n      chats {\n        id\n        title\n        admins\n        members {\n          id\n          slug\n          name\n          pic\n        }\n        unread\n        description\n        updated_at\n        messages {\n          id\n          body\n          created_by\n        }\n      }\n    }\n  }\n"];

export function gql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;