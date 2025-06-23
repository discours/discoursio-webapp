import { Portal } from 'solid-js/web'
import { NotificationsPanel } from '~/components/NotificationsPanel'
import { useNotifications } from '~/context/notifications'
import { ClientOnly } from '~/utils/clientonly'
import { ShowIfAuthenticated } from './ShowIfAuthenticated'

export const NotificationsPanelPortal = () => {
  const { isNotificationsPanelOpen, hideNotificationsPanel } = useNotifications()

  return (
    <ClientOnly>
      <ShowIfAuthenticated>
        <Portal>
          <NotificationsPanel isOpen={isNotificationsPanelOpen()} onClose={hideNotificationsPanel} />
        </Portal>
      </ShowIfAuthenticated>
    </ClientOnly>
  )
}
