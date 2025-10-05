import { A } from '@solidjs/router'
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { getStorageStats } from '~/components/SimpleRichEditor/lib/storage'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'
import type { PopupProps } from '../_shared/Popup'
import { Popup } from '../_shared/Popup'
import styles from '../_shared/Popup/Popup.module.scss'

type ProfilePopupProps = Omit<PopupProps, 'children'>

export const ProfilePopup = (props: ProfilePopupProps) => {
  const { session, signOut } = useSession()
  const author = createMemo(() => session()?.author || null)
  const { t } = useLocalize()

  // Состояние для оффлайн-функций
  const [isOnline, setIsOnline] = createSignal(true)
  const [storageStats, setStorageStats] = createSignal({
    syncPending: 0,
    syncFailed: 0,
    draftsCount: 0,
    quota: { percentage: 0 }
  })

  // Мониторинг сетевого статуса и синхронизации
  onMount(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Проверяем состояние синхронизации
    const updateStorageInfo = () => {
      try {
        const stats = getStorageStats()
        setStorageStats(stats)
      } catch (error) {
        console.error('[ProfilePopup] Storage stats check failed:', error)
      }
    }

    updateStorageInfo()
    const interval = setInterval(updateStorageInfo, 30000) // каждые 30 секунд

    onCleanup(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    })
  })

  // Определяем нужно ли показывать статус и какой
  const syncStatus = createMemo(() => {
    const stats = storageStats()
    const online = isOnline()

    // Если оффлайн и есть несинхронизированные данные
    if (!online && (stats.syncPending > 0 || stats.draftsCount > 0)) {
      return {
        show: true,
        icon: 'wifi-off',
        tooltip: t('Working offline. Some drafts need sync when online.', {
          count: stats.draftsCount
        }),
        className: styles.iconOffline
      }
    }

    // Если есть ошибки синхронизации
    if (stats.syncFailed > 0) {
      return {
        show: true,
        icon: 'sync-problem',
        tooltip: stats.syncFailed
          ? t('some drafts failed to sync. Click to review.', { count: stats.syncFailed || 0 })
          : '',
        className: styles.iconWarning
      }
    }

    // Если есть несинхронизированные черновики (онлайн)
    if (online && stats.syncPending > 0) {
      return {
        show: true,
        icon: 'cloud-upload',
        tooltip: t('some drafts waiting for sync. Click to review.', { count: stats.syncPending }),
        className: styles.iconInfo
      }
    }

    // Всё в порядке - не показываем иконку
    return { show: false }
  })

  const handleSyncClick = () => {
    // Переход в черновики для управления синхронизацией
    window.location.href = '/edit'
  }

  return (
    <Popup {...props} popupCssClass={styles.profilePopup}>
      <Show when={author()}>
        {/* Информация о пользователе со статусом */}
        <div class={styles.userInfo}>
          <div class={styles.userHeader}>
            <A href={`/author/${author()?.slug}`} class={styles.userDetailsLink}>
              <div class={styles.userName}>{author()?.name}</div>
              <div class={styles.userSlug}>@{author()?.slug}</div>
            </A>
            <Show when={syncStatus().show}>
              <div class={styles.userStatus}>
                <Popover content={syncStatus().tooltip || ''}>
                  {(ref) => (
                    <div ref={ref} onClick={handleSyncClick} class={styles.statusIcon}>
                      <Icon name={syncStatus().icon || 'alert-triangle'} class={syncStatus().className} />
                    </div>
                  )}
                </Popover>
              </div>
            </Show>
          </div>
        </div>

        {/* Разделитель */}
        <div class={styles.popupDivider} />

        <ul class="nodash">
          {/* Быстрые действия */}
          <li>
            <A href="/edit" class={styles.action}>
              <div class={styles.icon}>
                <Icon name="edit" />
              </div>
              <span>{t('Drafts')}</span>
            </A>
          </li>

          <li>
            <A href="/feed/bookmarked" class={styles.action}>
              <div class={styles.icon}>
                <Icon name="bookmark" />
              </div>
              <span>{t('Bookmarks')}</span>
            </A>
          </li>
        </ul>

        <ul class="nodash">
          {/* Навигация по настройкам */}
          <li>
            <A href="/settings" class={styles.action}>
              <div class={styles.icon}>
                <Icon name="settings" />
              </div>
              <span>{t('Profile settings')}</span>
            </A>
          </li>

          <li>
            <A href="/settings/security" class={styles.action}>
              <div class={styles.icon}>
                <Icon name="shield" />
              </div>
              <span>{t('Security')}</span>
            </A>
          </li>

          <li>
            <A href="/settings/subs" class={styles.action}>
              <div class={styles.icon}>
                <Icon name="bell" />
              </div>
              <span>{t('Subscriptions')}</span>
            </A>
          </li>
        </ul>

        <ul class="nodash">
          {/* Выход */}
          <li>
            <div class={styles.action} onClick={signOut}>
              <div class={styles.icon}>
                <Icon name="log-out" />
              </div>
              <span>{t('Exit')}</span>
            </div>
          </li>
        </ul>
      </Show>
    </Popup>
  )
}
