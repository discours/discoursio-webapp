import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AllTopicsView } from '~/components/Views/AllTopicsView'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
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

    // Сортируем результат по указанному критерию
    const sortedResult = (result || []).sort(byTopicStatDesc(sortBy) as (a: Topic, b: Topic) => number)
    console.log(`[fetchTopics] Sorted result: ${sortedResult.length} topics`)
    return sortedResult
  } catch (error) {
    console.error('Error fetching topics with pagination:', error)
    return []
  }
}

// ✅ Route definition - загружаем топики для SSR через fetchTopics
export const route = {
  load: async ({ location: { query } }) => {
    const layout = query.by || 'shouts'
    console.log('[route.load] Loading topics for SSR, layout:', layout)

    try {
      // ✅ Используем fetchTopics для SSR загрузки
      const topics = await fetchTopics(layout as string, 0, TOPICS_PER_PAGE)
      console.log('[route.load] Loaded topics for SSR:', topics.length)

      return {
        topics,
        currentLayout: layout
      }
    } catch (error) {
      console.error('[route.load] Error loading topics:', error)
      return {
        topics: [],
        currentLayout: layout
      }
    }
  }
} satisfies RouteDefinition

type AllTopicsData = {
  topics: Topic[]
  currentLayout: string
}

export default function AllTopicsPage(props: RouteSectionProps<AllTopicsData>) {
  const { t } = useLocalize()
  const { setTopicsSort, addTopics } = useTopics()

  // ✅ SSR данные - добавляем топики в контекст синхронно
  if (props.data?.topics?.length) {
    console.log('[AllTopicsPage] Adding SSR topics to context:', props.data.topics.length)
    addTopics(props.data.topics)
  }

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
      <AllTopicsView isLoaded={true} layout={currentLayout() as string} />
    </PageLayout>
  )
}
