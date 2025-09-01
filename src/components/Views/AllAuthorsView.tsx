import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { SearchField } from '~/components/_shared/SearchField'
import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { loadAuthors } from '~/graphql/api/public'
import { Author } from '~/graphql/generated/graphql'
import { authorLetterReduce } from '~/intl/translate'
import styles from '~/styles/views/AllAuthors.module.scss'
import { scrollHandler } from '~/utils/scroll'

const AUTHORS_PAGE_LAYOUTS = ['shouts', 'followers', 'name'] as const
type LayoutType = (typeof AUTHORS_PAGE_LAYOUTS)[number]

type TabNavigatorProps = {
  setSearchQuery: (query: string) => void
}

export const TabNavigator = ({ setSearchQuery }: TabNavigatorProps) => {
  const { t } = useLocalize()
  const [searchParams] = useSearchParams<{ by?: string }>()

  const getLayoutName = (layout: string) => {
    switch (layout) {
      case 'followers':
        return t('By followers')
      case 'name':
        return t('By name')
      default:
        return t('By shouts')
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
                    'view-switcher__item--selected':
                      searchParams?.by === layout || (!searchParams?.by && layout === 'shouts')
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

  // ✅ Состояние для дозагруженных авторов (followers/shouts)
  const [loadedAuthors, setLoadedAuthors] = createSignal<Author[]>([])

  // ✅ Мемоизированный layout для стабильности
  const layout = createMemo(() => searchParams.by || 'shouts')

  // ✅ Сбрасываем дозагруженных авторов при смене вкладки
  createEffect(() => {
    const currentLayout = layout()
    console.log('[AllAuthorsView] Layout changed to:', currentLayout)
    setLoadedAuthors([])
  })

  // ✅ Реактивные данные для каждой вкладки с приоритетом props.* (SSR данные)
  const getAuthorsForLayout = createMemo(() => {
    const currentLayout = layout()

    let result: Author[] = []
    switch (currentLayout) {
      case 'name': {
        // ✅ Для алфавитного списка приоритет обогащенным данным из контекста
        const contextAuthors = allAuthors()
        const propsAuthors = props.authors || []

        // Если в контексте есть авторы со статистикой, используем их
        // Иначе используем SSR данные как fallback
        if (contextAuthors.length > 0) {
          result = contextAuthors
        } else {
          result = propsAuthors
        }
        break
      }
      case 'followers': {
        // ✅ Объединяем SSR данные с дозагруженными
        const followersBase = props.authorsByFollowers || []
        const followersLoaded = loadedAuthors().filter((a) => !followersBase.some((base) => base.id === a.id))
        result = [...followersBase, ...followersLoaded]
        break
      }
      case 'shouts': {
        // ✅ Объединяем SSR данные с дозагруженными
        const shoutsBase = props.authorsByShouts || []
        const shoutsLoaded = loadedAuthors().filter((a) => !shoutsBase.some((base) => base.id === a.id))
        result = [...shoutsBase, ...shoutsLoaded]
        break
      }
      default:
        result = props.authorsByShouts || []
    }

    return result
  })

  // ✅ Мемоизированная группировка по алфавиту только для name
  const getGroupedByLetter = createMemo(() => {
    if (layout() !== 'name') return {}

    const authors = getAuthorsForLayout()
    if (!authors.length) return {}

    // 🔍 ДИАГНОСТИКА: Проверяем обогащение данных
    const authorsWithStats = authors.filter((a) => a.stat?.shouts && a.stat.shouts > 0)
    console.log('[AllAuthorsView] Authors with stats:', {
      total: authors.length,
      withStats: authorsWithStats.length,
      examples: authorsWithStats.slice(0, 3).map((a) => ({ name: a.name, shouts: a.stat?.shouts }))
    })

    // Применяем поиск
    const filteredAuthors = searchQuery().trim()
      ? authors.filter(
          (author: Author) =>
            author.name?.toLowerCase().includes(searchQuery().toLowerCase()) ||
            author.slug?.toLowerCase().includes(searchQuery().toLowerCase())
        )
      : authors

    const grouped = filteredAuthors.reduce(
      (acc: { [letter: string]: Author[] }, author: Author) => {
        return authorLetterReduce(acc, author, lang())
      },
      {} as { [letter: string]: Author[] }
    )

    return grouped
  })

  // ✅ Простой компонент алфавитного навигатора
  const AbcNavigator = () => {
    return (
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <ul class={clsx('nodash', styles.alphabet)}>
            <For each={alphabet().split('')}>
              {(letter, index) => (
                <li>
                  <Show when={letter in getGroupedByLetter()} fallback={letter}>
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
    return (
      <For each={alphabet().split('')}>
        {(letter) => (
          <Show when={getGroupedByLetter()[letter]}>
            <div class={clsx(styles.group, 'group')}>
              <h2 id={`letter-${alphabet().indexOf(letter)}`}>{letter}</h2>
              <div class="container">
                <div class="row">
                  <div class="col-lg-20">
                    <div class="row">
                      <For each={getGroupedByLetter()[letter]}>
                        {(author) => (
                          <div class={clsx(styles.topic, 'topic col-sm-12 col-md-8')}>
                            <div class="topic-title">
                              <A href={`/@${author.slug}`}>{author.name}</A>
                              <Show when={author.stat?.shouts && author.stat?.shouts > 0}>
                                <span class={styles.articlesCounter}>{author.stat?.shouts}</span>
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

  // ✅ Компонент списка авторов для followers/shouts с дозагрузкой
  const AuthorsSortedList = () => {
    return (
      <div class={clsx(styles.AuthorsList)}>
        <LoadMoreWrapper
          loadFunction={async (offset: number) => {
            const currentLayout = layout()
            if (currentLayout === 'name') return []

            // ✅ Дозагрузка авторов для текущего режима сортировки
            const orderBy = currentLayout === 'followers' ? 'followers' : 'shouts'
            const newAuthors = await loadAuthors({
              by: { order: orderBy },
              limit: 20,
              offset
            })()

            // ✅ Обновляем состояние дозагруженных авторов
            if (newAuthors && newAuthors.length > 0) {
              setLoadedAuthors((prev) => {
                const existingIds = new Set(prev.map((a) => a.id))
                const uniqueNew = newAuthors.filter((a) => !existingIds.has(a.id))
                console.log('[AuthorsSortedList] Adding new authors:', uniqueNew.length)
                return [...prev, ...uniqueNew]
              })
            }

            return newAuthors || []
          }}
          pageSize={20}
          hidden={layout() === 'name'}
        >
          <For each={getAuthorsForLayout()}>
            {(author: Author) => (
              <div class="row">
                <div class="col-lg-20 col-xl-18">
                  <AuthorBadge author={author} />
                </div>
              </div>
            )}
          </For>
        </LoadMoreWrapper>
      </div>
    )
  }

  return (
    <>
      <TabNavigator setSearchQuery={setSearchQuery} />
      <div class="offset-md-5">
        {/* ✅ Простая логика отображения */}
        <Show when={layout() === 'name'} fallback={<AuthorsSortedList />}>
          <AbcNavigator />
          <AbcAuthorsList />
        </Show>
      </div>
    </>
  )
}
