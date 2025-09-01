import { clsx } from 'clsx'
import { createEffect, createSignal, on, Show } from 'solid-js'

import { FollowingButton } from '~/components/_shared/FollowingButton'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { FollowingEntity, Topic } from '~/graphql/generated/graphql'
import { getFileUrl } from '~/lib/imageCache'
import { mediaMatches } from '~/lib/mediaQuery'
import { capitalize } from '~/utils/capitalize'

import styles from './TopicBadge.module.scss'

type Props = {
  topic: Topic
  minimize?: boolean
  showStat?: boolean
  subscriptionsMode?: boolean
}

export const TopicBadge = (props: Props) => {
  const { t, lang } = useLocalize()
  const [isMobileView, setIsMobileView] = createSignal(false)
  const [isFollowed, setIsFollowed] = createSignal<boolean>()
  const { follows } = useFollowing()

  createEffect(
    on([() => follows, () => props.topic], ([flws, tpc]) => {
      if (flws && tpc) {
        const followed = follows?.topics?.some((topic) => topic.id === props.topic?.id)
        setIsFollowed(followed)
      }
    })
  )

  createEffect(() => {
    setIsMobileView(!mediaMatches.sm)
  })

  const title = () => (lang() === 'en' ? capitalize(props.topic.slug.replaceAll('-', ' ')) : props.topic.title)

  return (
    <div class={clsx(styles.TopicBadge, { [styles.TopicBadgeSubscriptionsMode]: props.subscriptionsMode })}>
      <div class={styles.content}>
        <div class={styles.basicInfo}>
          <Show when={props.subscriptionsMode}>
            <a
              href={`/topic/${props.topic.slug}`}
              class={clsx(styles.picture, {
                [styles.withImage]: props.topic.pic,
                [styles.smallSize]: isMobileView()
              })}
              style={
                (props.topic?.pic || '') && {
                  'background-image': `url('${getFileUrl(props.topic?.pic || '', { width: 40, height: 40 })}')`
                }
              }
            />
          </Show>

          <a href={`/topic/${props.topic.slug}`} class={styles.info}>
            <span class={styles.title}>{title()}</span>

            <Show when={props.topic.body}>
              <div innerHTML={props.topic?.body || ''} class={clsx('text-truncate', styles.description)} />
            </Show>
          </a>
        </div>
        <div class={styles.actions}>
          <FollowingButton
            slug={props.topic.slug}
            entity={FollowingEntity.Topic}
            isFollowed={Boolean(isFollowed())}
            minimize={props.minimize}
          />
        </div>
      </div>

      <Show when={!props.subscriptionsMode}>
        <div class={styles.stats}>
          <span class={styles.statsItem}>{t('some shouts', { count: props.topic?.stat?.shouts })}</span>
          <span class={styles.statsItem}>{t('some authors', { count: props.topic?.stat?.authors })}</span>
          <span class={styles.statsItem}>{t('some followers', { count: props.topic?.stat?.followers })}</span>
          <Show when={props.topic?.stat?.comments}>
            <span class={styles.statsItem}>{t('some comments', { count: props.topic?.stat?.comments ?? 0 })}</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}
