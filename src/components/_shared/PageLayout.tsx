import { Meta, Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import type { Component, JSX } from 'solid-js'
import { Index, Show, createMemo } from 'solid-js'
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

  // Используем более надёжные гарантированные значения
  const pageTitle = createMemo(() => {
    return props.article?.title || t(props.title) || ogMetadata().title || 'Discours'
  })

  const pageDescription = createMemo(() => {
    return description() || props.desc || 'Discours – открытый журнал о культуре, науке и обществе'
  })

  const ogType = createMemo(() => ogMetadata().type || 'website')
  const ogUrl = createMemo(() => ogMetadata().url || `https://discours.io${loc.pathname}`)
  const ogImage = createMemo(() => ogMetadata().image || `${cdnUrl}/production/image/logo_image.png`)
  const ogLogo = createMemo(() => ogMetadata().logo || `${cdnUrl}/logo_sign.png`)

  // Debug лог для проверки значений
  console.log('[PageLayout] OG Meta Debug:', {
    title: pageTitle(),
    description: pageDescription(),
    type: ogType(),
    url: ogUrl(),
    image: ogImage(),
    logo: ogLogo()
  })

  return (
    <ErrorBoundary fallback={PageErrorFallback}>
      <div class={props.withPadding ? 'container' : ''}>
        <Suspense fallback={<Loading />}>
          <Title>{pageTitle()}</Title>
          <Header
            slug={props.slug}
            title={props.headerTitle}
            desc={props.desc}
            cover={imageUrl}
            isHeaderFixed={isHeaderFixed}
          />

          {/* Основные мета-теги */}
          <Meta name="description" content={pageDescription()} />
          <Meta name="keywords" content={keywords()} />

          {/* ============ ОБЯЗАТЕЛЬНЫЕ OPEN GRAPH ТЕГИ ============ */}
          {/* Эти три тега абсолютно необходимы для работы OG */}
          <Meta property="og:type" content={ogType()} />
          <Meta property="og:title" content={pageTitle()} />
          <Meta property="og:description" content={pageDescription()} />
          <Meta property="og:url" content={ogUrl()} />
          <Meta property="og:image" content={ogImage()} />
          <Meta property="og:logo" content={ogLogo()} />

          {/* Дополнительные обязательные теги */}
          <Meta property="og:site_name" content="Discours" />
          <Meta property="og:locale" content={lang() || 'ru'} />

          {/* ============ РАСШИРЕННЫЕ OG ТЕГИ ============ */}
          <Meta property="og:image:width" content="1200" />
          <Meta property="og:image:height" content="630" />
          <Meta property="og:image:alt" content={`${pageTitle()} - Discours`} />
          <Meta property="og:image:type" content="image/png" />
          <Meta property="og:image:secure_url" content={ogImage().replace('http://', 'https://')} />

          {/* Специфичные теги для статей */}
          <Show when={ogMetadata().articleAuthor}>
            <Meta property="article:author" content={ogMetadata().articleAuthor!} />
          </Show>
          <Show when={ogMetadata().articleSection}>
            <Meta property="article:section" content={ogMetadata().articleSection!} />
          </Show>
          <Show when={ogMetadata().articlePublishedTime}>
            <Meta property="article:published_time" content={ogMetadata().articlePublishedTime!} />
          </Show>
          <Show when={ogMetadata().articleModifiedTime}>
            <Meta property="article:modified_time" content={ogMetadata().articleModifiedTime!} />
          </Show>
          <Show when={ogMetadata().articleTags?.length}>
            <Index each={ogMetadata().articleTags!}>
              {(tag) => <Meta property="article:tag" content={tag()} />}
            </Index>
          </Show>

          {/* Специфичные теги для профилей авторов */}
          <Show when={ogMetadata().profileFirstName}>
            <Meta property="profile:first_name" content={ogMetadata().profileFirstName!} />
          </Show>
          <Show when={ogMetadata().profileLastName}>
            <Meta property="profile:last_name" content={ogMetadata().profileLastName!} />
          </Show>
          <Show when={ogMetadata().profileUsername}>
            <Meta property="profile:username" content={ogMetadata().profileUsername!} />
          </Show>

          {/* ============ ДУБЛИРОВАНИЕ ДЛЯ СОВМЕСТИМОСТИ ============ */}
          {/* Дублируем критичные теги с атрибутом name для максимальной совместимости */}
          <Meta name="og:type" content={ogType()} />
          <Meta name="og:title" content={pageTitle()} />
          <Meta name="og:description" content={pageDescription()} />
          <Meta name="og:url" content={ogUrl()} />
          <Meta name="og:logo" content={ogLogo()} />

          {/* ============ TWITTER CARD ТЕГИ ============ */}
          <Meta name="twitter:card" content="summary_large_image" />
          <Meta name="twitter:site" content="@discoursio" />
          <Meta name="twitter:title" content={pageTitle()} />
          <Meta name="twitter:description" content={pageDescription()} />
          <Meta name="twitter:image" content={ogImage()} />
          <Meta name="twitter:image:alt" content={`${pageTitle()} - Discours`} />

          {/* ============ ДРУГИЕ СОЦИАЛЬНЫЕ СЕТИ ============ */}
          <Meta name="vk:title" content={pageTitle()} />
          <Meta name="vk:description" content={pageDescription()} />
          <Meta name="vk:image" content={ogImage()} />

          <Meta name="telegram:channel" content="@discoursio" />
          <Meta name="linkedin:owner" content="Discours" />

          {/* ============ SEO ТЕГИ ============ */}
          <link rel="canonical" href={ogUrl()} />
          <Meta name="robots" content="index, follow" />

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
