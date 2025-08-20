import { clsx } from 'clsx'
import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { SearchField } from '~/components/_shared/SearchField'
import { FollowsFilter, useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { Author, Topic } from '~/graphql/generated/graphql'
import { dummyFilter } from '~/intl/dummyFilter'
import stylesSettings from '~/styles/views/FeedSettings.module.scss'
import styles from '~/styles/views/ProfileSettings.module.scss'
import { AuthorBadge } from '../Author/AuthorBadge'
import { ProfileSettingsNavigation } from '../ProfileNav'
import { TopicBadge } from '../Topic/TopicBadge'

export const ProfileSubscriptions = () => {
  const { t, lang } = useLocalize()
  const { follows } = useFollowing()
  const [flatFollows, setFlatFollows] = createSignal<Array<Author | Topic>>([])
  const [filtered, setFiltered] = createSignal<Array<Author | Topic>>([])
  const [followsFilter, setFollowsFilter] = createSignal<FollowsFilter>('all')
  const [searchQuery, setSearchQuery] = createSignal('')

  createEffect(() => {
    // Безопасный доступ к follows с проверкой на undefined
    const authors = follows?.authors || []
    const topics = follows?.topics || []
    const allFollows = [...authors, ...topics]
    console.log('[ProfileSubscriptions] Updating follows:', {
      authors: authors.length,
      topics: topics.length,
      total: allFollows.length
    })
    setFlatFollows(allFollows)
  })

  createEffect(
    on([flatFollows, followsFilter], ([flat, mode]) => {
      console.log('[ProfileSubscriptions] Filtering by mode:', mode, 'from', flat.length, 'items')
      if (mode === 'authors') {
        setFiltered(flat.filter((s) => 'name' in s))
      } else if (mode === 'topics') {
        setFiltered(flat.filter((s) => 'title' in s))
      } else {
        setFiltered(flat)
      }
    })
  )

  createEffect(() => {
    const query = searchQuery()
    if (query) {
      const baseList = flatFollows()
      const searchResults = dummyFilter(baseList, query, lang())

      const mode = followsFilter()
      if (mode === 'authors') {
        setFiltered(searchResults.filter((s) => 'name' in s))
      } else if (mode === 'topics') {
        setFiltered(searchResults.filter((s) => 'title' in s))
      } else {
        setFiltered(searchResults)
      }
    } else {
      const flat = flatFollows()
      const mode = followsFilter()
      if (mode === 'authors') {
        setFiltered(flat.filter((s) => 'name' in s))
      } else if (mode === 'topics') {
        setFiltered(flat.filter((s) => 'title' in s))
      } else {
        setFiltered(flat)
      }
    }
  })

  return (
    <div class="wide-container">
      <div class="row">
        <div class="col-md-5">
          <div class={clsx('left-navigation', styles.leftNavigation)}>
            <ProfileSettingsNavigation />
          </div>
        </div>

        <div class="col-md-19">
          <div class="row">
            <div class="col-md-20 col-lg-18 col-xl-16">
              <h1>{t('My subscriptions')}</h1>
              <p class="description">{t('Here you can manage all your Discours subscriptions')}</p>
              <Show
                when={flatFollows().length > 0}
                fallback={
                  <Show when={follows && (follows.authors || follows.topics)} fallback={<Loading />}>
                    <div class="empty-state">
                      <p>{t('You have no subscriptions yet')}</p>
                      <p>{t('Subscribe to authors and topics to see them here')}</p>
                    </div>
                  </Show>
                }
              >
                <ul class="view-switcher">
                  <li
                    class={clsx({
                      'view-switcher__item--selected': followsFilter() === 'all'
                    })}
                  >
                    <button type="button" onClick={() => setFollowsFilter('all')}>
                      {t('All')}
                    </button>
                    <span class="view-switcher__counter">{flatFollows().length}</span>
                  </li>
                  <li
                    class={clsx({
                      'view-switcher__item--selected': followsFilter() === 'authors'
                    })}
                  >
                    <button type="button" onClick={() => setFollowsFilter('authors')}>
                      {t('Authors')}
                    </button>
                    <span class="view-switcher__counter">{flatFollows().filter((s) => 'name' in s).length}</span>
                  </li>
                  <li
                    class={clsx({
                      'view-switcher__item--selected': followsFilter() === 'topics'
                    })}
                  >
                    <button type="button" onClick={() => setFollowsFilter('topics')}>
                      {t('Topics')}
                    </button>
                    <span class="view-switcher__counter">{flatFollows().filter((s) => 'title' in s).length}</span>
                  </li>
                </ul>

                <div class={clsx('pretty-form__item', styles.searchContainer)}>
                  <SearchField
                    onChange={(value) => setSearchQuery(value)}
                    class={styles.searchField}
                    variant="bordered"
                  />
                </div>

                <div class={clsx(stylesSettings.settingsList, styles.topicsList)}>
                  <Show
                    when={filtered().length > 0}
                    fallback={
                      <div class="empty-state">
                        <p>{searchQuery() ? t('No subscriptions found') : t('No items in this category')}</p>
                      </div>
                    }
                  >
                    <For each={filtered()}>
                      {(followingItem) => (
                        <div>
                          {'name' in followingItem ? (
                            <AuthorBadge minimize={true} author={followingItem as Author} />
                          ) : (
                            <TopicBadge minimize={true} topic={followingItem as Topic} />
                          )}
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
