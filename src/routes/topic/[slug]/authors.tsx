import { RouteDefinition, RouteSectionProps } from '@solidjs/router'
import { createMemo } from 'solid-js'
import { TopicAuthorsView } from '~/components/Views/TopicAuthorsView'
import { loadAuthors, loadTopics } from '~/graphql/api/public'
import { Author, Topic } from '~/graphql/generated/graphql'

type RouteData = {
  topic: Topic
  authors: Author[]
}

export const route = {
  load: async ({ params }) => {
    try {
      const slug = params.slug

      // ✅ Загружаем тему
      const topicsLoader = loadTopics()
      const topics = await topicsLoader()

      const topicsMap: Record<string, Topic> = {}
      for (const topic of topics) {
        topicsMap[topic.slug] = topic
      }

      const topic = topicsMap[slug]
      if (!topic) {
        throw new Error(`Topic ${slug} not found`)
      }

      // ✅ Загружаем авторов темы (сортировка по публикациям)
      const authorsLoader = loadAuthors({
        by: { topic: slug, order: 'shouts' },
        limit: 20
      })
      const authors = (await authorsLoader()) || []

      const data: RouteData = {
        topic,
        authors
      }

      return data
    } catch (error) {
      console.error('[topic/authors] Load error:', error)
      throw error
    }
  }
} satisfies RouteDefinition

export default function TopicAuthorsPage(props: RouteSectionProps<RouteData>) {
  // ✅ Мемоизированные данные для стабильности
  const topic = createMemo(() => props.data.topic)
  const authors = createMemo(() => props.data.authors || [])

  return <TopicAuthorsView topic={topic()} authors={authors()} />
}
