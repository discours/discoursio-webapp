import { A, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, Suspense } from 'solid-js'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { ShareModal } from '~/components/_shared/ShareModal'
import { CommentsList, KnowledgeBase, SuggestBox, TopAuthorsList } from '~/components/Feed/AsideComponents'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useAuthors } from '~/context/authors'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { ModalType, useUI } from '~/context/ui'
import { useShoutsMyRates } from '~/graphql/api/private'
import { loadReactions, loadUnratedShouts } from '~/graphql/api/public'
import { Author, Reaction, ReactionKind, ReactionSort, Shout } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache'
import styles from '~/styles/views/Feed.module.scss'
import { Modal } from '../_shared/Modal'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { ArticleCardSkeleton } from '../Feed/ArticleCardSkeleton'
import { FeedFiltersControl } from '../Feed/FeedFiltersControl'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'

export interface FeedProps {
  // Основные ленты для всех режимов
  recentShouts: Shout[]
  hotShouts: Shout[]
  topShouts: Shout[]
  // Дополнительные данные
  unratedShouts: Shout[]
  recentComments: Reaction[]
}

export const FeedView = (props: FeedProps) => {
  const { t } = useLocalize()
  const loc = useLocation()
  const { showModal } = useUI()
  const { session, client } = useSession()
  const { isFeedLoading, feedByMode, myFeed, mode, initializeFeed, loadRecentFeed, loadHotFeed, loadTopFeed, options } =
    useFeed()

  // Добавляем состояние для мобильного меню
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = createSignal(false)

  // Состояние для асинхронно загружаемых данных
  const [clientRecentComments, setClientRecentComments] = createSignal<Reaction[]>([])
  const [clientUnratedShouts, setClientUnratedShouts] = createSignal<Shout[]>([])

  // Локальное состояние загрузки только для списка статей
  const [isArticlesLoading, setIsArticlesLoading] = createSignal(false)

  // Добавим медиа-запрос для определения мобильного устройства
  const [isMobile, setIsMobile] = createSignal(false)

  // Обновляем состояние при изменении размера окна
  createEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 992) // 992px - стандартная точка для md-lg breakpoint
    }

    // Проверяем сразу при монтировании
    checkMobile()

    // Добавляем слушатель изменения размера
    window.addEventListener('resize', checkMobile)

    // Очищаем слушатель при размонтировании
    onCleanup(() => {
      window.removeEventListener('resize', checkMobile)
    })
  })

  const shouldShowPlaceholder = () => {
    const feedType = myFeed()
    const currentFeed = feedByMode()
    const isAuthorized = !!session()?.token
    const isEmpty = !currentFeed?.shouts?.length
    return (
      ['followed', 'coauthored', 'discussed', 'comments'].includes(feedType as string) && (isEmpty || !isAuthorized)
    )
  }

  const placeholderType = () => {
    const feedType = myFeed()
    if (!session()?.token) return 'author'
    return feedType || 'feed'
  }

  // Инициализация контекста с SSR данными для всех режимов - заменяем на правильный createEffect
  createEffect(() => {
    // Инициализируем контекст данными из SSR для всех режимов только если данные есть
    if (props.recentShouts?.length) {
      // console.log('[FeedView] Initializing recent feed with', props.recentShouts.length, 'items')
      initializeFeed('recent', props.recentShouts)
    }
    if (props.hotShouts?.length) {
      // console.log('[FeedView] Initializing hot feed with', props.hotShouts.length, 'items')
      initializeFeed('hot', props.hotShouts)
    }
    if (props.topShouts?.length) {
      // console.log('[FeedView] Initializing top feed with', props.topShouts.length, 'items')
      initializeFeed('top', props.topShouts)
    }
  })

  // ✅ Правильное использование createMemo для сложной логики выбора данных
  const sortedFeed = createMemo(() => {
    const currentFeed = feedByMode()
    const currentMode = mode()

    if (!currentFeed.isLoading) {
      console.log('[FeedView] Using context feed data (loaded):', currentFeed.shouts?.length || 0, 'items', {
        isEmpty: currentFeed.isEmpty,
        hasShouts: !!currentFeed.shouts?.length
      })
      return currentFeed.shouts || []
    }

    // Если контекст загружается, но есть SSR данные, используем SSR как fallback
    // Fallback на SSR данные в зависимости от режима
    let ssrFallback: Shout[] = []
    switch (currentMode) {
      case 'hot':
        ssrFallback = props.hotShouts || []
        break
      case 'top':
        ssrFallback = props.topShouts || []
        break
      default:
        ssrFallback = props.recentShouts || []
        break
    }

    console.log('[FeedView] Using SSR fallback for mode', currentMode, ':', ssrFallback.length, 'items', {
      contextLoading: currentFeed.isLoading,
      contextEmpty: currentFeed.isEmpty,
      hasSSRData: ssrFallback.length > 0
    })

    return ssrFallback
  })

  // Правильный SolidJS паттерн - onMount для инициализации дополнительных данных
  onMount(() => {
    if (!props.recentComments?.length && !clientRecentComments()?.length) {
      void loadRecentCommentsAsync()
    }
    if (!props.unratedShouts?.length && !clientUnratedShouts()?.length) {
      void loadUnratedShoutsAsync()
    }
  })

  const loadRecentCommentsAsync = async () => {
    try {
      console.log('[FeedView] Loading recent comments on client...')
      const commentsLoader = loadReactions({
        by: {
          kinds: [ReactionKind.Comment],
          sort: ReactionSort.Newest
        },
        limit: 3
      })
      const comments = await commentsLoader()
      if (comments?.length) {
        setClientRecentComments(comments)
      }
    } catch (error) {
      console.error('[FeedView] Error loading recent comments:', error)
    }
  }

  const loadUnratedShoutsAsync = async () => {
    try {
      console.log('[FeedView] Loading unrated shouts on client...')
      const unratedLoader = loadUnratedShouts({ limit: 5, offset: 0 })
      const unrated = await unratedLoader()
      if (unrated?.length) {
        setClientUnratedShouts(unrated)
      }
    } catch (error) {
      console.error('[FeedView] Error loading unrated shouts:', error)
    }
  }

  // Правильная проверка необходимости загрузки данных
  createEffect(() => {
    const currentMode = mode()
    const currentFeed = feedByMode()

    // Если на клиенте нет данных и нет SSR fallback данных, загружаем принудительно
    const hasContextData = currentFeed.shouts?.length > 0
    const hasSSRData =
      (currentMode === 'recent' && props.recentShouts?.length) ||
      (currentMode === 'hot' && props.hotShouts?.length) ||
      (currentMode === 'top' && props.topShouts?.length)

    if (!hasContextData && !hasSSRData && !currentFeed.isLoading) {
      console.log('[FeedView] No data available for mode', currentMode, 'triggering client load')
      void loadFeedByModeAsync(currentMode)
    }
  })

  const loadFeedByModeAsync = async (currentMode: string) => {
    // Устанавливаем локальное состояние загрузки
    setIsArticlesLoading(true)

    try {
      // Принудительно загружаем данные из контекста
      switch (currentMode) {
        case 'recent':
          await loadRecentFeed()
          break
        case 'hot':
          await loadHotFeed()
          break
        case 'top':
          await loadTopFeed()
          break
      }
    } catch (error) {
      console.error('[FeedView] Error loading feed data:', error)
    } finally {
      setIsArticlesLoading(false)
    }
  }

  // Используем новый хук для загрузки рейтингов
  const [myRatesData] = useShoutsMyRates(
    sortedFeed().map((s) => s.id),
    client()
  )

  const myRates = createMemo(() => {
    const rates = myRatesData()
    if (!Array.isArray(rates)) return {}

    return rates.reduce(
      (acc, row) => {
        if (row?.my_rate && row?.shout_id) {
          acc[row.shout_id] = row.my_rate
        }
        return acc
      },
      {} as Record<string, ReactionKind>
    )
  })

  const [shareData, setShareData] = createSignal<Shout>()

  const isLoading = () => {
    const feed = sortedFeed()
    const loading = isFeedLoading() && (!feed || feed.length === 0)

    console.log('[FeedView] Loading state:', {
      isFeedLoading: isFeedLoading(),
      sortedFeedLength: feed?.length || 0,
      isLoading: loading
    })

    return loading
  }

  // Компонент для комментариев с fallback на client data
  const FreshestCommentsList = () => {
    const comments = () => (props.recentComments?.length ? props.recentComments : clientRecentComments() || [])

    return (
      <Show when={comments()?.length > 0}>
        <CommentsList
          comments={comments()}
          title={t('Recent comments')}
          maxItems={5}
          showArticleTitle={true}
          collapsible={false}
        />
      </Show>
    )
  }

  createEffect(() => {
    const feed = sortedFeed()
    const currentMode = mode()
    const contextFeed = feedByMode()

    console.log('[FeedView] Feed state updated:', {
      currentMode,
      feedLength: feed?.length,
      isLoading: isLoading(),
      isFeedLoading: isFeedLoading(),
      isArticlesLoading: isArticlesLoading(),
      pathname: loc.pathname,
      showPlaceholder: shouldShowPlaceholder(),
      contextFeedLength: contextFeed?.shouts?.length,
      contextIsEmpty: contextFeed?.isEmpty,
      contextLoading: contextFeed?.isLoading
    })
  })

  // Отслеживаем смену режима для показа локального лоадинга
  createEffect(
    on(mode, (newMode, prevMode) => {
      if (newMode !== prevMode && prevMode !== undefined) {
        console.log('[FeedView] Mode changed from', prevMode, 'to', newMode, '- showing articles loading')
        setIsArticlesLoading(true)

        // Сбрасываем состояние через небольшую задержку для плавности
        setTimeout(() => {
          const currentFeed = feedByMode()
          if (currentFeed?.shouts?.length > 0 || !isFeedLoading()) {
            setIsArticlesLoading(false)
          }
        }, 300)
      }
    })
  )

  // Состояние для хранения данных для шаринга
  const handleShare = (shared: Shout | undefined) => {
    showModal('share')
    setShareData(shared)
  }

  // ✅ Функция дозагрузки для текущего режима ленты
  const loadMoreFeed = async (offset: number): Promise<LoadMoreItems> => {
    try {
      const currentMode = mode()
      console.log('[FeedView] Loading more for mode:', currentMode, 'offset:', offset)

      // Вызываем соответствующую функцию загрузки в зависимости от режима
      switch (currentMode) {
        case 'recent':
          await loadRecentFeed({ ...options(), offset })
          break
        case 'hot':
          await loadHotFeed({ ...options(), offset })
          break
        case 'top':
          await loadTopFeed({ ...options(), offset })
          break
        default:
          await loadRecentFeed({ ...options(), offset })
      }

      // Возвращаем текущие элементы ленты для LoadMoreWrapper
      return (feedByMode().shouts || []) as LoadMoreItems
    } catch (error) {
      console.error('[FeedView] Error loading more feed:', error)
      return [] as LoadMoreItems
    }
  }

  // Компонент для рендеринга статей
  const ArticlesList = () => {
    const { topAuthors } = useAuthors()

    // Создаем мемоизированный массив с правильной структурой для рендеринга
    const feedItems = createMemo(() => {
      const feed = sortedFeed()
      if (!feed.length) return []

      // Создаем новый массив с четкой типизацией
      const result: Array<{ type: 'article'; article: Shout; index: number } | { type: 'authors'; authors: Author[] }> =
        []

      // Добавляем статьи и блок авторов в нужной позиции
      feed.forEach((article, i) => {
        // Вставляем блок авторов перед 6-й статьей (индекс 5)
        if (i === 5) {
          result.push({ type: 'authors', authors: topAuthors() || [] })
        }
        result.push({ type: 'article', article, index: i })
      })

      return result
    })

    return (
      <>
        <For each={feedItems()}>
          {(item) => (
            <>
              {item.type === 'authors' ? (
                <div class={clsx({ [styles.hiddenOnDesktop]: !isMobile() })}>
                  <TopAuthorsList authors={item.authors} />
                </div>
              ) : (
                <ArticleCard
                  article={item.article}
                  settings={{ isFeedMode: true }}
                  desktopCoverSize="M"
                  onShare={handleShare}
                  onInvite={() => showModal('inviteCoauthors' as ModalType)}
                  myRate={myRates()[item.article.id]}
                />
              )}
            </>
          )}
        </For>
      </>
    )
  }

  // Компонент для неоценённых статей с fallback на client data
  const UnratedArticlesList = () => {
    const unratedShouts = () => (props.unratedShouts?.length ? props.unratedShouts : clientUnratedShouts() || [])

    return (
      <Show when={unratedShouts()?.length > 0}>
        <AsideSection title={t('Be the first to rate')} icon="star" class={styles.unratedSection}>
          <div class={styles.unratedList}>
            <For each={unratedShouts()}>
              {(article) => (
                <div
                  class={clsx(styles.comment, styles.unratedArticle)}
                  style={{
                    'background-image': `url(${getCdnUrl(article?.cover || '')})`
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

  // Удаляем Suspense и Show из корня, layout всегда видим
  return (
    <div class={styles.feedLayout}>
      {/* Мобильная кнопка меню */}
      <button
        class={styles.mobileMenuToggle}
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen())}
        aria-label={t('Toggle menu')}
      >
        <span class={styles.hamburger}>
          <span />
          <span />
          <span />
        </span>
      </button>

      {/* Sidebar всегда видим */}
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

      <div
        class={clsx(styles.mobileOverlay, {
          [styles.visible]: isMobileSidebarOpen(),
          [styles.animated]: true
        })}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      <div class={clsx(styles.feedMain)}>
        <div class="wide-container">
          <div class={clsx(styles.groupControls, 'row')}>
            <div class={styles.filtersRow}>
              <FeedSwitcher options={['recent', 'top', 'hot']} prefix={'/feed'} />
              <FeedFiltersControl />
            </div>
          </div>
        </div>
        <div class={styles.feedContent}>
          <Show when={!shouldShowPlaceholder()} fallback={<Placeholder type={placeholderType()} mode="feed" />}>
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
                  <Show
                    when={(!isFeedLoading() && !isArticlesLoading()) || sortedFeed()?.length > 0}
                    fallback={
                      <div class={styles.articlesLoading}>
                        {[...Array(6)].map(() => (
                          <ArticleCardSkeleton size="medium" />
                        ))}
                      </div>
                    }
                  >
                    <LoadMoreWrapper
                      loadFunction={loadMoreFeed}
                      pageSize={FEED_PAGE_SIZE}
                      hidden={feedByMode().isEmpty || !feedByMode().hasMore}
                    >
                      <ArticlesList />
                    </LoadMoreWrapper>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      <aside class={clsx(styles.feedAside)}>
        <Suspense
          fallback={
            <div class={styles.asideLoading}>
              <Loading />
            </div>
          }
        >
          <div class={styles.asideContent}>
            <FreshestCommentsList />
            <UnratedArticlesList />
            <div class={clsx({ [styles.hiddenOnMobile]: isMobile() })}>
              <TopAuthorsList authors={useAuthors().topAuthors() || []} maxItems={5} showViewAll={true} />
            </div>
            <KnowledgeBase />
            <SuggestBox title={t('Have an idea?')} />
          </div>
        </Suspense>
      </aside>

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
    </div>
  )
}
