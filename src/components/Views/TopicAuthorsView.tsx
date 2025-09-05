import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { useLocalize } from '~/context/localize'
import { loadAuthors } from '~/graphql/api/public'
import { Author, Topic } from '~/graphql/generated/graphql'

type Props = {
  topic: Topic
  authors: Author[]
  searchQuery?: string
  onSearchChange?: (value: string) => void
  onLoadMore?: (offset: number) => Promise<Author[]>
}

export const TopicAuthorsView = (props: Props) => {
  const { t } = useLocalize()

  // ✅ Безопасная инициализация авторов
  const initialAuthors = Array.isArray(props.authors) ? props.authors : []
  const [loadedAuthors, setLoadedAuthors] = createSignal<Author[]>(initialAuthors)

  // ⚡ КРИТИЧНО: Обновляем когда приходят новые авторы
  createEffect(() => {
    if (props.authors && props.authors.length > 0) {
      setLoadedAuthors(props.authors)
    }
  })

  // ✅ Используем внешний searchQuery если передан, иначе локальный
  const searchQuery = () => props.searchQuery ?? ''

  // ✅ Безопасная фильтрация авторов по поиску
  const filteredAuthors = createMemo(() => {
    const authors = loadedAuthors()
    const authorsArray = Array.isArray(authors) ? authors : []
    const query = searchQuery().trim().toLowerCase()

    if (!query) return authorsArray

    return authorsArray.filter(
      (author) => author?.name?.toLowerCase().includes(query) || author?.slug?.toLowerCase().includes(query)
    )
  })

  return (
    <div class="wide-container">
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <Show
            when={filteredAuthors().length > 0}
            fallback={
              <div style="text-align: center; padding: 40px; color: #666;">
                <Show
                  when={searchQuery().trim()}
                  fallback={
                    <div>
                      <h3 style="margin-bottom: 1rem; color: #666;">{t('No authors found')}</h3>
                      <p style="color: #999;">{t('This topic has no authors yet')}</p>
                    </div>
                  }
                >
                  <p>
                    {t('No authors found for')} "{searchQuery()}"
                  </p>
                </Show>
              </div>
            }
          >
            <LoadMoreWrapper
              loadFunction={async (offset: number) => {
                console.log(`[TopicAuthorsView] LoadMoreWrapper calling loadFunction with offset: ${offset}`)

                // Используем переданную функцию или fallback
                if (props.onLoadMore) {
                  const result = await props.onLoadMore(offset)
                  console.log(`[TopicAuthorsView] onLoadMore returned ${result?.length} authors`)
                  return result || []
                }

                // Fallback - прямой вызов API
                const newAuthors = await loadAuthors({
                  by: { topic: props.topic.slug },
                  limit: 20,
                  offset
                })()

                if (newAuthors?.length) {
                  console.log(`[TopicAuthorsView] Fallback loaded ${newAuthors.length} authors`)
                  setLoadedAuthors((prev) => [...prev, ...newAuthors])
                }
                return newAuthors || []
              }}
              pageSize={20}
            >
              <For each={filteredAuthors()}>
                {(author: Author) => (
                  <div class="row">
                    <div class="col-24">
                      <AuthorBadge author={author} />
                    </div>
                  </div>
                )}
              </For>
            </LoadMoreWrapper>
          </Show>
        </div>
      </div>
    </div>
  )
}
