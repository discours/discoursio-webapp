import { Meta, Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import type { Component, JSX } from 'solid-js'
import { Show, createMemo } from 'solid-js'
import { ErrorBoundary, Suspense } from 'solid-js'
import { cdnUrl } from '~/config'
import { useLocalize } from '~/context/localize'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import enKeywords from '~/intl/locales/en/keywords.json'
import ruKeywords from '~/intl/locales/ru/keywords.json'
import { getFileUrl } from '~/lib/getThumbUrl'
import { generateOGMetadata } from '~/lib/openGraph'
import { FooterView } from '../Discours/Footer'
import { Header } from '../HeaderNav'
import { Loading } from './Loading'

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
  children: JSX.Element
  isHeaderFixed?: boolean
  hideFooter?: boolean
  class?: string
  withPadding?: boolean
  zeroBottomPadding?: boolean
  key?: string
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const PageErrorFallback = (error: any) => {
  console.error('[PageLayout] Error:', error)

  return (
    <div
      style={{
        padding: '40px 20px',
        'text-align': 'center',
        'min-height': '50vh',
        display: 'flex',
        'flex-direction': 'column',
        'justify-content': 'center',
        'align-items': 'center'
      }}
    >
      <h1>Дискурс</h1>
      <p>Загружаем контент...</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          'margin-top': '20px',
          background: '#007acc',
          color: 'white',
          border: 'none',
          'border-radius': '4px',
          cursor: 'pointer'
        }}
      >
        Обновить страницу
      </button>
    </div>
  )
}

export const PageLayout: Component<PageLayoutProps> = (props) => {
  const isHeaderFixed = props.isHeaderFixed === undefined ? true : props.isHeaderFixed // FIXME: выглядит как костылек
  const loc = useLocation()
  const { t, lang } = useLocalize()
  const imageUrl = getFileUrl(props.cover || `${cdnUrl}/production/image/logo_image.png`)

  const keywords = createMemo(() => {
    const keypath = (props.key || loc?.pathname.split('/')[0]) as keyof typeof ruKeywords
    return props.keywords || lang() === 'ru' ? ruKeywords[keypath] : enKeywords[keypath]
  })

  // Определяем контент для OG-тегов
  const content = createMemo(() => {
    if (props.article) return props.article
    if (props.author) return props.author
    if (props.topic) return props.topic
    return undefined
  })

  // Генерируем все метаданные для OG в одном вызове
  const ogMetadata = createMemo(() => {
    return generateOGMetadata(content(), {
      pathname: loc.pathname,
      defaultTitle: t(props.title),
      defaultDescription: props.desc,
      locale: lang()
    })
  })

  // Получаем описание напрямую через дедупликацию логики
  const description = createMemo(() => ogMetadata().description)

  // Гарантируем, что все важные мета-теги имеют значения по умолчанию
  const guaranteedTitle = createMemo(
    () => ogMetadata().title || props.article?.title || t(props.title) || 'Discours'
  )
  const guaranteedDescription = createMemo(
    () => description() || props.desc || 'Discours – an open magazine about culture, science and society'
  )
  const guaranteedType = createMemo(() => ogMetadata().type || 'website')
  const guaranteedUrl = createMemo(() => ogMetadata().url || `https://testing3.discours.io${loc.pathname}`)
  const guaranteedImage = createMemo(
    () => ogMetadata().image || 'https://files.dscrs.site/production/image/logo_image.png'
  )
  const guaranteedLogo = createMemo(() => ogMetadata().logo || 'https://files.dscrs.site/logo_sign.png')

  return (
    <ErrorBoundary fallback={PageErrorFallback}>
      <div class={props.withPadding ? 'container' : ''}>
        <Suspense fallback={<Loading />}>
          <Title>{props.article?.title || t(props.title)}</Title>
          <Header
            slug={props.slug}
            title={props.headerTitle}
            desc={props.desc}
            cover={imageUrl}
            isHeaderFixed={isHeaderFixed}
          />
          {/* Основные мета-теги */}
          <Meta name="description" content={guaranteedDescription()} />
          <Meta name="keywords" content={keywords()} />

          {/* Open Graph теги - все обязательные и дополнительные теги */}
          <Meta property="og:type" content={guaranteedType()} />
          <Meta property="og:title" content={guaranteedTitle()} />
          <Meta property="og:site_name" content={ogMetadata().siteName || 'Discours'} />
          <Meta property="og:description" content={guaranteedDescription()} />
          <Meta property="og:url" content={guaranteedUrl()} />
          <Meta property="og:image" content={guaranteedImage()} />
          <Meta property="og:image:width" content={ogMetadata().imageWidth?.toString() || '1200'} />
          <Meta property="og:image:height" content={ogMetadata().imageHeight?.toString() || '630'} />
          <Meta property="og:locale" content={ogMetadata().locale || 'ru'} />
          <Meta property="og:logo" content={guaranteedLogo()} />

          {/* Дублируем обязательные мета-теги с использованием name вместо property для максимальной совместимости */}
          <Meta name="og:type" content={guaranteedType()} />
          <Meta name="og:title" content={guaranteedTitle()} />
          <Meta name="og:description" content={guaranteedDescription()} />
          <Meta name="og:url" content={guaranteedUrl()} />
          <Meta name="og:logo" content={guaranteedLogo()} />

          {/* Twitter Card теги */}
          <Meta name="twitter:card" content={ogMetadata().twitterCard || 'summary_large_image'} />
          <Meta name="twitter:site" content="@discoursio" />
          <Meta name="twitter:title" content={guaranteedTitle()} />
          <Meta name="twitter:description" content={guaranteedDescription()} />
          <Meta name="twitter:image" content={guaranteedImage()} />

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
