import { createEffect } from 'solid-js'
import { NoHydration, Portal } from 'solid-js/web'
import { NotificationsPanel } from '~/components/NotificationsPanel'
import { useNotifications } from '~/context/notifications'

export const NotificationsPanelPortal = () => {
  const { isNotificationsPanelOpen, hideNotificationsPanel } = useNotifications()

  // Debug logging
  createEffect(() => {
    console.log('[NotificationsPanelPortal] isNotificationsPanelOpen:', isNotificationsPanelOpen())
  })

  return (
    <NoHydration>
      <Portal>
        <NotificationsPanel isOpen={isNotificationsPanelOpen()} onClose={hideNotificationsPanel} />
      </Portal>
    </NoHydration>
  )
}
