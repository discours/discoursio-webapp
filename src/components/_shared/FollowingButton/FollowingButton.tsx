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
  const [caption, setCaption] = createSignal(props.isFollowed ? t('Unfollow') : t('Follow'))
  const [followed, setFollowed] = createSignal(props.isFollowed)
  const { followingLoading, changeFollowing } = useFollowing()

  const handleFollowClick = async () => {
    const oldState = followed()
    // Оптимистично обновляем UI
    setFollowed(!oldState)

    try {
      const newState = await changeFollowing(oldState, props.entity, props.slug)
      // Проверяем, что сервер вернул ожидаемое состояние
      if (newState !== !oldState) {
        console.warn('Server returned unexpected follow state:', newState, 'expected:', !oldState)
        setFollowed(newState)
      }
      setCaption(newState ? t('Unfollow') : t('Follow'))
      setInActionText(newState ? t('Unfollowing...') : t('Following...'))
    } catch (error) {
      // Откатываем изменения при ошибке
      setFollowed(oldState)
      console.error('Failed to change following state:', error)
    }
  }

  createEffect(
    on(
      () => props.isFollowed,
      (x) => {
        setFollowed(x)
        setCaption(x ? t('Unfollow') : t('Follow'))
        setInActionText(x ? t('Unfollowing...') : t('Following...'))
      }
    )
  )

  const FollowedButton = () => (
    <Button
      variant={props.iconButtons ? 'secondary' : 'bordered'}
      size="S"
      value={
        <Show when={props.iconButtons} fallback={caption()}>
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
  )

  const MiniButton = () => (
    <CheckButton text={caption()} checked={followed()} onClick={handleFollowClick} />
  )

  const FollowButton = () => (
    <Button
      variant={props.iconButtons ? 'secondary' : 'bordered'}
      size="S"
      value={
        <Show
          when={props.iconButtons}
          fallback={
            <>
              <span class={styles.actionButtonLabel}>{caption()}</span>
              <span class={styles.actionButtonLabelHovered}>{caption()}</span>
            </>
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
  )

  return (
    <div class={props.class}>
      <Show when={!props.minimize} fallback={<MiniButton />}>
        <Show when={followed()} fallback={<FollowedButton />}>
          <FollowButton />
        </Show>
      </Show>
    </div>
  )
}
