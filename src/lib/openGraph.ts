import { baseUrl } from '~/config'
import { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { descFromBody } from '~/utils/meta'

/**
 * Централизованный модуль для работы с Open Graph метаданными
 * Обеспечивает единый API для генерации OG-тегов и изображений
 */

// Константы для OG-тегов
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_SITE_NAME = 'Дискурс'
export const OG_BASE_URL = '/api/og'
export const OG_TWITTER_SITE = '@discoursio'
export const OG_DEFAULT_DESCRIPTION = 'Дискурс – открытый журнал о культуре, науке и обществе'
export const OG_LOGO_PATH = '/logo_sign.png'

// Типы контента для OG
export enum OGContentType {
  ARTICLE = 'article',
  PROFILE = 'profile',
  TOPIC = 'topic',
  WEBSITE = 'website'
}

// Общий интерфейс для метаданных OG
export interface OGMetadata {
  title: string
  description: string
  type: OGContentType
  url: string
  image: string
  locale: string
  siteName: string
  imageWidth?: number
  imageHeight?: number
  twitterCard?: string
  logo?: string
  imageAlt?: string
  imageType?: string
  imageSecureUrl?: string
  canonicalUrl?: string
  robots?: string

  // Специфичные метаданные для статей
  articleAuthor?: string
  articleSection?: string
  articleTags?: string[]
  articlePublishedTime?: string
  articleModifiedTime?: string

  // Специфичные метаданные для авторов
  profileFirstName?: string
  profileLastName?: string
  profileUsername?: string
}

/**
 * Определяет тип страницы на основе pathname
 */
export function getPageType(pathname: string): 'homepage' | 'article' | 'author' | 'topic' | 'website' {
  if (pathname === '/' || pathname === '/feed') return 'homepage'
  if (pathname.startsWith('/author/') || pathname.startsWith('/@')) return 'author'
  if (pathname.startsWith('/topic/') || pathname.startsWith('/!')) return 'topic'
  if (!pathname.startsWith('/search') && !pathname.startsWith('/settings') && !pathname.startsWith('/edit')) {
    return 'article'
  }
  return 'website'
}

/**
 * Формирует полный URL страницы
 */
export function getFullPageUrl(pathname: string): string {
  return `${baseUrl}${pathname}`
}

/**
 * Формирует полный URL изображения
 */
export function getFullImageUrl(relativePath: string): string {
  return `${baseUrl}${relativePath}`
}

/**
 * Генерирует специфичные OG метаданные для разных типов страниц
 */
export function generatePageSpecificOGMetadata(
  pageType: 'homepage' | 'article' | 'author' | 'topic' | 'website',
  data?: Shout | Author | Topic,
  options: {
    pathname?: string
    defaultTitle?: string
    defaultDescription?: string
    locale?: string
    featuredArticles?: Shout[]
  } = {}
): OGMetadata {
  const { pathname = '', defaultTitle = '', defaultDescription = OG_DEFAULT_DESCRIPTION, locale = 'ru' } = options

  // Общие данные
  const url = getFullPageUrl(pathname)
  const baseMetadata = {
    locale,
    siteName: OG_SITE_NAME,
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    twitterCard: 'summary_large_image',
    logo: 'https://files.dscrs.site/logo_sign.png',
    imageType: 'image/png',
    canonicalUrl: url,
    robots: 'index, follow'
  } as const

  switch (pageType) {
    case 'homepage': {
      const title = defaultTitle || 'Дискурс — открытый журнал о культуре, науке и обществе'
      let description = defaultDescription
      let image: string

      if (options.featuredArticles && options.featuredArticles.length > 0) {
        const topTitles = options.featuredArticles
          .slice(0, 3)
          .map((a) => a.title)
          .join(', ')
        image = `${baseUrl}${OG_BASE_URL}/homepage?featured=${encodeURIComponent(topTitles)}`

        const featuredTitles = options.featuredArticles
          .slice(0, 2)
          .map((a) => a.title)
          .join('" и "')
        description = `Читайте сейчас: "${featuredTitles}" и другие материалы`
      } else {
        image = 'https://files.dscrs.site/production/image/logo_image.png'
      }

      return {
        ...baseMetadata,
        title,
        description,
        type: OGContentType.WEBSITE,
        url,
        image,
        imageAlt: `${title} - Главная страница`,
        imageSecureUrl: image.startsWith('https://') ? image : image.replace('http://', 'https://')
      }
    }

    case 'article': {
      const article = data as Shout
      if (!article) {
        return {
          ...baseMetadata,
          title: defaultTitle || OG_SITE_NAME,
          description: defaultDescription,
          type: OGContentType.WEBSITE,
          url,
          image: 'https://files.dscrs.site/production/image/logo_image.png',
          imageAlt: OG_SITE_NAME,
          imageSecureUrl: 'https://files.dscrs.site/production/image/logo_image.png'
        }
      }

      const title = article.title || defaultTitle
      const description = article.body ? descFromBody(article.body) : defaultDescription
      const imageParams = new URLSearchParams()

      imageParams.append('title', article.title)
      imageParams.append('slug', article.slug)
      if (article.authors?.[0]?.name) {
        imageParams.append('author', article.authors[0].name)
      }
      if (article.topics?.[0]?.title) {
        imageParams.append('topic', article.topics[0].title)
      }
      if (article.cover) {
        imageParams.append('cover', article.cover)
      }

      const imageRelativePath = `${OG_BASE_URL}/article?${imageParams.toString()}`
      const image = getFullImageUrl(imageRelativePath)

      const metadata: OGMetadata = {
        ...baseMetadata,
        title,
        description,
        type: OGContentType.ARTICLE,
        url,
        image,
        imageAlt: `${title} - ${OG_SITE_NAME}`,
        imageSecureUrl: image.startsWith('https://') ? image : image.replace('http://', 'https://'),
        articleAuthor: article.authors?.[0]?.name || '',
        articleSection: article.topics?.[0]?.title || '',
        articleTags: article.topics?.map((topic) => topic?.title).filter(Boolean) as string[]
      }

      if (article.created_at) {
        metadata.articlePublishedTime = new Date(article.created_at * 1000).toISOString()
      }
      if (article.updated_at && article.updated_at !== article.created_at) {
        metadata.articleModifiedTime = new Date(article.updated_at * 1000).toISOString()
      }

      return metadata
    }

    case 'author': {
      const author = data as Author
      if (!author) {
        return {
          ...baseMetadata,
          title: defaultTitle || OG_SITE_NAME,
          description: defaultDescription,
          type: OGContentType.WEBSITE,
          url,
          image: 'https://files.dscrs.site/production/image/logo_image.png',
          imageAlt: OG_SITE_NAME,
          imageSecureUrl: 'https://files.dscrs.site/production/image/logo_image.png'
        }
      }

      const title = author.name || defaultTitle
      const description = author.bio || `Автор ${author.name} на Дискурсе`

      const imageParams = new URLSearchParams()
      imageParams.append('name', author.name || title)
      if (author.bio) {
        imageParams.append('bio', author.bio)
      }
      if (author.pic) {
        imageParams.append('avatar', author.pic)
      }
      if (author.stat?.shouts) {
        imageParams.append('articlesCount', author.stat.shouts.toString())
      }
      if (author.stat?.followers) {
        imageParams.append('followersCount', author.stat.followers.toString())
      }

      const imageRelativePath = `${OG_BASE_URL}/author?${imageParams.toString()}`
      const image = getFullImageUrl(imageRelativePath)

      const metadata: OGMetadata = {
        ...baseMetadata,
        title,
        description,
        type: OGContentType.PROFILE,
        url,
        image,
        imageAlt: `${title} - автор на ${OG_SITE_NAME}`,
        imageSecureUrl: image.startsWith('https://') ? image : image.replace('http://', 'https://')
      }

      const nameParts = author.name?.split(' ') || []
      metadata.profileFirstName = nameParts[0] || ''
      metadata.profileLastName = nameParts.slice(1).join(' ') || ''
      metadata.profileUsername = author.slug || author.name || ''

      return metadata
    }

    case 'topic': {
      const topic = data as Topic
      if (!topic) {
        return {
          ...baseMetadata,
          title: defaultTitle || OG_SITE_NAME,
          description: defaultDescription,
          type: OGContentType.WEBSITE,
          url,
          image: 'https://files.dscrs.site/production/image/logo_image.png',
          imageAlt: OG_SITE_NAME,
          imageSecureUrl: 'https://files.dscrs.site/production/image/logo_image.png'
        }
      }

      const title = topic.title || defaultTitle
      const description = topic.body
        ? topic.body
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        : `Тема "${topic.title}" на Дискурсе`

      const imageParams = new URLSearchParams()
      imageParams.append('title', topic.title || 'Topic')
      if (topic.body?.trim()) {
        const cleanDescription = topic.body
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (cleanDescription) {
          imageParams.append('description', cleanDescription)
        }
      }
      if (topic.pic) {
        imageParams.append('cover', topic.pic)
      }
      if (topic.stat?.shouts) {
        imageParams.append('articlesCount', topic.stat.shouts.toString())
      }

      const imageRelativePath = `${OG_BASE_URL}/topic?${imageParams.toString()}`
      const image = getFullImageUrl(imageRelativePath)

      return {
        ...baseMetadata,
        title,
        description,
        type: OGContentType.TOPIC,
        url,
        image,
        imageAlt: `${title} - тема на ${OG_SITE_NAME}`,
        imageSecureUrl: image.startsWith('https://') ? image : image.replace('http://', 'https://')
      }
    }

    default: {
      return {
        ...baseMetadata,
        title: defaultTitle || OG_SITE_NAME,
        description: defaultDescription,
        type: OGContentType.WEBSITE,
        url,
        image: 'https://files.dscrs.site/production/image/logo_image.png',
        imageAlt: OG_SITE_NAME,
        imageSecureUrl: 'https://files.dscrs.site/production/image/logo_image.png'
      }
    }
  }
}
