import { For } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'

import styles from './SocialProviders.module.scss'

const socialProviders = [
  // { name: 'telegram', title: 'Telegram', icon: 'telegram' }, // Hidden for now
  // { name: 'x.com', title: 'X.com', icon: 'twitter' }, // Hidden for now
  { name: 'google', title: 'Google', icon: 'google' },
  { name: 'github', title: 'GitHub', icon: 'github' },
  { name: 'facebook', title: 'Facebook', icon: 'facebook' },
  { name: 'vk', title: 'VKontakte', icon: 'vk' }
  // { name: 'yandex', title: 'Yandex', icon: 'yandex' } // Hidden for now
]

export const SocialProviders = () => {
  const { oauth, authError } = useSession()
  const { t } = useLocalize()

  const handleSocialLogin = (provider: string) => {
    console.log('[SocialProviders] Initiating OAuth for:', provider)
    oauth(provider)
  }

  return (
    <div class={styles.SocialProviders}>
      <div class={styles.header}>
        <span class={styles.divider}>{t('or sign in with social networks')}</span>
      </div>

      <div class={styles.providers}>
        <For each={socialProviders}>
          {(provider) => (
            <Button
              variant="outline"
              size="S"
              value={
                <Icon
                  name={provider.icon}
                  class={styles.providerIcon}
                  data-icon={provider.icon}
                  title={provider.title}
                />
              }
              onClick={() => handleSocialLogin(provider.name)}
              class={styles.providerButton}
              data-testid={`oauth-${provider.name}`}
              title={`Войти через ${provider.title}`}
            />
          )}
        </For>
      </div>

      {authError() && <div class={styles.error}>{authError()}</div>}
    </div>
  )
}
