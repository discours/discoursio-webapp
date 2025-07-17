import { createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { useAuthors } from '~/context/authors'
import { useFeaturedFeed } from '~/context/featured'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { FeedDeduplicationContext } from '~/utils/deduplicate'
import { compareServerClientDOM } from '~/utils/hydration-comparator'
import { paginate } from '~/utils/paginate'
import { ArticleCardSwiper } from '../_shared/SolidSwiper/ArticleCardSwiper'
import Banner from '../Discours/Banner'
import Hero from '../Discours/Hero'
import { Beside } from '../Feed/Beside'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'
import { Row5 } from '../Feed/Row5'
import RowShort from '../Feed/RowShort'
import { TopicShoutsGroup } from '../Feed/TopicShoutsGroup'
import { TopicsNav } from '../HeaderNav/TopicsNav'

import '~/styles/views/Home.module.scss'

export const RANDOM_TOPICS_COUNT = 12
export const RANDOM_TOPIC_SHOUTS_COUNT = 7
const CLIENT_LOAD_ARTICLES_COUNT = 29
const SHOUTS_PER_PAGE = 16 // Row1 + Row3 + Row2 + Beside (3 + 1) + Row1 + Row 2 + Row3
const MIN_SHOUTS_FOR_FULL_VIEW = 6 // Минимальное количество статей для показа дополнительных блоков

export interface HomeViewProps {
  featuredShouts: Shout[]
  topRatedShouts: Shout[]
  topMonthShouts: Shout[]
  topViewedShouts: Shout[]
  topCommentedShouts: Shout[]
}

export const HomeView = (props: HomeViewProps) => {
  const { t } = useLocalize()
  const { topAuthors, addAuthors } = useAuthors()
  const { topTopics } = useTopics()
  const { randomTopicFeed } = useFeaturedFeed()

  // Флаг для отслеживания завершения гидрации
  const [isHydrated, setIsHydrated] = createSignal(isServer)

  // После монтирования компонента отмечаем что гидрация завершена
  onMount(() => {
    setIsHydrated(true)
  })

  // Создаем сигналы для отслеживания гидрации
  const [hydrationDebug, setHydrationDebug] = createSignal({
    serverProps: null,
    clientProps: null,
    hydrationIssues: []
  } as Record<string, any>)

  // Расширенная диагностика гидрации
  createEffect(() => {
    if (typeof window !== 'undefined') {
      const serverPropsSnapshot = JSON.stringify({
        featuredShouts: props.featuredShouts?.map((s) => s.id),
        topRatedShouts: props.topRatedShouts?.map((s) => s.id)
      })

      const clientPropsSnapshot = JSON.stringify({
        featuredShouts: props.featuredShouts?.map((s) => s.id),
        topRatedShouts: props.topRatedShouts?.map((s) => s.id)
      })

      const hydrationIssues = []

      // Проверка контекстов
      const randomTopicFeedValue = randomTopicFeed()
      if (!randomTopicFeedValue) {
        hydrationIssues.push('Отсутствие randomTopicFeed на клиенте')
      }

      setHydrationDebug({
        serverProps: serverPropsSnapshot,
        clientProps: clientPropsSnapshot,
        hydrationIssues
      })

      // Логирование для консоли разработчика
      console.group('🔍 Solid Start Hydration Debug')
      console.log('Server Props:', serverPropsSnapshot)
      console.log('Client Props:', clientPropsSnapshot)
      console.log('Hydration Issues:', hydrationIssues)
      console.groupEnd()
    }
  })

  onMount(() => {
    props.featuredShouts?.forEach((s: Shout) => addAuthors((s?.authors || []) as Author[]))
    props.topRatedShouts?.forEach((s: Shout) => addAuthors((s?.authors || []) as Author[]))
  })

  const pages = createMemo<Shout[][]>(() =>
    paginate(props.featuredShouts || [], SHOUTS_PER_PAGE + CLIENT_LOAD_ARTICLES_COUNT, SHOUTS_PER_PAGE)
  )

  // Стабилизируем условие для предотвращения ошибок гидрации
  // Проверяем наличие данных вместо минимального количества
  const hasMoreShouts = createMemo(() => {
    const featured = props.featuredShouts || []
    // Используем более стабильное условие - проверяем наличие данных
    return featured.length > 0 && featured.length >= MIN_SHOUTS_FOR_FULL_VIEW
  })

  // Система дедупликации для предотвращения повторов публикаций
  const deduplicatedBlocks = createMemo(
    () => {
      const dedupContext = new FeedDeduplicationContext()

      // Обеспечиваем консистентность между сервером и клиентом
      const featured = props.featuredShouts || []
      const topRated = props.topRatedShouts || []
      const topMonth = props.topMonthShouts || []
      const topViewed = props.topViewedShouts || []
      const topCommented = props.topCommentedShouts || []

      // Стабильный доступ к randomTopicFeed
      // Возвращаем данные только после завершения гидрации на клиенте
      const randomTopicData = randomTopicFeed()
      const randomTopic = isHydrated() && randomTopicData?.shouts ? randomTopicData.shouts : []

      // Проверяем наличие минимального количества данных для стабильности
      if (featured.length < MIN_SHOUTS_FOR_FULL_VIEW) {
        return {
          mainFeaturedFirst: featured,
          remainingFeatured: [],
          topRated: [],
          topMonth: [],
          topViewed: [],
          topCommented: [],
          randomTopic: []
        }
      }

      // Основная лента - приоритет для первых публикаций
      const mainFeaturedFirst = featured.slice(0, 29) // Первые 29 публикаций имеют приоритет
      dedupContext.addUsedShouts(mainFeaturedFirst)

      // Дедуплицируем дополнительные блоки
      const deduplicatedTopRated = dedupContext.filterUnused(topRated)
      const deduplicatedTopMonth = dedupContext.filterUnused(topMonth)
      const deduplicatedTopViewed = dedupContext.filterUnused(topViewed.slice(0, 5))
      const deduplicatedTopCommented = dedupContext.filterUnused(topCommented.slice(0, 3))
      const deduplicatedRandomTopic = dedupContext.filterUnused(randomTopic)

      // Добавляем использованные из дополнительных блоков
      dedupContext.addUsedShouts(deduplicatedTopRated.slice(0, 10)) // Лимитируем слайдер
      dedupContext.addUsedShouts(deduplicatedTopMonth.slice(0, 10)) // Лимитируем слайдер
      dedupContext.addUsedShouts(deduplicatedTopViewed)
      dedupContext.addUsedShouts(deduplicatedTopCommented)
      dedupContext.addUsedShouts(deduplicatedRandomTopic.slice(0, 7)) // Лимитируем случайную тему

      // Остальная лента (после первых 29)
      const remainingFeatured = dedupContext.filterUnused(featured.slice(29))

      return {
        mainFeaturedFirst,
        remainingFeatured,
        topRated: deduplicatedTopRated,
        topMonth: deduplicatedTopMonth,
        topViewed: deduplicatedTopViewed,
        topCommented: deduplicatedTopCommented,
        randomTopic: deduplicatedRandomTopic
      }
    },
    {
      mainFeaturedFirst: [],
      remainingFeatured: [],
      topRated: [],
      topMonth: [],
      topViewed: [],
      topCommented: [],
      randomTopic: []
    }
  )

  // Добавляем вызов сравнения DOM
  createEffect(() => {
    if (typeof window !== 'undefined') {
      compareServerClientDOM()
    }
  })

  return (
    <div data-server-rendered="true">
      <TopicsNav />
      <Row5 articles={(deduplicatedBlocks().mainFeaturedFirst || []).slice(0, 5)} nodate={true} />
      <Hero />

      {/* Условие стабилизировано для предотвращения ошибок гидрации */}
      <Show when={hasMoreShouts()}>
        <>
          <Show when={deduplicatedBlocks().mainFeaturedFirst[5]}>
            <Beside
              beside={deduplicatedBlocks().mainFeaturedFirst[5]}
              title={t('Top viewed')}
              values={deduplicatedBlocks().topViewed}
              wrapper={'top-article'}
              nodate={true}
            />
          </Show>
          <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 6}>
            <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(6, 9)} nodate={true} />
          </Show>
          <Show when={deduplicatedBlocks().mainFeaturedFirst[9]}>
            <Beside
              beside={deduplicatedBlocks().mainFeaturedFirst[9]}
              title={t('Top authors')}
              values={topAuthors?.() || []}
              wrapper={'author'}
              nodate={true}
            />
          </Show>

          <Show when={deduplicatedBlocks().topMonth.length > 0}>
            <ArticleCardSwiper title={t('Top month')} slides={deduplicatedBlocks().topMonth.slice(0, 10)} />
          </Show>

          <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 10}>
            <Row2 articles={deduplicatedBlocks().mainFeaturedFirst.slice(10, 12)} nodate={true} />
          </Show>
          <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 12}>
            <RowShort articles={deduplicatedBlocks().mainFeaturedFirst.slice(12, 16)} />
          </Show>
          <Show when={deduplicatedBlocks().mainFeaturedFirst[16]}>
            <Row1 article={deduplicatedBlocks().mainFeaturedFirst[16]} nodate={true} />
          </Show>
          <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 17}>
            <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(17, 20)} nodate={true} />
          </Show>

          <Show when={deduplicatedBlocks().topCommented.length > 0}>
            <Row3
              articles={deduplicatedBlocks().topCommented.slice(0, 3)}
              header={<h2>{t('Top commented')}</h2>}
              nodate={true}
            />
          </Show>

          {/* Показываем блок случайной темы только после завершения гидрации */}
          <Show
            when={isHydrated() && randomTopicFeed()?.topic && deduplicatedBlocks().randomTopic.length > 0}
          >
            <TopicShoutsGroup
              shouts={deduplicatedBlocks().randomTopic.slice(0, 7)}
              topic={randomTopicFeed()?.topic as Topic}
            />
          </Show>

          <Show when={deduplicatedBlocks().topRated.length > 0}>
            <ArticleCardSwiper title={t('Favorite')} slides={deduplicatedBlocks().topRated.slice(0, 10)} />
          </Show>

          <Show when={deduplicatedBlocks().mainFeaturedFirst.length > SHOUTS_PER_PAGE}>
            <>
              <Show when={deduplicatedBlocks().mainFeaturedFirst[20]}>
                <Beside
                  beside={deduplicatedBlocks().mainFeaturedFirst[20]}
                  title={t('Top topics')}
                  values={topTopics()?.slice(0, 5) || []}
                  wrapper={'topic'}
                  isTopicCompact={true}
                  nodate={true}
                />
              </Show>
              <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 21}>
                <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(21, 24)} nodate={true} />
              </Show>
              <Banner />
              <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 24}>
                <Row2 articles={deduplicatedBlocks().mainFeaturedFirst.slice(24, 26)} nodate={true} />
              </Show>
              <Show when={deduplicatedBlocks().mainFeaturedFirst.length > 26}>
                <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(26, 29)} nodate={true} />
              </Show>
            </>
          </Show>
        </>
      </Show>

      {/* Пагинированные страницы (дедуплицированные) - стабилизировано для гидрации */}
      <Show when={hasMoreShouts()}>
        <For each={pages()}>
          {(_page, pageIndex) => {
            const startIndex = pageIndex() * SHOUTS_PER_PAGE
            const deduplicatedPage = deduplicatedBlocks().remainingFeatured.slice(
              startIndex,
              startIndex + SHOUTS_PER_PAGE
            )

            // Используем Show для стабильной структуры DOM
            return (
              <Show when={deduplicatedPage.length > 0}>
                <>
                  <Show when={deduplicatedPage[0]}>
                    <Row1 article={deduplicatedPage[0]} nodate={true} />
                  </Show>
                  <Show when={deduplicatedPage.length > 1}>
                    <Row3 articles={deduplicatedPage.slice(1, 4)} nodate={true} />
                  </Show>
                  <Show when={deduplicatedPage.length > 4}>
                    <Row2 articles={deduplicatedPage.slice(4, 6)} nodate={true} />
                  </Show>
                  <Show when={deduplicatedPage.length > 6 && deduplicatedPage[9]}>
                    <Beside
                      values={deduplicatedPage.slice(6, 9)}
                      beside={deduplicatedPage[9]}
                      wrapper="article"
                      nodate={true}
                    />
                  </Show>
                  <Show when={deduplicatedPage[10]}>
                    <Row1 article={deduplicatedPage[10]} nodate={true} />
                  </Show>
                  <Show when={deduplicatedPage.length > 11}>
                    <Row2 articles={deduplicatedPage.slice(11, 13)} nodate={true} />
                  </Show>
                  <Show when={deduplicatedPage.length > 13}>
                    <Row3 articles={deduplicatedPage.slice(13, 16)} nodate={true} />
                  </Show>
                </>
              </Show>
            )
          }}
        </For>
      </Show>
    </div>
  )
}
