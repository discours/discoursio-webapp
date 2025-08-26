import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, createResource } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AllAuthorsView } from '~/components/Views/AllAuthorsView'
import { useLocalize } from '~/context/localize'
import { useAuthors } from '~/context/authors'
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
        loadAuthorsAll()().then(result => {
          console.log('[route.load] ✅ loadAuthorsAll результат:', result?.length || 0, 'авторов')
          return result || []
        }),
        loadAuthors({ by: { order: 'followers' }, limit: AUTHORS_PER_PAGE, offset: 0 })().then(result => {
          console.log('[route.load] ✅ loadAuthors followers результат:', result?.length || 0, 'авторов')
          return result || []
        }),
        loadAuthors({ by: { order: 'shouts' }, limit: AUTHORS_PER_PAGE, offset: 0 })().then(result => {
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
        authors: authorsByName,           // ← authors для алфавитного списка
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
        authors: [],                    // ← Исправляем на authors
        authorsByFollowers: [],
        authorsByShouts: [],
        currentLayout: layout
      }
    }
  }
} satisfies RouteDefinition

type AllAuthorsData = {
  authors: Author[]                    // ← Переименовываем в authors
  authorsByFollowers: Author[]
  authorsByShouts: Author[]
  currentLayout: string
}

export default function AllAuthorsPage(props: RouteSectionProps<AllAuthorsData>) {
  const { t } = useLocalize()
  const { addAuthors } = useAuthors()

  // ✅ Отладка - что приходит в компонент
  console.log('[AllAuthorsPage] 🔍 === ДЕТАЛЬНАЯ ОТЛАДКА КОМПОНЕНТА ===')
  console.log('[AllAuthorsPage] props.data:', props.data)
  console.log('[AllAuthorsPage] typeof props.data:', typeof props.data)
  console.log('[AllAuthorsPage] props.data instanceof Promise:', props.data instanceof Promise)
  
  // ✅ ИСПРАВЛЕНИЕ: Используем createResource вместо async createEffect для правильной гидрации
  const [data] = createResource(
    () => props.data,
    async (dataOrPromise) => {
      if (dataOrPromise instanceof Promise) {
        console.log('[AllAuthorsPage] 🔄 Ожидаем Promise...')
        try {
          const resolvedData = await dataOrPromise
          console.log('[AllAuthorsPage] ✅ Promise разрешен:', resolvedData)
          return resolvedData
        } catch (error) {
          console.error('[AllAuthorsPage] ❌ Ошибка Promise:', error)
          throw error
        }
      } else {
        console.log('[AllAuthorsPage] 🔄 props.data не Promise, возвращаем напрямую')
        return dataOrPromise
      }
    },
    { 
      // ✅ Если данные не Promise, используем как начальные для SSR
      initialValue: props.data instanceof Promise ? undefined : props.data
    }
  )

  // ✅ Инициализируем контекст данными из роута
  createEffect(() => {
    const resolvedData = data()
    if (resolvedData?.authors?.length) {
      console.log('[AllAuthorsPage] ✅ Добавляем авторов в контекст:', resolvedData.authors.length)
      addAuthors(resolvedData.authors)
    } else {
      console.log('[AllAuthorsPage] ⏳ Ожидаем данные...')
    }
  })

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All authors')}`}
      desc="List of authors of the open editorial community"
    >
      <AllAuthorsView
        authors={data()?.authors || []}
        authorsByFollowers={data()?.authorsByFollowers || []}
        authorsByShouts={data()?.authorsByShouts || []}
      />
    </PageLayout>
  )
}
