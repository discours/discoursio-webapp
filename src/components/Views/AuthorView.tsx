import { A, useLocation, useParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on } from 'solid-js'
import { CommentsList } from '~/components/Comments/CommentsList'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { useAuthors } from '~/context/authors'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { loadReactions, loadShouts } from '~/graphql/api/public'
import getAuthorFollowersQuery from '~/graphql/query/core/author-followers'
import getAuthorFollowsQuery from '~/graphql/query/core/author-follows'
import { ReactionKind, ReactionSort } from '~/graphql/schema/core.gen'
import type { Author, Reaction, Shout, Topic } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { AuthorCard } from '../Author/AuthorCard'
import { AuthorShoutsRating } from '../Author/AuthorShoutsRating'
import FeedFiltersControl from '../Feed/FeedFiltersControl'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Placeholder } from '../Feed/Placeholder'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'

import styles from '~/styles/views/Author.module.scss'

type AuthorViewProps = {
  authorSlug: string
  shouts: Shout[]
  comments: Reaction[]
  author?: Author
}

export const PRERENDERED_ARTICLES_COUNT = 12
const COMMENTS_PER_PAGE = 12
// const LOAD_MORE_PAGE_SIZE = 9

export const AuthorView = (props: AuthorViewProps) => {
  // contexts
  const { t } = useLocalize()
  const loc = useLocation()
  const params = useParams()
  const { mode } = useParams()
  const { mode: feedMode } = useFeed()
  const [currentTab, setCurrentTab] = createSignal<string | undefined>()

  const { session, client } = useSession()

  const { loadAuthor, authorsEntities } = useAuthors()
  const { followers: myFollowers, follows: myFollows } = useFollowing()

  // signals
  const [isBioExpanded, setIsBioExpanded] = createSignal(false)
  const [author, setAuthor] = createSignal<Author>()
  const [followers, setFollowers] = createSignal<Author[]>([] as Author[])
  const [followingArray, setFollowingArray] = createSignal<Array<Author | Topic>>(
    [] as Array<Author | Topic>
  ) // flat AuthorFollowsResult
  const [showExpandBioControl, setShowExpandBioControl] = createSignal(false)
  const [commented, setCommented] = createSignal<Reaction[]>(props.comments || [])
  const [followersLoaded, setFollowersLoaded] = createSignal(false)
  const [followingsLoaded, setFollowingsLoaded] = createSignal(false)
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || [])

  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)

  // derivatives
  const me = createMemo<Author>(() => session()?.user?.app_data?.profile as Author)

  const { commentsByAuthor, addShoutReactions } = useReactions()
  const { feedByAuthor } = useFeed()

  // Создаем мемо для статистики из author.stat
  const stats = createMemo(() => ({
    shouts: author()?.stat?.shouts || 0,
    comments: author()?.stat?.comments || 0
  }))

  // Эффект для обработки изменения таба через браузер
  createEffect(
    on(
      () => params.tab,
      async (newTab) => {
        setCurrentTab(newTab)

        // Если переключились на комментарии и они еще не загружены
        if (newTab === 'comments' && !commented().length && author()) {
          try {
            const result = await loadReactions({
              by: {
                kinds: [ReactionKind.Comment],
                author: author()?.slug
              },
              limit: COMMENTS_PER_PAGE,
              offset: 0
            })()

            if (result) {
              addShoutReactions(result)
              setCommented(result)
              setLoadMoreCommentsHidden(result.length >= stats().comments)
            }
          } catch (error) {
            console.error('[AuthorView] Error loading comments:', error)
          }
        }
      }
    )
  )

  // Эффект для обновления комментариев при изменении автора или commentsByAuthor
  createEffect(
    on([author, commentsByAuthor], ([a, ccc]) => {
      if (a?.id && ccc?.[a.id]) {
        setCommented(ccc[a.id])
        setLoadMoreCommentsHidden(ccc[a.id].length >= stats().comments)
      }
    })
  )

  // Эффект для обновления статей при изменении feedByAuthor
  createEffect(
    on(
      () => feedByAuthor()[props.authorSlug],
      (authorFeed) => {
        if (authorFeed?.length) {
          setSortedFeed(authorFeed)
          setLoadMoreHidden(authorFeed.length >= stats().shouts)
        }
      },
      { defer: false }
    )
  )

  // Объединенный эффект для загрузки автора и его подписок
  createEffect(
    on(
      () => session()?.user?.app_data?.profile,
      async (meData?: Author) => {
        const slug = props.authorSlug

        if (slug && meData?.slug === slug) {
          setAuthor(meData)
          setFollowers(myFollowers() || [])
          setFollowersLoaded(true)
          setFollowingArray([...(myFollows?.topics || []), ...(myFollows?.authors || [])])
          setFollowingsLoaded(true)
          // Добавить логирование для отладки
          console.log('Current user:', meData)
          console.log('Author slug:', slug)
        } else if (slug && !author()) {
          await loadAuthor({ slug })
          const foundAuthor = authorsEntities()[slug]
          // Проверить загрузку автора
          console.log('Loaded author:', foundAuthor)
          setAuthor(foundAuthor)

          if (foundAuthor) {
            const followsResp = await client()
              ?.query(getAuthorFollowsQuery, { slug: foundAuthor.slug })
              .toPromise()
            const follows = followsResp?.data?.get_author_follows || {}
            setFollowingArray([...(follows?.authors || []), ...(follows?.topics || [])])
            setFollowingsLoaded(true)

            const followersResp = await client()
              ?.query(getAuthorFollowersQuery, { slug: foundAuthor.slug })
              .toPromise()
            setFollowers(followersResp?.data?.get_author_followers || [])
            setFollowersLoaded(true)
          }
        }
      },
      {}
    )
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

  const TabNavigator = () => (
    <div class="col-md-16">
      <ul class="view-switcher">
        <li classList={{ 'view-switcher__item--selected': !currentTab() }}>
          <A href={`/@${props.authorSlug}`}>{t('Publications')}</A>
          <Show when={author()?.stat}>
            <span class="view-switcher__counter">{stats().shouts}</span>
          </Show>
        </li>
        <li classList={{ 'view-switcher__item--selected': currentTab() === 'comments' }}>
          <A href={`/@${props.authorSlug}/comments`}>{t('Comments')}</A>
          <Show when={author()?.stat}>
            <span class="view-switcher__counter">{stats().comments}</span>
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

  // Эффект для обработки начальных данных
  createEffect(on(() => props.shouts, setSortedFeed))

  // Обновленная функция loadMore
  const loadMore = async () => {
    saveScrollPosition()
    const offset = sortedFeed().length

    try {
      const authorShoutsFetcher = loadShouts({
        options: {
          filters: { author: props.authorSlug },
          limit: FEED_PAGE_SIZE,
          offset
        }
      })
      const result = await authorShoutsFetcher()

      if (result?.length) {
        // Добавляем только уникальные статьи
        const currentSlugs = new Set(sortedFeed().map((s) => s.slug))
        const newShouts = result.filter((shout: Shout) => !currentSlugs.has(shout.slug))

        if (newShouts.length) {
          setSortedFeed((prev) => [...prev, ...newShouts])
          setLoadMoreHidden(sortedFeed().length >= stats().shouts)
        }
      }

      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.error('[AuthorView] Error loading more shouts:', error)
      return []
    }
  }

  const [loadMoreCommentsHidden, setLoadMoreCommentsHidden] = createSignal(
    Boolean(author()?.stat && author()?.stat?.comments === 0)
  )

  // Effect: Reset sortedFeed When Author Slug Changes**
  createEffect(
    on(
      () => props.authorSlug,
      (newSlug, prevSlug) => {
        if (newSlug !== prevSlug) {
          setSortedFeed([]) // Reset sortedFeed to prevent shouts from previous author
        }
      },
      {}
    )
  )

  // Функция загрузки дополнительных комментариев
  const loadMoreComments = async () => {
    if (!author()) return [] as LoadMoreItems

    saveScrollPosition()
    try {
      const result = await loadReactions({
        by: {
          kinds: [ReactionKind.Comment],
          author: author()?.slug
        },
        limit: COMMENTS_PER_PAGE,
        offset: commented().length
      })()

      if (result?.length) {
        addShoutReactions(result)
        setCommented((prev) => [...prev, ...result])
        setLoadMoreCommentsHidden(commented().length >= stats().comments)
      }

      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.error('[AuthorView] Error loading more comments:', error)
      return []
    }
  }

  // Синхронизируем таб с URL
  createEffect(() => {
    // Если режим comments или URL содержит /comments, переключаем на таб комментариев
    if (feedMode() === 'comments' || loc.pathname.includes('/comments')) {
      setCurrentTab('comments')
    } else if (feedMode() === 'about' || loc.pathname.includes('/about')) {
      setCurrentTab('about')
    } else {
      setCurrentTab(mode)
    }
  })

  const [commentsOrder, setCommentsOrder] = createSignal<ReactionSort>(ReactionSort.Newest)

  return (
    <div class={styles.authorPage}>
      <div class="wide-container">
        <Show when={author() && followersLoaded() && followingsLoaded()} fallback={<Loading />}>
          <>
            <div class={styles.authorHeader}>
              <AuthorCard
                author={author() as Author}
                followers={followers() || []}
                flatFollows={followingArray() || []}
              />
            </div>
            <div class={clsx(styles.groupControls, 'row')}>
              <TabNavigator />
              <div class={clsx('col-md-8', styles.additionalControls)}>
                <Show when={typeof author()?.stat?.rating === 'number'}>
                  <div class={styles.ratingContainer}>
                    {t('All posts rating')}
                    <AuthorShoutsRating author={author() as Author} class={styles.ratingControl} />
                  </div>
                </Show>
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
          <Show when={me()?.slug === props.authorSlug && !me()?.stat?.comments}>
            <div class="wide-container">
              <Placeholder type={loc?.pathname} mode="profile" />
            </div>
          </Show>

          <div class="wide-container">
            <div class="row">
              <div class="col-md-20 col-lg-18">
                <CommentsList
                  comments={commented()}
                  showArticleLink={true}
                  withFilter={true}
                  sortOrder={commentsOrder()}
                  onFiltersChange={(filters) => setCommentsOrder(filters.sort || ReactionSort.Newest)}
                  onDeleteComment={(id) => setCommented((prev) => prev.filter((c) => c.id !== id))}
                  loadMoreComments={loadMoreComments}
                  loadMoreHidden={loadMoreCommentsHidden()}
                  pageSize={COMMENTS_PER_PAGE}
                />
              </div>
            </div>
          </div>
        </Match>

        <Match when={!currentTab()}>
          <div class={styles.filtersContainer}>
            <FeedSwitcher options={['recent', 'top', 'hot']} prefix={`/@${props.authorSlug}`} />
            <FeedFiltersControl />
          </div>

          <Show when={me()?.slug === props.authorSlug && !me()?.stat?.shouts}>
            <div class="wide-container">
              <Placeholder type={loc?.pathname} mode="profile" />
            </div>
          </Show>

          <LoadMoreWrapper loadFunction={loadMore} pageSize={FEED_PAGE_SIZE} hidden={loadMoreHidden()}>
            <For each={sortedFeed()}>
              {(_article, index) => {
                const i = index()
                if (i % 3 === 0) {
                  const articles = sortedFeed().slice(i, i + 3)
                  return (
                    <Switch>
                      <Match when={articles.length === 1}>
                        <Row1 article={articles[0]} noauthor={true} nodate={true} />
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
        </Match>
      </Switch>
    </div>
  )
}
