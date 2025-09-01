/**
 * 🚀 Notification Grouper - Fast & Simple
 * Smart grouping with toast integration
 */

import type { NotificationGroup } from '~/graphql/generated/graphql'
import type { ClientNotificationGroup, NotificationAction, NotificationCategory } from '~/types/notifications'

// 🎯 Simple grouping for notifications
export function groupNotifications(
  notifications: NotificationGroup[],
  systemNotifications: Array<{ id: string; message: string; type: string; timestamp: number; dismissed?: boolean }> = []
): ClientNotificationGroup[] {
  if (notifications.length === 0 && systemNotifications.length === 0) {
    return []
  }

  const groups: ClientNotificationGroup[] = []

  // 1. Add system notifications as high-priority groups
  systemNotifications
    .filter((sn) => !sn.dismissed)
    .forEach((sysNotif) => {
      groups.push({
        id: `system_${sysNotif.id}`,
        type: 'single',
        category: 'system',
        priority: 'high',
        title: sysNotif.message,
        count: 1,
        collapsed: false,
        notifications: [], // No underlying notifications for system
        avatars: [],
        timestamp: sysNotif.timestamp,
        actions: [
          {
            id: 'dismiss',
            type: 'dismiss',
            label: 'Dismiss',
            variant: 'secondary',
            handler: () => {
              // Emit event to dismiss system notification
              window.dispatchEvent(
                new CustomEvent('system-notification:dismiss', {
                  detail: { id: sysNotif.id }
                })
              )
            }
          }
        ],
        metadata: {
          originalIds: [sysNotif.id],
          groupingRule: 'system',
          importance: 3 // High priority for system notifications
        }
      })
    })

  // 2. Simple grouping for regular notifications
  const regularGroups = simpleGroup(notifications)
  groups.push(...regularGroups)

  // 3. Sort by priority and timestamp
  return groups.sort((a, b) => {
    // System notifications first
    if (a.category === 'system' && b.category !== 'system') return -1
    if (b.category === 'system' && a.category !== 'system') return 1

    // Then by timestamp
    return b.timestamp - a.timestamp
  })
}

function simpleGroup(notifications: NotificationGroup[]): ClientNotificationGroup[] {
  const groups = new Map<string, NotificationGroup[]>()

  notifications.forEach((notification) => {
    const category = detectSimpleCategory(notification)
    const key = generateSimpleKey(notification, category)

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(notification)
  })

  return Array.from(groups.entries()).map(([key, items]) => ({
    id: key,
    type: items.length > 1 ? 'grouped' : 'single',
    category: detectSimpleCategory(items[0]),
    priority: 'normal',
    title: generateSimpleTitle(items),
    description: items.length > 1 ? generateSimpleDescription(items) : undefined,
    count: items.length,
    collapsed: items.length > 2,
    notifications: items.sort((a, b) => b.updated_at - a.updated_at),
    avatars: extractSimpleAvatars(items),
    timestamp: Math.max(...items.map((n) => n.updated_at * 1000)),
    actions: generateSimpleActions(items),
    metadata: {
      originalIds: items.map((n) => n.thread),
      groupingRule: key,
      importance: 1
    }
  }))
}

function detectSimpleCategory(notification: NotificationGroup): NotificationCategory {
  const text = getSimpleText(notification)

  if (text.includes('подписал') || text.includes('follow')) return 'follow'
  if (text.includes('комментар') || text.includes('comment')) return 'comment'
  if (text.includes('лайк') || text.includes('like') || text.includes('reaction')) return 'reaction'
  if (text.includes('сообщение') || text.includes('message')) return 'message'

  return 'other'
}

function generateSimpleKey(notification: NotificationGroup, category: NotificationCategory): string {
  switch (category) {
    case 'follow':
      return 'follows'
    case 'comment':
      return `comments_${notification.shout?.id || 'unknown'}`
    case 'reaction':
      return `reactions_${notification.shout?.id || 'unknown'}`
    default:
      return `single_${notification.thread}_${Date.now()}`
  }
}

function generateSimpleTitle(items: NotificationGroup[]): string {
  const count = items.length
  const first = items[0]
  const category = detectSimpleCategory(first)

  if (count === 1) {
    return getSimpleText(first)
  }

  const authorName = first.authors?.[0]?.name || 'User'
  const postTitle = first.shout?.title || 'your post'

  switch (category) {
    case 'follow':
      return count === 2 ? `${authorName} and 1 other subscribed` : `${authorName} and ${count - 1} others subscribed`

    case 'comment':
      return count === 2
        ? `New comments on "${truncate(postTitle)}"`
        : `${count} new comments on "${truncate(postTitle)}"`

    case 'reaction':
      return count === 2
        ? `New reactions to "${truncate(postTitle)}"`
        : `${count} new reactions to "${truncate(postTitle)}"`

    default:
      return `${count} notifications`
  }
}

function generateSimpleDescription(items: NotificationGroup[]): string {
  const authors = new Set(items.flatMap((item) => item.authors?.map((a) => a?.name).filter(Boolean) || []))

  if (authors.size <= 3) {
    return `From: ${Array.from(authors).join(', ')}`
  }

  return `From: ${Array.from(authors).slice(0, 2).join(', ')} and ${authors.size - 2} others`
}

function extractSimpleAvatars(items: NotificationGroup[]): string[] {
  const avatars = new Set<string>()

  items.forEach((item) => {
    item.authors?.forEach((author) => {
      if (author?.pic) avatars.add(author.pic)
    })
  })

  return Array.from(avatars).slice(0, 4)
}

function generateSimpleActions(items: NotificationGroup[]): NotificationAction[] {
  const first = items[0]
  const category = detectSimpleCategory(first)

  const actions: NotificationAction[] = [
    {
      id: 'view',
      type: 'view' as const,
      label: 'View',
      variant: 'primary' as const,
      handler: () => {
        const url = first.shout?.slug ? `/${first.shout.slug}` : '/inbox'
        window.location.href = url
      }
    }
  ]

  if (category === 'follow') {
    actions.push({
      id: 'follow',
      type: 'follow' as const,
      label: 'Follow',
      variant: 'primary' as const,
      handler: () => console.log('Follow back:', items)
    })
  }

  actions.push({
    id: 'dismiss',
    type: 'dismiss' as const,
    label: 'Dismiss',
    variant: 'destructive' as const,
    handler: () => {
      window.dispatchEvent(
        new CustomEvent('notifications:dismissed', {
          detail: { threadIds: items.map((n) => n.thread) }
        })
      )
    }
  })

  return actions
}

function getSimpleText(notification: NotificationGroup): string {
  if (notification.entity && notification.action) {
    const entityMap = {
      reaction: 'New reaction to your content',
      message: 'New message',
      shout: 'New publication',
      follower: 'New follower'
    }
    return entityMap[notification.entity as keyof typeof entityMap] || 'Notification'
  }

  return notification.thread?.includes(':') ? 'New replies to your comment' : 'New comments to your publication'
}

function truncate(text: string, maxLength = 30): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength).trim()}...`
}

// 🚀 Easy integration hook
export function useNotificationGrouping() {
  return {
    groupNotifications
    // Add more hooks as needed
  }
}
