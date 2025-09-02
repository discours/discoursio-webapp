import { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { getPageKeywords } from '~/intl/keywords'
import { generatePageSpecificOGMetadata, getPageType, OG_SITE_NAME, OG_TWITTER_SITE } from '~/lib/openGraph'

/**
 * Централизованная функция для генерации всех метатегов на сервере
 * Решает проблемы SSR с @solidjs/meta путем прямой генерации HTML-тегов
 *
 * [Inference] Основано на анализе ограничений @solidjs/meta Issue #54, #33, #29, #28
 */
export function generateServerMetaTags(
  contentData: Shout | Author | Topic | undefined,
  options: {
    pathname: string
    defaultTitle?: string
    defaultDescription?: string
    locale: 'ru' | 'en'
    t: (key: string) => string
  }
): string {
  const { pathname, defaultTitle, defaultDescription, locale, t } = options

  // Генерируем OG метаданные через новую систему
  const pageType = getPageType(pathname)
  const ogMetadata = generatePageSpecificOGMetadata(pageType, contentData, {
    pathname,
    defaultTitle: defaultTitle || t('Discours'),
    defaultDescription: defaultDescription || t('Discours – an open magazine about culture, science and society'),
    locale
  })

  // Генерируем keywords через существующую систему
  const contentInfo = {
    type:
      contentData && 'title' in contentData && 'body' in contentData
        ? 'article'
        : contentData && 'name' in contentData
          ? 'author'
          : contentData && 'title' in contentData
            ? 'topic'
            : 'website',
    data: contentData || null
  }
  const keywords = getPageKeywords(contentInfo, pathname, locale)

  // Генерируем HTML строку с метатегами
  const metaTags = `
    <!-- ========== ОСНОВНЫЕ МЕТАТЕГИ ============ -->
    <title>${escapeHtml(ogMetadata.title)}</title>
    <meta name="description" content="${escapeHtml(ogMetadata.description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <link rel="canonical" href="${escapeHtml(ogMetadata.canonicalUrl || ogMetadata.url)}" />
    <meta name="robots" content="${escapeHtml(ogMetadata.robots || 'index, follow')}" />
    
    <!-- ========== OPEN GRAPH ТЕГИ ============ -->
    <meta property="og:type" content="${escapeHtml(ogMetadata.type)}" />
    <meta property="og:title" content="${escapeHtml(ogMetadata.title)}" />
    <meta property="og:description" content="${escapeHtml(ogMetadata.description)}" />
    <meta property="og:url" content="${escapeHtml(ogMetadata.url)}" />
    <meta property="og:image" content="${escapeHtml(ogMetadata.image)}" />
    <meta property="og:logo" content="${escapeHtml(ogMetadata.logo || '')}" />
    <meta property="og:site_name" content="${escapeHtml(OG_SITE_NAME)}" />
    <meta property="og:locale" content="${escapeHtml(ogMetadata.locale)}" />
    <meta property="og:image:width" content="${ogMetadata.imageWidth || 1200}" />
    <meta property="og:image:height" content="${ogMetadata.imageHeight || 630}" />
    <meta property="og:image:alt" content="${escapeHtml(ogMetadata.imageAlt || ogMetadata.title)}" />
    <meta property="og:image:type" content="${escapeHtml(ogMetadata.imageType || 'image/png')}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogMetadata.imageSecureUrl || ogMetadata.image)}" />
    
    <!-- ========== TWITTER CARD ТЕГИ ============ -->
    <meta name="twitter:card" content="${escapeHtml(ogMetadata.twitterCard || 'summary_large_image')}" />
    <meta name="twitter:site" content="${escapeHtml(OG_TWITTER_SITE)}" />
    <meta name="twitter:creator" content="${escapeHtml(OG_TWITTER_SITE)}" />
    <meta name="twitter:title" content="${escapeHtml(ogMetadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(ogMetadata.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogMetadata.image)}" />
    <meta name="twitter:image:width" content="${ogMetadata.imageWidth || 1200}" />
    <meta name="twitter:image:height" content="${ogMetadata.imageHeight || 630}" />
    <meta name="twitter:image:alt" content="${escapeHtml(ogMetadata.imageAlt || ogMetadata.title)}" />
    ${generateArticleMetaTags(ogMetadata)}
    ${generateProfileMetaTags(ogMetadata)}`.trim()

  return metaTags
}

/**
 * Генерирует метатеги для статей
 */
function generateArticleMetaTags(ogMetadata: ReturnType<typeof generatePageSpecificOGMetadata>): string {
  if (ogMetadata.type !== 'article') return ''

  let articleTags = ''

  if (ogMetadata.articleAuthor) {
    articleTags += `\n    <meta property="article:author" content="${escapeHtml(ogMetadata.articleAuthor)}" />`
  }

  if (ogMetadata.articleSection) {
    articleTags += `\n    <meta property="article:section" content="${escapeHtml(ogMetadata.articleSection)}" />`
  }

  if (ogMetadata.articlePublishedTime) {
    articleTags += `\n    <meta property="article:published_time" content="${escapeHtml(ogMetadata.articlePublishedTime)}" />`
  }

  if (ogMetadata.articleModifiedTime) {
    articleTags += `\n    <meta property="article:modified_time" content="${escapeHtml(ogMetadata.articleModifiedTime)}" />`
  }

  if (ogMetadata.articleTags?.length) {
    for (const tag of ogMetadata.articleTags) {
      if (tag) {
        articleTags += `\n    <meta property="article:tag" content="${escapeHtml(tag)}" />`
      }
    }
  }

  return articleTags
}

/**
 * Генерирует метатеги для профилей авторов
 */
function generateProfileMetaTags(ogMetadata: ReturnType<typeof generatePageSpecificOGMetadata>): string {
  if (ogMetadata.type !== 'profile') return ''

  let profileTags = ''

  if (ogMetadata.profileFirstName) {
    profileTags += `\n    <meta property="profile:first_name" content="${escapeHtml(ogMetadata.profileFirstName)}" />`
  }

  if (ogMetadata.profileLastName) {
    profileTags += `\n    <meta property="profile:last_name" content="${escapeHtml(ogMetadata.profileLastName)}" />`
  }

  if (ogMetadata.profileUsername) {
    profileTags += `\n    <meta property="profile:username" content="${escapeHtml(ogMetadata.profileUsername)}" />`
  }

  return profileTags
}

/**
 * Экранирует HTML специальные символы для безопасности
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return text.replace(/[&<>"']/g, (match) => map[match] || match)
}
