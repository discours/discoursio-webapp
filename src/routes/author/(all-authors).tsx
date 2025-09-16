import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, createResource } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AllAuthorsView } from '~/components/Views/AllAuthorsView'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { loadAuthors, loadAuthorsAll } from '~/graphql/api/public'
import { Author } from '~/graphql/generated/graphql'

const AUTHORS_PER_PAGE = 20

// ✅ Route definition - загружаем только начальные данные для SSR
export const route = {
  load: async ({ location: { query } }) => {
    const layout = query.by || 'shouts'
    console.log('[route.load] 🔍 === ДЕТАЛЬНАЯ ОТЛАДКА ROUTE.LOAD ===')
    console.log('[route.load] Loading initial authors data for layout:', layout)

    // ✅ Загружаем ВСЕ три выборки данных параллельно для стабильной гидратации:
    // 1. По алфавиту (name) - используем loadAuthorsAll для полного списка без статистики
    // 2. По количеству фолловеров - топ 20 для режима "followers"
    // 3. По количеству публикаций - топ 20 для режима "shouts"

    console.log('[route.load] 🚀 Начинаем загрузку данных...')

    try {
      const [authorsByName, authorsByFollowers, authorsByShouts] = await Promise.all([
        loadAuthorsAll()().then((result) => {
          console.log('[route.load] ✅ loadAuthorsAll результат:', result?.length || 0, 'авторов')
          return result || []
        }),
        loadAuthors({ by: { order: 'followers' }, limit: AUTHORS_PER_PAGE, offset: 0 })().then((result) => {
          console.log('[route.load] ✅ loadAuthors followers результат:', result?.length || 0, 'авторов')
          return result || []
        }),
        loadAuthors({ by: { order: 'shouts' }, limit: AUTHORS_PER_PAGE, offset: 0 })().then((result) => {
          console.log('[route.load] ✅ loadAuthors shouts результат:', result?.length || 0, 'авторов')
          return result || []
        })
      ])

      console.log('[route.load] 📊 Итоговые данные:', {
        authors: authorsByName.length,
        authorsByFollowers: authorsByFollowers.length,
        authorsByShouts: authorsByShouts.length
      })

      const result = {
        authors: authorsByName, // ← authors для алфавитного списка
        authorsByFollowers,
        authorsByShouts,
        currentLayout: layout
      }

      console.log('[route.load] 🔍 === ВОЗВРАЩАЕМЫЕ ДАННЫЕ ===')
      // console.log('[route.load] Результат:', result)
      console.log('[route.load] authors.length:', result.authors?.length)
      console.log('[route.load] authorsByFollowers.length:', result.authorsByFollowers?.length)
      console.log('[route.load] authorsByShouts.length:', result.authorsByShouts?.length)

      return result
    } catch (error) {
      console.error('[route.load] ❌ Ошибка загрузки данных:', error)
      return {
        authors: [], // ← Исправляем на authors
        authorsByFollowers: [],
        authorsByShouts: [],
        currentLayout: layout
      }
    }
  }
} satisfies RouteDefinition

type AllAuthorsData = {
  authors: Author[] // ← Переименовываем в authors
  authorsByFollowers: Author[]
  authorsByShouts: Author[]
  currentLayout: string
}

export default function AllAuthorsPage(props: RouteSectionProps<AllAuthorsData>) {
  const { t } = useLocalize()
  const { addAuthors } = useAuthors()

  // ✅  props.data может быть Promise в SolidStart!
  const [data] = createResource(
    () => props.data,
    async (routeData) => {
      // Разрешаем Promise если это Promise
      const resolvedData = routeData instanceof Promise ? await routeData : routeData

      console.log('[AllAuthorsPage] Resolved route data:', {
        hasAuthors: !!resolvedData?.authors?.length,
        hasFollowers: !!resolvedData?.authorsByFollowers?.length,
        hasShouts: !!resolvedData?.authorsByShouts?.length
      })

      // Если SSR данные есть, возвращаем их
      if (
        resolvedData &&
        (resolvedData.authors?.length ||
          resolvedData.authorsByFollowers?.length ||
          resolvedData.authorsByShouts?.length)
      ) {
        console.log('[AllAuthorsPage] Using SSR data from route.load')
        return resolvedData
      }

      // Иначе загружаем на клиенте
      console.log('[AllAuthorsPage] Loading data on client')
      const [authorsByName, authorsByFollowers, authorsByShouts] = await Promise.all([
        loadAuthorsAll()(),
        loadAuthors({ by: { order: 'followers' }, limit: 20 })(),
        loadAuthors({ by: { order: 'shouts' }, limit: 20 })()
      ])

      return {
        authors: authorsByName || [],
        authorsByFollowers: authorsByFollowers || [],
        authorsByShouts: authorsByShouts || [],
        currentLayout: 'shouts'
      }
    },
    {
      // ✅  initialValue для стабильной гидрации
      initialValue:
        typeof props.data === 'object' && !('then' in props.data)
          ? props.data
          : { authors: [], authorsByFollowers: [], authorsByShouts: [], currentLayout: 'shouts' }
    }
  )

  // ✅ Обновляем контекст ТОЛЬКО после получения данных (предотвращаем циклы)
  createEffect(() => {
    const authorsData = data()
    if (
      authorsData &&
      (authorsData.authors?.length || authorsData.authorsByFollowers?.length || authorsData.authorsByShouts?.length)
    ) {
      console.log('[AllAuthorsPage] Adding authors to context:', {
        authors: authorsData.authors?.length || 0,
        followers: authorsData.authorsByFollowers?.length || 0,
        shouts: authorsData.authorsByShouts?.length || 0
      })
      // ✅ Добавляем все типы авторов в контекст для кеширования
      addAuthors([
        ...(authorsData.authors || []),
        ...(authorsData.authorsByFollowers || []),
        ...(authorsData.authorsByShouts || [])
      ])
    }
  })

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All authors')}`}
      desc="List of authors of the open editorial community"
    >
      <AllAuthorsView
        // ✅ Передаем реактивные данные из createResource
        authors={data()?.authors || []}
        authorsByFollowers={data()?.authorsByFollowers || []}
        authorsByShouts={data()?.authorsByShouts || []}
      />
    </PageLayout>
  )
}
