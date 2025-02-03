import { For, Show, createMemo, onMount } from 'solid-js'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { Author, Shout } from '~/graphql/schema/core.gen'
import { paginate } from '~/utils/paginate'
import Banner from '../Discours/Banner'
import Hero from '../Discours/Hero'
import { Beside } from '../Feed/Beside'
import { TopicShoutsSwiper } from '../Feed/TopicShoutsSwiper'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'
import { Row5 } from '../Feed/Row5'
import RowShort from '../Feed/RowShort'
import { TopicsNav } from '../HeaderNav/TopicsNav'
import { Loading } from '../_shared/Loading'
import { ArticleCardSwiper } from '../_shared/SolidSwiper/ArticleCardSwiper'

import '~/styles/views/Home.module.scss'
import { useFeaturedFeed } from '~/context/featured'

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

  const hasFeaturedShouts = createMemo(() => (props.featuredShouts || []).length > 0)
  const hasMoreShouts = createMemo(() => (props.featuredShouts || []).length >= MIN_SHOUTS_FOR_FULL_VIEW)

  return (
    <Show when={hasFeaturedShouts()} fallback={<Loading />}>
      <TopicsNav />
      <Row5 articles={props.featuredShouts.slice(0, 5)} nodate={true} />
      <Hero />

      <Show when={hasMoreShouts()}>
        <Beside
          beside={props.featuredShouts[5]}
          title={t('Top viewed')}
          values={props.topViewedShouts.slice(0, 5)}
          wrapper={'top-article'}
          nodate={true}
        />
        <Row3 articles={props.featuredShouts.slice(6, 9)} nodate={true} />
        <Beside
          beside={props.featuredShouts[9]}
          title={t('Top authors')}
          values={topAuthors?.() || []}
          wrapper={'author'}
          nodate={true}
        />

        <Show when={props.topMonthShouts?.length}>
          <ArticleCardSwiper title={t('Top month')} slides={props.topMonthShouts} />
        </Show>

        <Row2 articles={props.featuredShouts.slice(10, 12)} nodate={true} />
        <RowShort articles={props.featuredShouts.slice(12, 16)} />
        <Row1 article={props.featuredShouts[16]} nodate={true} />
        <Row3 articles={props.featuredShouts.slice(17, 20)} nodate={true} />

        <Show when={props.topCommentedShouts?.length}>
          <Row3
            articles={props.topCommentedShouts.slice(0, 3)}
            header={<h2>{t('Top commented')}</h2>}
            nodate={true}
          />
        </Show>

        <TopicShoutsSwiper shouts={randomTopicFeed() || []} />

        <Show when={props.topRatedShouts?.length}>
          <ArticleCardSwiper title={t('Favorite')} slides={props.topRatedShouts} />
        </Show>

        <Show when={props.featuredShouts.length > SHOUTS_PER_PAGE}>
          <Beside
            beside={props.featuredShouts[20]}
            title={t('Top topics')}
            values={topTopics().slice(0, 5)}
            wrapper={'topic'}
            isTopicCompact={true}
            nodate={true}
          />
          <Row3 articles={props.featuredShouts.slice(21, 24)} nodate={true} />
          <Banner />
          <Row2 articles={props.featuredShouts.slice(24, 26)} nodate={true} />
          <Row3 articles={props.featuredShouts.slice(26, 29)} nodate={true} />
          <Row2 articles={props.featuredShouts.slice(29, 31)} nodate={true} />
          <Row3 articles={props.featuredShouts.slice(31, 34)} nodate={true} />
        </Show>
      </Show>

      <For each={pages()}>
        {(page) => (
          <>
            <Row1 article={page[0]} nodate={true} />
            <Row3 articles={page.slice(1, 4)} nodate={true} />
            <Row2 articles={page.slice(4, 6)} nodate={true} />
            <Beside values={page.slice(6, 9)} beside={page[9]} wrapper="article" nodate={true} />
            <Row1 article={page[10]} nodate={true} />
            <Row2 articles={page.slice(11, 13)} nodate={true} />
            <Row3 articles={page.slice(13, 16)} nodate={true} />
          </>
        )}
      </For>
    </Show>
  )
}
