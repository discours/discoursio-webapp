import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, createSignal, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AllTopicsView } from '~/components/Views/AllTopicsView'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadTopics } from '~/graphql/api/public'
import { defaultClient } from '~/graphql/client'
import { QueryGet_Topics_By_CommunityArgs, Topic } from '~/graphql/generated/graphql'
import loadTopicsByCommunityQuery from '~/graphql/query/core/topics-by-community'
import { byTopicStatDesc } from '~/utils/sort'

const TOPICS_PER_PAGE = 50

// Function to fetch topics with pagination using get_topics_by_community
const fetchTopics = async (sortBy: string, offset = 0, limit = TOPICS_PER_PAGE) => {
  try {
    console.log(`[fetchTopics] Requesting ${sortBy} topics, offset: ${offset}, limit: ${limit}`)

    const options: QueryGet_Topics_By_CommunityArgs = {
      community_id: 1,
      limit,
      offset
    }

    // Используем get_topics_by_community для пагинации
    const resp = await defaultClient.query(loadTopicsByCommunityQuery, options).toPromise()
    const result = resp?.data?.get_topics_by_community as Topic[]

    console.log(`[fetchTopics] API returned ${result?.length || 0} topics for ${sortBy}`)

    // Если нет результатов с первого запроса, используем fallback
    if (!result?.length && offset === 0) {
      console.log('[fetchTopics] No results from community API, falling back to topics-all')
      const fallbackLoader = loadTopics()
      const fallbackTopics = await fallbackLoader()
      const sortedTopics = (fallbackTopics || []).sort(byTopicStatDesc(sortBy) as (a: Topic, b: Topic) => number)
      const sliced = sortedTopics.slice(offset, offset + limit)
      console.log(`[fetchTopics] Fallback returned ${sliced.length} topics`)
      return sliced
    }

    // Сортируем результат по указанному критерию
    const sortedResult = (result || []).sort(byTopicStatDesc(sortBy) as (a: Topic, b: Topic) => number)
    console.log(`[fetchTopics] Sorted result: ${sortedResult.length} topics`)
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
  const { setTopicsSort } = useTopics()
  
  // ✅ Устанавливаем сортировку в контексте на основе URL
  createEffect(() => {
    const layout = props.location.query.by || 'shouts'
    console.log('[AllTopicsPage] Setting topics sort to:', layout)
    setTopicsSort(layout as string)
  })

  const currentLayout = () => props.location.query.by || 'shouts'

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All topics')}`}
      desc="All topics of the editorial community"
    >
      {/* ✅ Простой роут - компонент получает данные из контекста */}
      <AllTopicsView 
        isLoaded={true} 
        layout={currentLayout() as string} 
      />
    </PageLayout>
  )
}
