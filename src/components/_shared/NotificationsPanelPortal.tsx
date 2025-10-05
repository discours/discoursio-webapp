import { createEffect } from 'solid-js'
import { NoHydration, Portal } from 'solid-js/web'
import { NotificationsPanel } from '~/components/NotificationsPanel'
import { useNotifications } from '~/context/notifications'

export const NotificationsPanelPortal = () => {
  const { isNotificationsPanelOpen, hideNotificationsPanel } = useNotifications()

  // Debug logging
  createEffect(() => {
    console.log('[NotificationsPanelPortal] isNotificationsPanelOpen changed:', isNotificationsPanelOpen())
    console.log('[NotificationsPanelPortal] Portal exists in DOM:', typeof document !== 'undefined' && !!document.body)
  })

  return (
    <NoHydration>
      <Portal mount={typeof document !== 'undefined' ? document.body : undefined}>
        <NotificationsPanel isOpen={isNotificationsPanelOpen()} onClose={hideNotificationsPanel} />
      </Portal>
    </NoHydration>
  )
}
