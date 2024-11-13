import { A, createAsync, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createEffect, createSignal, on, createMemo } from 'solid-js'
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
import type { Author, Shout, Topic } from '~/graphql/schema/core.gen'
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
  const { feedOptions, updateFeedOptions, feed, isFeedLoading, feedByAuthor, seen } = useFeed()

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

  // Мемоизируем основные состояния
  const feedState = createMemo(() => ({
    items: feed() || [],
    isLoading: isFeedLoading(),
    options: feedOptions()
  }))

  // Разделяем массив статей для оптимизации рендеринга
  const topArticles = createMemo(() => feedState().items.slice(0, 4))
  const bottomArticles = createMemo(() => feedState().items.slice(4))

  // Мемоизируем асинхронные данные
  const asyncData = createMemo(() => ({
    unrated: unrated(),
    comments: recentComments(),
    topics: topTopics()
  }))

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
  const CommentsList = () => (
    <Show when={asyncData().comments}>
      <section class={styles.asideSection}>
        <h4>{t('Comments')}</h4>
        <For each={asyncData().comments}>
          {(comment) => (
            <div class={styles.comment} id={`comment-${comment.id}`}>
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
          )}
        </For>
      </section>
    </Show>
  )

  // Мемоизируем список топиков с предварительной проверкой данных
  const visibleTopics = createMemo(() => {
    const topics = topTopics()
    if (!topics) return []
    
    return topics
      .slice(0, 7)
      .map(topic => ({
        slug: topic.slug,
        title: topic.title,
        key: `topic-${topic.slug}`
      }))
      .filter(Boolean)
  }, [])

  // Компонент для горячих тем с предсказуемой структурой
  const TopicsList = () => (
    <section class={styles.asideSection}>
      <h4>{t('Hot topics')}</h4>
      <ul class={styles.topicsGrid}>
        <For each={visibleTopics() || []}>
          {(topic) => (
            <li id={topic.key}>
              <span class={clsx(stylesTopic.shoutTopic, styles.topic)}>
                <A href={`/topic/${topic.slug}`}>
                  {topic.title}
                </A>
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  )

  // Мемоизируем список авторов с предварительной проверкой данных
  const authorsList = createMemo(() => {
    const authors = topAuthors()

    // Важно: дождемся инициализации данных
    if (!authors) return []

    return authors
      .filter(Boolean)
      .map(author => {
        // Убеждаемся, что все необходимые данные существуют
        if (!author.slug || !author.name) return null

        return {
          ...author,
          isUnread: Boolean(
            feedByAuthor()[author.slug]?.every(
              (article) => Boolean(seen()[article.slug])
            )
          ),
          key: `author-${author.slug}`
        }
      })
      .filter(Boolean) // Удаляем null элементы
  })

  // Оптимизированный компонент списка авторов
  const AuthorsList = () => {
    // Получаем данные через memo для стабильности
    const authors = authorsList()

    // Если данных нет - возвращаем null для предсказуемой гидратации
    if (!authors.length) return null

    return (
      <ul>
        <For each={authors}>
          {(author: Author & { isUnread: boolean, key: string } | null) => {
            if (!author) return null
            return (
              <li id={author.key}>
                <AuthorLink
                  author={author}
                  size="XS"
                  class={clsx({ [styles.unread]: author.isUnread })}
                />
              </li>
            )
          }}
        </For>
      </ul>
    )
  }

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
                  {/* Популярные авторы */}
                  <AuthorsList />
                </div>

                <ArticlesList articles={bottomArticles()} />

              </Show>
            </Show>
          </Show>
        </div>

        {/* Боковая панель с Suspense для асинхронных данных */}
        <aside class={clsx('col-md-7 col-xl-6 offset-xl-1', styles.feedAside)}>
          <Show when={!feedState().isLoading}>
            <Suspense fallback={<Loading />}>
              <CommentsList />
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
function seen() {
  throw new Error('Function not implemented.')
}

