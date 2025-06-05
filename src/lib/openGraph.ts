import { baseUrl } from '~/config'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import { descFromBody } from '~/utils/meta'

/**
 * Централизованный модуль для работы с Open Graph метаданными
 * Обеспечивает единый API для генерации OG-тегов и изображений
 * как для компонентов, так и для API-эндпоинтов
 */

// Константы для OG-тегов
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_SITE_NAME = 'Discours'
export const OG_BASE_URL = '/api/og'
export const OG_TWITTER_SITE = '@discoursio'
export const OG_DEFAULT_DESCRIPTION = 'Discours – an open magazine about culture, science and society'
export const OG_LOGO_PATH = '/logo_sign.png'

// Типы контента для OG
export enum OGContentType {
  ARTICLE = 'article',
  PROFILE = 'profile',
  TOPIC = 'topic',
  WEBSITE = 'website'
}

// Опции для изображений
export interface OGImageOptions {
  width?: number
  height?: number
  quality?: number
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
}

/**
 * Определяет тип контента для OG на основе переданного объекта данных
 */
export function getOGContentType(data?: Shout | Author | Topic): OGContentType {
  if (!data) return OGContentType.WEBSITE
  if ('title' in data && 'body' in data) return OGContentType.ARTICLE
  if ('name' in data) return OGContentType.PROFILE
  if ('title' in data) return OGContentType.TOPIC
  return OGContentType.WEBSITE
}

/**
 * Извлекает заголовок для OG из объекта данных
 */
export function getOGTitle(data?: Shout | Author | Topic | string, defaultTitle = ''): string {
  if (!data) return defaultTitle
  if (typeof data === 'string') return data
  if ('title' in data) return data.title || defaultTitle
  if ('name' in data) return data.name || defaultTitle
  return defaultTitle
}

/**
 * Извлекает описание для OG из объекта данных
 */
export function getOGDescription(
  data?: Shout | Author | Topic,
  defaultDescription: string = OG_DEFAULT_DESCRIPTION
): string {
  if (!data) return defaultDescription
  if ('body' in data && data.body) return descFromBody(data.body)
  if ('bio' in data && data.bio) return data.bio
  if ('about' in data && data.about) return data.about
  return defaultDescription
}

/**
 * Формирует полный URL для OG-изображения
 */
export function getFullImageUrl(relativePath: string): string {
  return relativePath.startsWith('http') ? relativePath : `${baseUrl}${relativePath}`
}

/**
 * Формирует полный URL для страницы
 */
export function getFullPageUrl(pathname: string): string {
  return `${baseUrl}${pathname}`
}

/**
 * Формирует полный URL для логотипа
 */
export function getLogoUrl(): string {
  return `${baseUrl}${OG_LOGO_PATH}`
}

/**
 * Генерирует параметры для OG-метатегов на основе данных
 */
export function generateOGMetadata(
  data?: Shout | Author | Topic,
  options: {
    pathname?: string
    defaultTitle?: string
    defaultDescription?: string
    locale?: string
  } = {}
): OGMetadata {
  const type = getOGContentType(data)
  const title = getOGTitle(data, options.defaultTitle || '')
  const description = getOGDescription(data, options.defaultDescription || OG_DEFAULT_DESCRIPTION)
  const url = getFullPageUrl(options.pathname || '')
  const imageRelativePath = data ? generateRelativeImagePath(data) : OG_BASE_URL
  const image = getFullImageUrl(imageRelativePath)
  const logo = getLogoUrl()

  // Убедимся, что все обязательные поля заполнены
  return {
    title: title || 'Discours',
    description: description || OG_DEFAULT_DESCRIPTION,
    type,
    url,
    image,
    locale: options.locale || 'ru',
    siteName: OG_SITE_NAME,
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    twitterCard: 'summary_large_image',
    logo
  }
}

/**
 * Генерирует относительный путь к OG-изображению на основе типа объекта
 */
export function generateRelativeImagePath(
  content: Shout | Author | Topic | string,
  options: OGImageOptions = {}
): string {
  // Статья
  if (typeof content === 'object' && 'title' in content && 'body' in content) {
    return getArticleOGImagePath(content as Shout, options)
  }

  // Автор
  if (typeof content === 'object' && 'name' in content) {
    return getAuthorOGImagePath(content as Author, options)
  }

  // Тема
  if (typeof content === 'object' && 'title' in content && !('body' in content)) {
    return getTopicOGImagePath(content as Topic, options)
  }

  return OG_BASE_URL
}

/**
 * Генерирует относительный путь к OG-изображению для статьи
 */
export function getArticleOGImagePath(article: Shout, options: OGImageOptions = {}): string {
  const params = new URLSearchParams()

  params.append('title', article.title)
  params.append('slug', article.slug)
  if (article.authors?.[0]?.name) {
    params.append('author', article.authors[0].name)
  }

  // Добавляем тему если доступна
  if (article.topics && article.topics.length > 0 && article.topics[0]) {
    params.append('topic', article.topics[0].title || '')
  }

  // Добавляем обложку если доступна
  if (article.cover) {
    params.append('cover', article.cover)
  }

  // Добавляем числовые опции как строки
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())

  return `${OG_BASE_URL}/article?${params.toString()}`
}

/**
 * Генерирует относительный путь к OG-изображению для автора
 */
export function getAuthorOGImagePath(author: Author, options: OGImageOptions = {}): string {
  const params = new URLSearchParams()

  params.append('name', author.name || 'Author')
  // Включаем био - OG изображение автоматически обрежет его если нужно
  if (author.bio?.trim()) {
    params.append('bio', author.bio.trim())
  } else if (author.about?.trim()) {
    params.append('bio', author.about.trim())
  }

  if (author.pic) {
    params.append('avatar', author.pic)
  }

  if (author.stat?.shouts) {
    params.append('articlesCount', author.stat.shouts.toString())
  }

  if (author.stat?.followers) {
    params.append('followersCount', author.stat.followers.toString())
  }

  // Добавляем числовые опции как строки
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())

  return `${OG_BASE_URL}/author?${params.toString()}`
}

/**
 * Генерирует относительный путь к OG-изображению для темы
 */
export function getTopicOGImagePath(topic: Topic, options: OGImageOptions = {}): string {
  const params = new URLSearchParams()

  params.append('title', topic.title || 'Topic')
  // Включаем описание - OG изображение автоматически обрежет его если нужно
  if (topic.body?.trim()) {
    const cleanDescription = topic.body
      .replace(/<[^>]*>/g, '') // Удаляем HTML теги
      .replace(/\s+/g, ' ') // Нормализуем пробелы
      .trim()
    if (cleanDescription) {
      params.append('description', cleanDescription)
    }
  }

  // Добавляем обложку темы если доступна
  if (topic.pic) {
    params.append('cover', topic.pic)
  }

  if (topic.stat?.shouts) {
    params.append('articlesCount', topic.stat.shouts.toString())
  }

  // Добавляем числовые опции как строки
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())

  return `${OG_BASE_URL}/topic?${params.toString()}`
}
