import { redirect, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import stylesButton from '~/components/_shared/Button/Button.module.scss'
import { FollowingButton } from '~/components/_shared/FollowingButton'
import { FollowingCounters } from '~/components/_shared/FollowingCounters/FollowingCounters'
import { ShowOnlyOnClient } from '~/components/_shared/ShowOnlyOnClient'
import { FollowsFilter, useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import type { Author, Community } from '~/graphql/schema/core.gen'
import { FollowingEntity, Topic } from '~/graphql/schema/core.gen'
import { isCyrillic } from '~/intl/translate'
import { translit } from '~/intl/translit'
import { SharePopup, getShareUrl } from '../../Article/SharePopup'
import { TopicBadge } from '../../Topic/TopicBadge'
import { Modal } from '../../_shared/Modal'
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
  const { t, lang } = useLocalize()
  const navigate = useNavigate()
  const { session, isSessionLoaded, requireAuthentication } = useSession()
  const author = createMemo<Author>(() => session()?.user?.app_data?.profile as Author)
  const [authorSubs, setAuthorSubs] = createSignal<Array<Author | Topic | Community>>([])
  const [followsFilter, setFollowsFilter] = createSignal<FollowsFilter>('all')
  const [isFollowed, setIsFollowed] = createSignal<boolean>()
  const isProfileOwner = createMemo(() => author()?.slug === props.author.slug)
  const { follows } = useFollowing() // viewer's followings
  const { hideModal } = useUI()

  createEffect(() => {
    if (!(follows && props.author)) return
    const followed = follows?.authors?.some((authorEntity) => authorEntity.id === props.author?.id)
    setIsFollowed(followed)
  })

  const name = createMemo(() => {
    if (lang() !== 'ru' && isCyrillic(props.author?.name || '')) {
      if (props.author.name === 'Дискурс') {
        return 'Discours'
      }
      return translit(props.author?.name || '')
    }
    return props.author.name
  })

  const initChat = () => {
    // eslint-disable-next-line solid/reactivity
    requireAuthentication(() => {
      props.author?.id && navigate(`/inbox/${props.author?.id}`, { replace: true })
    }, 'discussions')
  }

  createEffect(
    on(followsFilter, (f = 'all') => {
      const subs =
        f !== 'all'
          ? follows[f as keyof typeof follows]
          : [...(follows.topics || []), ...(follows.authors || [])]
      setAuthorSubs(subs || [])
    })
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

  const FollowingModalView = () => (
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
          <span class="view-switcher__counter">{props.flatFollows?.length}</span>
        </li>
        <li
          class={clsx({
            'view-switcher__item--selected': followsFilter() === 'authors'
          })}
        >
          <button type="button" onClick={() => setFollowsFilter('authors')}>
            {t('Authors')}
          </button>
          <span class="view-switcher__counter">{props.flatFollows?.filter((s) => 'name' in s).length}</span>
        </li>
        <li
          class={clsx({
            'view-switcher__item--selected': followsFilter() === 'topics'
          })}
        >
          <button type="button" onClick={() => setFollowsFilter('topics')}>
            {t('Topics')}
          </button>
          <span class="view-switcher__counter">
            {props.flatFollows?.filter((s) => 'title' in s).length}
          </span>
        </li>
      </ul>
      <br />
      <div class={styles.listWrapper}>
        <div class="row">
          <div class="col-24">
            <For each={authorSubs()}>
              {(subscription) =>
                'name' in subscription ? (
                  <AuthorBadge
                    author={subscription as Author}
                    subscriptionsMode={true}
                    onClick={() => hideModal()}
                  />
                ) : (
                  <TopicBadge topic={subscription as Topic} subscriptionsMode={true} />
                )
              }
            </For>
          </div>
        </div>
      </div>
    </>
  )

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
          <Show when={(props.followers || [])?.length > 0 || (props.flatFollows || []).length > 0}>
            <div class={styles.subscribersContainer}>
              <FollowingCounters
                followers={props.followers}
                followersAmount={props.author?.stat?.followers || 0}
                following={props.flatFollows}
                followingAmount={props.flatFollows?.length || 0}
              />
            </div>
          </Show>
        </div>
        <ShowOnlyOnClient>
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
                  <Show when={authorSubs()?.length}>
                    <FollowingButton
                      slug={props.author.slug}
                      entity={FollowingEntity.Author}
                      isFollowed={Boolean(isFollowed())}
                      class={clsx({ [stylesButton.followed]: isFollowed() })}
                    />
                  </Show>
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
                  onClick={() => redirect('/settings')}
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
        </ShowOnlyOnClient>
        <Show when={props.followers}>
          <Modal variant="medium" isResponsive={true} name="followers" maxHeight>
            <FollowersModalView />
          </Modal>
        </Show>
        <Show when={props.flatFollows}>
          <Modal variant="medium" isResponsive={true} name="following" maxHeight>
            <FollowingModalView />
          </Modal>
        </Show>
      </div>
    </div>
  )
}
