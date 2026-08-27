/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Chat = {
  __typename?: 'Chat';
  admins?: Maybe<Array<Maybe<Scalars['Int']['output']>>>;
  created_at: Scalars['Int']['output'];
  created_by: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  members?: Maybe<Array<ChatMember>>;
  messages?: Maybe<Array<Message>>;
  title?: Maybe<Scalars['String']['output']>;
  unread?: Maybe<Scalars['Int']['output']>;
  updated_at: Scalars['Int']['output'];
};

export type ChatInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type ChatMember = {
  __typename?: 'ChatMember';
  id: Scalars['Int']['output'];
  last_seen: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  online?: Maybe<Scalars['Boolean']['output']>;
  pic?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
};

export type ChatResult = {
  __typename?: 'ChatResult';
  chat?: Maybe<Chat>;
  chats?: Maybe<Array<Chat>>;
  error?: Maybe<Scalars['String']['output']>;
  members?: Maybe<Array<ChatMember>>;
  message?: Maybe<Message>;
  messages?: Maybe<Array<Message>>;
};

export type Message = {
  __typename?: 'Message';
  body: Scalars['String']['output'];
  chat_id: Scalars['String']['output'];
  created_at: Scalars['Int']['output'];
  created_by: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  reply_to?: Maybe<Scalars['Int']['output']>;
  seen?: Maybe<Scalars['Boolean']['output']>;
  updated_at?: Maybe<Scalars['Int']['output']>;
};

export type MessageInput = {
  body?: InputMaybe<Scalars['String']['input']>;
  chat_id: Scalars['String']['input'];
  id: Scalars['String']['input'];
  seen?: InputMaybe<Scalars['Boolean']['input']>;
};

export enum MessageStatus {
  Deleted = 'DELETED',
  New = 'NEW',
  Updated = 'UPDATED'
}

export type MessagesBy = {
  body?: InputMaybe<Scalars['String']['input']>;
  chat?: InputMaybe<Scalars['String']['input']>;
  created_by?: InputMaybe<Scalars['String']['input']>;
  days?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<Scalars['String']['input']>;
  stat?: InputMaybe<Scalars['String']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  create_chat: ChatResult;
  create_message: ChatResult;
  delete_chat: ChatResult;
  delete_message: ChatResult;
  mark_as_read: ChatResult;
  update_chat: ChatResult;
  update_message: ChatResult;
};


export type MutationCreate_ChatArgs = {
  members: Array<InputMaybe<Scalars['Int']['input']>>;
  title?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreate_MessageArgs = {
  body: Scalars['String']['input'];
  chat_id: Scalars['String']['input'];
  reply_to?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationDelete_ChatArgs = {
  chat_id: Scalars['String']['input'];
};


export type MutationDelete_MessageArgs = {
  chat_id: Scalars['String']['input'];
  message_id: Scalars['Int']['input'];
};


export type MutationMark_As_ReadArgs = {
  chat_id: Scalars['String']['input'];
  message_id: Scalars['Int']['input'];
};


export type MutationUpdate_ChatArgs = {
  chat: ChatInput;
};


export type MutationUpdate_MessageArgs = {
  message: MessageInput;
};

export type Query = {
  __typename?: 'Query';
  load_chats: ChatResult;
  load_messages_by: ChatResult;
  search_messages: ChatResult;
  search_recipients: ChatResult;
};


export type QueryLoad_ChatsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLoad_Messages_ByArgs = {
  by: MessagesBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySearch_MessagesArgs = {
  by: MessagesBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySearch_RecipientsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};

export type CreateChatMutationVariables = Exact<{
  title?: InputMaybe<Scalars['String']['input']>;
  members: Array<Scalars['Int']['input']> | Scalars['Int']['input'];
}>;


export type CreateChatMutation = { __typename?: 'Mutation', create_chat: { __typename?: 'ChatResult', error?: string | null, chat?: { __typename?: 'Chat', id: string, members?: Array<{ __typename?: 'ChatMember', id: number, slug: string }> | null } | null } };

export type DeleteChatMutationVariables = Exact<{
  chat_id: Scalars['String']['input'];
}>;


export type DeleteChatMutation = { __typename?: 'Mutation', delete_chat: { __typename?: 'ChatResult', error?: string | null } };

export type MarkAsReadMutationMutationVariables = Exact<{
  message_id: Scalars['Int']['input'];
  chat_id: Scalars['String']['input'];
}>;


export type MarkAsReadMutationMutation = { __typename?: 'Mutation', mark_as_read: { __typename?: 'ChatResult', error?: string | null } };

export type CreateMessageMutationVariables = Exact<{
  chat_id: Scalars['String']['input'];
  body: Scalars['String']['input'];
  reply_to?: InputMaybe<Scalars['Int']['input']>;
}>;


export type CreateMessageMutation = { __typename?: 'Mutation', create_message: { __typename?: 'ChatResult', error?: string | null, message?: { __typename?: 'Message', id: number, body: string, created_by: number, created_at: number, reply_to?: number | null, updated_at?: number | null } | null } };

export type DeleteMessageMutationVariables = Exact<{
  chat_id: Scalars['String']['input'];
  message_id: Scalars['Int']['input'];
}>;


export type DeleteMessageMutation = { __typename?: 'Mutation', delete_message: { __typename?: 'ChatResult', error?: string | null } };

export type UpdateMessageMutationVariables = Exact<{
  message: MessageInput;
}>;


export type UpdateMessageMutation = { __typename?: 'Mutation', update_message: { __typename?: 'ChatResult', error?: string | null, message?: { __typename?: 'Message', id: number, body: string, created_by: number, created_at: number, reply_to?: number | null, updated_at?: number | null } | null } };

export type UpdateChatMutationVariables = Exact<{
  chat: ChatInput;
}>;


export type UpdateChatMutation = { __typename?: 'Mutation', update_chat: { __typename?: 'ChatResult', error?: string | null, chat?: { __typename?: 'Chat', id: string, members?: Array<{ __typename?: 'ChatMember', id: number, slug: string }> | null } | null } };

export type LoadMessagesQueryQueryVariables = Exact<{
  by: MessagesBy;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type LoadMessagesQueryQuery = { __typename?: 'Query', load_messages_by: { __typename?: 'ChatResult', error?: string | null, messages?: Array<{ __typename?: 'Message', id: number, created_by: number, body: string, reply_to?: number | null, created_at: number, updated_at?: number | null }> | null } };

export type GetChatsQueryQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetChatsQueryQuery = { __typename?: 'Query', load_chats: { __typename?: 'ChatResult', error?: string | null, chats?: Array<{ __typename?: 'Chat', id: string, title?: string | null, admins?: Array<number | null> | null, unread?: number | null, description?: string | null, updated_at: number, members?: Array<{ __typename?: 'ChatMember', id: number, slug: string, name: string, pic?: string | null }> | null, messages?: Array<{ __typename?: 'Message', id: number, body: string, created_by: number }> | null }> | null } };


export const CreateChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"members"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_chat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}},{"kind":"Argument","name":{"kind":"Name","value":"members"},"value":{"kind":"Variable","name":{"kind":"Name","value":"members"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"chat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateChatMutation, CreateChatMutationVariables>;
export const DeleteChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_chat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chat_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<DeleteChatMutation, DeleteChatMutationVariables>;
export const MarkAsReadMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkAsReadMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"message_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mark_as_read"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"message_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"message_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"chat_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<MarkAsReadMutationMutation, MarkAsReadMutationMutationVariables>;
export const CreateMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"createMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"body"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reply_to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"create_message"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chat_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"body"},"value":{"kind":"Variable","name":{"kind":"Name","value":"body"}}},{"kind":"Argument","name":{"kind":"Name","value":"reply_to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reply_to"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]}}]} as unknown as DocumentNode<CreateMessageMutation, CreateMessageMutationVariables>;
export const DeleteMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"message_id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delete_message"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chat_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chat_id"}}},{"kind":"Argument","name":{"kind":"Name","value":"message_id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"message_id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]} as unknown as DocumentNode<DeleteMessageMutation, DeleteMessageMutationVariables>;
export const UpdateMessageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMessage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"message"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MessageInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_message"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"message"},"value":{"kind":"Variable","name":{"kind":"Name","value":"message"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"message"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateMessageMutation, UpdateMessageMutationVariables>;
export const UpdateChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chat"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"update_chat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chat"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chat"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"chat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdateChatMutation, UpdateChatMutationVariables>;
export const LoadMessagesQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LoadMessagesQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"by"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MessagesBy"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_messages_by"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"by"},"value":{"kind":"Variable","name":{"kind":"Name","value":"by"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"reply_to"}},{"kind":"Field","name":{"kind":"Name","value":"created_at"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}}]}}]}}]}}]} as unknown as DocumentNode<LoadMessagesQueryQuery, LoadMessagesQueryQueryVariables>;
export const GetChatsQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetChatsQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"load_chats"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"chats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"admins"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"pic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unread"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"updated_at"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"created_by"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetChatsQueryQuery, GetChatsQueryQueryVariables>;