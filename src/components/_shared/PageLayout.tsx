import { Meta, Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { Component, createEffect, createMemo, ErrorBoundary, JSX, on, Show, Suspense } from 'solid-js'
import { isServer } from 'solid-js/web'
import { cdnUrl } from '~/config'
import { useLocalize } from '~/context/localize'
import { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { getPageKeywords } from '~/intl/keywords'
import { getCachedImageUrl } from '~/lib/imageCache'
import { generateOGMetadata } from '~/lib/openGraph'
import { FooterView } from '../Discours/Footer'
import { Header } from '../HeaderNav'

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

/**
 * Обновляет метатеги на клиенте через прямое DOM API
 * Обходит проблемы @solidjs/meta с SSR
 */
function updateServerMetaTags(ogMetadata: ReturnType<typeof generateOGMetadata>, keywords: string) {
  if (isServer) return // На сервере только базовые теги

  try {
    // Обновляем title
    if (document.title !== ogMetadata.title) {
      document.title = ogMetadata.title
    }

    // Функция для обновления/создания метатега
    const updateMetaTag = (selector: string, content: string) => {
      let meta = document.querySelector(selector)
      if (!meta) {
        meta = document.createElement('meta')

        // Определяем атрибут по селектору
        if (selector.includes('property=')) {
          const property = selector.match(/property="([^"]+)"/)?.[1]
          if (property) meta.setAttribute('property', property)
        } else if (selector.includes('name=')) {
          const name = selector.match(/name="([^"]+)"/)?.[1]
          if (name) meta.setAttribute('name', name)
        }

        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }

    // Обновляем базовые метатеги
    updateMetaTag('meta[name="description"]', ogMetadata.description)
    updateMetaTag('meta[name="keywords"]', keywords)

    // Обновляем OG теги
    updateMetaTag('meta[property="og:type"]', ogMetadata.type)
    updateMetaTag('meta[property="og:title"]', ogMetadata.title)
    updateMetaTag('meta[property="og:description"]', ogMetadata.description)
    updateMetaTag('meta[property="og:url"]', ogMetadata.url)
    updateMetaTag('meta[property="og:image"]', ogMetadata.image)
    updateMetaTag('meta[property="og:locale"]', ogMetadata.locale)

    // Обновляем Twitter Card теги
    updateMetaTag('meta[name="twitter:title"]', ogMetadata.title)
    updateMetaTag('meta[name="twitter:description"]', ogMetadata.description)
    updateMetaTag('meta[name="twitter:image"]', ogMetadata.image)

    // Обновляем canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = ogMetadata.canonicalUrl || ogMetadata.url
  } catch (error) {
    console.error('[PageLayout] Error updating meta tags:', error)
  }
}

export const PageLayout: Component<PageLayoutProps> = (props) => {
  const isHeaderFixed = props.isHeaderFixed === undefined ? true : props.isHeaderFixed
  const loc = useLocation()
  const { t, lang } = useLocalize()
  const imageUrl = getCachedImageUrl(props.cover || `${cdnUrl}/production/image/logo_image.png`)

  // Простая функция для получения ключевых слов - только для сложных вычислений нужен createMemo
  const keywords = createMemo(() => {
    if (props.keywords) return props.keywords

    const contentInfo = {
      type: props.article ? 'article' : props.author ? 'author' : props.topic ? 'topic' : 'website',
      data: props.article || props.author || props.topic || null
    }

    return getPageKeywords(contentInfo, loc.pathname, lang())
  })

  // Простая функция для определения контента - избегаем createMemo для простых условий
  const content = () => {
    if (props.article) return props.article
    if (props.author) return props.author
    if (props.topic) return props.topic
    return undefined
  }

  // Оставляем createMemo только для сложной функции generateOGMetadata
  const ogMetadata = createMemo(() =>
    generateOGMetadata(content(), {
      pathname: loc.pathname,
      defaultTitle: t(props.title),
      defaultDescription: props.desc,
      locale: lang()
    })
  )

  // Используем более надёжные гарантированные значения
  const pageTitle = () => {
    return props.article?.title || t(props.title) || ogMetadata().title || t('Discours')
  }

  // Обновляем метатеги на клиенте
  createEffect(
    on([ogMetadata, keywords], ([ogData, keywords]) => {
      updateServerMetaTags(ogData, keywords)
    })
  )

  return (
    <ErrorBoundary fallback={PageErrorFallback}>
      <Header
        slug={props.slug}
        title={props.headerTitle}
        desc={props.desc}
        cover={imageUrl}
        isHeaderFixed={isHeaderFixed}
      />

      <div class={props.withPadding ? 'container' : ''}>
        <Suspense fallback={<div>Загрузка страницы...</div>}>
          {/* Заголовок страницы всегда обновляется */}
          <Title>{pageTitle()}</Title>
          <Meta
            name="description"
            content={
              ogMetadata().description ||
              props.desc ||
              t('Discours – an open magazine about culture, science and society') ||
              ''
            }
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
