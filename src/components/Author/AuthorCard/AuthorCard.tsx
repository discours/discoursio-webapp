import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, on, Show, Suspense } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import { Button } from '~/components/_shared/Button'
import stylesButton from '~/components/_shared/Button/Button.module.scss'
import { FollowingButton } from '~/components/_shared/FollowingButton'
import { FollowingCounters } from '~/components/_shared/FollowingCounters/FollowingCounters'
import { Icon } from '~/components/_shared/Icon'
import { FollowsFilter, useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useProfile } from '~/context/profile'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import type { Author, Community, Topic } from '~/graphql/generated/graphql'
import { FollowingEntity } from '~/graphql/generated/graphql'
import { isCyrillic } from '~/intl/translate'
import { translit } from '~/intl/translit'
import { Modal } from '../../_shared/Modal'
import { getShareUrl, SharePopup } from '../../Article/SharePopup'
import { TopicBadge } from '../../Topic/TopicBadge'
import { AuthorBadge } from '../AuthorBadge'
import { Userpic } from '../Userpic'
import styles from './AuthorCard.module.scss'

type Props = {
  author: Author
  followers?: Author[]
  flatFollows?: Array<Author | Topic>
  showMessageButton?: boolean
}

export const AuthorCard = (props: Props) => {
  const { t, lang, formatDate } = useLocalize()
  const navigate = useNavigate()
  const { session, isSessionLoaded, requireAuthentication } = useSession()
  const { setForm } = useProfile()
  const author = createMemo<Author>(() => session()?.author as Author)
  const [authorSubs, setAuthorSubs] = createSignal<Array<Author | Topic | Community>>(props.flatFollows || [])
  const [followsFilter, setFollowsFilter] = createSignal<FollowsFilter>('all')
  const isProfileOwner = () => author()?.slug === props.author.slug
  const { follows } = useFollowing() // viewer's followings
  const { hideModal } = useUI()

  // Определяем состояние подписки реактивно на основе контекста
  const isFollowed = () => {
    if (!follows?.authors || !props.author?.id) return false
    return follows.authors.some((authorEntity) => authorEntity.id === props.author.id)
  }

  const name = () => {
    const authorName = props.author?.name || ''
    if (lang() !== 'ru' && isCyrillic(authorName)) {
      if (authorName === 'Дискурс') {
        return 'Discours'
      }
      return translit(authorName)
    }
    return authorName
  }

  const initChat = () => {
    // eslint-disable-next-line solid/reactivity
    requireAuthentication(() => {
      props.author?.id && navigate(`/inbox/${props.author?.id}`, { replace: true })
    }, 'discussions')
  }

  const navigateToSettings = () => {
    console.log('Attempting to navigate to settings')
    console.log('Session state:', session())
    requireAuthentication(() => {
      const currentAuthor = author()
      if (currentAuthor && setForm) {
        setForm({
          name: currentAuthor.name || '',
          slug: currentAuthor.slug || '',
          bio: currentAuthor.bio || '',
          about: currentAuthor.about || '',
          pic: currentAuthor.pic || '',
          links: currentAuthor.links || []
        })
      }
      console.log('Authentication successful, navigating...')
      navigate('/settings', { replace: true })
    }, 'profile')
  }

  createEffect(
    on(
      () => props.flatFollows,
      (ff = []) => {
        if (!ff) return
        setAuthorSubs(ff)
      },
      { defer: true }
    )
  )
  const FollowersModalView = () => (
    <>
      <h2>{t('Followers')}</h2>
      <div class={styles.listWrapper}>
        <div class="row">
          <div class="col-24">
            <For each={props.followers}>
              {(follower: Author) => <AuthorBadge author={follower} onClick={() => hideModal()} />}
            </For>
          </div>
        </div>
      </div>
    </>
  )

  const FollowingModalView = () => {
    const filteredSubs = () => {
      const f = followsFilter()
      if (!authorSubs()) return []

      return f !== 'all'
        ? authorSubs().filter((sub) => (f === 'authors' ? 'name' in sub : 'title' in sub))
        : authorSubs()
    }

    return (
      <>
        <h2>{t('Subscriptions')}</h2>
        <ul class="view-switcher">
          <li
            class={clsx({
              'view-switcher__item--selected': followsFilter() === 'all'
            })}
          >
            <button type="button" onClick={() => setFollowsFilter('all')}>
              {t('All')}
            </button>
            <span class="view-switcher__counter">{authorSubs()?.length}</span>
          </li>
          <li
            class={clsx({
              'view-switcher__item--selected': followsFilter() === 'authors'
            })}
          >
            <button type="button" onClick={() => setFollowsFilter('authors')}>
              {t('Authors')}
            </button>
            <span class="view-switcher__counter">{authorSubs()?.filter((s) => 'name' in s).length}</span>
          </li>
          <li
            class={clsx({
              'view-switcher__item--selected': followsFilter() === 'topics'
            })}
          >
            <button type="button" onClick={() => setFollowsFilter('topics')}>
              {t('Topics')}
            </button>
            <span class="view-switcher__counter">{authorSubs()?.filter((s) => 'title' in s).length}</span>
          </li>
        </ul>
        <br />
        <div class={styles.listWrapper}>
          <div class="row">
            <div class="col-24">
              <For each={filteredSubs()}>
                {(subscription) =>
                  'name' in subscription ? (
                    <AuthorBadge author={subscription as Author} subscriptionsMode={true} onClick={() => hideModal()} />
                  ) : (
                    <TopicBadge topic={subscription as Topic} subscriptionsMode={true} onClick={() => hideModal()} />
                  )
                }
              </For>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div class={clsx(styles.author, 'row')}>
      <div class="col-md-5">
        <Userpic
          size={'XL'}
          name={props.author.name || ''}
          userpic={props.author.pic || ''}
          slug={props.author.slug}
          class={styles.circlewrap}
        />
      </div>
      <div class={clsx('col-md-15 col-xl-13', styles.authorDetails)}>
        <div class={styles.authorDetailsWrapper}>
          <div class={styles.authorName}>{name()}</div>
          <Show when={props.author.bio}>
            <div class={styles.authorAbout} innerHTML={props.author.bio || ''} />
          </Show>
          <Show when={props.author.created_at}>
            <div style="font-size: 1.4rem; color: var(--black-400); font-weight: 500; margin-top: 0.8rem;">
              {t('member since some time', {
                date: formatDate(new Date((props.author.created_at || 0) * 1000))
              })}
            </div>
          </Show>
          <Show when={(props.followers || [])?.length > 0 || (authorSubs() || []).length > 0}>
            <div class={styles.subscribersContainer}>
              <FollowingCounters
                followers={props.followers}
                followersAmount={props.author?.stat?.followers || 0}
                following={authorSubs()}
                followingAmount={authorSubs()?.length || 0}
              />
            </div>
          </Show>
          <Show when={props.author?.stat}>
            <Suspense>
              <div
                class="stats"
                style="display: flex; flex-wrap: nowrap; gap: 1rem; margin-top: 1.5rem; color: var(--black-400); font-size: 1.2rem; line-height: 1.3; overflow-x: auto;"
              >
                {(props.author?.stat?.shouts || 0) > 0 && (
                  <span
                    class="statItem"
                    style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                  >
                    <Icon
                      name="feed-all"
                      class="statIcon"
                      style="width: 1.2rem; height: 1.2rem; flex-shrink: 0; color: var(--black-400);"
                      title={t('Publications')}
                    />
                    {t('some shouts', { count: props.author?.stat?.shouts })}
                  </span>
                )}
                {(props.author?.stat?.topics || 0) > 0 && (
                  <span
                    class="statItem"
                    style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                  >
                    <Icon
                      name="create-literature"
                      class="statIcon"
                      style="width: 1.2rem; height: 1.2rem; flex-shrink: 0; color: var(--black-400);"
                      title={t('Topics')}
                    />
                    {t('some topics', { count: props.author?.stat?.topics })}
                  </span>
                )}
                {props.author?.stat?.coauthors && props.author?.stat?.coauthors > 0 && (
                  <span
                    class="statItem"
                    style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                  >
                    <Icon
                      name="feed-collaborate"
                      class="statIcon"
                      style="width: 1.2rem; height: 1.2rem; flex-shrink: 0; color: var(--black-400);"
                      title={t('Co-authors')}
                    />
                    {t('some coauthors', { count: props.author?.stat?.coauthors })}
                  </span>
                )}
                {props.author?.stat?.viewed_shouts && props.author?.stat?.viewed_shouts > 0 && (
                  <span
                    class="statItem"
                    style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                  >
                    <Icon
                      name="view"
                      class="statIcon"
                      style="width: 1.2rem; height: 1.2rem; flex-shrink: 0; color: var(--black-400);"
                      title={t('Views')}
                    />
                    <span class="statCount" title={t('some views', { count: props.author?.stat?.viewed_shouts })}>
                      {props.author?.stat?.viewed_shouts}
                    </span>
                  </span>
                )}
                {(props.author?.stat?.comments || 0) > 0 && (
                  <span
                    class="statItem"
                    style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                  >
                    <Icon name="comment" class="statIcon" style="width: 1.2rem; height: 1.2rem; flex-shrink: 0;" />
                    <span title={t('some comments', { count: props.author?.stat?.comments })}>
                      {props.author?.stat?.comments}
                    </span>
                    {' / '}
                    <span title={t('some replies', { count: props.author?.stat?.replies_count })}>
                      {props.author?.stat?.replies_count}
                    </span>
                  </span>
                )}
                {props.author?.stat &&
                  ((props.author?.stat?.rating_shouts && props.author?.stat?.rating_shouts !== 0) ||
                    (props.author?.stat?.rating_comments && props.author?.stat?.rating_comments !== 0)) && (
                    <span
                      class="statItem"
                      style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                    >
                      <span class="statCount" title={t('Rating shouts')}>
                        {(props.author?.stat?.rating_shouts || 0) > 0 ? '+' : ''}
                        {props.author?.stat?.rating_shouts || 0}
                        {' / '}
                        <span title={t('Rating comments')}>
                          {(props.author?.stat?.rating_comments || 0) > 0 ? '+' : ''}
                          {props.author?.stat?.rating_comments || 0}
                        </span>
                      </span>
                    </span>
                  )}
              </div>
            </Suspense>
          </Show>
        </div>
        <NoHydration>
          <Show when={isSessionLoaded()}>
            <Show when={props.author.links && props.author.links.length > 0}>
              <div class={styles.authorSubscribeSocial}>
                <For each={props.author.links}>
                  {(link: string | null) => (
                    <a
                      class={styles.socialLink}
                      href={link?.startsWith('http') ? link : `https://${link}`}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                    >
                      <span class={styles.authorSubscribeSocialLabel}>
                        {link?.startsWith('http') ? link : `https://${link}`}
                      </span>
                    </a>
                  )}
                </For>
              </div>
            </Show>
            <Show
              when={isProfileOwner()}
              fallback={
                <div class={styles.authorActions}>
                  <FollowingButton
                    slug={props.author.slug}
                    entity={FollowingEntity.Author}
                    // 🔄 НЕ передаем isFollowed - пусть компонент сам определяет из контекста
                    class={clsx({ [stylesButton.followed]: isFollowed() })}
                  />
                  <Show when={props.showMessageButton}>
                    <Button
                      variant={'secondary'}
                      value={t('Message')}
                      onClick={initChat}
                      class={styles.buttonWriteMessage}
                    />
                  </Show>
                </div>
              }
            >
              <div class={styles.authorActions}>
                <Button
                  variant="secondary"
                  onClick={navigateToSettings}
                  value={
                    <>
                      <span class={styles.authorActionsLabel}>{t('Edit profile')}</span>
                      <span class={styles.authorActionsLabelMobile}>{t('Edit')}</span>
                    </>
                  }
                />
                <SharePopup
                  title={props.author.name || ''}
                  description={props.author.bio || ''}
                  imageUrl={props.author.pic || ''}
                  shareUrl={getShareUrl({
                    pathname: `/@${props.author.slug}`
                  })}
                  trigger={<Button variant="secondary" value={t('Share')} />}
                />
              </div>
            </Show>
          </Show>
        </NoHydration>
        <Show when={props.followers}>
          <Modal variant="medium" isResponsive={true} name="followers" maxHeight>
            <FollowersModalView />
          </Modal>
        </Show>
        <Show when={authorSubs()}>
          <Modal variant="medium" isResponsive={true} name="following" maxHeight>
            <FollowingModalView />
          </Modal>
        </Show>
      </div>
    </div>
  )
}
