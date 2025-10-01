import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'
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

  // ✅ Атомарный сигнал для обработки запроса
  const [isProcessing, setIsProcessing] = createSignal(false)

  // ✅ Простая реактивная функция вместо createMemo (операция < 1мс)
  // НЕТ дублирования состояния - источник истины только в контексте!
  const isFollowed = () => {
    // Если есть явное значение в пропсах, используем его (приоритет)
    if (props.isFollowed !== undefined) {
      return props.isFollowed
    }

    // ✅ КРИТИЧНО: Прямой доступ к props.* для реактивности
    // ✅ КРИТИЧНО: Прямой доступ к follows.authors для createStore реактивности
    if (props.entity === FollowingEntity.Author) {
      return (follows.authors || []).some((author) => author.slug === props.slug)
    }

    if (props.entity === FollowingEntity.Topic) {
      return (follows.topics || []).some((topic) => topic.slug === props.slug)
    }

    // По умолчанию не подписан
    return false
  }

  // ✅ Простая функция для caption (не нужен createMemo - операция < 1мс)
  const caption = () => (isFollowed() ? t('Unfollow') : t('Follow'))

  const handleFollowClick = async () => {
    // ✅ Защита от двойных кликов
    if (isProcessing()) return

    setIsProcessing(true)
    const oldState = isFollowed()

    try {
      await changeFollowing(oldState, props.entity, props.slug)
    } catch (error) {
      console.error('[FollowingButton] Failed to change following state:', error)
    } finally {
      setIsProcessing(false)
    }
  }

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
        [stylesButton.followed]: isFollowed()
      })}
    />
  )

  const MiniButton = () => <CheckButton text={caption()} checked={isFollowed()} onClick={handleFollowClick} />

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
          [stylesButton.followed]: isFollowed()
        })}
      />
      {props.iconButtons && <Icon name="author-unsubscribe" class={stylesButton.icon} />}
    </>
  )

  return (
    <div class={props.class}>
      <Show when={!props.minimize} fallback={<MiniButton />}>
        <Show when={isFollowed()} fallback={<FollowButton />}>
          <FollowedButton />
        </Show>
      </Show>
    </div>
  )
}
