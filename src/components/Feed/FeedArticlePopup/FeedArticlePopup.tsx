import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import type { PopupProps } from '~/components/_shared/Popup'
import { Popup } from '~/components/_shared/Popup'
import { SoonChip } from '~/components/_shared/SoonChip'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { FollowingEntity } from '~/graphql/generated/graphql'

import styles from './FeedArticlePopup.module.scss'

type Props = {
  canEdit: boolean
  shoutId?: number
  shoutSlug?: string
  onInviteClick: () => void
  onShareClick: () => void
} & Omit<PopupProps, 'children'>

export const FeedArticlePopup = (props: Props) => {
  const { t } = useLocalize()
  const { follow, unfollow, follows } = useFollowing()
  const [hidePopup, setHidePopup] = createSignal(false)

  // Проверяем, следит ли пользователь за уведомлениями к этому посту
  const isFollowing = () => {
    if (!props.shoutId) return false
    const following = (follows.shouts || []).some((shout) => shout?.id === props.shoutId)
    console.log('[FeedArticlePopup] Follow check:', {
      shoutId: props.shoutId,
      shoutSlug: props.shoutSlug,
      totalShouts: follows.shouts?.length || 0,
      isFollowing: following,
      shoutIds: follows.shouts?.map((s) => s?.id)
    })
    return following
  }

  return (
    <>
      <Popup
        {...props}
        //TODO: fix hide logic
        closePopup={hidePopup()}
        horizontalAnchor={'right'}
        variant="tiny"
        popupCssClass={styles.feedArticlePopup}
      >
        <ul class={clsx('nodash', styles.actionList)}>
          <li>
            <button
              class={styles.action}
              onClick={() => {
                props.onShareClick()
                setHidePopup(true)
              }}
            >
              <Icon name="share-outline" class={styles.icon} />
              <div class={styles.title}>{t('Share')}</div>
            </button>
          </li>
          <Show when={!props.canEdit}>
            <li>
              <button
                class={styles.action}
                onClick={() => {
                  alert('Help to edit')
                  setHidePopup(true)
                }}
              >
                <Icon name="pencil-outline" class={styles.icon} />
                <div class={styles.title}>{t('Help to edit')}</div>
              </button>
            </li>
          </Show>
          <li>
            <button
              class={styles.action}
              onClick={() => {
                props.onInviteClick()
                setHidePopup(false)
              }}
            >
              <Icon name="expert" class={styles.icon} />
              <div class={styles.title}>{t('Invite experts')}</div>
            </button>
          </li>
          <Show when={!props.canEdit && props.shoutSlug}>
            <li>
              <button
                class={styles.action}
                onClick={async () => {
                  if (!props.shoutSlug) return

                  const wasFollowing = isFollowing()
                  console.log('[FeedArticlePopup] Toggle follow:', {
                    action: wasFollowing ? 'unfollow' : 'follow',
                    shoutSlug: props.shoutSlug,
                    shoutId: props.shoutId
                  })

                  try {
                    if (wasFollowing) {
                      const result = await unfollow(FollowingEntity.Shout, props.shoutSlug)
                      console.log('[FeedArticlePopup] Unfollow result:', result)
                    } else {
                      const result = await follow(FollowingEntity.Shout, props.shoutSlug)
                      console.log('[FeedArticlePopup] Follow result:', result)
                    }
                    setHidePopup(true)
                  } catch (error) {
                    console.error('[FeedArticlePopup] Failed to toggle follow:', error)
                  }
                }}
              >
                <Icon name="bell-white" class={styles.icon} />
                <div class={styles.title}>
                  {isFollowing() ? t('Unfollow the discussion') : t('Follow the discussion')}
                </div>
              </button>
            </li>
          </Show>
          <li>
            <button class={clsx(styles.action, styles.soon)}>
              <Icon name="bookmark" class={styles.icon} />
              <div class={styles.title}>{t('Add to bookmarks')}</div>
              <SoonChip />
            </button>
          </li>
          {/*<Show when={!props.canEdit}>*/}
          {/*  <li>*/}
          {/*    <button*/}
          {/*      class={styles.action}*/}
          {/*      */}
          {/*      onClick={() => {*/}
          {/*        alert('Complain')*/}
          {/*      }}*/}
          {/*    >*/}
          {/*      {t('Complain')}*/}
          {/*    </button>*/}
          {/*  </li>*/}
          {/*</Show>*/}
          {/*<li>*/}
          {/*  <button*/}
          {/*    class={styles.action}*/}
          {/*    */}
          {/*    onClick={() => {*/}
          {/*      alert('Get notifications')*/}
          {/*    }}*/}
          {/*  >*/}
          {/*    {t('Get notifications')}*/}
          {/*  </button>*/}
          {/*</li>*/}
        </ul>
      </Popup>
    </>
  )
}
