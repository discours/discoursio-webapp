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
  const { changeFollowing, follows, followsResource } = useFollowing()

  // 🔄 Умное начальное состояние - правильно различаем "не загружено" и "не подписан"
  const getInitialState = (): boolean | null => {
    // Если есть явное значение в пропсах, используем его
    if (props.isFollowed !== undefined) {
      return props.isFollowed
    }

    // Если ресурс загружается ИЛИ ещё не было первой загрузки, показываем загрузку
    if (followsResource.loading || !followsResource.latest) {
      return null
    }

    // Если данные реально загружены (есть latest), проверяем подписку
    if (props.entity === FollowingEntity.Author && follows?.authors) {
      return follows.authors.some((author) => author.slug === props.slug)
    }

    // Если данные загружены, но нет массива авторов - не подписан
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

    // 🔄 Не обрабатываем клики во время загрузки
    if (oldState === null) return

    try {
      // НЕ делаем оптимистичные обновления, ждем ответ сервера
      const newState = await changeFollowing(oldState, props.entity, props.slug)
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
      const currentFollowed = followed()
      if (currentFollowed !== props.isFollowed) {
        setFollowed(props.isFollowed)
      }
      return
    }

    // Если загружается ИЛИ нет данных, показываем загрузку
    if (followsResource.loading || !followsResource.latest) {
      const currentFollowed = followed()
      if (currentFollowed !== null) {
        setFollowed(null)
      }
      return
    }

    // Данные реально загружены - обновляем состояние подписки
    if (props.entity === FollowingEntity.Author && follows?.authors) {
      const isFollowedBySlug = follows.authors.some((author) => author.slug === props.slug)
      const currentFollowed = followed()

      if (currentFollowed !== isFollowedBySlug) {
        setFollowed(isFollowedBySlug)
      }
    } else {
      // Данные загружены, но нет массива авторов - не подписан
      const currentFollowed = followed()
      if (currentFollowed !== false) {
        setFollowed(false)
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
      disabled={followed() === null} // 🔄 Отключаем во время загрузки
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
