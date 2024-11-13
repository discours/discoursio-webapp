import { A, createAsync, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createEffect, createMemo, createResource, createSignal, on } from 'solid-js'
// import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { ModalType, useUI } from '~/context/ui'
import { loadUnratedShouts } from '~/graphql/api/public'
import type { Author, Shout } from '~/graphql/schema/core.gen'
import { ReactionKind } from '~/graphql/schema/core.gen'
import { CommentDate } from '../Article/CommentDate'
import { getShareUrl } from '../Article/SharePopup'
// import { AuthorBadge } from '../Author/AuthorBadge'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { FeedFilters, FeedMode, ShoutsOrder } from '../Feed/FeedFilters'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'
import { Modal } from '../_shared/Modal'
import { ViewSwitcher } from '../_shared/ViewSwitcher/ViewSwitcher'

import { isServer } from 'solid-js/web'
import styles from '~/styles/views/Feed.module.scss'
// import stylesBeside from '../Feed/Beside.module.scss'
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
  const { feedByAuthor, feedByTopic, feedOptions, updateFeedOptions, feed, isFeedLoading, seen } = useFeed()

  // loading async data
  const asyncData = createAsync(async () => {
    const fetchUnrated = loadUnratedShouts({ limit: 5, offset: 0 })
    const comments = await loadReactionsBy({ by: { kinds: [ReactionKind.Comment] }, limit: 3 })
    return {
      unrated: await fetchUnrated(),
      comments
    }
  })

  const topicShoutsSeen = (topic: string) => feedByTopic()[topic]?.some((shout) => !seen()[shout.slug])
  const authorShoutsSeen = (author: string) => feedByAuthor()[author]?.some((shout) => !seen()[shout.slug])

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

  // Мемоизируем основные состояния
  const feedState = createMemo(() => ({
    items: feed() || [],
    isLoading: isFeedLoading(),
    options: feedOptions()
  }))

  // Разделяем массив статей для оптимизации рендеринга
  const topArticles = createMemo(() => feedState().items.slice(0, 4))
  const bottomArticles = createMemo(() => feedState().items.slice(4))

  // Создаем ресурс вместо memo для асинхронной загрузки
  const [topics] = createResource(async () => {
    if (isServer) return [] // На сервере возвращаем пустой массив

    const topics = await topTopics()
    return (
      topics?.slice(0, 7).map((topic) => ({
        slug: topic.slug,
        title: topic.title,
        key: `topic-${topic.slug}`
      })) || []
    )
  })

  // Компонент для рендеринга статей
  const ArticlesList = (props: { articles: Shout[] }) => (
    <For each={props.articles}>
      {(article) => (
        <ArticleCard
          article={article}
          settings={{ isFeedMode: true }}
          desktopCoverSize="M"
          onShare={handleShare}
          onInvite={() => showModal('inviteCoauthors' as ModalType)}
        />
      )}
    </For>
  )

  // Компонент для комментариев
  const FreshestCommentsList = () => (
    <Show when={asyncData()?.comments?.length}>
      <section class={styles.asideSection}>
        <h4>{t('Comments')}</h4>
        <For each={asyncData()?.comments || []}>
          {(comment) => (
            <div class={styles.comment} id={`comment-${comment.id}`}>
              <div class={clsx('text-truncate', styles.commentBody)}>
                <A href={`/${comment.shout.slug}?commentId=${comment.id}`} innerHTML={comment.body || ''} />
              </div>
              <div class={styles.commentDetails}>
                <AuthorLink author={comment.created_by as Author} size={'XS'} />
                <CommentDate comment={comment} isShort={true} isLastInRow={true} />
              </div>
              <div class={clsx('text-truncate', styles.commentArticleTitle)}>
                <A href={`/${comment.shout.slug}`}>{comment.shout.title}</A>
              </div>
            </div>
          )}
        </For>
      </section>
    </Show>
  )

  // Компонент списка тем теперь использует Suspense
  const TopicsList = () => (
    <Suspense fallback={null}>
      <Show when={topics()?.length}>
        <section class={styles.asideSection}>
          <h4>{t('Hot topics')}</h4>
          <ul class={styles.topicsGrid}>
            <For each={topics() || []}>
              {(topic) => (
                <li id={topic.key}>
                  <span
                    class={clsx(stylesTopic.shoutTopic, styles.topic, {
                      [styles.seen]: topicShoutsSeen(topic.slug)
                    })}
                  >
                    <A href={`/topic/${topic.slug}`}>{topic.title}</A>
                  </span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </Suspense>
  )
  const AuthorsList = () => (
    <Show when={topAuthors()?.length}>
      <section class={styles.asideSection}>
        <h4>{t('Top authors')}</h4>
        <For each={topAuthors() || []}>
          {(author) => (
            <AuthorLink
              author={author}
              size={'XS'}
              class={clsx({ [styles.seen]: authorShoutsSeen(author.slug) })}
            />
          )}
        </For>
      </section>
    </Show>
  )

  return (
    <div class={clsx('wide-container', styles.feed)}>
      <div class="row">
        {/* Sidebar с Suspense */}
        <Suspense fallback={<Loading />}>
          <div class={clsx('col-md-5 col-xl-4', styles.feedNavigation)}>
            <Sidebar />
          </div>
        </Suspense>

        {/* Основной контент */}
        <div class="col-md-12 offset-xl-1">
          <Show
            when={session() || loc?.pathname === 'feed'}
            fallback={<Placeholder type={loc?.pathname} mode="feed" />}
          >
            <Show when={feedState().items.length > 0}>
              <div class={styles.filtersContainer}>
                <ViewSwitcher
                  options={['recent', 'top', 'hot']}
                  prefix={'/feed'}
                  active={feedState().options?.order}
                  onClick={(value) => updateFeedOptions({ order: value as ShoutsOrder })}
                />
                <FeedFilters />
              </div>

              <Show when={!feedState().isLoading} fallback={<Loading />}>
                <ArticlesList articles={topArticles()} />

                <div class={styles.asideSection}>
                  <AuthorsList />
                </div>

                <ArticlesList articles={bottomArticles()} />
              </Show>
            </Show>
          </Show>
        </div>

        {/* Боковая панель с Suspense для асинхронных данных */}
        <aside class={clsx('col-md-7 col-xl-6 offset-xl-1', styles.feedAside)}>
          <Show when={!isFeedLoading()}>
            <Suspense fallback={<Loading />}>
              <FreshestCommentsList />
              <TopicsList />
            </Suspense>
          </Show>
        </aside>
      </div>

      {/* Модальные окна */}
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
