/**
 * 🔔 Notifications System Types
 * Система типов для уведомлений
 */

import type { NotificationGroup } from '~/graphql/generated/graphql'

// ===== PRESENCE SYSTEM TYPES (из notifications.ts) =====

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
  Follower = 'follower'
}

export enum PresenceActionType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Join = 'join',
  Left = 'left',
  Seen = 'seen'
}

// ===== CORE NOTIFICATION TYPES =====

export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low'
export type NotificationChannel = 'web' | 'email' | 'push'
export type NotificationFrequency = 'instant' | 'batched' | 'hourly' | 'daily'

// Унифицированная категория уведомлений
export type NotificationCategory =
  | 'reaction' // Реакции на контент
  | 'comment' // Комментарии
  | 'follow' // Подписки
  | 'mention' // Упоминания
  | 'system' // Системные уведомления
  | 'publication' // Новые публикации
  | 'message' // Личные сообщения
  | 'suggestion' // Предложения к черновикам
  | 'other' // Прочие

// ===== SMART GROUPING TYPES =====

// Клиентская группа уведомлений (основная структура)
export interface ClientNotificationGroup {
  id: string
  type: 'single' | 'grouped'
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  description?: string
  count: number
  collapsed: boolean

  // Данные
  notifications: NotificationGroup[]
  avatars: string[]
  timestamp: number // время последнего уведомления

  // Интерактивность
  actions: NotificationAction[]
  readAt?: number
  dismissedAt?: number

  // Метаданные
  metadata: {
    originalIds: string[]
    groupingRule: string
    entityId?: string
    entityTitle?: string
    aggregationRules?: string[]
    importance: number
  }
}

// Быстрые действия для уведомлений
export interface NotificationAction {
  id: string
  type: 'like' | 'reply' | 'follow' | 'dismiss' | 'mute' | 'navigate' | 'quick_reply' | 'view' | 'expand' | 'skip'
  label: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'destructive'
  primary?: boolean
  handler: () => void | Promise<void>
  loading?: boolean
  shortcut?: string
}

// Контекст уведомления
export interface NotificationContext {
  entityType: 'shout' | 'comment' | 'author' | 'topic'
  entityId: string
  entityTitle?: string
  authorName?: string
  authorSlug?: string
  preview?: string
  url: string
}

// Расширенная сущность уведомления
export interface EnhancedNotificationEntity {
  id: string
  type: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  avatar?: string
  timestamp: number
  readAt?: number
  context: NotificationContext
  actions: NotificationAction[]
  metadata: {
    sourceId: string
    authorId?: string
    entityType: 'shout' | 'comment' | 'author' | 'topic'
    entityId: string
  }
}

// ===== GROUPING LOGIC =====

// Правила группировки
export interface GroupingRule {
  id: string
  category: NotificationCategory
  pattern: RegExp | string
  timeWindow: number // в миллисекундах
  maxGroupSize: number
  autoCollapse: boolean
  priority: NotificationPriority
}

// Настройки группировки (localStorage)
export interface GroupingSettings {
  enabled: boolean
  autoCollapse: boolean
  collapseThreshold: number
  timeWindow: number
  smartGrouping: boolean

  categories: Record<
    NotificationCategory,
    {
      enabled: boolean
      frequency: NotificationFrequency
      priority: NotificationPriority
      channels: NotificationChannel[]
      autoGroup: boolean
      collapseAfter: number
    }
  >

  customRules: GroupingRule[]
}

// Результат парсинга уведомления
export interface ParsedNotification {
  category: NotificationCategory
  entityType?: 'shout' | 'comment' | 'author' | 'topic'
  entityId?: string
  entityTitle?: string
  authorIds: string[]
  action: string
  importance: number
}

// ===== SYSTEM SETTINGS =====

// Глобальные настройки уведомлений
export interface NotificationSettings {
  // Основные настройки
  enabled: boolean
  quietHours: { start: string; end: string }
  maxNotificationsPerDay: number

  // По категориям
  categories: Record<
    NotificationCategory,
    {
      enabled: boolean
      frequency: NotificationFrequency
      priority: NotificationPriority
      channels: NotificationChannel[]
      autoGroup: boolean
      collapseAfter: number
    }
  >

  // По каналам
  channels: Record<
    NotificationChannel,
    {
      enabled: boolean
      quietHours: { start: string; end: string }
      retryOnFailure: boolean
    }
  >

  // Продвинутые настройки
  smartGrouping: boolean
  contextualPreviews: boolean
  instantActions: boolean
  crossDeviceSync: boolean
}

// ===== QUEUE & PROCESSING =====

// Очередь уведомлений
export interface NotificationQueue {
  id: string
  priority: NotificationPriority
  items: EnhancedNotificationEntity[]
  processingStrategy: 'fifo' | 'priority' | 'smart'
  batchSize: number
  flushInterval: number
  retryCount: number
}

// Дедупликация
export interface NotificationDeduplicator {
  rules: DeduplicationRule[]
  cache: Map<string, string> // hash -> groupId
  timeWindow: number // время для группировки в мс
}

export interface DeduplicationRule {
  category: NotificationCategory
  groupBy: ('authorId' | 'entityId' | 'type')[]
  timeWindow: number
  maxCount: number
  mergeStrategy: 'count' | 'latest' | 'important'
}

// ===== STREAMING =====

// Real-time поток уведомлений
export interface NotificationStream {
  subscribe(callback: (notification: EnhancedNotificationEntity) => void): () => void
  unsubscribe(): void
  reconnect(): Promise<void>
  getStatus(): 'connected' | 'connecting' | 'disconnected' | 'error'
}

export interface StreamConfig {
  url: string
  reconnectDelay: number
  maxReconnectAttempts: number
  heartbeatInterval: number
  protocols: ('sse' | 'websocket' | 'polling')[]
}

// ===== ANALYTICS & STATS =====

// Статистика группировки
export interface GroupingStats {
  originalCount: number
  groupedCount: number
  reductionPercent: number
  largestGroup: number
  avgGroupSize: number
  categoriesReduced: Record<NotificationCategory, number>
}

// Контекст группировки
export interface GroupingContext {
  timeWindow: number
  maxGroupSize: number
  rules: GroupingRule[]
  settings: GroupingSettings
}

// ===== LEGACY COMPATIBILITY =====

// Для совместимости с существующим кодом
export interface SystemNotification {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  timestamp: number
  dismissed?: boolean
}

// ===== TYPE GUARDS =====

export function isGroupedNotification(
  item: ClientNotificationGroup
): item is ClientNotificationGroup & { type: 'grouped' } {
  return item.type === 'grouped' && item.count > 1
}

export function isSingleNotification(
  item: ClientNotificationGroup
): item is ClientNotificationGroup & { type: 'single' } {
  return item.type === 'single' && item.count === 1
}

export function isHighPriority(notification: ClientNotificationGroup): boolean {
  return notification.priority === 'high' || notification.priority === 'urgent'
}

export function isSystemCategory(category: NotificationCategory): boolean {
  return category === 'system'
}

// ===== MIGRATION HELPERS =====

// Маппинг старых категорий в новые
export const CATEGORY_MIGRATION_MAP: Record<string, NotificationCategory> = {
  follow: 'follow',
  subscription: 'follow', // объединяем с follow
  publication: 'publication',
  reaction: 'reaction',
  comment: 'comment',
  mention: 'mention',
  system: 'system',
  message: 'message',
  suggestion: 'suggestion',
  other: 'other'
} as const

// Нормализация категории
export function normalizeCategory(category: string): NotificationCategory {
  return CATEGORY_MIGRATION_MAP[category] || 'other'
}

// ===== DEFAULT VALUES =====

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  quietHours: { start: '22:00', end: '08:00' },
  maxNotificationsPerDay: 50,
  categories: {
    reaction: {
      enabled: true,
      frequency: 'batched',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 3
    },
    comment: {
      enabled: true,
      frequency: 'instant',
      priority: 'high',
      channels: ['web', 'push'],
      autoGroup: true,
      collapseAfter: 2
    },
    follow: {
      enabled: true,
      frequency: 'batched',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 2
    },
    mention: {
      enabled: true,
      frequency: 'instant',
      priority: 'high',
      channels: ['web', 'push'],
      autoGroup: false,
      collapseAfter: 1
    },
    system: {
      enabled: true,
      frequency: 'instant',
      priority: 'normal',
      channels: ['web'],
      autoGroup: false,
      collapseAfter: 3
    },
    publication: {
      enabled: true,
      frequency: 'hourly',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 5
    },
    message: {
      enabled: true,
      frequency: 'instant',
      priority: 'urgent',
      channels: ['web', 'push'],
      autoGroup: false,
      collapseAfter: 1
    },
    suggestion: {
      enabled: true,
      frequency: 'batched',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 2
    },
    other: {
      enabled: true,
      frequency: 'batched',
      priority: 'low',
      channels: ['web'],
      autoGroup: false,
      collapseAfter: 5
    }
  },
  channels: {
    web: { enabled: true, quietHours: { start: '22:00', end: '08:00' }, retryOnFailure: true },
    email: { enabled: false, quietHours: { start: '22:00', end: '08:00' }, retryOnFailure: true },
    push: { enabled: true, quietHours: { start: '22:00', end: '08:00' }, retryOnFailure: true }
  },
  smartGrouping: true,
  contextualPreviews: true,
  instantActions: true,
  crossDeviceSync: false
}

export const DEFAULT_GROUPING_SETTINGS: GroupingSettings = {
  enabled: true,
  autoCollapse: true,
  collapseThreshold: 2,
  timeWindow: 24 * 60 * 60 * 1000, // 24 часа
  smartGrouping: true,
  categories: {
    reaction: {
      enabled: true,
      frequency: 'batched',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 3
    },
    comment: {
      enabled: true,
      frequency: 'instant',
      priority: 'high',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 2
    },
    follow: {
      enabled: true,
      frequency: 'batched',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 2
    },
    mention: {
      enabled: true,
      frequency: 'instant',
      priority: 'high',
      channels: ['web'],
      autoGroup: false,
      collapseAfter: 1
    },
    system: {
      enabled: true,
      frequency: 'instant',
      priority: 'normal',
      channels: ['web'],
      autoGroup: false,
      collapseAfter: 3
    },
    publication: {
      enabled: true,
      frequency: 'hourly',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 5
    },
    message: {
      enabled: true,
      frequency: 'instant',
      priority: 'urgent',
      channels: ['web'],
      autoGroup: false,
      collapseAfter: 1
    },
    suggestion: {
      enabled: true,
      frequency: 'batched',
      priority: 'normal',
      channels: ['web'],
      autoGroup: true,
      collapseAfter: 2
    },
    other: {
      enabled: true,
      frequency: 'batched',
      priority: 'low',
      channels: ['web'],
      autoGroup: false,
      collapseAfter: 5
    }
  },
  customRules: []
}
