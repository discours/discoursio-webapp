import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { SearchField } from '~/components/_shared/SearchField'
import { useLocalize } from '~/context/localize'
import { useAuthors } from '~/context/authors'
import { authorLetterReduce } from '~/intl/translate'
import { scrollHandler } from '~/utils/scroll'
import { loadAuthors } from '~/graphql/api/public'
import styles from '~/styles/views/AllAuthors.module.scss'
import { Author } from '~/graphql/generated/graphql'

const AUTHORS_PAGE_LAYOUTS = ['shouts', 'followers', 'name'] as const
type LayoutType = typeof AUTHORS_PAGE_LAYOUTS[number]

type TabNavigatorProps = {
  setSearchQuery: (query: string) => void
}

export const TabNavigator = ({ setSearchQuery }: TabNavigatorProps) => {
  const { t } = useLocalize()
  const [searchParams] = useSearchParams<{ by?: string }>()

  const getLayoutName = (layout: string) => {
    switch (layout) {
      case 'shouts':
        return t('By shouts')
      case 'followers':
        return t('By followers')
      default:
        return t('By name')
    }
  }

  return (
    <div class="offset-md-5">
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <h1>{t('Authors')}</h1>
          <p>{t('Subscribe who you like to tune your personal feed')}</p>
          <ul class={clsx('view-switcher')}>
            <For each={AUTHORS_PAGE_LAYOUTS}>
              {(layout: LayoutType) => (
                <li
                  class={clsx({
                    'view-switcher__item--selected': searchParams?.by === layout || (!searchParams?.by && layout === 'shouts')
                  })}
                >
                  <A href={`/author?by=${layout}`}>
                    <span class="linkReplacement">{getLayoutName(layout)}</span>
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
  authors: Author[] // authorsByName из роута
  authorsByFollowers?: Author[]
  authorsByShouts?: Author[]
}

export const ABC = {
  ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ@',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ@'
}

export const AllAuthorsView = (props: Props) => {
  const { lang } = useLocalize()
  const { allAuthors } = useAuthors()
  const alphabet = createMemo(() => ABC[lang()] || ABC['ru'])
  const [searchParams] = useSearchParams<{ by?: string }>()
  const [searchQuery, setSearchQuery] = createSignal('')

  // ✅ Простая проверка layout
  const layout = () => searchParams.by || 'shouts'

  console.log('[AllAuthorsView] layout:', layout(), '| Props counts - authors:', props.authors?.length || 0, 'followers:', props.authorsByFollowers?.length || 0, 'shouts:', props.authorsByShouts?.length || 0)

  // ✅ Простые данные для каждой вкладки
  const getAuthorsForLayout = () => {
    const result = (() => {
      switch (layout()) {
        case 'name':
          // ✅ Используем props.authors как fallback для гидратации
          return allAuthors().length > 0 ? allAuthors() : props.authors || []
        case 'followers':
          return props.authorsByFollowers || []
        case 'shouts':
          return props.authorsByShouts || []
        default:
          return props.authorsByShouts || []
      }
    })()
    
    console.log('[getAuthorsForLayout] layout:', layout(), '| result count:', result.length)
    return result
  }

  // ✅ Простая группировка по алфавиту только для name
  const getGroupedByLetter = () => {
    if (layout() !== 'name') return {}
    
    const authors = getAuthorsForLayout()
    if (!authors.length) return {}

    // Применяем поиск
    const filteredAuthors = searchQuery().trim()
      ? authors.filter((author: Author) =>
          author.name?.toLowerCase().includes(searchQuery().toLowerCase()) ||
          author.slug?.toLowerCase().includes(searchQuery().toLowerCase())
        )
      : authors

    const grouped = filteredAuthors.reduce((acc: { [letter: string]: Author[] }, author: Author) => {
      return authorLetterReduce(acc, author, lang())
    }, {} as { [letter: string]: Author[] })

    return grouped
  }

  // ✅ Простой компонент алфавитного навигатора
  const AbcNavigator = () => {
    const grouped = getGroupedByLetter()
    
    return (
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <ul class={clsx('nodash', styles.alphabet)}>
            <For each={alphabet().split('')}>
              {(letter, index) => (
                <li>
                  <Show when={letter in grouped} fallback={letter}>
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
  }

  // ✅ Простой компонент списка авторов по алфавиту
  const AbcAuthorsList = () => {
    const grouped = getGroupedByLetter()
    
    return (
      <For each={alphabet().split('')}>
        {(letter) => (
          <Show when={grouped[letter]}>
            <div class={clsx(styles.group, 'group')}>
              <h2 id={`letter-${alphabet().indexOf(letter)}`}>{letter}</h2>
              <div class="container">
                <div class="row">
                  <div class="col-lg-20">
                    <div class="row">
                      <For each={grouped[letter]}>
                        {(author) => (
                          <div class={clsx(styles.topic, 'topic col-sm-12 col-md-8')}>
                            <div class="topic-title">
                              <A href={`/@${author.slug}`}>{author.name}</A>
                              <Show when={author.stat?.shouts && (author.stat?.shouts || 0) > 0}>
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

  // ✅ Простой компонент списка авторов для followers/shouts
  const AuthorsSortedList = () => {
    const authors = getAuthorsForLayout()
    
    return (
      <div class={clsx(styles.AuthorsList)}>
        <For each={authors}>
          {(author: Author) => (
            <div class="row">
              <div class="col-lg-20 col-xl-18">
                <AuthorBadge author={author} />
              </div>
            </div>
          )}
        </For>
      </div>
    )
  }







  return (
    <>
      <TabNavigator setSearchQuery={setSearchQuery} />
      <div class="offset-md-5">
        {/* ✅ Простая логика отображения */}
        <Show when={layout() === 'name'} fallback={
          <AuthorsSortedList />
        }>
          <AbcNavigator />
          <AbcAuthorsList />
        </Show>
      </div>
    </>
  )
}
