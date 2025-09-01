import { createMemo, createSignal, For, Show } from 'solid-js'
import { LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { SearchField } from '~/components/_shared/SearchField'
import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { useLocalize } from '~/context/localize'
import { loadAuthors } from '~/graphql/api/public'
import { Author, Topic } from '~/graphql/generated/graphql'

type Props = {
  topic: Topic
  authors: Author[]
}

export const TopicAuthorsView = (props: Props) => {
  const { t } = useLocalize()

  // ✅ Состояние для дозагруженных авторов по теме
  const [loadedAuthors, setLoadedAuthors] = createSignal<Author[]>(props.authors || [])
  const [searchQuery, setSearchQuery] = createSignal('')

  // ✅ Фильтрация авторов по поиску
  const filteredAuthors = createMemo(() => {
    const query = searchQuery().trim().toLowerCase()
    if (!query) return loadedAuthors()

    return loadedAuthors().filter(
      (author) => author.name?.toLowerCase().includes(query) || author.slug?.toLowerCase().includes(query)
    )
  })

  return (
    <div class="offset-md-5">
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <h1>
            {t('Authors of topic')} "{props.topic.title || props.topic.slug}"
          </h1>
          <p>{t('Authors who write about this topic')}</p>

          {/* Поле поиска */}
          <div style="margin: 20px 0;">
            <SearchField onChange={(value) => setSearchQuery(value)} />
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <LoadMoreWrapper
            loadFunction={async (offset: number) => {
              // ✅ Дозагрузка авторов по теме (сортировка по количеству публикаций)
              const newAuthors = await loadAuthors({
                by: {
                  topic: props.topic.slug,
                  order: 'shouts'
                },
                limit: 20,
                offset
              })()

              // ✅ Обновляем состояние дозагруженных авторов
              if (newAuthors && newAuthors.length > 0) {
                setLoadedAuthors((prev) => {
                  const existingIds = new Set(prev.map((a) => a.id))
                  const uniqueNew = newAuthors.filter((a) => !existingIds.has(a.id))
                  return [...prev, ...uniqueNew]
                })
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

            {/* Сообщение если нет результатов поиска */}
            <Show when={searchQuery().trim() && filteredAuthors().length === 0}>
              <div class="row">
                <div class="col-24" style="text-align: center; padding: 40px; color: #666;">
                  {t('No authors found for')} "{searchQuery()}"
                </div>
              </div>
            </Show>
          </LoadMoreWrapper>
        </div>
      </div>
    </div>
  )
}
