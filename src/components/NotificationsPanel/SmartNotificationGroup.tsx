/**
 * 🚀 Smart Notification Group - Demo Ready
 * Simple grouped notification display with toast integration
 */

import { clsx } from 'clsx'
import { createSignal, For, Show } from 'solid-js'
import type { Author } from '~/graphql/generated/graphql'
import type { ClientNotificationGroup } from '~/types/notifications'
import { GroupAvatar } from '../_shared/GroupAvatar'
import { Icon } from '../_shared/Icon'
import { TimeAgo } from '../_shared/TimeAgo'
import styles from './NotificationView/NotificationView.module.scss'

type Props = {
  group: ClientNotificationGroup
  onClick: () => void
  onActionClick: (actionId: string) => void
  dateTimeFormat: 'ago' | 'time' | 'date'
  class?: string
}

export const SmartNotificationGroup = (props: Props) => {
  const [expanded, setExpanded] = createSignal(false)

  const toggleExpanded = (e: Event) => {
    e.stopPropagation()
    setExpanded(!expanded())
  }

  const handleActionClick = (actionId: string, e: Event) => {
    e.stopPropagation()
    props.onActionClick(actionId)
  }

  const isGrouped = () => props.group.type === 'grouped' && props.group.count > 1

  return (
    <div class={clsx(styles.NotificationView, props.class)}>
      {/* Main notification display */}
      <div class={styles.userpic}>
        <GroupAvatar authors={(props.group.notifications[0]?.authors?.filter(Boolean) as Author[]) || []} />
      </div>

      <div style="flex: 1;">
        {/* Group title with expand/collapse */}
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 500;">{props.group.title}</span>

          <Show when={isGrouped()}>
            <button
              onClick={toggleExpanded}
              style="background: none; border: none; cursor: pointer; padding: 4px;"
              title={expanded() ? 'Collapse' : 'Expand'}
            >
              <Icon name={expanded() ? 'chevron-up' : 'chevron-down'} style="width: 16px; height: 16px;" />
            </button>
          </Show>

          {/* Count badge for grouped notifications */}
          <Show when={isGrouped()}>
            <span
              style="
              background: var(--primary-color, #007acc);
              color: white;
              border-radius: 12px;
              padding: 2px 8px;
              font-size: 12px;
              font-weight: 500;
            "
            >
              {props.group.count}
            </span>
          </Show>
        </div>

        {/* Description for grouped items */}
        <Show when={props.group.description}>
          <div style="color: var(--text-secondary, #666); font-size: 14px; margin-top: 4px;">
            {props.group.description}
          </div>
        </Show>

        {/* Expanded list of individual notifications */}
        <Show when={expanded() && isGrouped()}>
          <div style="margin-top: 12px; padding-left: 16px; border-left: 2px solid var(--border-color, #eee);">
            <For each={props.group.notifications.slice(0, 5)}>
              {(notification) => (
                <div style="padding: 8px 0; border-bottom: 1px solid var(--border-light, #f5f5f5);">
                  <div style="font-size: 14px;">
                    {notification.authors?.[0]?.name || 'User'} •
                    <TimeAgo date={notification.updated_at} />
                  </div>
                  <Show when={notification.shout?.title}>
                    <div style="font-size: 13px; color: var(--text-secondary, #666); margin-top: 2px;">
                      "{notification.shout?.title?.substring(0, 50)}..."
                    </div>
                  </Show>
                </div>
              )}
            </For>
            <Show when={props.group.notifications.length > 5}>
              <div style="padding: 8px 0; color: var(--text-secondary, #666); font-size: 14px;">
                +{props.group.notifications.length - 5} more...
              </div>
            </Show>
          </div>
        </Show>

        {/* Quick actions */}
        <Show when={props.group.actions.length > 0}>
          <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
            <For each={props.group.actions.slice(0, 3)}>
              {(action) => (
                <button
                  onClick={(e) => handleActionClick(action.id, e)}
                  style={`
                    padding: 6px 12px;
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 6px;
                    background: ${action.variant === 'primary' ? 'var(--primary-color, #007acc)' : 'white'};
                    color: ${action.variant === 'primary' ? 'white' : 'var(--text-color, #333)'};
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                  `}
                  onMouseOver={(e) => {
                    if (action.variant !== 'primary') {
                      e.currentTarget.style.background = 'var(--hover-color, #f5f5f5)'
                    }
                  }}
                  onMouseOut={(e) => {
                    if (action.variant !== 'primary') {
                      e.currentTarget.style.background = 'white'
                    }
                  }}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Timestamp */}
      <div class={styles.timeContainer}>
        <Show when={props.dateTimeFormat === 'ago'}>
          <TimeAgo date={Math.floor(props.group.timestamp / 1000)} />
        </Show>
      </div>
    </div>
  )
}
