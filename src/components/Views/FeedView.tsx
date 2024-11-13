import { A, createAsync, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createEffect, createMemo, createSignal, on } from 'solid-js'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { ModalType, useUI } from '~/context/ui'
import { loadUnratedShouts } from '~/graphql/api/public'
import type { Author, Shout } from '~/graphql/schema/core.gen'
import { ReactionKind } from '~/graphql/schema/core.gen'
import { getFileUrl } from '~/lib/getThumbUrl'
import styles from '~/styles/views/Feed.module.scss'
import { CommentDate } from '../Article/CommentDate'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { FeedFilters, FeedMode, ShoutsOrder } from '../Feed/FeedFilters'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'
import { Modal } from '../_shared/Modal'
import { ViewSwitcher } from '../_shared/ViewSwitcher/ViewSwitcher'

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
  const { topAuthors } = useAuthors()
  const { session } = useSession()
  const { feedOptions, updateFeedOptions, feed, isFeedLoading } = useFeed()

  // loading async data
  const asyncData = createAsync(async () => {
    console.log('Starting asyncData load')
    try {
      const fetchUnrated = loadUnratedShouts({ limit: 5, offset: 0 })
      const comments = await loadReactionsBy({ by: { kinds: [ReactionKind.Comment] }, limit: 3 })

      const unrated = await fetchUnrated()
      console.log('Loaded unrated:', unrated)

      return {
        unrated,
        comments
      }
    } catch (error) {
      console.error('Error in asyncData:', error)
      return {
        unrated: [],
        comments: []
      }
    }
  })
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
          {(comment) => {
            const suffix = comment.id ? `?commentId=${comment.id}` : ''
            return (
              <div class={styles.comment} id={`comment-${comment.id}`}>
                <div class={clsx('text-truncate', styles.commentBody)}>
                  <A href={`/${comment.shout.slug}${suffix}`} innerHTML={comment.body || ''} />
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
  )

  // После TopicsList добавляем новый компонент
  const UnratedArticlesList = () => {
    return (
      <Show when={asyncData()?.unrated?.length}>
        <section class={styles.asideSection}>
          <h4>{t('Be the first to rate')}</h4>
          <For each={asyncData()?.unrated || []}>
            {(article) => (
              <div
                class={clsx(styles.comment, styles.unratedArticle)}
                style={{
                  'background-image': `url(${getFileUrl(article.cover || '', { width: 40 })})`
                }}
              >
                <Show when={article.main_topic}>
                  <A href={`/topic/${article.main_topic?.slug}`} class={styles.commentTopic}>
                    {article.main_topic?.title?.toUpperCase()}
                  </A>
                </Show>

                <div class={clsx('text-truncate', styles.commentBody)}>
                  <A href={`/${article.slug}`}>{article.title}</A>
                  <Show when={article.subtitle || article.lead}>
                    <p class={styles.commentText}>{article.subtitle || article.lead}</p>
                  </Show>
                </div>

                <div class={styles.commentDetails}>
                  <AuthorLink author={article.created_by as Author} size={'XS'} />
                </div>
              </div>
            )}
          </For>
        </section>
      </Show>
    )
  }

  const TopAuthorsList = () => (
    <section class={styles.asideSection}>
      <h4>{t('Top authors')}</h4>
      <For each={topAuthors() || []}>{(author) => <AuthorLink author={author} size={'XS'} />}</For>
    </section>
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
                  <TopAuthorsList />
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
              {/* Блок комментариев */}
              <FreshestCommentsList />
              {/* Блок "Оцените первым" */}
              <UnratedArticlesList />
              {/* Блок "База знаний" */}
              <section class={styles.asideSection}>
                <h4>{t('Knowledge base')}</h4>
                <ul class={styles.knowledgeBaseList}>
                  <li>
                    <A href="/guide/how-it-works" class={styles.knowledgeBaseLink}>
                      {t('How Discours works')}
                    </A>
                  </li>
                  <li>
                    <A href="/guide/constructive-criticism" class={styles.knowledgeBaseLink}>
                      {t('Constructive criticism')}
                    </A>
                  </li>

                  <li>
                    <A href="/guide/community-principles" class={styles.knowledgeBaseLink}>
                      {t('Community principles')}
                    </A>
                  </li>
                  <li>
                    <A href="/how-to-write-a-good-article" class={styles.knowledgeBaseLink}>
                      {t('How to write a good article')}
                    </A>
                  </li>
                </ul>
              </section>
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
