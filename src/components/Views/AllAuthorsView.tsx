import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { Loading } from '~/components/_shared/Loading'
import { SearchField } from '~/components/_shared/SearchField'
import { useLocalize } from '~/context/localize'
import type { Author } from '~/graphql/schema/core.gen'
import { authorLetterReduce } from '~/intl/translate'
import { scrollHandler } from '~/utils/scroll'

import styles from '~/styles/views/AllAuthors.module.scss'

const AUTHORS_PAGE_LAYOUTS = ['shouts', 'followers', 'name']

type TabNavigatorProps = {
  setLayout: (layout: string) => void
}

export const TabNavigator = ({ setLayout }: TabNavigatorProps) => {
  const { t } = useLocalize()
  const [searchParams] = useSearchParams<{ by?: string }>()
  const [_searchQuery, setSearchQuery] = createSignal('')

  const layouts = [...AUTHORS_PAGE_LAYOUTS]

  return (
    <div class="offset-md-5">
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <h1>{t('Authors')}</h1>
          <p>{t('Subscribe who you like to tune your personal feed')}</p>
          <ul class={clsx(styles.viewSwitcher, 'view-switcher')}>
            <For each={layouts}>
              {(layout) => (
                <li
                  class={clsx({
                    'view-switcher__item--selected':
                      searchParams?.by === layout || (!searchParams?.by && layout === 'shouts')
                  })}
                  onClick={() => setLayout(layout)}
                >
                  <A href={`/author?by=${layout}`}>
                    <span class="linkReplacement">{t(`By ${layout}`)}</span>
                  </A>
                </li>
              )}
            </For>
            <Show when={searchParams?.by === 'name'}>
              <li class="view-switcher__search">
                <SearchField onChange={(value) => setSearchQuery(value)} />
              </li>
            </Show>
          </ul>
        </div>
      </div>
    </div>
  )
}

type Props = {
  authors: Author[]
  authorsByFollowers?: Author[]
  authorsByShouts?: Author[]
  isLoaded: boolean
}

export const ABC = {
  ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ@',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@'
}

export const AllAuthorsView = (props: Props) => {
  const { lang } = useLocalize()
  const alphabet = createMemo(() => ABC[lang()] || ABC['ru'])
  const [searchParams] = useSearchParams<{ by?: string }>()
  const [authors, setAuthors] = createSignal<Author[]>([])
  const [layout, setLayout] = createSignal(searchParams.by || 'shouts')

  // Watch for changes in the URL and update the layout state
  createEffect(() => {
    setLayout(searchParams.by || 'shouts')
  })

  // Update the authors signal based on layout
  createEffect(() => {
    if (layout() === 'followers') {
      setAuthors(props.authorsByFollowers || [])
    } else if (layout() === 'shouts') {
      setAuthors(props.authorsByShouts || [])
    } else {
      setAuthors(props.authors || [])
    }
  })

  // Watch for changes in props and update the authors signal
  createEffect(
    on(
      () => [props.authors, props.authorsByFollowers, props.authorsByShouts],
      ([newAuthors, newAuthorsByFollowers, newAuthorsByShouts]) => {
        if (layout() === 'followers') {
          setAuthors(newAuthorsByFollowers || [])
        } else if (layout() === 'shouts') {
          setAuthors(newAuthorsByShouts || [])
        } else {
          setAuthors(newAuthors || [])
        }
      }
    )
  )

  // Memo to store authors grouped by the first letter and sorted by the alphabet
  const byLetterFiltered = createMemo<{ [letter: string]: Author[] }>(() => {
    if (!authors()) return {}
    const groupedAuthors =
      authors()?.reduce(
        (acc, author: Author) => authorLetterReduce(acc, author, lang()),
        {} as { [letter: string]: Author[] }
      ) || {}

    // Sort the keys based on the alphabet
    const sortedGroupedAuthors: { [letter: string]: Author[] } = {}
    for (const letter of alphabet()) {
      if (groupedAuthors[letter]) {
        sortedGroupedAuthors[letter] = groupedAuthors[letter]
      }
    }

    return sortedGroupedAuthors
  })

  // Component to render the alphabet navigator
  const AbcNavigator = () => (
    <div class="row">
      <div class="col-lg-20 col-xl-18">
        <ul class={clsx('nodash', styles.alphabet)}>
          <For each={[...(alphabet() || [])]}>
            {(letter, index) => (
              <li>
                <Show when={letter in byLetterFiltered()} fallback={letter}>
                  <A
                    href={`/author?by=name#letter-${index()}`}
                    onClick={(event) => {
                      event.preventDefault()
                      scrollHandler(`letter-${index()}`)
                    }}
                  >
                    {letter}
                  </A>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  )

  // Function to group authors by the first letter of their name
  const groupAuthorsByFirstLetter = (authors: Author[]) => {
    if (!Array.isArray(authors)) {
      console.error('Expected authors to be an array, but got:', authors)
      return {}
    }

    return authors.reduce(
      (acc, author) => {
        const firstLetter = (author.name ?? '').charAt(0).toUpperCase()
        if (!acc[firstLetter]) {
          acc[firstLetter] = []
        }
        acc[firstLetter].push(author)
        return acc
      },
      {} as Record<string, Author[]>
    )
  }

  // Component to render the list of authors grouped by the first letter of their name
  const AbcAuthorsList = () => {
    const groupedAuthors = createMemo(() => groupAuthorsByFirstLetter(authors()))

    return (
      <For each={alphabet().split('')}>
        {(letter) => (
          <Show when={groupedAuthors()[letter]}>
            <div class={clsx(styles.group, 'group')}>
              <h2 id={`letter-${alphabet()?.indexOf(letter) || ''}`}>{letter}</h2>
              <div class="container">
                <div class="row">
                  <div class="col-lg-20">
                    <div class="row">
                      <For each={groupedAuthors()[letter]}>
                        {(author) => (
                          <div class={clsx(styles.topic, 'topic col-sm-12 col-md-8')}>
                            <div class="topic-title">
                              <A href={`/@${author.slug}`}>{author.name}</A>
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
          </Show>
        )}
      </For>
    )
  }

  // Component to render the sorted list of authors
  const AuthorsSortedList = (props: { authors: Author[] }) => (
    <div class={clsx(styles.AuthorsList)}>
      <For each={props.authors}>
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
          <div class={styles.action} />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Show when={props.isLoaded} fallback={<Loading />}>
        <TabNavigator setLayout={setLayout} />
        <div class="offset-md-5">
          <Show when={layout() === 'name'}>
            <AbcNavigator />
            <AbcAuthorsList />
          </Show>
          <Show when={layout() === 'followers' || layout() === 'shouts'}>
            <AuthorsSortedList authors={authors()} />
          </Show>
        </div>
      </Show>
    </>
  )
}
