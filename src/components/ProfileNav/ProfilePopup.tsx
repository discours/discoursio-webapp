import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createMemo, Show, createEffect } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import type { Author } from '~/graphql/schema/core.gen'
import { createComponentDebugger, getSessionDebugInfo, checkNullSafety } from '~/utils/debug'
import { Icon } from '../_shared/Icon'
import type { PopupProps } from '../_shared/Popup'
import { Popup } from '../_shared/Popup'
import styles from '../_shared/Popup/Popup.module.scss'

type ProfilePopupProps = Omit<PopupProps, 'children'>

export const ProfilePopup = (props: ProfilePopupProps) => {
  const { session, signOut } = useSession()
  const { t } = useLocalize()
  
  // Инициализация отладчика
  const componentDebugger = createComponentDebugger('ProfilePopup')
  
  // Безопасная типизация автора с проверкой на null
  const author = createMemo<Author | null>(() => {
    const currentSession = session()
    const sessionDebugInfo = getSessionDebugInfo(currentSession)
    
    // Логируем состояние сессии в development режиме
    if (process.env.NODE_ENV === 'development') {
      componentDebugger.logState({
        sessionInfo: sessionDebugInfo,
        authorExists: Boolean(currentSession?.author),
        authorSlug: currentSession?.author?.slug
      })
    }
    
    // Проверяем null-безопасность
    if (!checkNullSafety(currentSession, 'author.slug')) {
      console.warn('[ProfilePopup] Author slug is not available, popup will not render')
      return null
    }
    
    return currentSession?.author || null
  })
  
  // Эффект для отслеживания изменений автора
  createEffect(() => {
    const currentAuthor = author()
    if (process.env.NODE_ENV === 'development') {
      componentDebugger.logState({
        authorChanged: true,
        hasAuthor: Boolean(currentAuthor),
        authorSlug: currentAuthor?.slug,
        authorName: currentAuthor?.name
      })
    }
  })

  return (
    <Show when={author()} fallback={null}>
      {(currentAuthor) => {
        // Дополнительная проверка безопасности перед рендерингом
        if (!currentAuthor().slug) {
          console.warn('[ProfilePopup] Author has no slug, skipping render')
          return null
        }
        
        return (
          <Popup {...props} horizontalAnchor="right" popupCssClass={styles.profilePopup}>
            <ul class="nodash">
              <li>
                <A class={styles.action} href={`/@${currentAuthor().slug}`}>
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
                <A class={styles.action} href={`/@${currentAuthor().slug}?m=following`}>
                  <Icon name="feed-all" class={styles.icon} />
                  {t('Subscriptions')}
                </A>
              </li>
              <li>
                <A class={styles.action} href={`/@${currentAuthor().slug}/comments`}>
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
      }}
    </Show>
  )
}
