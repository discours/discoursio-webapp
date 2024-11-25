import { RouteSectionProps, createAsync } from '@solidjs/router'
import { HttpStatusCode } from '@solidjs/start'
import { Show, Suspense, createEffect, createSignal, on } from 'solid-js'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { TopicView } from '~/components/Views/TopicView'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadShouts } from '~/graphql/api/public'
import { Author, LoadShoutsOptions, Shout, Topic } from '~/graphql/schema/core.gen'
import { getFileUrl } from '~/lib/getThumbUrl'
import { descFromBody } from '~/utils/meta'

const fetchTopicShouts = async (slug: string, offset?: number) => {
  const options: LoadShoutsOptions = { filters: { topic: slug }, limit: FEED_PAGE_SIZE, offset }
  const shoutsLoader = loadShouts({ options })
  return await shoutsLoader()
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps<{ articles: Shout[] }>) => {
    const offset: number = Number.parseInt(query.offset as string, 10)
    const result = await fetchTopicShouts(params.slug, offset)
    return {
      articles: result
    }
  }
}
export type TopicPageProps = { articles?: Shout[]; topics: Topic[]; authors?: Author[] }

export default function TopicPage(props: RouteSectionProps<TopicPageProps>) {
  const { t } = useLocalize()

  // all topics
  const { addTopics, sortedTopics } = useTopics()
  const [loadingError, setLoadingError] = createSignal(false)

  // current topic's shouts
  const articles = createAsync(async () => {
    const result = (await props.data).articles || (await fetchTopicShouts(props.params.slug))
    if (!result) setLoadingError(true)
    return result
  })

  // current topic's data
  const [topic, setTopic] = createSignal<Topic>()
  const [title, setTitle] = createSignal<string>('')
  const [desc, setDesc] = createSignal<string>('')
  const [cover, setCover] = createSignal<string>('')
  const [viewed, setViewed] = createSignal(false)
  const [topicsAdded, setTopicsAdded] = createSignal(false)

  createEffect(
    on(
      sortedTopics,
      (ttt) => {
        if (ttt && !topicsAdded()) {
          addTopics(ttt)
          setTopicsAdded(true) // Prevent future calls
          const tpc = ttt.find((x) => x.slug === props.params.slug)
          if (!tpc) return
          setTopic(tpc)
          setTitle(`${t('Discours')}${tpc.title ? ` :: ${tpc.title}` : ''}`)
          setDesc(
            tpc.body
              ? descFromBody(tpc.body)
              : t('The most interesting publications on the topic', { topicName: tpc.title })
          )
          setCover(tpc.pic ? getFileUrl(tpc.pic, { width: 1200 }) : '/logo.png')

          // views google counter increment
          if (!viewed()) {
            window?.gtag?.('event', 'page_view', {
              page_title: tpc.title,
              page_location: window.location.href,
              page_path: window.location.pathname
            })
            setViewed(true)
          }
        }
      },
      { defer: true }
    )
  )

  return (
    <Show
      when={!loadingError()}
      fallback={
        <PageLayout isHeaderFixed={false} hideFooter={true} title={t('Nothing is here')}>
          <FourOuFourView />
          <HttpStatusCode code={404} />
        </PageLayout>
      }
    >
      <Suspense fallback={<Loading />}>
        <PageLayout
          key="topic"
          title={title()}
          desc={desc()}
          headerTitle={topic()?.title || ''}
          slug={topic()?.slug}
          cover={cover()}
        >
          <TopicView
            topic={topic() as Topic}
            topicSlug={props.params.slug}
            shouts={articles() as Shout[]}
          />
        </PageLayout>
      </Suspense>
    </Show>
  )
}
