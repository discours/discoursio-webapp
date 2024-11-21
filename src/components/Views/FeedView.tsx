import { A, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createEffect, createMemo, createSignal } from 'solid-js'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { ModalType, useUI } from '~/context/ui'
import { Author, Shout } from '~/graphql/schema/core.gen'
import { Reaction } from '~/graphql/schema/core.gen'
import { getFileUrl } from '~/lib/getThumbUrl'
import { CommentDate } from '../Article/CommentDate'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { FeedFilters } from '../Feed/FeedFilters'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'
import { Modal } from '../_shared/Modal'

import styles from '~/styles/views/Feed.module.scss'

export interface FeedProps {
  shouts: Shout[]
  unratedShouts: Shout[]
  recentComments: Reaction[]
}

export const FeedView = (props: FeedProps) => {
  console.log('[FeedView] Render started with props:', {
    shoutsCount: props.shouts?.length,
    unratedCount: props.unratedShouts?.length,
    commentsCount: props.recentComments?.length
  })

  const { t } = useLocalize()
  const loc = useLocation()
  const { showModal } = useUI()
  const { session } = useSession()
  const { isFeedLoading, feedByMode } = useFeed()

  // Мемоизируем sortedFeed для оптимизации производительности
  const sortedFeed = createMemo(() => {
    const currentFeed = feedByMode().shouts
    const result = currentFeed.length ? currentFeed : props.shouts
    console.log('[FeedView] Sorted feed computed:', {
      currentFeedLength: currentFeed.length,
      propsShoutsLength: props.shouts?.length,
      resultLength: result?.length
    })
    return result
  })

  const [shareData, setShareData] = createSignal<Shout>()

  // Мемоизируем вычисляемые значения
  const isLoading = createMemo(() => {
    const loading = isFeedLoading() && !sortedFeed()?.length
    console.log('[FeedView] Loading state computed:', {
      isFeedLoading: isFeedLoading(),
      hasSortedFeed: !!sortedFeed()?.length,
      isLoading: loading
    })
    return loading
  })

  // Добавляем мемоизацию для проверки необходимости показа плейсхолдера
  const showPlaceholder = createMemo(() => {
    const shouldShow = !(session() && loc.pathname.includes('feed'))
    console.log('[FeedView] Placeholder visibility computed:', {
      hasSession: !!session(),
      pathname: loc.pathname,
      shouldShow
    })
    return shouldShow
  })

  // Компонент для комментариев
  const FreshestCommentsList = () => {
    return (
      <Show when={props.recentComments?.length > 0}>
        <section class={styles.asideSection}>
          <h4>{t('Comments')}</h4>
          <For each={props.recentComments || []}>
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
  }

  createEffect(() => {
    console.log('[FeedView] Feed state updated:', {
      feedLength: sortedFeed()?.length,
      isLoading: isLoading(),
      pathname: loc.pathname,
      showPlaceholder: showPlaceholder()
    })
  })

  // Состояние для хранения данных для шаринга
  const handleShare = (shared: Shout | undefined) => {
    showModal('share')
    setShareData(shared)
  }

  // Компонент для рендеринга статей
  const ArticlesList = () => {
    const { topAuthors } = useAuthors()

    const TopAuthorsList = () => (
      <section class={styles.asideSection}>
        <h4>{t('Top authors')}</h4>
        <For each={topAuthors() || []}>{(author) => <AuthorLink author={author} size={'XS'} />}</For>
      </section>
    )

    return (
      <>
        <For each={sortedFeed()}>
          {(article, index) => (
            <>
              {index() === 5 && <TopAuthorsList />}
              <ArticleCard
                article={article}
                settings={{ isFeedMode: true }}
                desktopCoverSize="M"
                onShare={handleShare}
                onInvite={() => showModal('inviteCoauthors' as ModalType)}
              />
            </>
          )}
        </For>
      </>
    )
  }

  // После TopicsList добавляем новый компонент
  const UnratedArticlesList = () => {
    return (
      <Show when={props.unratedShouts?.length > 0}>
        <section class={styles.asideSection}>
          <h4>{t('Be the first to rate')}</h4>
          <For each={props.unratedShouts || []}>
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

  return (
    <Suspense fallback={<Loading />}>
      <Show when={!isLoading()} fallback={<Loading />}>
        <div class="wide-container">
          <div class={clsx('row')}>
            <Show when={!showPlaceholder()} fallback={<Placeholder type={loc.pathname} mode="feed" />}>
              <div class={clsx('col-md-5 col-xl-4', styles.feedNavigation)}>
                <Sidebar />
              </div>

              <div class="col-md-12 col-xl-7 offset-xl-1">
                <div class={styles.filtersContainer}>
                  <FeedSwitcher options={['recent', 'top', 'hot']} prefix={'/feed'} />
                  <FeedFilters />
                </div>

                <Show when={!isFeedLoading()} fallback={<Loading />}>
                  <div class={styles.feedContent}>
                    <div class={styles.feedPage}>
                      <div class={styles.mainArticles}>
                        <ArticlesList />
                      </div>
                    </div>
                  </div>
                </Show>
              </div>

              <aside class={clsx('col-md-7 col-xl-4', styles.feedAside)}>
                <Show when={!isFeedLoading()}>
                  <Suspense fallback={<Loading />}>
                    <FreshestCommentsList />
                    <UnratedArticlesList />
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
                  </Suspense>
                </Show>
              </aside>
            </Show>
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
      </Show>
    </Suspense>
  )
}
