import { type Author, FollowingEntity, type Topic } from '~/graphql/schema/core.gen'

import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, on } from 'solid-js'

import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'
import { FollowingButton } from '../_shared/FollowingButton'
import { FollowingCounters } from '../_shared/FollowingCounters/FollowingCounters'
import { Icon } from '../_shared/Icon'

import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { useUI } from '~/context/ui'
import { Modal } from '../_shared/Modal'

import { LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'

import styles from './Full.module.scss'

type Props = {
  topic: Topic
  followers?: Author[]
  authors?: Author[]
}

export const FullTopic = (props: Props) => {
  const { t, lang } = useLocalize()
  const { follows } = useFollowing()
  const [followed, setFollowed] = createSignal()
  const [title, setTitle] = createSignal('')
  const { hideModal } = useUI()

  const FollowersModalView = () => (
    <>
      <h2>{t('Followers')}</h2>
      <div class="row">
        <div class="col-24">
          <For each={props.followers}>
            {(follower: Author) =>
              <AuthorBadge
                author={follower}
                onClick={() => hideModal()} />}
          </For>
        </div>
      </div>
    </>
  )

  const AuthorsModalView = () => (
    <>
      <h2>{t('Authors')}</h2>
      <div class="row">
        <div class="col-24">
          <For each={props.authors}>
            {(authors: Author) => (
              <AuthorBadge
                author={authors}
                onClick={() => hideModal()}
              />
            )}
            </For>
        </div>
      </div>
    </>
  )

  createEffect(
    on(
      () => props.topic,
      (tpc) => {
        if (!tpc) return
        /* FIXME: use title translation*/
        setTitle((_) => tpc?.title || '')
        return `#${capitalize(
          lang() === 'en' ? tpc.slug.replaceAll('-', ' ') : tpc.title || tpc.slug.replaceAll('-', ' '),
          true
        )}`
      },
      {}
    )
  )

  createEffect(() => {
    if (follows?.topics?.length ?? true) {
      const items = follows.topics || []
      setFollowed(items.some((x: Topic) => x?.slug === props.topic?.slug))
    }
  })

  return (
    <div class={clsx(styles.topicHeader, 'col-md-16 col-lg-12 offset-md-4 offset-lg-6')}>
      <h1>{title()}</h1>
      <p class={styles.topicDescription} innerHTML={props.topic?.body || ''} />

      <div class={styles.topicDetails}>
        <Show when={props.topic?.stat}>
          <div class={styles.topicDetailsItem}>
            <Icon name="feed-all" class={styles.topicDetailsIcon} />
            {t('some posts', {
              count: props.topic?.stat?.shouts ?? 0
            })}
          </div>
        </Show>

        <FollowingCounters
          followers={props.followers}
          followersAmount={props.topic?.stat?.followers}
          authors={props.authors}
          authorsAmount={props.topic?.stat?.authors || props.authors?.length || 0}
        />
      </div>

      <Show when={props.followers}>
        <Modal variant="medium" isResponsive={true} name="followers" maxHeight>
          <FollowersModalView />
        </Modal>
      </Show>

      <Show when={props.authors}>
        <Modal variant="medium" isResponsive={true} name="following" maxHeight>
          <AuthorsModalView />
        </Modal>
      </Show>

      <div class={clsx(styles.topicActions)}>
        <FollowingButton
          entity={FollowingEntity.Topic}
          slug={props.topic?.slug}
          isFollowed={Boolean(followed())}
          class={styles.followControl}
        />
        <A class={styles.writeControl} href={`/edit/new/?topicId=${props.topic?.id}`}>
          {t('Write about the topic')}
        </A>
      </div>
      <Show when={props.topic?.pic}>
        <img src={props.topic?.pic || ''} alt={props.topic?.title || ''} />
      </Show>
    </div>
  )
}
