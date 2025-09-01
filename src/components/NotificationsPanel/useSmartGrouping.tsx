/**
 * 🚀 Smart Grouping Hook
 * Quick integration with existing NotificationsPanel
 */

import { createEffect, createMemo } from 'solid-js'
import type { NotificationGroup } from '~/graphql/generated/graphql'
import type { ClientNotificationGroup } from '~/types/notifications'
import { groupNotifications } from './notificationGrouper'

interface UseSmartGroupingProps {
  notifications: NotificationGroup[]
  systemNotifications: Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    timestamp: number
    dismissed?: boolean
  }>
  enabled?: boolean
}

export function useSmartGrouping(props: UseSmartGroupingProps) {
  // 🔍 Debug SSE integration
  createEffect(() => {
    if (props.notifications.length > 0) {
      console.log('🔔 Smart grouping: received notifications:', props.notifications.length)
    }
    if (props.systemNotifications.length > 0) {
      console.log('🔔 Smart grouping: received system notifications:', props.systemNotifications.length)
    }
  })

  // Group notifications smartly
  const groupedNotifications = createMemo(() => {
    if (!props.enabled) {
      // Return original format for backward compatibility
      return props.notifications.map((n) => ({
        id: `single_${n.thread}`,
        type: 'single' as const,
        category: 'other' as const,
        priority: 'normal' as const,
        title: getNotificationText(n),
        count: 1,
        collapsed: false,
        notifications: [n],
        avatars: (n.authors?.map((a) => a?.pic).filter(Boolean) as string[]) || [],
        timestamp: n.updated_at * 1000,
        actions: [],
        metadata: {
          originalIds: [n.thread],
          groupingRule: 'legacy',
          importance: 1
        }
      }))
    }

    return groupNotifications(props.notifications, props.systemNotifications)
  })

  // Filter by time periods for existing layout
  const todayGroups = createMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()

    return groupedNotifications().filter((group) => group.timestamp >= todayTimestamp)
  })

  const yesterdayGroups = createMemo(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayStart = yesterday.getTime()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()

    return groupedNotifications().filter((group) => group.timestamp >= yesterdayStart && group.timestamp < todayStart)
  })

  const earlierGroups = createMemo(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayStart = yesterday.getTime()

    return groupedNotifications().filter((group) => group.timestamp < yesterdayStart)
  })

  // Handle actions
  const handleGroupAction = (group: ClientNotificationGroup, actionId: string) => {
    const action = group.actions.find((a) => a.id === actionId)
    if (action?.handler) {
      action.handler()
    }
  }

  const handleGroupClick = (group: ClientNotificationGroup) => {
    // Default action is to view the first notification
    if (group.actions.length > 0) {
      const viewAction = group.actions.find((a) => a.type === 'view') || group.actions[0]
      if (viewAction?.handler) {
        viewAction.handler()
      }
    }
  }

  return {
    groupedNotifications,
    todayGroups,
    yesterdayGroups,
    earlierGroups,
    handleGroupAction,
    handleGroupClick,
    // Stats for demo
    stats: createMemo(() => ({
      originalCount: props.notifications.length + props.systemNotifications.filter((s) => !s.dismissed).length,
      groupedCount: groupedNotifications().length,
      reductionPercent: Math.round(
        ((props.notifications.length - groupedNotifications().filter((g) => g.category !== 'system').length) /
          Math.max(props.notifications.length, 1)) *
          100
      )
    }))
  }
}

// Helper function (keeping it simple for demo)
function getNotificationText(notification: NotificationGroup): string {
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
