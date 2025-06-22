// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server'
import { ErrorBoundary, For, Suspense } from 'solid-js'
import { Loading } from './components/_shared/Loading'
import { defaultClient } from './graphql/client'
import getShoutQuery from './graphql/query/core/article-load'
import getAuthorQuery from './graphql/query/core/author-by'
import topicBySlugQuery from './graphql/query/core/topic-by-slug'
import { i18next } from './intl/i18next'
import { getPageKeywords } from './intl/keywords'
import { generateOGMetadata } from './lib/openGraph'

// biome-ignore lint/suspicious/noExplicitAny: ok
const ServerErrorFallback = (err: any) => {
  if (process.env.NODE_ENV === 'production') {
    return <Loading />
  }
  return (
    <div style={{ padding: '20px', background: '#fee', color: '#c00' }}>
      <h1>Server Error</h1>
      <pre style={{ 'white-space': 'pre-wrap' }}>{err?.toString()}</pre>
    </div>
  )
}

/**
 * Минимальные метатеги для системных запросов и fallback
 */
const getMinimalMetaTags = (pathname: string, locale: 'ru' | 'en') => (
  <>
    <title>Discours</title>
    <meta name="description" content="Дискурс – открытый журнал о культуре, науке и обществе" />
    <meta name="keywords" content="discours.io, Дискурс журнал, культура, наука, искусство, общество" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Discours" />
    <meta property="og:description" content="Дискурс – открытый журнал о культуре, науке и обществе" />
    <meta property="og:url" content={`https://discours.io${pathname}`} />
    <meta property="og:site_name" content="Discours" />
    <meta property="og:locale" content={locale} />
    <link rel="canonical" href={`https://discours.io${pathname}`} />
    <meta name="robots" content="index, follow" />
  </>
)

/**
 * Проверяет является ли запрос системным (боты, скриншоты и т.д.)
 */
const isSystemRequest = (userAgent: string): boolean => {
  const systemAgents = ['vercel-', 'bot', 'crawler', 'spider', 'facebook', 'twitter']
  return systemAgents.some((agent) => userAgent.toLowerCase().includes(agent))
}

/**
 * Быстрое получение данных GraphQL с обработкой ошибок
 */
// biome-ignore lint/suspicious/noExplicitAny: ok
const fetchGraphQLData = async (query: any, variables: any, type: string) => {
  try {
    const response = await defaultClient.query(query, variables).toPromise()
    return response?.data?.[`get_${type}`] || null
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[Server] Error fetching ${type}:`, error)
    }
    return null
  }
}

/**
 * Анализирует URL и возвращает тип контента и данные
 */
async function analyzeURLAndFetchData(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  // Статья: /slug или /slug/mode
  if (
    segments.length <= 2 &&
    segments[0] &&
    !['author', 'topic', 'feed', 'search', 'settings', 'edit', 'inbox', 'authors', 'topics'].includes(
      segments[0]
    )
  ) {
    const data = await fetchGraphQLData(getShoutQuery, { slug: segments[0] }, 'shout')
    if (data) return { type: 'article', data }
  }

  // Автор: /author/slug
  if (segments[0] === 'author' && segments[1]) {
    const data = await fetchGraphQLData(getAuthorQuery, { slug: segments[1] }, 'author')
    if (data) return { type: 'author', data }
  }

  // Тема: /topic/slug
  if (segments[0] === 'topic' && segments[1]) {
    const data = await fetchGraphQLData(topicBySlugQuery, { slug: segments[1] }, 'topic')
    if (data) return { type: 'topic', data }
  }

  return { type: 'website', data: null }
}

/**
 * Определяет язык интерфейса на основе заголовков запроса
 */
const getLocaleFromRequest = (request: Request): 'ru' | 'en' => {
  const acceptLanguage = request.headers.get('Accept-Language') || ''
  return acceptLanguage.includes('en') && !acceptLanguage.includes('ru') ? 'en' : 'ru'
}

/**
 * Генерирует метатеги на основе данных с поддержкой многоязычности
 */
function generateMetaTags(
  // biome-ignore lint/suspicious/noExplicitAny: ok
  contentInfo: any,
  pathname: string,
  locale: 'ru' | 'en',
  // biome-ignore lint/suspicious/noExplicitAny: ok
  t: any,
  isMinimal = false
) {
  // Для системных запросов возвращаем минимальные метатеги
  if (isMinimal) {
    return getMinimalMetaTags(pathname, locale)
  }

  try {
    const ogMetadata = generateOGMetadata(contentInfo.data, {
      pathname,
      defaultTitle: t('Discours'),
      defaultDescription: t('Discours – an open magazine about culture, science and society'),
      locale
    })

    // Альтернативные языки для hreflang
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://discours.io'
    const alternateLocale = locale === 'ru' ? 'en' : 'ru'
    const alternateUrl = `${baseUrl}${pathname}?lng=${alternateLocale}`

    return (
      <>
        <title>{ogMetadata.title}</title>

        {/* ============ ЯЗЫКОВЫЕ МЕТАТЕГИ ============ */}
        <meta name="language" content={locale} />
        <link rel="alternate" hreflang={alternateLocale} href={alternateUrl} />
        <link rel="alternate" hreflang="x-default" href={`${baseUrl}${pathname}`} />

        {/* ============ ОБЯЗАТЕЛЬНЫЕ OPEN GRAPH ТЕГИ ============ */}
        <meta property="og:type" content={ogMetadata.type} />
        <meta property="og:title" content={ogMetadata.title} />
        <meta property="og:description" content={ogMetadata.description} />
        <meta property="og:image" content={ogMetadata.image} />
        <meta property="og:url" content={ogMetadata.url} />
        <meta property="og:logo" content={ogMetadata.logo} />
        <meta property="og:site_name" content={ogMetadata.siteName} />
        <meta property="og:locale" content={locale} />
        <meta property="og:locale:alternate" content={alternateLocale} />

        {/* ============ ДОПОЛНИТЕЛЬНЫЕ OG ТЕГИ ============ */}
        <meta property="og:image:width" content={ogMetadata.imageWidth?.toString() || '1200'} />
        <meta property="og:image:height" content={ogMetadata.imageHeight?.toString() || '630'} />
        <meta property="og:image:alt" content={ogMetadata.imageAlt} />
        <meta property="og:image:type" content={ogMetadata.imageType} />
        <meta property="og:image:secure_url" content={ogMetadata.imageSecureUrl} />

        {/* Специфичные теги для статей */}
        {ogMetadata.articleAuthor && <meta property="article:author" content={ogMetadata.articleAuthor} />}
        {ogMetadata.articleSection && (
          <meta property="article:section" content={ogMetadata.articleSection} />
        )}
        {ogMetadata.articlePublishedTime && (
          <meta property="article:published_time" content={ogMetadata.articlePublishedTime} />
        )}
        {ogMetadata.articleModifiedTime && (
          <meta property="article:modified_time" content={ogMetadata.articleModifiedTime} />
        )}
        <For each={ogMetadata.articleTags}>{(tag) => <meta property="article:tag" content={tag} />}</For>

        {/* Специфичные теги для профилей */}
        {ogMetadata.profileFirstName && (
          <meta property="profile:first_name" content={ogMetadata.profileFirstName} />
        )}
        {ogMetadata.profileLastName && (
          <meta property="profile:last_name" content={ogMetadata.profileLastName} />
        )}
        {ogMetadata.profileUsername && (
          <meta property="profile:username" content={ogMetadata.profileUsername} />
        )}

        {/* ============ TWITTER CARD ТЕГИ ============ */}
        <meta name="twitter:card" content={ogMetadata.twitterCard} />
        <meta name="twitter:site" content="@discoursio" />
        <meta name="twitter:title" content={ogMetadata.title} />
        <meta name="twitter:description" content={ogMetadata.description} />
        <meta name="twitter:image" content={ogMetadata.image} />
        <meta name="twitter:image:alt" content={ogMetadata.imageAlt} />

        {/* ============ БАЗОВЫЕ МЕТАТЕГИ ============ */}
        <meta name="keywords" content={getPageKeywords(contentInfo, pathname, locale)} />
        <meta name="description" content={ogMetadata.description} />
        <link rel="canonical" href={ogMetadata.canonicalUrl} />
        <meta name="robots" content={ogMetadata.robots} />
      </>
    )
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Server] generateMetaTags error:', error)
    }
    return getMinimalMetaTags(pathname, locale)
  }
}

/**
 * Создает базовую HTML структуру
 */
// biome-ignore lint/suspicious/noExplicitAny: ok
const createHTMLDocument = (locale: string, metaTags: any, assets: any, children: any, scripts: any) => (
  <html lang={locale}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {metaTags}
      <link rel="icon" href="/favicon.ico" />
      {assets}
    </head>
    <body>
      <div id="app">
        <ErrorBoundary fallback={ServerErrorFallback}>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </ErrorBoundary>
      </div>
      {scripts}
    </body>
  </html>
)

export default createHandler(async (event) => {
  try {
    const pathname = new URL(event.request.url).pathname
    const userAgent = event.request.headers.get('User-Agent') || ''
    const isSystem = isSystemRequest(userAgent)
    const locale = getLocaleFromRequest(event.request)

    // Инициализируем i18next для сервера с нужным языком
    await i18next.changeLanguage(locale)
    const t = i18next.t.bind(i18next)

    // Для системных запросов используем минимальные данные
    const contentInfo = isSystem ? { type: 'website', data: null } : await analyzeURLAndFetchData(pathname)

    if (process.env.NODE_ENV !== 'production' && !isSystem) {
      console.log(`[Server] ${contentInfo.type} | ${pathname} | ${locale}`)
    }

    return (
      <StartServer
        document={({ assets, children, scripts }) => {
          const metaTags = generateMetaTags(contentInfo, pathname, locale, t, isSystem)
          return createHTMLDocument(locale, metaTags, assets, children, scripts)
        }}
      />
    )
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Server] Handler error:', error)
    }

    // Возвращаем минимальный HTML в случае ошибки
    return (
      <StartServer
        document={({ assets, children, scripts }) => {
          const metaTags = getMinimalMetaTags('/', 'ru')
          return createHTMLDocument('ru', metaTags, assets, children, scripts)
        }}
      />
    )
  }
})
