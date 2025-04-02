import clsx from 'clsx'

import { useNotifications } from '~/context/notifications'
import { Icon } from '../_shared/Icon/Icon'

import styles from './Header.module.scss'

export const NotificationsBell = () => {
  const { unreadNotificationsCount, showNotificationsPanel } = useNotifications()

  const handleBellIconClick = (event: Event) => {
    event.preventDefault()
    showNotificationsPanel()
  }
  return (
    <div class={styles.userControlItem} onClick={handleBellIconClick}>
      <div class={styles.button}>
        <Icon name="bell-white" counter={unreadNotificationsCount?.() || 0} class={styles.icon} />
        <Icon
          name="bell-white-hover"
          counter={unreadNotificationsCount?.() || 0}
          class={clsx(styles.icon, styles.iconHover)}
        />
      </div>
    </div>
  )
}

export default NotificationsBell
