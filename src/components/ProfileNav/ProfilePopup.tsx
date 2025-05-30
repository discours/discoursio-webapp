import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createMemo } from 'solid-js'
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
  const author = createMemo<Author>(() => session()?.author as Author)
  const { t } = useLocalize()

  return (
    <Popup {...props} horizontalAnchor="right" popupCssClass={styles.profilePopup}>
      <ul class="nodash">
        <li>
          <A class={styles.action} href={`/@${author().slug}`}>
            <Icon name="profile" class={styles.icon} />
            {t('Profile')}
          </A>
        </li>
        <li>
          <A class={styles.action} href="/edit">
            <Icon name="pencil-outline" class={styles.icon} />
            {t('Drafts')}
          </A>
        </li>
        <li>
          <A class={styles.action} href={`/@${author()?.slug}?m=following`}>
            <Icon name="feed-all" class={styles.icon} />
            {t('Subscriptions')}
          </A>
        </li>
        <li>
          <A class={styles.action} href={`/@${author()?.slug}/comments`}>
            <Icon name="comment" class={styles.icon} />
            {t('Comments')}
          </A>
        </li>
        <li>
          <a class={styles.action} href="#">
            <Icon name="bookmark" class={styles.icon} />
            {t('Bookmarks')}
          </a>
        </li>
        <li>
          <A class={styles.action} href={'/settings'}>
            <Icon name="settings" class={styles.icon} />
            {t('Settings')}
          </A>
        </li>
        <li class={styles.topBorderItem}>
          <span class={clsx(styles.action, 'link')} onClick={() => signOut()}>
            <Icon name="logout" class={styles.icon} />
            {t('Logout')}
          </span>
        </li>
      </ul>
    </Popup>
  )
}
