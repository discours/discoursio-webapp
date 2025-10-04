import { clsx } from 'clsx'
import { createSignal, For, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import styles from '~/styles/views/ProfileSettings.module.scss'
import { Icon } from '../_shared/Icon'
import { ProfileSettingsNavigation } from '../ProfileNav'

type NotificationPreference = {
  id: string
  name: string
  description: string
  email: boolean
  push: boolean
}

export const ProfileNotifications = () => {
  const { t } = useLocalize()

  const [digestMode, setDigestMode] = createSignal(localStorage.getItem('notificationDigestMode') === 'true')

  // Default preferences
  const defaultPreferences: NotificationPreference[] = [
    {
      id: 'new_publication',
      name: t('New publication'),
      description: t('Notifications about new publications from authors you follow'),
      email: true,
      push: true
    },
    {
      id: 'new_comment',
      name: t('New comments'),
      description: t('Notifications about new comments on your publications'),
      email: true,
      push: true
    },
    {
      id: 'new_reply',
      name: t('Replies to comments'),
      description: t('Notifications about replies to your comments'),
      email: true,
      push: true
    },
    {
      id: 'new_reaction',
      name: t('New reaction to your content'),
      description: t('Notifications about reactions to your publications and comments'),
      email: false,
      push: true
    },
    {
      id: 'new_follower',
      name: t('You have a new follower!'),
      description: t('Notifications when someone follows you'),
      email: false,
      push: true
    },
    {
      id: 'publication_updated',
      name: t('Publication updated'),
      description: t('Notifications about updates to publications you follow'),
      email: false,
      push: false
    }
  ]

  // Load preferences from localStorage or use defaults
  const loadPreferences = (): NotificationPreference[] => {
    try {
      const stored = localStorage.getItem('notificationPreferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to ensure all preference types exist
        return defaultPreferences.map((def) => {
          const stored = parsed.find((p: NotificationPreference) => p.id === def.id)
          return stored ? { ...def, email: stored.email, push: stored.push } : def
        })
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error)
    }
    return defaultPreferences
  }

  const [preferences, setPreferences] = createSignal<NotificationPreference[]>(loadPreferences())

  const [isSaving, setIsSaving] = createSignal(false)

  const toggleEmail = (id: string) => {
    setPreferences((prev) => prev.map((pref) => (pref.id === id ? { ...pref, email: !pref.email } : pref)))
  }

  const togglePush = (id: string) => {
    setPreferences((prev) => prev.map((pref) => (pref.id === id ? { ...pref, push: !pref.push } : pref)))
  }

  const handleDigestToggle = () => {
    const newValue = !digestMode()
    setDigestMode(newValue)
    localStorage.setItem('notificationDigestMode', String(newValue))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save settings to localStorage
      localStorage.setItem('notificationDigestMode', String(digestMode()))
      localStorage.setItem('notificationPreferences', JSON.stringify(preferences()))

      await new Promise((resolve) => setTimeout(resolve, 300)) // Small delay for UX
    } catch (error) {
      console.error('❌ Error saving notification preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div class="wide-container">
      <div class="row">
        <div class="col-md-5">
          <div class={clsx('left-navigation', styles.leftNavigation)}>
            <ProfileSettingsNavigation />
          </div>
        </div>

        <div class="col-md-19">
          <div class="row">
            <div class="col-md-20 col-lg-18 col-xl-16">
              <h1>{t('Notification settings')}</h1>
              <p class="description">
                {t('Configure how you want to receive notifications about activity on Discours')}
              </p>

              <div class={styles.notificationPreferences}>
                <div class={styles.notificationHeader}>
                  <div class={styles.notificationName}>{t('Notification type')}</div>
                  <div class={styles.notificationToggle}>
                    <Icon name="mail" class={styles.toggleIcon} />
                    <span>{t('Email')}</span>
                  </div>
                  <div class={styles.notificationToggle}>
                    <Icon name="bell" class={styles.toggleIcon} />
                    <span>{t('Push')}</span>
                  </div>
                </div>

                <For each={preferences()}>
                  {(pref) => (
                    <div class={styles.notificationItem}>
                      <div class={styles.notificationInfo}>
                        <div class={styles.notificationTitle}>{pref.name}</div>
                        <div class={styles.notificationDescription}>{pref.description}</div>
                      </div>
                      <div class={styles.notificationToggle}>
                        <label class={styles.toggleSwitch}>
                          <input type="checkbox" checked={pref.email} onChange={() => toggleEmail(pref.id)} />
                          <span class={styles.toggleSlider} />
                        </label>
                      </div>
                      <div class={styles.notificationToggle}>
                        <label class={styles.toggleSwitch}>
                          <input type="checkbox" checked={pref.push} onChange={() => togglePush(pref.id)} />
                          <span class={styles.toggleSlider} />
                        </label>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class={styles.formActions}>
                <button type="button" class="button" onClick={handleSave} disabled={isSaving()}>
                  <Show when={!isSaving()} fallback={<>{t('Saving...')}</>}>
                    {t('Save changes')}
                  </Show>
                </button>
              </div>

              <hr class={styles.divider} />

              <h3>{t('Additional settings')}</h3>
              <p class="description">{t('Advanced notification preferences')}</p>

              <div class={styles.additionalSettings}>
                <div class={styles.settingItem}>
                  <div class={styles.settingInfo}>
                    <div class={styles.settingTitle}>{t('Digest mode')}</div>
                    <div class={styles.settingDescription}>
                      {t('Receive daily digest instead of individual notifications')}
                    </div>
                  </div>
                  <label class={styles.toggleSwitch}>
                    <input type="checkbox" checked={digestMode()} onChange={handleDigestToggle} />
                    <span class={styles.toggleSlider} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
