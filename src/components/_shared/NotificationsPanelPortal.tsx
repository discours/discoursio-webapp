import { NoHydration, Portal } from 'solid-js/web'
import { NotificationsPanel } from '~/components/NotificationsPanel'
import { useNotifications } from '~/context/notifications'

export const NotificationsPanelPortal = () => {
  const { isNotificationsPanelOpen, hideNotificationsPanel } = useNotifications()

  return (
    <NoHydration>
      <Portal>
        <NotificationsPanel isOpen={isNotificationsPanelOpen()} onClose={hideNotificationsPanel} />
      </Portal>
    </NoHydration>
  )
}
