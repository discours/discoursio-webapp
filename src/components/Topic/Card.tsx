import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, on, Show } from 'solid-js'
import { NoHydration } from 'solid-js/web'

import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Author, FollowingEntity, type Topic } from '~/graphql/generated/graphql'
import { capitalize } from '~/utils/capitalize'
import { CheckButton } from '../_shared/CheckButton'
import { FollowingButton } from '../_shared/FollowingButton'
import { CardTopic } from '../Feed/CardTopic'

import styles from './Card.module.scss'

interface TopicProps {
  topic: Topic
  compact?: boolean
  followed?: boolean
  shortDescription?: boolean
  subscribeButtonBottom?: boolean
  additionalClass?: string
  isTopicInRow?: boolean
  iconButton?: boolean
  showPublications?: boolean
  showDescription?: boolean
  isCardMode?: boolean
  minimize?: boolean
  isNarrow?: boolean
  withIcon?: boolean
}

export const TopicCard = (props: TopicProps) => {
  const { t, lang } = useLocalize()
  const title = createMemo(() =>
    capitalize(lang() === 'en' ? props.topic.slug.replaceAll('-', ' ') : props.topic.title || '')
  )
  const { session, requireAuthentication } = useSession()
  const author = createMemo<Author>(() => session()?.author as Author)
  const { follows, changeFollowing } = useFollowing()
  const [isFollowed, setIsFollowed] = createSignal(false)

  createEffect(
    on([() => follows, () => props.topic], ([flws, tpc]) => {
      if (flws && tpc) {
        const followed = follows?.topics?.some((topic) => topic.id === props.topic?.id)
        setIsFollowed(Boolean(followed))
      }
    })
  )

  const handleFollowClick = () => {
    requireAuthentication(async () => {
      try {
        const newState = await changeFollowing(isFollowed(), FollowingEntity.Topic, props.topic.slug)
        console.log('[TopicCard] Follow state changed to:', newState)
      } catch (error) {
        console.error('[TopicCard] Failed to change follow state:', error)
      }
    }, 'follow')
  }

  return (
    <div class={styles.topicContainer}>
      <div
        class={styles.topic}
        classList={{
          row: !props.subscribeButtonBottom,
          [styles.topicCompact]: props.compact,
          [styles.topicInRow]: props.isTopicInRow
        }}
      >
        <div
          classList={{
            [clsx('col-sm-18 col-md-24 col-lg-14 col-xl-15', styles.topicDetails)]: props.isNarrow,
            [clsx('col-24 col-sm-17 col-md-18', styles.topicDetails)]: props.compact,
            [clsx('col-sm-17 col-md-18', styles.topicDetails)]: !(
              props.subscribeButtonBottom ||
              props.isNarrow ||
              props.compact
            )
          }}
        >
          <Show when={title() && !props.isCardMode}>
            <h3 class={styles.topicTitle}>
              <a href={`/topic/${props.topic.slug}`}>{title()}</a>
            </h3>
          </Show>

          <Show when={props.isCardMode}>
            <CardTopic title={props.topic?.title || ''} slug={props.topic.slug} class={styles.cardMode} />
          </Show>

          <Show when={props.topic.pic}>
            <div class={styles.topicAvatar}>
              <a href={`/topic/${props.topic.slug}`}>
                <img src={props.topic.pic || ''} alt={title()} />
              </a>
            </div>
          </Show>

          <Show when={props.showDescription && props.topic?.body}>
            <div
              class={clsx(styles.topicDescription, 'text-truncate')}
              classList={{ [styles.topicDescriptionShort]: props.shortDescription }}
            >
              {props.topic.body}
            </div>
          </Show>
        </div>
        <div
          class={styles.controlContainer}
          classList={{
            'col-sm-6 col-md-24 col-lg-10 col-xl-9': props.isNarrow,
            'col-24 col-sm-7 col-md-6': props.compact,
            'col-sm-7 col-md-6': !(props.subscribeButtonBottom || props.isNarrow || props.compact)
          }}
        >
          <NoHydration>
            <Show when={author()}>
              <Show
                when={!props.minimize}
                fallback={<CheckButton text={t('Follow')} checked={isFollowed()} onClick={handleFollowClick} />}
              >
                <FollowingButton slug={props.topic.slug} entity={FollowingEntity.Topic} isFollowed={isFollowed()} />
              </Show>
            </Show>
          </NoHydration>
        </div>
      </div>
    </div>
  )
}
