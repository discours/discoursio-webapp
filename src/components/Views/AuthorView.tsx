import { A, useLocation, useParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on } from 'solid-js'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { useAuthors } from '~/context/authors'
import { SHOUTS_PER_PAGE, useFeed } from '~/context/feed'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { loadReactions, loadShouts } from '~/graphql/api/public'
import getAuthorFollowersQuery from '~/graphql/query/core/author-followers'
import getAuthorFollowsQuery from '~/graphql/query/core/author-follows'
import { ReactionKind } from '~/graphql/schema/core.gen'
import type { Author, Reaction, Shout, Topic } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { byCreated } from '~/utils/sort'
import { Comment } from '../Article/Comment'
import { AuthorCard } from '../Author/AuthorCard'
import { AuthorShoutsRating } from '../Author/AuthorShoutsRating'
import { Placeholder } from '../Feed/Placeholder'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'

import styles from '~/styles/views/Author.module.scss'
import stylesArticle from '../Article/Article.module.scss'

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
  const [currentTab, setCurrentTab] = createSignal<string>(params.tab)

  const { session, client } = useSession()

  const { loadAuthor, authorsEntities } = useAuthors()
  const { followers: myFollowers, follows: myFollows } = useFollowing()

  // signals
  const [isBioExpanded, setIsBioExpanded] = createSignal(false)
  const [author, setAuthor] = createSignal<Author>()
  const [followers, setFollowers] = createSignal<Author[]>([] as Author[])
  const [following, changeFollowing] = createSignal<Array<Author | Topic>>([] as Array<Author | Topic>) // flat AuthorFollowsResult
  const [showExpandBioControl, setShowExpandBioControl] = createSignal(false)
  const [commented, setCommented] = createSignal<Reaction[]>(props.comments || [])
  const [followersLoaded, setFollowersLoaded] = createSignal(false)
  const [followingsLoaded, setFollowingsLoaded] = createSignal(false)
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || []) // Full list of shouts
  const [shoutBatches, setShoutBatches] = createSignal<Shout[][]>([]) // Array for batches

  // Utility function to append new shouts into batches, keeping the last incomplete batch untouched
  const appendShoutsToBatches = (newShouts: Shout[]): Shout[][] => {
    const currentBatches = shoutBatches() // Get the current batches
    const newBatch: Shout[][] = [] // Explicitly type newBatch as Shout[][]

    // If the last batch is full, we can start adding new shouts directly
    if (currentBatches.length === 0 || currentBatches[currentBatches.length - 1].length === 3) {
      // No incomplete batch, so just add new batches
      for (let i = 0; i < newShouts.length; i += 3) {
        newBatch.push(newShouts.slice(i, i + 3))
      }
    } else {
      // If the last batch is incomplete, leave it as is and start a new batch
      for (let i = 0; i < newShouts.length; i += 3) {
        newBatch.push(newShouts.slice(i, i + 3))
      }
    }

    return [...currentBatches, ...newBatch] // Return the combined old and new batches
  }

  // When sortedFeed changes, append the new items to shoutBatches without modifying incomplete batches
  createEffect(() => {
    // Get the current number of shouts that have already been batched
    const currentShoutCount = shoutBatches().reduce((acc, batch) => acc + batch.length, 0)

    // Calculate how many new shouts have been added since last time
    const newShouts = sortedFeed().slice(currentShoutCount)

    // Only append if there are new shouts
    if (newShouts.length > 0) {
      // Append only if new batches differ from old ones
      const batches = appendShoutsToBatches(newShouts)

      // Check if the new batches are different from the existing ones to avoid redundant updates
      if (JSON.stringify(batches) !== JSON.stringify(shoutBatches())) {
        setShoutBatches(batches)
      }
    }
  })

  // derivatives
  const me = createMemo<Author>(() => session()?.user?.app_data?.profile as Author)

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
          changeFollowing([...(myFollows?.topics || []), ...(myFollows?.authors || [])])
          setFollowingsLoaded(true)
        } else if (slug && !author()) {
          await loadAuthor({ slug })
          const foundAuthor = authorsEntities()[slug]
          setAuthor(foundAuthor)

          if (foundAuthor) {
            const followsResp = await client()
              ?.query(getAuthorFollowsQuery, { slug: foundAuthor.slug })
              .toPromise()
            const follows = followsResp?.data?.get_author_followers || {}
            changeFollowing([...(follows?.authors || []), ...(follows?.topics || [])])
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

  const handleDeleteComment = (id: number) => {
    setCommented((prev) => (prev || []).filter((comment) => comment.id !== id))
  }

  const TabNavigator = () => (
    <div class="col-md-16">
      <ul class="view-switcher">
        <li classList={{ 'view-switcher__item--selected': !currentTab() }}>
          <A href={`/@${props.authorSlug}`}>{t('Publications')}</A>
          <Show when={author()?.stat}>
            <span class="view-switcher__counter">{author()?.stat?.shouts || 0}</span>
          </Show>
        </li>
        <li classList={{ 'view-switcher__item--selected': currentTab() === 'comments' }}>
          <A href={`/@${props.authorSlug}/comments`}>{t('Comments')}</A>
          <Show when={author()?.stat}>
            <span class="view-switcher__counter">{author()?.stat?.comments || 0}</span>
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

  const { feedByAuthor } = useFeed()
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)

  // Load more functionality, fetch new shouts, and update sortedFeed
  const loadMore = async () => {
    saveScrollPosition()
    const authorShoutsFetcher = loadShouts({
      options: {
        filters: { author: props.authorSlug },
        limit: SHOUTS_PER_PAGE,
        offset: sortedFeed().length || 0
      } // Offset is based on the current length of sortedFeed
    })
    const result = await authorShoutsFetcher()

    if (result) {
      // Append the newly loaded shouts to the existing sortedFeed
      setSortedFeed((prev) => [...prev, ...result]) // Ensure sortedFeed grows with new items
    }
    restoreScrollPosition()
    return result as LoadMoreItems
  }

  // fx to update author's feed
  createEffect(
    on(
      feedByAuthor,
      (byAuthor) => {
        const feed = byAuthor[props.authorSlug] as Shout[]
        if (!feed) return
        setSortedFeed(feed)
      },
      {}
    )
  )

  const [loadMoreCommentsHidden, setLoadMoreCommentsHidden] = createSignal(
    Boolean(props.author?.stat && props.author?.stat?.comments === 0)
  )
  const { commentsByAuthor, addShoutReactions } = useReactions()
  const loadMoreComments = async () => {
    if (!author()) return [] as LoadMoreItems
    saveScrollPosition()
    const aid = author()?.id || 0
    const authorCommentsFetcher = loadReactions({
      by: {
        kinds: [ReactionKind.Comment],
        author: author()?.slug
      },
      limit: COMMENTS_PER_PAGE,
      offset: commentsByAuthor()[aid]?.length || 0
    })
    const result = await authorCommentsFetcher()
    if (result) {
      addShoutReactions(result)
    }
    restoreScrollPosition()
    return result as LoadMoreItems
  }

  createEffect(() => setCurrentTab(params.tab))

  // Update commented when author or commentsByAuthor changes
  createEffect(
    on(
      [author, commentsByAuthor],
      ([a, ccc]) => {
        if (a && ccc && ccc[a.id]) {
          setCommented(ccc[a.id])
        }
      },
      {}
    )
  )

  createEffect(
    on(
      [author, commented],
      ([a, ccc]) => {
        if (a && ccc) {
          setLoadMoreCommentsHidden((ccc || []).length === a.stat?.comments)
        }
      },
      {}
    )
  )

  createEffect(
    on(
      [author, feedByAuthor],
      ([a, feed]) => {
        if (a && feed[props.authorSlug]) {
          setLoadMoreHidden(feed[props.authorSlug]?.length === a.stat?.shouts)
        }
      },
      {}
    )
  )

  // ffect: Reset sortedFeed When Author Slug Changes**
  createEffect(
    on(
      () => props.authorSlug,
      (newSlug, prevSlug) => {
        if (newSlug !== prevSlug) {
          setSortedFeed([]) // Reset sortedFeed to prevent shouts from previous author
          setShoutBatches([]) // Reset shoutBatches as well
        }
      },
      {}
    )
  )

  return (
    <div class={styles.authorPage}>
      <div class="wide-container">
        <Show when={author() && followersLoaded() && followingsLoaded()} fallback={<Loading />}>
          <>
            <div class={styles.authorHeader}>
              <AuthorCard
                author={author() as Author}
                followers={followers() || []}
                flatFollows={following() || []}
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

          <LoadMoreWrapper
            loadFunction={loadMoreComments}
            pageSize={COMMENTS_PER_PAGE}
            hidden={loadMoreCommentsHidden()}
          >
            <div class="wide-container">
              <div class="row">
                <div class="col-md-20 col-lg-18">
                  <ul class={stylesArticle.comments}>
                    <For each={commented()?.sort(byCreated).reverse()}>
                      {(comment) => (
                        <Comment
                          comment={comment}
                          class={styles.comment}
                          showArticleLink={true}
                          onDelete={(id) => handleDeleteComment(id)}
                        />
                      )}
                    </For>
                  </ul>
                </div>
              </div>
            </div>
          </LoadMoreWrapper>
        </Match>

        <Match when={!currentTab()}>
          <Show when={me()?.slug === props.authorSlug && !me()?.stat?.shouts}>
            <div class="wide-container">
              <Placeholder type={loc?.pathname} mode="profile" />
            </div>
          </Show>

          <LoadMoreWrapper loadFunction={loadMore} pageSize={SHOUTS_PER_PAGE} hidden={loadMoreHidden()}>
            <For each={shoutBatches()}>
              {(batch) => {
                const rowsInBatch: Shout[][] = [] // Explicitly type rowsInBatch
                for (let i = 0; i < batch.length; i += 3) {
                  rowsInBatch.push(batch.slice(i, i + 3)) // Slicing batch into arrays of up to 3 items
                }
                return (
                  <For each={rowsInBatch}>
                    {(articles) => (
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
                    )}
                  </For>
                )
              }}
            </For>
          </LoadMoreWrapper>
        </Match>
      </Switch>
    </div>
  )
}
