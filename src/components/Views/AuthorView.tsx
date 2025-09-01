import { A, useLocation, useParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, Match, on, onMount, Show, Switch } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { CommentsList } from '~/components/Comments/CommentsList'
import { COMMENTS_PER_PAGE } from '~/constants/pagination'
import { useAuthors } from '~/context/authors'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { loadReactions, loadShouts } from '~/graphql/api/public'
import type { Author, Reaction, Shout, Topic } from '~/graphql/generated/graphql'
import { ReactionKind, ReactionSort } from '~/graphql/generated/graphql'
import getAuthorFollowersQuery from '~/graphql/query/core/author-followers'
import getAuthorFollowsQuery from '~/graphql/query/core/author-follows'
import styles from '~/styles/views/Author.module.scss'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { AuthorCard } from '../Author/AuthorCard'
import { AuthorShoutsRating } from '../Author/AuthorShoutsRating'
import { FeedFiltersControl } from '../Feed/FeedFiltersControl'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Placeholder } from '../Feed/Placeholder'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'

type AuthorViewProps = {
  authorSlug: string
  shouts: Shout[]
  comments: Reaction[]
  author?: Author
}

export const PRERENDERED_ARTICLES_COUNT = 12

export const AuthorView = (props: AuthorViewProps) => {
  // contexts
  const { t } = useLocalize()
  const loc = useLocation()
  const params = useParams()
  const { mode: feedMode, filterState, options } = useFeed()
  const [currentTab, setCurrentTab] = createSignal<string | undefined>()

  const { session, client } = useSession()
  const { loadAuthor, authorsEntities } = useAuthors()

  // signals
  const [isBioExpanded, setIsBioExpanded] = createSignal(false)
  const [author, setAuthor] = createSignal<Author>()
  const [followers, setFollowers] = createSignal<Author[]>([] as Author[])
  const [followingArray, setFollowingArray] = createSignal<Array<Author | Topic>>([] as Array<Author | Topic>) // flat AuthorFollowsResult
  const [showExpandBioControl, setShowExpandBioControl] = createSignal(false)
  const [commented, setCommented] = createSignal<Reaction[]>(props.comments || [])

  const [commentsAmount, setCommentsAmount] = createSignal(0)
  createEffect(
    on(
      () => author()?.stat?.comments ?? 0,
      (amount) => setCommentsAmount(amount)
    )
  )
  const [shoutsAmount, setShoutsAmount] = createSignal(0)
  createEffect(
    on(
      () => author()?.stat?.shouts ?? 0,
      (amount) => setShoutsAmount(amount)
    )
  )

  const [followersLoaded, setFollowersLoaded] = createSignal(false)
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)
  const [loadMoreCommentsHidden, setLoadMoreCommentsHidden] = createSignal(false)

  // Немедленно инициализируем sortedFeed с пропсами
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || [])

  // Инициализируем loadMoreHidden сразу на основе начальных данных
  // Важно: onMount гарантирует, что публикации отображаются сразу при загрузке страницы
  onMount(() => {
    const initialShouts = props.shouts || []
    console.log('[AuthorView] onMount - initial shouts:', initialShouts.length)
    if (initialShouts.length > 0) {
      setSortedFeed(initialShouts)
      console.log('[AuthorView] Set initial feed:', initialShouts.length, 'items')

      // Инициализируем флаг loadMoreHidden на основе статистики автора
      if (props.author?.stat?.shouts) {
        const allShoutsLoaded = initialShouts.length >= props.author.stat.shouts
        setLoadMoreHidden(allShoutsLoaded)
        console.log(
          '[AuthorView] Initial loadMoreHidden set to:',
          allShoutsLoaded,
          'based on stats:',
          props.author.stat.shouts
        )
      } else {
        setLoadMoreHidden(initialShouts.length < FEED_PAGE_SIZE)
      }
    }

    // Инициализируем автора из пропсов если доступен
    if (props.author) {
      console.log('[AuthorView] Setting initial author from props:', props.author.slug, props.author.stat)
      setAuthor(props.author)
    }

    // 🔧 ИСПРАВЛЕНИЕ: Всегда инициализируем комментарии из пропсов и добавляем в стор реакций
    if (props.comments) {
      console.log('[AuthorView] Setting initial comments from props:', props.comments.length)
      setCommented(props.comments)
      // 🔧 КРИТИЧНО: Добавляем SSR комментарии в стор реакций
      addShoutReactions(props.comments)
      // Устанавливаем состояние загрузки дополнительных комментариев
      if (props.author?.stat?.comments) {
        setLoadMoreCommentsHidden(props.comments.length >= props.author.stat.comments)
      }
    } else if (props.author) {
      // Если комментариев нет в пропсах, но есть автор - загружаем комментарии
      console.log('[AuthorView] No comments in props, loading from API for author:', props.author.slug)
      loadReactions({
        by: {
          kinds: [ReactionKind.Comment],
          created_by: props.author.id
        },
        limit: COMMENTS_PER_PAGE,
        offset: 0
      })()
        .then((result: Reaction[]) => {
          console.log('[AuthorView] Loaded comments from API:', result?.length || 0)
          if (result) {
            setCommented(result)
            // 🔧 КРИТИЧНО: Добавляем загруженные комментарии в стор реакций
            addShoutReactions(result)
            if (props.author?.stat?.comments) {
              setLoadMoreCommentsHidden(result.length >= props.author.stat.comments)
            }
          }
        })
        .catch((error: unknown) => {
          console.error('[AuthorView] Error loading comments:', error)
        })
    }
  })

  // derivatives
  const { commentsByAuthor, addShoutReactions } = useReactions()
  const { feedByAuthor } = useFeed()

  // Проверка, является ли профиль собственным
  const isOwnProfile = createMemo(() => {
    const currentUser = session()?.author
    const profileAuthor = author()
    return currentUser && profileAuthor && currentUser.slug === profileAuthor.slug
  })

  const shouldShowFiltersAndLoadMore = () => {
    // Показываем фильтры и кнопку только если:
    // 1. Мы на вкладке публикаций (не comments/about)
    // 2. Есть публикации для отображения
    // 3. Не все публикации уже загружены
    if (currentTab()) return false
    if (author()?.stat?.shouts === 0) return false

    // Проверяем, загружены ли все публикации автора
    const allShoutsLoaded = sortedFeed().length >= Number(author()?.stat?.shouts ?? 0)
    return !allShoutsLoaded
  }

  const shouldShowLoadMore = () => {
    if (currentTab()) return false
    if (!Number.isInteger(author()?.stat?.shouts) || author()?.stat?.shouts === 0) return false

    // Показываем кнопку только если не все публикации загружены
    const allShoutsLoaded = sortedFeed().length >= Number(author()?.stat?.shouts ?? 0)
    return !allShoutsLoaded && !loadMoreHidden()
  }

  // Эффект для обновления комментариев при изменении автора или commentsByAuthor
  createEffect(
    on([author, commentsByAuthor], ([a, ccc]) => {
      if (a?.id && ccc?.[a.id]) {
        setCommented(ccc[a.id])
        setLoadMoreCommentsHidden(ccc[a.id].length >= Number(author()?.stat?.comments ?? 0))
      }
    })
  )

  // Эффект для обновления статей при изменении feedByAuthor
  createEffect(
    on(
      () => feedByAuthor()[props.authorSlug],
      (authorFeed) => {
        // Обновляем только если данные из feedByAuthor отличаются от текущих
        // и если у нас еще нет начальных данных или они пустые
        if (authorFeed?.length && (!sortedFeed().length || authorFeed.length > sortedFeed().length)) {
          setSortedFeed(authorFeed)
          const amount = author()?.stat?.shouts ?? 0
          if (amount > 0) {
            // Скрываем кнопку "Показать еще" если загружены все публикации автора
            setLoadMoreHidden(authorFeed.length >= amount)
          } else {
            setLoadMoreHidden(authorFeed.length < FEED_PAGE_SIZE)
          }
        }
      },
      { defer: true }
    )
  )

  // Эффект для загрузки данных автора
  createEffect(
    on([() => session()?.author, () => props.authorSlug], async ([meData, slug]) => {
      console.log('[AuthorView] Author loading effect triggered:', {
        sessionAuthor: meData?.slug,
        targetSlug: slug,
        currentAuthor: author()?.slug
      })

      // 🔧 ИСПРАВЛЕНИЕ: Приоритет для данных из route.load с полной статистикой
      if (props.author && typeof props.author.stat?.comments === 'number') {
        console.log('[AuthorView] Using author data from route.load with full stats:', props.author.stat)
        setAuthor(props.author)
        return
      }

      // Всегда загружаем автора через API для получения актуальной статистики
      if (slug && (!author() || author()?.slug !== slug)) {
        console.log('[AuthorView] Loading author from API:', slug)
        await loadAuthor({ slug })
        const foundAuthor = authorsEntities()[slug]

        if (foundAuthor) {
          console.log('[AuthorView] Author loaded successfully:', foundAuthor.slug, foundAuthor.stat)
          setAuthor(foundAuthor)
        } else {
          console.warn('[AuthorView] Author not found:', slug)
          // Fallback для собственного профиля если API не вернул данные
          if (meData?.slug === slug) {
            console.log('[AuthorView] Using session author as fallback')
            setAuthor(meData)
          }
        }
      }
    })
  )

  // Отдельный эффект для загрузки фолловеров и подписок
  createEffect(
    on([author, () => props.authorSlug], async ([currentAuthor, slug]) => {
      // Загружаем followers/followings только если автор установлен и еще не загружали для этого автора
      if (slug && currentAuthor && !followersLoaded()) {
        try {
          console.log('[AuthorView] Loading followers/followings for:', slug)

          // Проверяем доступность клиента с небольшой задержкой
          let currentClient = client()
          if (!currentClient) {
            console.log('[AuthorView] GraphQL client not ready, waiting...')
            // Ждем немного для инициализации клиента
            await new Promise((resolve) => setTimeout(resolve, 100))
            currentClient = client()
          }

          if (!currentClient) {
            console.warn('[AuthorView] GraphQL client still not ready, skipping followers load')
            return
          }

          const followsResp = await currentClient.query(getAuthorFollowsQuery, { slug }).toPromise()
          const follows = followsResp?.data?.get_author_follows || {}
          setFollowingArray([...(follows?.authors || []), ...(follows?.topics || [])])
          setFollowersLoaded(true)

          const followersResp = await currentClient.query(getAuthorFollowersQuery, { slug }).toPromise()
          const allFollowers = followersResp?.data?.get_author_followers || []

          // Исключаем текущего пользователя из списка подписчиков
          const currentUserId = session()?.author?.id
          const filteredFollowers = currentUserId
            ? allFollowers.filter((follower: Author) => follower.id !== currentUserId)
            : allFollowers

          setFollowers(filteredFollowers)

          // Обновляем статистику автора с правильным количеством подписчиков
          setAuthor((prev) =>
            prev
              ? {
                  ...prev,
                  stat: {
                    ...prev.stat,
                    followers: filteredFollowers.length
                  }
                }
              : prev
          )

          setFollowersLoaded(true)
          console.log('[AuthorView] Loaded followers:', allFollowers.length, 'filtered:', filteredFollowers.length)
        } catch (error) {
          console.error('[AuthorView] Error loading followers/followings:', error)
          // Устанавливаем флаги в true даже при ошибке, чтобы не блокировать отображение
          setFollowersLoaded(true)
        }
      }
    })
  )

  // Обработка биографии
  let bioContainerRef: HTMLDivElement
  let bioWrapperRef: HTMLDivElement
  const checkBioHeight = () => {
    if (bioWrapperRef && bioContainerRef) {
      const showExpand = bioContainerRef.offsetHeight > bioWrapperRef.offsetHeight
      setShowExpandBioControl(showExpand)
    }
  }

  createEffect(() => {
    checkBioHeight()
  })

  // Обновляем эффект для корректной обработки URL и состояния
  createEffect(
    on(
      () => [loc.pathname, params.tab, feedMode()],
      ([pathname]) => {
        if (pathname.includes('/comments')) {
          setCurrentTab('comments')
          // 🔧 ИСПРАВЛЕНИЕ: Комментарии теперь загружаются заранее в onMount, только устанавливаем вкладку
        } else if (pathname.includes('/about')) {
          setCurrentTab('about')
        } else {
          setCurrentTab(undefined)
        }
      },
      { defer: false }
    )
  )

  const TabNavigator = () => (
    <div class={styles.tabNavigator}>
      <ul class="view-switcher">
        <li classList={{ 'view-switcher__item--selected': !currentTab() }}>
          <A href={`/@${props.authorSlug}`}>{t('Publications')}</A>
          <Show when={author() && shoutsAmount() > 0}>
            <span class="view-switcher__counter">{shoutsAmount()}</span>
          </Show>
        </li>
        <li classList={{ 'view-switcher__item--selected': currentTab() === 'comments' }}>
          <A href={`/@${props.authorSlug}/comments`}>{t('Comments')}</A>
          <Show when={author() && commentsAmount() > 0}>
            <span class="view-switcher__counter">{commentsAmount()}</span>
          </Show>
        </li>
        <li classList={{ 'view-switcher__item--selected': currentTab() === 'about' }}>
          <A onClick={() => checkBioHeight()} href={`/@${props.authorSlug}/about`}>
            {t('About')}
          </A>
        </li>
      </ul>
    </div>
  )

  // Функция загрузки публикаций автора с учетом фильтров (для LoadMoreWrapper)
  const loadAuthorShouts = async (offset = 0) => {
    if (!author()) return []

    try {
      console.log('[AuthorView] Loading author shouts with filters:', {
        author: author()?.slug,
        filters: filterState().filters,
        options: options(),
        offset
      })

      // Объединяем фильтр автора с другими фильтрами и опциями
      const currentFilters = filterState().filters
      const currentOptions = options()
      const mergedFilters = {
        ...currentFilters,
        author: author()!.slug
      }

      const authorShoutsFetcher = loadShouts({
        options: {
          ...currentOptions,
          filters: mergedFilters,
          limit: FEED_PAGE_SIZE,
          offset
        }
      })
      const result = await authorShoutsFetcher()

      if (result?.length) {
        return result
      }
      return []
    } catch (error) {
      console.error('[AuthorView] Error loading author shouts:', error)
      return []
    }
  }

  // Эффект для перезагрузки публикаций автора при изменении фильтров
  createEffect(
    on(
      () => filterState().timestamp,
      (timestamp, prevTimestamp) => {
        // Перезагружаем только если фильтры действительно изменились и автор загружен
        if (timestamp !== prevTimestamp && prevTimestamp !== undefined && author() && !currentTab()) {
          console.log('[AuthorView] Filters changed, reloading author feed:', author()?.slug)

          // Сбрасываем текущие данные и загружаем заново
          setSortedFeed([])
          setLoadMoreHidden(false)

          void loadAuthorShouts(0).then((result) => {
            if (result.length) {
              setSortedFeed(result)
              // Скрываем кнопку "Показать еще" если загружены все публикации автора
              if (shoutsAmount() > 0) {
                setLoadMoreHidden(result.length >= shoutsAmount())
              } else {
                setLoadMoreHidden(result.length < FEED_PAGE_SIZE)
              }
            } else {
              setLoadMoreHidden(true)
            }
          })
        }
      },
      { defer: true }
    )
  )

  // Дополнительный эффект для перезагрузки при изменении сортировки (order_by)
  createEffect(
    on(
      () => options().order_by,
      (orderBy, prevOrderBy) => {
        // Перезагружаем только если сортировка действительно изменилась и автор загружен
        if (orderBy !== prevOrderBy && prevOrderBy !== undefined && author() && !currentTab()) {
          console.log('[AuthorView] Sorting changed, reloading author feed:', {
            author: author()?.slug,
            orderBy,
            prevOrderBy
          })

          // Сбрасываем текущие данные и загружаем заново
          setSortedFeed([])
          setLoadMoreHidden(false)

          void loadAuthorShouts(0).then((result) => {
            if (result.length) {
              setSortedFeed(result)
              // Скрываем кнопку "Показать еще" если загружены все публикации автора
              if (shoutsAmount() > 0) {
                setLoadMoreHidden(result.length >= shoutsAmount())
              } else {
                setLoadMoreHidden(result.length < FEED_PAGE_SIZE)
              }
            } else {
              setLoadMoreHidden(true)
            }
          })
        }
      },
      { defer: true }
    )
  )

  // Обновленная функция loadMore с поддержкой фильтров (БЕЗ LoadMoreWrapper)
  const loadMoreAuthorShouts = async () => {
    if (!author()) return

    saveScrollPosition()
    const offset = sortedFeed().length

    try {
      const result = await loadAuthorShouts(offset)

      if (result?.length) {
        // Добавляем только уникальные статьи
        const currentSlugs = new Set(sortedFeed().map((s) => s.slug))
        const newShouts = result.filter((shout: Shout) => !currentSlugs.has(shout.slug))

        if (newShouts.length) {
          setSortedFeed((prev) => [...prev, ...newShouts])
          // Скрываем кнопку "Показать еще" если загружены все публикации автора
          if (shoutsAmount() > 0) {
            setLoadMoreHidden(sortedFeed().length + newShouts.length >= shoutsAmount())
          } else {
            setLoadMoreHidden(newShouts.length < FEED_PAGE_SIZE)
          }
        } else {
          setLoadMoreHidden(true)
        }
      } else {
        setLoadMoreHidden(true)
      }

      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.error('[AuthorView] Error loading more shouts:', error)
    }
  }

  // Effect: Reset sortedFeed When Author Slug Changes
  createEffect(
    on(
      () => [props.authorSlug, props.shouts] as const,
      ([newSlug, newShouts], prevValues) => {
        const prevSlug = prevValues?.[0]
        if (newSlug !== prevSlug) {
          // Сбрасываем и сразу устанавливаем начальные данные для нового автора
          const initialShouts = newShouts || []
          setSortedFeed(initialShouts)
          // Скрываем кнопку "Показать еще" если загружены все публикации автора
          if (shoutsAmount() > 0) {
            setLoadMoreHidden(initialShouts.length >= shoutsAmount())
          } else {
            setLoadMoreHidden(initialShouts.length < FEED_PAGE_SIZE)
          }

          // Сбрасываем флаги загрузки фолловеров для нового автора
          setFollowersLoaded(false)
          setFollowers([])
          setFollowingArray([])
        }
      },
      { defer: true }
    )
  )

  // Функция загрузки дополнительных комментариев
  const loadMoreComments = async () => {
    if (!author()) return [] as LoadMoreItems

    saveScrollPosition()
    try {
      console.log('[AuthorView] Loading more comments for author:', author()?.slug, 'offset:', commented().length)
      const result = await loadReactions({
        by: {
          kinds: [ReactionKind.Comment],
          created_by: author()?.id
        },
        limit: COMMENTS_PER_PAGE,
        offset: commented().length
      })()

      if (result?.length) {
        console.log('[AuthorView] Loaded more reactions:', result.length)
        // Диагностика: проверяем типы загруженных реакций
        const reactionTypes = result.map((r) => ({ id: r.id, kind: r.kind, body: r.body?.slice(0, 50) }))
        console.log('[AuthorView] More reaction types loaded:', reactionTypes)

        // Проверяем, есть ли реакции не типа Comment
        const nonComments = result.filter((r) => r.kind !== ReactionKind.Comment)
        if (nonComments.length > 0) {
          console.warn(
            '[AuthorView] Found non-comment reactions in loadMore:',
            nonComments.map((r) => ({ id: r.id, kind: r.kind }))
          )
        }

        addShoutReactions(result)
        setCommented((prev) => [...prev, ...result])
        setLoadMoreCommentsHidden(commented().length >= commentsAmount())
      }

      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.error('[AuthorView] Error loading more comments:', error)
      return []
    }
  }

  const [commentsOrder, setCommentsOrder] = createSignal<ReactionSort>(ReactionSort.Newest)

  // Обновляем обработчик удаления комментария с учетом статистики
  const handleDeleteComment = (id: number) => {
    setCommented((prev) => {
      const filtered = prev.filter((c) => c.id !== id)
      if (author()) {
        const updatedAuthor = {
          ...author()!,
          stat: {
            ...author()!.stat!,
            comments: Math.max(0, (commentsAmount() || 1) - 1)
          }
        }
        setAuthor(updatedAuthor)
      }
      return filtered
    })
  }

  return (
    <div class={styles.authorPage}>
      <div class="wide-container">
        <Show when={author()} fallback={<Loading />}>
          <>
            <div class={styles.authorHeader}>
              <AuthorCard
                author={author() as Author}
                followers={followers() || []}
                flatFollows={followingArray() || []}
                showMessageButton={true}
              />
            </div>
            <div class={clsx(styles.groupControls, 'row')}>
              <div class="col-md-24">
                <div class={styles.controlsRow}>
                  <TabNavigator />

                  {/* Центральный блок с фильтрами - показываем только на вкладке публикаций и когда есть что фильтровать */}
                  <Show when={shouldShowFiltersAndLoadMore()}>
                    <div class={styles.filtersInline}>
                      <FeedSwitcher
                        options={['recent', 'top', 'hot']}
                        prefix={`/@${props.authorSlug}`}
                        class={styles.feedSwitcher}
                      />
                      <FeedFiltersControl />
                    </div>
                  </Show>

                  {/* Пустой div для симметрии когда нет фильтров */}
                  <Show when={currentTab()}>
                    <div class={styles.filtersInline} />
                  </Show>

                  {/* Рейтинг справа */}
                  <Show when={typeof author()?.stat?.rating === 'number'}>
                    <div class={styles.ratingContainer}>
                      {t('All posts rating')}
                      <AuthorShoutsRating author={author() as Author} class={styles.ratingControl} />
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </>
        </Show>
      </div>

      <Switch>
        <Match when={currentTab() === 'about'}>
          <div class="wide-container">
            <div class="row">
              <div class="col-md-20 col-lg-18">
                <Show when={author()?.about} fallback={<div>{t('No information provided')}</div>}>
                  <div
                    ref={(el) => (bioWrapperRef = el)}
                    class={clsx(styles.longBio, { [styles.longBioExpanded]: isBioExpanded() })}
                  >
                    <div ref={(el) => (bioContainerRef = el)} innerHTML={author()?.about || ''} />
                  </div>

                  <Show when={showExpandBioControl()}>
                    <button
                      class={clsx('button button--subscribe-topic', styles.longBioExpandedControl)}
                      onClick={() => setIsBioExpanded(!isBioExpanded())}
                    >
                      {isBioExpanded() ? t('Show less') : t('Show more')}
                    </button>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </Match>

        <Match when={currentTab() === 'comments'}>
          {/* 🔧 ИСПРАВЛЕНИЕ: Показываем комментарии если есть фактические комментарии ИЛИ статистика показывает больше 0 */}
          <Show when={commented().length > 0 || commentsAmount() > 0}>
            <div class="wide-container">
              <div class="row">
                <div class="col-md-20 col-lg-18">
                  <Show
                    when={commented().length > 0}
                    fallback={
                      <div style="text-align: center; padding: 4rem 2rem;">
                        <div>
                          <h3 style="margin-bottom: 1rem; color: #666;">{t('Loading comments...')}</h3>
                          <Loading />
                        </div>
                      </div>
                    }
                  >
                    <CommentsList
                      comments={commented()}
                      showArticleLink={true}
                      withFilter={true}
                      sortOrder={commentsOrder()}
                      onFiltersChange={(filters) => setCommentsOrder(filters.sort || ReactionSort.Newest)}
                      onDeleteComment={handleDeleteComment}
                      loadMoreComments={loadMoreComments}
                      loadMoreHidden={loadMoreCommentsHidden()}
                      pageSize={COMMENTS_PER_PAGE}
                    />
                  </Show>
                </div>
              </div>
            </div>
          </Show>

          {/* Показываем плейсхолдер если нет комментариев и это собственный профиль */}
          <Show when={commented().length === 0 && commentsAmount() === 0 && author() && isOwnProfile()}>
            <div class="wide-container">
              <Placeholder type={'comments'} mode="profile" />
            </div>
          </Show>

          {/* Показываем сообщение "нет комментариев" для чужих профилей */}
          <Show when={commented().length === 0 && commentsAmount() === 0 && author() && !isOwnProfile()}>
            <div class="wide-container">
              <div class="row">
                <div class="col-md-20 col-lg-18">
                  <div style="text-align: center; padding: 4rem 2rem;">
                    <div>
                      <h3 style="margin-bottom: 1rem; color: #666;">{t('No comments found')}</h3>
                      <p style="color: #999;">{t("This author hasn't left any comments yet")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </Match>

        <Match when={!currentTab()}>
          {/* Показываем плейсхолдер только если статистика показывает 0 публикаций И это собственный профиль */}
          <Show when={shoutsAmount() === 0 && author() && isOwnProfile()}>
            <div class="wide-container">
              <Placeholder type={'author'} mode="profile" />
            </div>
          </Show>

          {/* Показываем публикации если статистика показывает больше 0 */}
          <Show when={shoutsAmount() > 0}>
            <Show
              when={sortedFeed().length > 0}
              fallback={
                <div class="wide-container">
                  <div class="row">
                    <div class="col-md-20 col-lg-18">
                      <div style="text-align: center; padding: 4rem 2rem;">
                        <Show when={author()} fallback={<Loading />}>
                          <div>
                            <h3 style="margin-bottom: 1rem; color: #666;">{t('No publications found')}</h3>
                            <p style="color: #999;">{t('Try changing filters or check back later')}</p>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              }
            >
              <LoadMoreWrapper
                loadFunction={loadMoreAuthorShouts}
                pageSize={FEED_PAGE_SIZE}
                hidden={!shouldShowLoadMore()}
              >
                <For each={sortedFeed()}>
                  {(_article, index) => {
                    const i = index()
                    if (i % 3 === 0) {
                      const articles = sortedFeed().slice(i, i + 3)
                      return (
                        <Switch>
                          <Match when={articles.length === 1}>
                            <Row1 article={articles[0]} noauthor={true} nodate={false} />
                          </Match>
                          <Match when={articles.length === 2}>
                            <Row2 articles={articles} noauthor={true} nodate={true} isEqual={true} />
                          </Match>
                          <Match when={articles.length === 3}>
                            <Row3 articles={articles} noauthor={true} nodate={true} />
                          </Match>
                        </Switch>
                      )
                    }
                    return null
                  }}
                </For>
              </LoadMoreWrapper>
            </Show>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}
