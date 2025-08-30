/**
 * Типы уведомлений для presence сервиса
 */

// Типы уведомлений, которые могут приходить от presence сервиса
export enum PresenceEntityType {
  Global = 'global',
  Personal = 'personal',
  Topic = 'topic',
  Shout = 'shout',
  Reaction = 'reaction',
  Chat = 'chat',
  Message = 'message',
  Editor = 'editor',
  Cursor = 'cursor',
  Draft = 'draft',
  Proposal = 'proposal',
  Follower = 'follower' // Новый тип для уведомлений о подписчиках
}

// Действия, которые могут происходить с сущностями
export enum PresenceActionType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Join = 'join',
  Left = 'left',
  Seen = 'seen'
}
