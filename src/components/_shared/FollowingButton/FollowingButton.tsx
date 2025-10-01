import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, on, Show } from 'solid-js'
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

  // ✅ Атомарные сигналы вместо сложного состояния
  const [isProcessing, setIsProcessing] = createSignal(false)
  const [followed, setFollowed] = createSignal<boolean>(false)

  // ✅ createMemo для производной логики (проверка подписки)
  const isFollowedFromContext = createMemo(() => {
    // Если есть явное значение в пропсах, используем его (приоритет)
    if (props.isFollowed !== undefined) {
      return props.isFollowed
    }

    // 🔧 ИСПРАВЛЕНИЕ: Реактивный доступ через follows.authors (не follows?.authors)
    // createStore требует прямого доступа к свойствам для отслеживания изменений
    const followedAuthors = follows.authors || []
    const followedTopics = follows.topics || []

    // Проверяем подписку в зависимости от типа сущности
    if (props.entity === FollowingEntity.Author) {
      const isFollowed = followedAuthors.some((author) => author.slug === props.slug)
      console.log('[FollowingButton] Checking author follow status:', {
        slug: props.slug,
        isFollowed,
        followedCount: followedAuthors.length,
        followedSlugs: followedAuthors.map((a) => a.slug)
      })
      return isFollowed
    }

    if (props.entity === FollowingEntity.Topic) {
      return followedTopics.some((topic) => topic.slug === props.slug)
    }

    // По умолчанию не подписан
    return false
  })

  // ✅ Простая функция для caption (не нужен createMemo - операция < 1мс)
  const caption = () => (followed() ? t('Unfollow') : t('Follow'))

  const handleFollowClick = async () => {
    // ✅ Защита от двойных кликов
    if (isProcessing()) return

    setIsProcessing(true)
    const oldState = followed()

    try {
      // ✅ НЕ делаем оптимистичные обновления, ждем ответ сервера
      const newState = await changeFollowing(oldState, props.entity, props.slug)
      // ✅ Обновляем состояние только на основе реального ответа сервера
      setFollowed(newState)
      console.log('[FollowingButton] Updated state from server:', newState, 'for', props.entity, props.slug)
    } catch (error) {
      console.error('[FollowingButton] Failed to change following state:', error)
      // Состояние остается прежним при ошибке
    } finally {
      setIsProcessing(false)
    }
  }

  // ✅ ЕДИНСТВЕННЫЙ createEffect с правильными зависимостями on()
  // Синхронизация локального состояния с контекстом
  createEffect(
    on(
      [isFollowedFromContext, () => props.entity, () => props.slug],
      ([isFollowedValue]) => {
        setFollowed(isFollowedValue)
      },
      { defer: true } // ✅ defer для предотвращения каскадных обновлений
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
      disabled={isProcessing()} // ✅ Блокируем кнопку во время обработки
      class={clsx(styles.actionButton, {
        [styles.iconed]: props.iconButtons,
        [stylesButton.followed]: followed()
      })}
    />
  )

  const MiniButton = () => <CheckButton text={caption()} checked={followed()} onClick={handleFollowClick} />

  const FollowButton = () => (
    <>
      <Button
        variant={props.iconButtons ? 'secondary' : 'bordered'}
        size="S"
        value={props.iconButtons ? '' : caption()}
        onClick={handleFollowClick}
        isSubscribeButton={true}
        disabled={isProcessing()} // ✅ Блокируем кнопку во время обработки
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
