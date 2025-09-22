import { createEffect, createMemo, For, onMount, Show } from 'solid-js'
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
  const { featuredFeed, topMonthFeed, topFeed, topCommentedFeed, randomTopicFeed } = useFeaturedFeed()

  // Диагностика состояния данных
  createEffect(() => {
    if (import.meta.env.DEV && !props.featuredShouts?.length) {
      console.log('[HomeView] NO DATA RECEIVED FROM PROPS')
    }
  })

  // Диагностика загрузки случайных тем (только в dev)
  createEffect(() => {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      const randomTopicFeedValue = randomTopicFeed()

      if (randomTopicFeedValue) {
        console.log('✅ HomeView: randomTopicFeed загружен:', randomTopicFeedValue.topic.slug)
      }
    }
  })

  onMount(() => {
    props.featuredShouts?.forEach((s: Shout) => {
      addAuthors((s?.authors || []) as Author[])
    })
    props.topRatedShouts?.forEach((s: Shout) => {
      addAuthors((s?.authors || []) as Author[])
    })
  })

  const pages = createMemo<Shout[][]>(() => {
    const featured = featuredFeed() || props.featuredShouts || []
    return paginate(featured, SHOUTS_PER_PAGE + CLIENT_LOAD_ARTICLES_COUNT, SHOUTS_PER_PAGE)
  })

  // 🔧 ИСПРАВЛЕНО: Более мягкое условие для предотвращения бесконечных плейсхолдеров
  const hasMoreShouts = createMemo(() => {
    const featured = featuredFeed() || props.featuredShouts || []
    // Достаточно если есть хотя бы несколько статей (снижаем порог)
    const threshold = Math.min(MIN_SHOUTS_FOR_FULL_VIEW, 3) // Минимум 3 вместо 6
    return featured.length >= threshold
  })

  // Система дедупликации для предотвращения повторов публикаций
  const deduplicatedBlocks = createMemo(
    () => {
      const dedupContext = new FeedDeduplicationContext()

      // ✅ Используем данные из контекста (обновляются при дозагрузке) с fallback на props
      const featured = featuredFeed() || props.featuredShouts || []
      const topRated = topFeed() || props.topRatedShouts || []
      const topMonth = topMonthFeed() || props.topMonthShouts || []
      const topViewed = props.topViewedShouts || [] // Пока только из props
      const topCommented = topCommentedFeed() || props.topCommentedShouts || []

      // randomTopic теперь чисто клиентский - не участвует в SSR дедупликации

      // 🔧 ИСПРАВЛЕНО: Снижаем порог для показа контента
      const threshold = Math.min(MIN_SHOUTS_FOR_FULL_VIEW, 3)
      if (featured.length < threshold) {
        // Показываем хотя бы то что есть, вместо полного скрытия
        return {
          mainFeaturedFirst: featured, // Показываем все доступные статьи
          remainingFeatured: [],
          topRated: topRated.slice(0, 5), // Показываем хотя бы часть дополнительного контента
          topMonth: topMonth.slice(0, 5),
          topViewed: topViewed.slice(0, 3),
          topCommented: topCommented.slice(0, 3)
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
      // randomTopic больше не дедуплицируется - чисто клиентский

      // Добавляем использованные из дополнительных блоков
      dedupContext.addUsedShouts(deduplicatedTopRated.slice(0, 10)) // Лимитируем слайдер
      dedupContext.addUsedShouts(deduplicatedTopMonth.slice(0, 10)) // Лимитируем слайдер
      dedupContext.addUsedShouts(deduplicatedTopViewed)
      dedupContext.addUsedShouts(deduplicatedTopCommented)
      // randomTopic больше не участвует в дедупликации

      // Остальная лента (после первых 29)
      const remainingFeatured = dedupContext.filterUnused(featured.slice(29))

      return {
        mainFeaturedFirst,
        remainingFeatured,
        topRated: deduplicatedTopRated,
        topMonth: deduplicatedTopMonth,
        topViewed: deduplicatedTopViewed,
        topCommented: deduplicatedTopCommented
      }
    },
    {
      mainFeaturedFirst: [],
      remainingFeatured: [],
      topRated: [],
      topMonth: [],
      topViewed: [],
      topCommented: []
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
            <Row3 articles={deduplicatedBlocks().topCommented.slice(0, 3)} nodate={true} />
          </Show>

          {/* ✅ Случайная тема - ТОЛЬКО клиентский рендер через onMount флаг */}
          <Show when={!isServer && randomTopicFeed()?.shouts && randomTopicFeed()?.topic}>
            <TopicShoutsGroup
              shouts={randomTopicFeed()?.shouts.slice(0, 7) || []}
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
