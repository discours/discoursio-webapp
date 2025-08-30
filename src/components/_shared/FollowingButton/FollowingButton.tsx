import { clsx } from 'clsx'
import { createEffect, createSignal, on, Show } from 'solid-js'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { FollowingEntity } from '~/graphql/generated/graphql'
import { Button } from '../Button'
import stylesButton from '../Button/Button.module.scss'
import { CheckButton } from '../CheckButton'
import { Icon } from '../Icon'
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
  const { changeFollowing, follows } = useFollowing()

  // Определяем изначальное состояние - приоритет у props.isFollowed
  const getInitialState = () => {
    // Если props.isFollowed задан явно, используем его
    if (props.isFollowed !== undefined) {
      return props.isFollowed
    }
    // Иначе проверяем контекст
    if (props.entity === FollowingEntity.Author && follows?.authors) {
      return follows.authors.some((author) => author.slug === props.slug)
    }
    return false
  }

  const [followed, setFollowed] = createSignal(getInitialState())
  const [caption, setCaption] = createSignal(getInitialState() ? t('Unfollow') : t('Follow'))

  const handleFollowClick = async () => {
    const oldState = followed()

    try {
      // НЕ делаем оптимистичные обновления, ждем ответ сервера
      const newState = await changeFollowing(oldState, props.entity, props.slug)
      // Обновляем состояние только на основе реального ответа сервера
      setFollowed(newState)
      setCaption(newState ? t('Unfollow') : t('Follow'))
      console.log('[FollowingButton] Updated state from server:', newState, 'for', props.entity, props.slug)
    } catch (error) {
      console.error('Failed to change following state:', error)
      // Состояние остается прежним при ошибке
    }
  }

  // Синхронизация с пропсами
  createEffect(
    on(
      () => props.isFollowed,
      (x) => {
        setFollowed(x)
        setCaption(x ? t('Unfollow') : t('Follow'))
      }
    )
  )

  // Синхронизация с контекстом подписок - только если нет явного props.isFollowed
  createEffect(() => {
    if (props.isFollowed !== undefined) return // Не переопределяем, если есть явное значение

    if (props.entity === FollowingEntity.Author && follows?.authors) {
      const isFollowedBySlug = follows.authors.some((author) => author.slug === props.slug)
      if (isFollowedBySlug !== followed()) {
        console.log('[FollowingButton] Context updated follow state:', isFollowedBySlug, 'for', props.slug)
        setFollowed(isFollowedBySlug)
        setCaption(isFollowedBySlug ? t('Unfollow') : t('Follow'))
      }
    }
  })

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

  const MiniButton = () => <CheckButton text={caption()} checked={followed()} onClick={handleFollowClick} />

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
        <Show when={followed()} fallback={<FollowButton />}>
          <FollowedButton />
        </Show>
      </Show>
    </div>
  )
}
