import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createMemo, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import type { Author } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'
import type { PopupProps } from '../_shared/Popup'
import { Popup } from '../_shared/Popup'
import styles from '../_shared/Popup/Popup.module.scss'

type ProfilePopupProps = Omit<PopupProps, 'children'>

export const ProfilePopup = (props: ProfilePopupProps) => {
  const { session, signOut } = useSession()
  const { t } = useLocalize()
  
  // Безопасная типизация автора с проверкой на null
  const author = createMemo<Author | null>(() => session()?.author || null)

  return (
    <Popup {...props}>
      <Show when={author()}>
        {(currentAuthor) => (
          <ul class={clsx('nodash', styles.popupMenu)}>
            <li>
              <A href={`/author/${currentAuthor().slug}`}>
                <Icon name="profile" />
                {t('My Profile')}
              </A>
            </li>
            <li>
              <A href="/settings">
                <Icon name="settings" />
                {t('Settings')}
              </A>
            </li>
            <li>
              <button onClick={() => signOut()}>
                <Icon name="logout" />
                {t('Sign out')}
              </button>
            </li>
          </ul>
        )}
      </Show>
    </Popup>
  )
}
