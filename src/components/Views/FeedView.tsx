import { A, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createEffect, createMemo, createSignal, on } from 'solid-js'
import { CommentsList, KnowledgeBase, SuggestBox, TopAuthorsList } from '~/components/Feed/AsideComponents'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { ModalType, useUI } from '~/context/ui'
import { loadShoutsMyRates } from '~/graphql/api/private'
import { Author, ReactionKind, Shout } from '~/graphql/schema/core.gen'
import { Reaction } from '~/graphql/schema/core.gen'
import { getFileUrl } from '~/lib/getThumbUrl'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { FeedFiltersControl } from '../Feed/FeedFiltersControl'
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
  const { t } = useLocalize()
  const loc = useLocation()
  const { showModal } = useUI()
  const { session, client } = useSession()
  const { isFeedLoading, feedByMode, myFeed, mode, initializeFeed } = useFeed()

  // Добавляем состояние для мобильного меню
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = createSignal(false)

  const shouldShowPlaceholder = createMemo(() => {
    const feedType = myFeed()
    const currentFeed = feedByMode()
    const isAuthorized = !!session()?.token
    const isEmpty = !currentFeed?.shouts?.length
    return (
      ['followed', 'coauthored', 'discussed', 'comments'].includes(feedType as string) &&
      (isEmpty || !isAuthorized)
    )
  })

  const placeholderType = createMemo(() => {
    const feedType = myFeed()
    if (!session()?.token) return 'author'
    return feedType || 'feed'
  })

  // Мемоизируем sortedFeed для оптимизации производительности
  const sortedFeed = createMemo(() => {
    const currentFeed = feedByMode()
    const result = currentFeed.shouts?.length ? currentFeed.shouts : props.shouts || []
    console.log('[FeedView] Sorted feed computed:', {
      currentFeedLength: currentFeed.shouts?.length,
      propsShoutsLength: props.shouts?.length,
      resultLength: result?.length,
      currentMode: mode()
    })
    return result
  })

  // Инициализируем feed данными из props при первой загрузке
  createEffect(() => {
    if (props.shouts?.length && !feedByMode().shouts?.length) {
      const currentMode = mode()
      console.log('[FeedView] Initializing feed with props data:', {
        mode: currentMode,
        shoutsLength: props.shouts.length
      })
      initializeFeed(currentMode, props.shouts)
    }
  })

  const [myRates, setMyRates] = createSignal<Record<string, ReactionKind | undefined>>({})
  // загрузка myRates при изменении фида или авторизации
  createEffect(
    on(
      [sortedFeed, () => client()],
      async ([shouts, authorizedClient]) => {
        if (!(shouts?.length && authorizedClient)) {
          setMyRates({})
          return
        }

        try {
          const myRates = await loadShoutsMyRates(
            shouts.map((s) => s.id),
            authorizedClient
          )()

          if (Array.isArray(myRates)) {
            const ratesMap = myRates.reduce(
              (acc, row) => {
                if (row?.my_rate && row?.shout_id) {
                  acc[row.shout_id] = row.my_rate
                }
                return acc
              },
              {} as Record<string, number>
            )
            setMyRates(ratesMap)
          }
        } catch (error) {
          console.error('[FeedView] Error loading rates:', error)
          setMyRates({})
        }
      },
      { defer: true }
    )
  )

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

  // Компонент для комментариев
  const FreshestCommentsList = () => {
    return (
      <CommentsList
        comments={props.recentComments || []}
        title={t('Recent comments')}
        maxItems={5}
        showArticleTitle={true}
        collapsible={false}
      />
    )
  }

  createEffect(() => {
    console.log('[FeedView] Feed state updated:', {
      feedLength: sortedFeed()?.length,
      isLoading: isLoading(),
      pathname: loc.pathname,
      showPlaceholder: shouldShowPlaceholder()
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

    return (
      <>
        <For each={sortedFeed()}>
          {(article, index) => (
            <>
              {index() === 5 && <TopAuthorsList authors={topAuthors() || []} />}
              <ArticleCard
                article={article}
                settings={{ isFeedMode: true }}
                desktopCoverSize="M"
                onShare={handleShare}
                onInvite={() => showModal('inviteCoauthors' as ModalType)}
                myRate={myRates()[article.id]}
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
        <AsideSection title={t('Be the first to rate')} icon="star" class={styles.unratedSection}>
          <div class={styles.unratedList}>
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
          </div>
        </AsideSection>
      </Show>
    )
  }

  return (
    <Suspense fallback={<Loading />}>
      <Show when={!isLoading() && sortedFeed()} fallback={<Loading />}>
        <div class={styles.feedLayout}>
          {/* Мобильная кнопка меню */}
          <button
            class={styles.mobileMenuToggle}
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen())}
            aria-label={t('Toggle menu')}
          >
            <span class={styles.hamburger}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          {/* Улучшенный мобильный sidebar с анимациями */}
          <div
            class={clsx(styles.feedSidebar, {
              [styles.mobileOpen]: isMobileSidebarOpen(),
              [styles.withTransition]: true
            })}
          >
            <div class={styles.sidebarContent}>
              <Sidebar />
            </div>
          </div>

          {/* Улучшенный оверлей для закрытия sidebar на мобильных */}
          <div
            class={clsx(styles.mobileOverlay, {
              [styles.visible]: isMobileSidebarOpen(),
              [styles.animated]: true
            })}
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          {/* Оптимизированная основная область с Grid Layout */}
          <div class={clsx(styles.feedMain)}>
            <div class="wide-container">
              <div class={clsx(styles.groupControls, 'row')}>
                <div class={styles.filtersRow}>
                  <FeedSwitcher options={['recent', 'top', 'hot']} prefix={'/feed'} />
                  <FeedFiltersControl />
                </div>
              </div>
            </div>

            <Show when={!isFeedLoading()} fallback={<Loading />}>
              <div class={styles.feedContent}>
                <Show
                  when={!shouldShowPlaceholder()}
                  fallback={<Placeholder type={placeholderType()} mode="feed" />}
                >
                  <div class={styles.feedPage}>
                    <Show
                      when={!feedByMode().isEmpty}
                      fallback={
                        <div class={styles.noContent}>
                          <p>{t('No publications yet')}</p>
                        </div>
                      }
                    >
                      <div class={styles.mainArticles}>
                        <ArticlesList />
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Улучшенная aside область с унифицированными секциями */}
          <aside class={clsx(styles.feedAside)}>
            <Show when={!isFeedLoading()}>
              <Suspense fallback={<Loading />}>
                <div class={styles.asideContent}>
                  <FreshestCommentsList />
                  <UnratedArticlesList />
                  <TopAuthorsList
                    authors={useAuthors().topAuthors() || []}
                    maxItems={5}
                    showViewAll={true}
                  />
                  <KnowledgeBase />
                  {/* <Show when={!session()?.token}>
                    <JoinCommunity
                      title={''}
                      description={t(
                        'Connect and discuss which articles will come out in the journal, edit, perform as an expert or become an author'
                      )}
                    />
                  </Show>
                  <NewsletterSubscription
                    title={''}
                    description={t(
                      'Subscribe to the newsletter of the best publications to receive a digest of the main materials'
                    )}
                  />
                  <Show when={session()?.token}>
                    <FeedCustomization
                      title={''}
                      description={t(
                        'Subscribe to your favorite topics, authors and communities — instantly learn about new publications and discussions'
                      )}
                      variant="illustration"
                    />
                  </Show>
                  */}
                  <SuggestBox title={t('Have an idea?')} />
                </div>
              </Suspense>
            </Show>
          </aside>
        </div>

        <Show when={shareData()}>
          <ShareModal
            title={shareData()?.title || ''}
            description={shareData()?.seo || ''}
            imageUrl={shareData()?.cover || ''}
            shareUrl={getShareUrl({ pathname: `/${shareData()?.slug || ''}` })}
          />
        </Show>

        <Modal variant="medium" name="inviteCoauthors">
          <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
        </Modal>
      </Show>
    </Suspense>
  )
}
