import { Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { Component, ErrorBoundary, JSX, Show, Suspense } from 'solid-js'
import bannerImage from '~/assets/images/discours-banner.jpg'
import { useLocalize } from '~/context/localize'
import { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { FooterView } from '../Discours/Footer'
import { Header } from '../HeaderNav'
import { Loading } from './Loading'
import { MetaTags } from './MetaTags'
import styles from './PageLayout.module.scss'

type PageLayoutProps = {
  title: string
  desc?: string
  keywords?: string
  headerTitle?: string
  slug?: string
  article?: Shout
  author?: Author // Add author prop for author pages
  topic?: Topic // Add topic prop for topic pages
  cover?: string
  featuredArticles?: Shout[] // Add featured articles for homepage
  children: JSX.Element
  isHeaderFixed?: boolean
  hideFooter?: boolean
  class?: string
  withPadding?: boolean
  zeroBottomPadding?: boolean
  key?: string
}

// biome-ignore lint/suspicious/noExplicitAny: ok
const PageErrorFallback = (err: any) => {
  console.error('[PageLayout] Error:', err)
  return (
    <div style={{ padding: '20px', background: '#fee', color: '#c00' }}>
      <h1>Ошибка страницы</h1>
      <pre style={{ 'white-space': 'pre-wrap' }}>{err?.toString()}</pre>
    </div>
  )
}

export const PageLayout: Component<PageLayoutProps> = (props) => {
  const isHeaderFixed = props.isHeaderFixed === undefined ? true : props.isHeaderFixed
  const loc = useLocation()
  const { t } = useLocalize()

  // Определяем контент для метатегов
  const content = () => {
    if (props.article) return props.article
    if (props.author) return props.author
    if (props.topic) return props.topic
    return undefined
  }

  // Используем более надёжные гарантированные значения
  const pageTitle = () => {
    return props.article?.title || t(props.title) || t('Discours')
  }

  return (
    <ErrorBoundary fallback={PageErrorFallback}>
      <Header
        slug={props.slug}
        title={props.headerTitle}
        desc={props.desc}
        cover={props.cover || bannerImage}
        isHeaderFixed={isHeaderFixed}
      />

      <div class={props.withPadding ? 'container' : ''}>
        <Suspense fallback={<Loading />}>
          <Title>{pageTitle()}</Title>
          <MetaTags
            content={content()}
            pathname={loc.pathname}
            title={t(props.title)}
            description={props.desc}
            keywords={props.keywords}
            featuredArticles={props.featuredArticles}
          />

          <main
            class={clsx('main-content', {
              [styles.zeroBottomPadding]: props.zeroBottomPadding
            })}
            classList={{ 'main-content--no-padding': !isHeaderFixed }}
          >
            {props.children}
          </main>
          <Show when={!props.hideFooter}>
            <FooterView />
          </Show>
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}
