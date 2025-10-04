import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { useLocalize } from '~/context/localize'
import styles from './ProfileSettingsNavigation.module.scss'

export const ProfileSettingsNavigation = () => {
  const { t } = useLocalize()
  const loc = useLocation()
  return (
    <>
      <h4 class={styles.navigationHeader}>{t('Settings')}</h4>
      <ul class={clsx(styles.navigation, 'nodash')}>
        <li class={clsx({ [styles.active]: loc?.pathname === '/settings' })}>
          <a href="/settings">{t('Profile')}</a>
        </li>
        <li class={clsx({ [styles.active]: loc?.pathname === '/settings/subs' })}>
          <a href="/settings/subs">{t('Subscriptions')}</a>
        </li>
        <li class={clsx({ [styles.active]: loc?.pathname === '/settings/notifications' })}>
          <a href="/settings/notifications">{t('Notifications')}</a>
        </li>
        <li class={clsx({ [styles.active]: loc?.pathname === '/settings/security' })}>
          <a href="/settings/security">{t('Security')}</a>
        </li>
      </ul>
    </>
  )
}
