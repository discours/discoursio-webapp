import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { Show, createEffect, createSignal } from 'solid-js'
import { AllTopicsView } from '~/components/Views/AllTopicsView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadTopics } from '~/graphql/api/public'
import { defaultClient } from '~/graphql/client'
import loadTopicsByCommunityQuery from '~/graphql/query/core/topics-by-community'
import { QueryGet_Topics_By_CommunityArgs, Topic } from '~/graphql/schema/core.gen'
import { byTopicStatDesc } from '~/utils/sort'

const TOPICS_PER_PAGE = 50

// Function to fetch topics with pagination using get_topics_by_community
const fetchTopicsWithPagination = async (sortBy: string, offset = 0, limit = TOPICS_PER_PAGE) => {
  try {
    console.log(`[fetchTopicsWithPagination] Requesting ${sortBy} topics, offset: ${offset}, limit: ${limit}`)
    
    const options: QueryGet_Topics_By_CommunityArgs = {
      community_id: 1,
      limit,
      offset
    }
    
    // Используем get_topics_by_community для пагинации
    const resp = await defaultClient.query(loadTopicsByCommunityQuery, options).toPromise()
    const result = resp?.data?.get_topics_by_community as Topic[]
    
    console.log(`[fetchTopicsWithPagination] API returned ${result?.length || 0} topics for ${sortBy}`)
    
    // Если нет результатов с первого запроса, используем fallback
    if (!result?.length && offset === 0) {
      console.log('[fetchTopicsWithPagination] No results from community API, falling back to topics-all')
      const fallbackLoader = loadTopics()
      const fallbackTopics = await fallbackLoader()
      const sortedTopics = (fallbackTopics || []).sort(byTopicStatDesc(sortBy as any))
      const sliced = sortedTopics.slice(offset, offset + limit)
      console.log(`[fetchTopicsWithPagination] Fallback returned ${sliced.length} topics`)
      return sliced
    }

    // Сортируем результат по указанному критерию
    const sortedResult = (result || []).sort(byTopicStatDesc(sortBy as any))
    console.log(`[fetchTopicsWithPagination] Sorted result: ${sortedResult.length} topics`)
    return sortedResult
  } catch (error) {
    console.error('Error fetching topics with pagination:', error)
    return []
  }
}

// Route definition - возвращаем минимальную информацию
export const route = {
  load: async ({ location: { query } }) => {
    return {
      currentLayout: query.by || 'shouts'
    }
  }
} satisfies RouteDefinition

type AllTopicsData = {
  currentLayout: string
}

export default function AllTopicsPage(props: RouteSectionProps<AllTopicsData>) {
  const { t } = useLocalize()
  const { addTopics } = useTopics()
  const [titleTopics, setTitleTopics] = createSignal<Topic[]>([])
  const [authorsTopics, setAuthorsTopics] = createSignal<Topic[]>([])
  const [shoutsTopics, setShoutsTopics] = createSignal<Topic[]>([])
  const [isLoading, setIsLoading] = createSignal(false)

  // Специальная загрузка для вкладки 'title' - все топики сразу без пагинации
  createEffect(() => {
    const layout = props.location.query.by || 'shouts'
    
    if (layout === 'title' && titleTopics().length === 0) {
      const loadTitleTopics = async () => {
        setIsLoading(true)
        try {
          const result = (await loadTopics()()) || []
          setTitleTopics(result)
          addTopics(result)
        } catch (error) {
          console.error('Error loading topics for title layout:', error)
        } finally {
          setIsLoading(false)
        }
      }
      loadTitleTopics()
    }
  })

  // Function to load more topics for authors layout
  const loadMoreAuthors = async (offset: number): Promise<LoadMoreItems> => {
    try {
      console.log('[LoadMoreAuthors] Loading from offset:', offset)
      const result = await fetchTopicsWithPagination('authors', offset, TOPICS_PER_PAGE)
      console.log('[LoadMoreAuthors] Received:', result.length, 'items')
      
      if (result && result.length > 0) {
        // Добавляем топики в контекст для статистики
        addTopics(result)
        // Обновляем локальный стейт для отображения
        if (offset === 0) {
          setAuthorsTopics(result)
        } else {
          setAuthorsTopics(prev => [...prev, ...result])
        }
      }
      
      return result || []
    } catch (error) {
      console.error('Error loading more topics by authors:', error)
      return []
    }
  }

  // Function to load more topics for shouts layout
  const loadMoreShouts = async (offset: number): Promise<LoadMoreItems> => {
    try {
      console.log('[LoadMoreShouts] Loading from offset:', offset)
      const result = await fetchTopicsWithPagination('shouts', offset, TOPICS_PER_PAGE)
      console.log('[LoadMoreShouts] Received:', result.length, 'items')
      
      if (result && result.length > 0) {
        // Добавляем топики в контекст для статистики
        addTopics(result)
        // Обновляем локальный стейт для отображения
        if (offset === 0) {
          setShoutsTopics(result)
        } else {
          setShoutsTopics(prev => [...prev, ...result])
        }
      }
      
      return result || []
    } catch (error) {
      console.error('Error loading more topics by shouts:', error)
      return []
    }
  }

  const currentLayout = () => props.location.query.by || 'shouts'

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All topics')}`}
      desc="All topics of the editorial community"
    >
      <Show when={currentLayout() === 'authors'}>
        <LoadMoreWrapper
          loadFunction={loadMoreAuthors}
          pageSize={TOPICS_PER_PAGE}
          useScrollTrigger={false}
        >
          <AllTopicsView
            isLoaded={true}
            topics={authorsTopics()}
          />
        </LoadMoreWrapper>
      </Show>

      <Show when={currentLayout() === 'shouts'}>
        <LoadMoreWrapper
          loadFunction={loadMoreShouts}
          pageSize={TOPICS_PER_PAGE}
          useScrollTrigger={false}
        >
          <AllTopicsView
            isLoaded={true}
            topics={shoutsTopics()}
          />
        </LoadMoreWrapper>
      </Show>

      <Show when={currentLayout() === 'title'}>
        <Show when={!isLoading()} fallback={<Loading />}>
          <AllTopicsView
            isLoaded={!isLoading()}
            topics={titleTopics()}
          />
        </Show>
      </Show>
    </PageLayout>
  )
}
