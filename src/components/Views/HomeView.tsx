import { createMemo, For, onMount, Show } from 'solid-js'
import { useAuthors } from '~/context/authors'
import { useFeaturedFeed } from '~/context/featured'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import { FeedDeduplicationContext } from '~/utils/deduplicate'
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

  onMount(() => {
    props.featuredShouts?.forEach((s: Shout) => addAuthors((s?.authors || []) as Author[]))
    props.topRatedShouts?.forEach((s: Shout) => addAuthors((s?.authors || []) as Author[]))
  })

  const pages = createMemo<Shout[][]>(() =>
    paginate(props.featuredShouts || [], SHOUTS_PER_PAGE + CLIENT_LOAD_ARTICLES_COUNT, SHOUTS_PER_PAGE)
  )

  const hasMoreShouts = createMemo(() => (props.featuredShouts || []).length >= MIN_SHOUTS_FOR_FULL_VIEW)

  // Система дедупликации для предотвращения повторов публикаций
  const deduplicatedBlocks = createMemo(() => {
    const dedupContext = new FeedDeduplicationContext()

    const featured = props.featuredShouts || []
    const topRated = props.topRatedShouts || []
    const topMonth = props.topMonthShouts || []
    const topViewed = props.topViewedShouts || []
    const topCommented = props.topCommentedShouts || []
    const randomTopic = randomTopicFeed()?.shouts || []

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
  })

  return (
    <>
      <TopicsNav />
      <Row5 articles={(deduplicatedBlocks().mainFeaturedFirst || []).slice(0, 5)} nodate={true} />
      <Hero />

      {/* Если нет featuredShouts — не рендерим остальные секции вообще */}
      <Show when={hasMoreShouts()}>
        <>
          <Beside
            beside={deduplicatedBlocks().mainFeaturedFirst[5]}
            title={t('Top viewed')}
            values={deduplicatedBlocks().topViewed}
            wrapper={'top-article'}
            nodate={true}
          />
          <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(6, 9)} nodate={true} />
          <Beside
            beside={deduplicatedBlocks().mainFeaturedFirst[9]}
            title={t('Top authors')}
            values={topAuthors?.() || []}
            wrapper={'author'}
            nodate={true}
          />

          {deduplicatedBlocks().topMonth.length > 0 && (
            <ArticleCardSwiper title={t('Top month')} slides={deduplicatedBlocks().topMonth.slice(0, 10)} />
          )}

          <Row2 articles={deduplicatedBlocks().mainFeaturedFirst.slice(10, 12)} nodate={true} />
          <RowShort articles={deduplicatedBlocks().mainFeaturedFirst.slice(12, 16)} />
          <Row1 article={deduplicatedBlocks().mainFeaturedFirst[16]} nodate={true} />
          <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(17, 20)} nodate={true} />

          {deduplicatedBlocks().topCommented.length > 0 && (
            <Row3
              articles={deduplicatedBlocks().topCommented.slice(0, 3)}
              header={<h2>{t('Top commented')}</h2>}
              nodate={true}
            />
          )}

          <TopicShoutsGroup
            shouts={deduplicatedBlocks().randomTopic.slice(0, 7)}
            topic={randomTopicFeed()?.topic as Topic}
          />

          {deduplicatedBlocks().topRated.length > 0 && (
            <ArticleCardSwiper title={t('Favorite')} slides={deduplicatedBlocks().topRated.slice(0, 10)} />
          )}

          {deduplicatedBlocks().mainFeaturedFirst.length > SHOUTS_PER_PAGE && (
            <>
              <Beside
                beside={deduplicatedBlocks().mainFeaturedFirst[20]}
                title={t('Top topics')}
                values={topTopics().slice(0, 5)}
                wrapper={'topic'}
                isTopicCompact={true}
                nodate={true}
              />
              <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(21, 24)} nodate={true} />
              <Banner />
              <Row2 articles={deduplicatedBlocks().mainFeaturedFirst.slice(24, 26)} nodate={true} />
              <Row3 articles={deduplicatedBlocks().mainFeaturedFirst.slice(26, 29)} nodate={true} />
            </>
          )}
        </>
      </Show>

      {/* Пагинированные страницы (дедуплицированные) */}
      <Show when={hasMoreShouts()}>
        <For each={pages()}>
          {(_page, pageIndex) => {
            const startIndex = pageIndex() * SHOUTS_PER_PAGE
            const deduplicatedPage = deduplicatedBlocks().remainingFeatured.slice(
              startIndex,
              startIndex + SHOUTS_PER_PAGE
            )
            return (
              deduplicatedPage.length > 0 && (
                <>
                  <Row1 article={deduplicatedPage[0]} nodate={true} />
                  <Row3 articles={deduplicatedPage.slice(1, 4)} nodate={true} />
                  <Row2 articles={deduplicatedPage.slice(4, 6)} nodate={true} />
                  <Beside
                    values={deduplicatedPage.slice(6, 9)}
                    beside={deduplicatedPage[9]}
                    wrapper="article"
                    nodate={true}
                  />
                  <Row1 article={deduplicatedPage[10]} nodate={true} />
                  <Row2 articles={deduplicatedPage.slice(11, 13)} nodate={true} />
                  <Row3 articles={deduplicatedPage.slice(13, 16)} nodate={true} />
                </>
              )
            )
          }}
        </For>
      </Show>
    </>
  )
}
