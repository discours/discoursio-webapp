import { Portal } from 'solid-js/web'
import { NotificationsPanel } from '~/components/NotificationsPanel'
import { useNotifications } from '~/context/notifications'
import { NoHydration } from 'solid-js/web'
import { ShowIfAuthenticated } from './ShowIfAuthenticated'

export const NotificationsPanelPortal = () => {
  const { isNotificationsPanelOpen, hideNotificationsPanel } = useNotifications()

  return (
    <NoHydration>
      <ShowIfAuthenticated>
        <Portal>
          <NotificationsPanel isOpen={isNotificationsPanelOpen()} onClose={hideNotificationsPanel} />
        </Portal>
      </ShowIfAuthenticated>
    </NoHydration>
  )
}
