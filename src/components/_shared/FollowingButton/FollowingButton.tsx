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
  isFollowed?: boolean // initial value (optional - will use context if not provided)
  entity: FollowingEntity
  slug: string
  class?: string
  minimize?: boolean
  iconButtons?: boolean
}

export const FollowingButton = (props: Props) => {
  const { t } = useLocalize()
  const { changeFollowing, follows } = useFollowing()

  // 🔄 Умное начальное состояние - правильно различаем "не загружено" и "не подписан"
  const getInitialState = (): boolean | null => {
    // Если есть явное значение в пропсах, используем его
    if (props.isFollowed !== undefined) {
      return props.isFollowed
    }

    // Если данные следований уже есть, используем их
    if (follows?.authors) {
      return follows.authors.some((author) => author.slug === props.slug)
    }

    // По умолчанию не подписан (не показываем загрузку)
    return false
  }

  const [followed, setFollowed] = createSignal<boolean | null>(getInitialState())

  // 🔄 Реактивный caption, обновляется при изменении followed()
  const caption = () => {
    const followedState = followed()
    return followedState === null ? t('Loading') : followedState ? t('Unfollow') : t('Follow')
  }

  const handleFollowClick = async () => {
    const oldState = followed()

    try {
      // НЕ делаем оптимистичные обновления, ждем ответ сервера
      const newState = await changeFollowing(!!oldState, props.entity, props.slug)
      // Обновляем состояние только на основе реального ответа сервера
      setFollowed(newState)
      console.log('[FollowingButton] Updated state from server:', newState, 'for', props.entity, props.slug)
    } catch (error) {
      console.error('Failed to change following state:', error)
      // Состояние остается прежним при ошибке
    }
  }

  // 🔄 Синхронизация с пропсами
  createEffect(
    on(
      () => props.isFollowed,
      (isFollowed) => {
        if (isFollowed !== undefined) {
          setFollowed(isFollowed)
        }
      }
    )
  )

  // 🔄 Синхронизация с изменениями данных
  createEffect(() => {
    // Если есть явное значение в пропсах, приоритет у него
    if (props.isFollowed !== undefined) {
      setFollowed(props.isFollowed)
      return
    }

    // Если есть данные следований, проверяем подписку
    if (follows?.authors && props.entity === FollowingEntity.Author) {
      const isFollowedBySlug = follows.authors.some((author) => author.slug === props.slug)
      setFollowed(isFollowedBySlug)
    } else {
      // Нет данных - не подписан
      setFollowed(false)
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
      disabled={false}
      class={clsx(styles.actionButton, {
        [styles.iconed]: props.iconButtons,
        [stylesButton.followed]: followed() === true // 🔄 Проверяем именно true
      })}
    />
  )

  const MiniButton = () => (
    <CheckButton
      text={caption()}
      checked={followed() === true} // 🔄 Проверяем именно true
      onClick={handleFollowClick}
    />
  )

  const FollowButton = () => (
    <>
      <Button
        variant={props.iconButtons ? 'secondary' : 'bordered'}
        size="S"
        value={props.iconButtons ? '' : caption()}
        onClick={handleFollowClick}
        isSubscribeButton={true}
        class={clsx(styles.actionButton, {
          [styles.iconed]: props.iconButtons,
          [stylesButton.followed]: followed()
        })}
      />
      {props.iconButtons && <Icon name="author-unsubscribe" class={stylesButton.icon} />}
    </>
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
