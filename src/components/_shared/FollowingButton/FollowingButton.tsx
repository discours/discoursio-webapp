import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { FollowingEntity } from '~/graphql/schema/core.gen'
import { Button } from '../Button'
import { CheckButton } from '../CheckButton'
import { Icon } from '../Icon'

import stylesButton from '../Button/Button.module.scss'
import styles from './FollowingButton.module.scss'

type Props = {
  isFollowed: boolean // initial value
  entity: FollowingEntity
  slug: string
  class?: string
  minimize?: boolean
  iconButtons?: boolean
}

export const FollowingButton = (props: Props) => {
  const { t } = useLocalize()
  const [inActionText, setInActionText] = createSignal('...')
  const [caption, setCaption] = createSignal(t('Follow'))
  const [followed, setFollowed] = createSignal(props.isFollowed)
  const { followingLoading, changeFollowing } = useFollowing()

  const handleFollowClick = async () => {
    const newFollowState = await changeFollowing(followed(), props.entity, props.slug)
    setFollowed(newFollowState)
  }

  createEffect(
    on(followed, (x) => {
      setCaption(x ? t('Unfollow') : t('Follow'))
      setInActionText(x ? t('Unfollowing...') : t('Following...'))
    })
  )

  return (
    <div class={props.class}>
      <Show
        when={!props.minimize}
        fallback={
          <CheckButton
            text={t('Follow')}
            checked={followed() && !followingLoading()}
            onClick={handleFollowClick}
          />
        }
      >
        <Show
          when={props.isFollowed}
          fallback={
            <Button
              variant={props.iconButtons ? 'secondary' : 'bordered'}
              size="S"
              value={
                <Show when={props.iconButtons} fallback={followingLoading() ? inActionText() : caption()}>
                  <Icon name="author-subscribe" class={stylesButton.icon} />
                </Show>
              }
              onClick={handleFollowClick}
              isSubscribeButton={true}
              class={clsx(styles.actionButton, {
                [styles.iconed]: props.iconButtons,
                [stylesButton.followed]: followed()
              })}
            />
          }
        >
          <Button
            variant={props.iconButtons ? 'secondary' : 'bordered'}
            size="S"
            value={
              <Show
                when={props.iconButtons}
                fallback={
                  followingLoading() ? (
                    inActionText()
                  ) : (
                    <>
                      <span class={styles.actionButtonLabel}>{t('Following')}</span>
                      <span class={styles.actionButtonLabelHovered}>{t('Unfollow')}</span>
                    </>
                  )
                }
              >
                <Icon name="author-unsubscribe" class={stylesButton.icon} />
              </Show>
            }
            onClick={handleFollowClick}
            isSubscribeButton={true}
            class={clsx(styles.actionButton, {
              [styles.iconed]: props.iconButtons,
              [stylesButton.followed]: followed()
            })}
          />
        </Show>
      </Show>
    </div>
  )
}
