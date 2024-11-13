import { A, createAsync, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createEffect, createSignal, on } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useUI } from '~/context/ui'
import { loadUnratedShouts } from '~/graphql/api/public'
import type { Author, Shout } from '~/graphql/schema/core.gen'
import { ReactionKind } from '~/graphql/schema/core.gen'
import { CommentDate } from '../Article/CommentDate'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorBadge } from '../Author/AuthorBadge'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { FeedFilters, FeedMode, ShoutsOrder } from '../Feed/FeedFilters'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'
import { Modal } from '../_shared/Modal'
import { ViewSwitcher } from '../_shared/ViewSwitcher/ViewSwitcher'

import styles from '~/styles/views/Feed.module.scss'
import stylesBeside from '../Feed/Beside.module.scss'
import stylesTopic from '../Feed/CardTopic.module.scss'

export const FEED_PAGE_SIZE = 20
export type FeedProps = {
  mode?: FeedMode
  order?: ShoutsOrder
}

export const FeedView = (props: FeedProps) => {
  const { t } = useLocalize()
  const loc = useLocation()
  const { showModal } = useUI()
  const { loadReactionsBy } = useReactions()
  const { topTopics } = useTopics()
  const { topAuthors } = useAuthors()
  const { session } = useSession()
  const { feedOptions, updateFeedOptions, feed, isFeedLoading } = useFeed()

  const unrated = createAsync(async () => {
    const fetcher = loadUnratedShouts({ limit: 5, offset: 0 })
    const result = await fetcher()
    return result
  })

  const recentComments = createAsync(
    async () => await loadReactionsBy({ by: { kinds: [ReactionKind.Comment] }, limit: 3 })
  )

  // loading state
  const [shareData, setShareData] = createSignal<Shout | undefined>()

  const handleShare = (shared: Shout | undefined) => {
    showModal('share')
    setShareData(shared)
  }

  createEffect(
    on(
      feedOptions,
      (opts) => {
        // Проверяем, действительно ли изменились значения
        const currentMode = opts?.mode
        const currentOrder = opts?.order
        const newMode = props.mode || 'all'
        const newOrder = props.order || currentOrder

        if (currentMode !== newMode || currentOrder !== newOrder) {
          updateFeedOptions({
            mode: newMode,
            order: newOrder
          })
        }
      },
      { defer: true }
    )
  )

  return (
    <div class={clsx('wide-container', styles.feed)}>
      <div class="row">
        <Suspense fallback={<Loading />}>
          <div class={clsx('col-md-5 col-xl-4', styles.feedNavigation)}>
            <Sidebar />
          </div>
        </Suspense>
        <div class="col-md-12 offset-xl-1">
          <Show when={!session() && loc?.pathname !== 'feed'}>
            <Placeholder type={loc?.pathname} mode="feed" />
          </Show>

          <Show when={(session() || loc?.pathname === 'feed') && feed()}>
            <div class={styles.filtersContainer}>
              <ViewSwitcher
                options={['recent', 'top', 'hot']}
                prefix={'/feed'}
                active={feedOptions()?.order}
                onClick={(value) => updateFeedOptions({ order: value as ShoutsOrder })}
              />
              <FeedFilters />
            </div>

            <Show when={!isFeedLoading()} fallback={<Loading />}>
              <Show when={(feed() || []).length > 0}>
                <For each={(feed() || []).slice(0, 4)}>
                  {(article) => (
                    <ArticleCard
                      onShare={(shared) => handleShare(shared)}
                      onInvite={() => showModal('inviteMembers')}
                      article={article}
                      settings={{ isFeedMode: true }}
                      desktopCoverSize="M"
                    />
                  )}
                </For>

                <div class={styles.asideSection}>
                  <div class={stylesBeside.besideColumnTitle}>
                    <h4>{t('Popular authors')}</h4>
                    <a href="/author">
                      {t('All authors')}
                      <Icon name="arrow-right" class={stylesBeside.icon} />
                    </a>
                  </div>

                  <ul class={stylesBeside.besideColumn}>
                    <For each={topAuthors().slice(0, 5)}>
                      {(author) => (
                        <li>
                          <AuthorBadge author={author} />
                        </li>
                      )}
                    </For>
                  </ul>
                </div>

                <For each={(feed() || []).slice(4)}>
                  {(article) => (
                    <ArticleCard article={article} settings={{ isFeedMode: true }} desktopCoverSize="M" />
                  )}
                </For>
              </Show>
            </Show>
          </Show>
        </div>

        <aside class={clsx('col-md-7 col-xl-6 offset-xl-1', styles.feedAside)}>
          <Show when={!isFeedLoading()}>
            <Show when={recentComments()}>
              <section class={styles.asideSection}>
                <h4>{t('Comments')}</h4>
                <For each={recentComments()}>
                  {(comment) => {
                    return (
                      <div class={styles.comment}>
                        <div class={clsx('text-truncate', styles.commentBody)}>
                          <A
                            href={`/${comment.shout.slug}?commentId=${comment.id}`}
                            innerHTML={comment.body || ''}
                          />
                        </div>
                        <div class={styles.commentDetails}>
                          <AuthorLink author={comment.created_by as Author} size={'XS'} />
                          <CommentDate comment={comment} isShort={true} isLastInRow={true} />
                        </div>
                        <div class={clsx('text-truncate', styles.commentArticleTitle)}>
                          <A href={`/${comment.shout.slug}`}>{comment.shout.title}</A>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </section>
            </Show>

            <section class={styles.asideSection}>
              <Show when={topTopics()?.length > 0} fallback={<h4>{t('Hot topics')}</h4>}>
                <h4>{t('Hot topics')}</h4>
                <div>
                  <For each={topTopics().slice(0, 7)}>
                    {(topic) => (
                      <span class={clsx(stylesTopic.shoutTopic, styles.topic)}>
                        <A href={`/topic/${topic.slug}`}>{topic.title}</A>
                      </span>
                    )}
                  </For>
                </div>
              </Show>
            </section>

            <Show when={unrated?.()}>
              <section class={clsx(styles.asideSection)}>
                <h4>{t('Be the first to rate')}</h4>
                <For each={unrated() as Shout[]}>
                  {(article) => (
                    <ArticleCard article={article} settings={{ noimage: true, noauthor: false }} />
                  )}
                </For>
              </section>
            </Show>

            <section class={clsx(styles.asideSection, styles.pinnedLinks)}>
              <h4>{t('Knowledge base')}</h4>
              <ul class="nodash">
                <li>
                  <A href="/guide">{t('How Discours works')}</A>
                </li>
                <li>
                  <A href="/how-to-write-a-good-article">{t('How to write a good article')}</A>
                </li>
                <li>
                  <A href="/rules">{t('Rules of constructive discussions')}</A>
                </li>
                <li>
                  <A href="/principles">{t('Community principles')}</A>
                </li>
              </ul>
            </section>
          </Show>
        </aside>
      </div>
      <Show when={shareData()}>
        <ShareModal
          title={shareData()?.title || ''}
          description={shareData()?.description || ''}
          imageUrl={shareData()?.cover || ''}
          shareUrl={getShareUrl({ pathname: `/${shareData()?.slug || ''}` })}
        />
      </Show>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>
    </div>
  )
}
