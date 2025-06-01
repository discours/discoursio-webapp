import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, on } from 'solid-js'

import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { type Author, FollowingEntity, type Topic } from '~/graphql/schema/core.gen'
import { capitalize } from '~/utils/capitalize'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { Button } from '../_shared/Button'
import { FollowingButton } from '../_shared/FollowingButton'
import { FollowingCounters } from '../_shared/FollowingCounters/FollowingCounters'
import { Icon } from '../_shared/Icon'
import { Modal } from '../_shared/Modal'

import styles from './Full.module.scss'

type Props = {
  topic: Topic
  followers?: Author[]
  authors?: Author[]
}

const AUTHORS_ON_PAGE = 20

export const FullTopic = (props: Props) => {
  const { t, lang } = useLocalize()
  const { follows } = useFollowing()
  const [followed, setFollowed] = createSignal()
  const [title, setTitle] = createSignal('')
  const { hideModal } = useUI()

  // This is function for load more Authors for modals windows

  const [offsetFollowers, setOffsetFollowers] = createSignal(0)
  const [offsetAuthors, setOffsetAuthors] = createSignal(0)
  const [displayedFollowers, setDisplayedFollowers] = createSignal<Author[]>(
    (props.followers ?? []).slice(0, AUTHORS_ON_PAGE)
  )
  const [displayedAuthors, setDisplayedAuthors] = createSignal<Author[]>(
    (props.authors ?? []).slice(0, AUTHORS_ON_PAGE)
  )
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)

  const loadMoreFollowers = async () => {
    saveScrollPosition()
    const start = offsetFollowers
    const end = offsetFollowers() + AUTHORS_ON_PAGE
    const newFollowers = await new Promise<Author[]>((resolve) =>
      resolve((props.followers ?? []).slice(start(), end))
    )
    setDisplayedFollowers([...displayedFollowers(), ...newFollowers])
    setOffsetFollowers(offsetFollowers() + AUTHORS_ON_PAGE)
    if (newFollowers.length < AUTHORS_ON_PAGE) {
      setLoadMoreHidden(true)
    }
    restoreScrollPosition()
    return newFollowers as LoadMoreItems
  }

  const loadMoreAuthors = async () => {
    saveScrollPosition()
    const start = offsetAuthors
    const end = offsetAuthors() + AUTHORS_ON_PAGE
    const newAuthors = await new Promise<Author[]>((resolve) =>
      resolve((props.authors ?? []).slice(start(), end))
    )
    setDisplayedAuthors([...displayedAuthors(), ...newAuthors])
    setOffsetAuthors(offsetAuthors() + AUTHORS_ON_PAGE)
    if (newAuthors.length < AUTHORS_ON_PAGE) {
      setLoadMoreHidden(true)
    }
    restoreScrollPosition()
    return newAuthors as LoadMoreItems
  }

  // Modals views

  const FollowersModalView = () => (
    <>
      <h2>{t('Followers')}</h2>
      <div class="row">
        <div class="col-24">
          <LoadMoreWrapper
            loadFunction={loadMoreFollowers}
            pageSize={AUTHORS_ON_PAGE}
            hidden={loadMoreHidden()}
          >
            <For each={displayedFollowers()}>
              {(follower: Author) => <AuthorBadge author={follower} onClick={() => hideModal()} />}
            </For>
          </LoadMoreWrapper>
        </div>
      </div>
    </>
  )

  const AuthorsModalView = () => (
    <>
      <h2>{t('Authors')}</h2>
      <div class="row">
        <div class="col-24">
          <LoadMoreWrapper
            loadFunction={loadMoreAuthors}
            pageSize={AUTHORS_ON_PAGE}
            hidden={loadMoreHidden()}
          >
            <For each={displayedAuthors()}>
              {(authors: Author) => <AuthorBadge author={authors} onClick={() => hideModal()} />}
            </For>
          </LoadMoreWrapper>
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
      const isFollowed = items.some((x: Topic) => x?.slug === props.topic?.slug)
      setFollowed(isFollowed)
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

      <div class={clsx(styles.topicActions)}>
        <FollowingButton
          entity={FollowingEntity.Topic}
          slug={props.topic?.slug}
          isFollowed={Boolean(followed())}
          class={styles.followControl}
        />

        <Button
          variant={'bordered'}
          size="S"
          value={t('Write about the topic')}
          onClick={() => {}}
          class={clsx(styles.followControl)}
        />
      </div>

      <Show when={props.topic?.pic}>
        <div class={styles.topicImage}>
          <img src={props.topic?.pic || ''} alt={props.topic?.title || ''} />
        </div>
      </Show>

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
    </div>
  )
}
