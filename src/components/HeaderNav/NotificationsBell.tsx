import clsx from 'clsx'

import { useNotifications } from '~/context/notifications'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { Icon } from '../_shared/Icon/Icon'

import styles from './Header.module.scss'

export const NotificationsBell = () => {
  const { unreadNotificationsCount, showNotificationsPanel, hideNotificationsPanel, isNotificationsPanelOpen } =
    useNotifications()
  const { session } = useSession()
  const { showModal } = useUI()

  const isAuthorized = () => Boolean(session()?.token && session()?.author)

  const handleBellIconClick = (event: Event) => {
    event.preventDefault()

    console.log('[NotificationsBell] Click event:', {
      isAuthorized: isAuthorized(),
      hasSession: !!session(),
      hasToken: !!session()?.token,
      hasAuthor: !!session()?.author,
      isPanelOpen: isNotificationsPanelOpen()
    })

    // Если пользователь не авторизован, показываем модаль авторизации
    if (!isAuthorized()) {
      console.log('[NotificationsBell] Guest user clicked, showing auth modal')
      showModal('auth')
      return
    }

    // Если авторизован, работаем с панелью уведомлений
    console.log('[NotificationsBell] Authorized user clicked, calling toggle functions')

    if (isNotificationsPanelOpen()) {
      console.log('[NotificationsBell] Hiding panel')
      hideNotificationsPanel()
    } else {
      console.log('[NotificationsBell] Showing panel')
      showNotificationsPanel()
    }
    
    // Проверяем состояние после вызова
    setTimeout(() => {
      console.log('[NotificationsBell] State after toggle:', isNotificationsPanelOpen())
    }, 100)
  }
  return (
    <div
      class={clsx(styles.userControlItem, {
        [styles.active]: isAuthorized() && isNotificationsPanelOpen()
      })}
      onClick={handleBellIconClick}
    >
      <div class={styles.button}>
        <Icon name="bell-white" counter={isAuthorized() ? unreadNotificationsCount?.() || 0 : 0} class={styles.icon} />
        <Icon
          name="bell-white-hover"
          counter={isAuthorized() ? unreadNotificationsCount?.() || 0 : 0}
          class={clsx(styles.icon, styles.iconHover)}
        />
      </div>
    </div>
  )
}

export default NotificationsBell
