import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { Button } from '~/components/_shared/Button'
import { InlineLoader } from '~/components/_shared/InlineLoader'
import { Loading } from '~/components/_shared/Loading'
import { SearchField } from '~/components/_shared/SearchField'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import type { Author } from '~/graphql/schema/core.gen'
import { dummyFilter } from '~/intl/dummyFilter'
import { authorLetterReduce, translateAuthor } from '~/intl/translate'
import { scrollHandler } from '~/utils/scroll'

import styles from '~/styles/views/AllAuthors.module.scss'

type Props = {
  authors: Author[]
  authorsByFollowers?: Author[]
  authorsByShouts?: Author[]
  isLoaded: boolean
}

export const AUTHORS_PER_PAGE = 20
export const ABC = {
  ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ@',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@'
}

// useAuthors sorted from context, set filter/sort

export const AllAuthorsView = (props: Props) => {
  const { t, lang } = useLocalize()
  const alphabet = createMemo(() => ABC[lang()] || ABC['ru'])
  const [searchParams] = useSearchParams<{ by?: string }>()
  const { authorsSorted, setAuthorsSort, loadAuthors } = useAuthors()
  const authors = createMemo(() =>
    searchParams.by || searchParams.by === 'name' ? props.authors : authorsSorted()
  )
  const [loading, setLoading] = createSignal<boolean>(false)

  // filter
  const [searchQuery, setSearchQuery] = createSignal('')
  const [filteredAuthors, setFilteredAuthors] = createSignal<Author[]>([])
  createEffect(
    () =>
      authors() &&
      setFilteredAuthors((_prev: Author[]) => dummyFilter(authors(), searchQuery(), lang()) as Author[])
  )

  // sort by
  // onMount(() => !searchParams?.by && changeSearchParams({ by: 'name' }))
  createEffect(on(() => searchParams?.by || 'name', setAuthorsSort || ((_) => null), {}))

  // store by first char
  const byLetterFiltered = createMemo<{ [letter: string]: Author[] }>(() => {
    if (!filteredAuthors()) return {}
    // console.debug('[components.AllAuthors] update byLetterFiltered', filteredAuthors()?.length)
    return (
      filteredAuthors()?.reduce(
        (acc, author: Author) => authorLetterReduce(acc, author, lang()),
        {} as { [letter: string]: Author[] }
      ) || {}
    )
  })

  const sortedKeys = createMemo<string[]>(() => {
    const keys = Object.keys(byLetterFiltered() || {})
    keys.sort()
    const fk = keys.shift() || ''
    fk && keys.push(fk)
    return keys
  })

  const fetchAuthors = async (queryType: string, page: number) => {
    try {
      console.debug('[components.AuthorsList] fetching authors...')
      setLoading(true)
      setAuthorsSort?.(queryType)
      const offset = AUTHORS_PER_PAGE * page
      await loadAuthors({
        by: { order: queryType },
        limit: AUTHORS_PER_PAGE,
        offset
      })
    } catch (error) {
      console.error('[components.AuthorsList] error fetching authors:', error)
    } finally {
      setLoading(false)
    }
  }
  const [currentPage, setCurrentPage] = createSignal<{ followers: number; shouts: number }>({
    followers: 0,
    shouts: 0
  })
  const loadMoreAuthors = () => {
    const by = searchParams?.by
    if (!by || by === 'name') return
    const nextPage = currentPage()[by as 'followers' | 'shouts'] + 1
    fetchAuthors(by, nextPage).then(() => setCurrentPage({ ...currentPage(), [by]: nextPage }))
  }

  const TabNavigator = () => (
    <div class="row">
      <div class="col-lg-20 col-xl-18">
        <h1>{t('Authors')}</h1>
        <p>{t('Subscribe who you like to tune your personal feed')}</p>
        <ul class={clsx(styles.feedSwitcher, 'view-switcher')}>
          <li
            class={clsx({
              ['view-switcher__item--selected']: !searchParams?.by || searchParams?.by === 'shouts'
            })}
          >
            <a href="/author?by=shouts">{t('By shouts')}</a>
          </li>
          <li
            class={clsx({
              ['view-switcher__item--selected']: searchParams?.by === 'followers'
            })}
          >
            <a href="/author?by=followers">{t('By popularity')}</a>
          </li>
          <li
            class={clsx({
              ['view-switcher__item--selected']: searchParams?.by === 'name'
            })}
          >
            <a href="/author?by=name">{t('By name')}</a>
          </li>
          <Show when={searchParams?.by === 'name'}>
            <li class="view-switcher__search">
              <SearchField onChange={(value) => setSearchQuery(value)} />
            </li>
          </Show>
        </ul>
      </div>
    </div>
  )

  const AbcNavigator = () => (
    <div class="row">
      <div class="col-lg-20 col-xl-18">
        <ul class={clsx('nodash', styles.alphabet)}>
          <For each={[...(alphabet() || [])]}>
            {(letter, index) => (
              <li>
                <Show when={letter in byLetterFiltered()} fallback={letter}>
                  <a
                    href={`/author?by=name#letter-${index()}`}
                    onClick={(event) => {
                      event.preventDefault()
                      scrollHandler(`letter-${index()}`)
                    }}
                  >
                    {letter}
                  </a>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  )

  const AbcAuthorsList = () => (
    <For each={sortedKeys() || []}>
      {(letter) => (
        <div class={clsx(styles.group, 'group')}>
          <h2 id={`letter-${alphabet()?.indexOf(letter) || ''}`}>{letter}</h2>
          <div class="container">
            <div class="row">
              <div class="col-lg-20">
                <div class="row">
                  <For each={byLetterFiltered()?.[letter] || []}>
                    {(author) => (
                      <div class={clsx(styles.topic, 'topic col-sm-12 col-md-8')}>
                        <div class="topic-title">
                          <a href={`/@${author.slug}`}>{translateAuthor(author, lang())}</a>
                          <Show when={author.stat?.shouts || 0}>
                            <span class={styles.articlesCounter}>{author.stat?.shouts || 0}</span>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </For>
  )

  const AuthorsSortedList = () => (
    <div class={clsx(styles.AuthorsList)}>
      <For each={authorsSorted?.()}>
        {(author) => (
          <div class="row">
            <div class="col-lg-20 col-xl-18">
              <AuthorBadge author={author} />
            </div>
          </div>
        )}
      </For>
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <div class={styles.action}>
            <Show
              when={
                searchParams.by !== 'name' &&
                !searchParams.by &&
                !loading() &&
                ((authorsSorted?.() || []).length || 0) > 0
              }
            >
              <Button value={t('Load more')} onClick={loadMoreAuthors} aria-live="polite" />
            </Show>
            <Show when={loading()}>
              <InlineLoader />
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
  return (
    <>
      <Show when={props.isLoaded} fallback={<Loading />}>
        <div class="offset-md-5">
          <TabNavigator />
          <Show when={searchParams?.by === 'name'} fallback={<AuthorsSortedList />}>
            <AbcNavigator />
            <AbcAuthorsList />
          </Show>
        </div>
      </Show>
    </>
  )
}
