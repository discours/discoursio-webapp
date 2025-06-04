import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import { authorizerRedirectUrl } from '~/config'

/**
 * Generate OG image URL for different content types
 * This function creates URLs that point to our OG API endpoints
 * with the appropriate parameters for dynamic image generation
 */

export interface OGImageOptions {
  width?: number
  height?: number
  quality?: number
}

// Use the same base domain as configured in config.ts
const OG_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? `${new URL(authorizerRedirectUrl).origin}/api/og` // Use configured domain from config
    : 'https://localhost:3000/api/og'

/**
 * Generate OG image for articles
 * Usage: When sharing article links on social media
 */
export function getArticleOGImage(article: Shout, options: OGImageOptions = {}): string {
  const params = new URLSearchParams()

  params.append('title', article.title || 'Discours Article')
  params.append('slug', article.slug || '')
  params.append('author', article.authors?.[0]?.name || '')

  // Add topic if available
  if (article.topics && article.topics.length > 0 && article.topics[0]) {
    params.append('topic', article.topics[0].title || '')
  }

  if (article.cover) {
    params.append('cover', article.cover)
  }

  // Add numeric options as strings
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())

  return `${OG_BASE_URL}/article?${params.toString()}`
}

/**
 * Generate OG image for author profiles
 * Usage: When sharing author profile links
 */
export function getAuthorOGImage(author: Author, options: OGImageOptions = {}): string {
  const params = new URLSearchParams()

  params.append('name', author.name || 'Author')
  // Include bio/about - OG image will handle truncation if needed
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

  // Add numeric options as strings
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())

  return `${OG_BASE_URL}/author?${params.toString()}`
}

/**
 * Generate OG image for topics
 * Usage: When sharing topic pages
 */
export function getTopicOGImage(topic: Topic, options: OGImageOptions = {}): string {
  const params = new URLSearchParams()

  params.append('title', topic.title || 'Topic')
  // Include description - OG image will handle truncation if needed
  if (topic.body?.trim()) {
    const cleanDescription = topic.body
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    if (cleanDescription) {
      params.append('description', cleanDescription)
    }
  }

  // Add topic cover image if available
  if (topic.pic) {
    params.append('cover', topic.pic)
  }

  if (topic.stat?.shouts) {
    params.append('articlesCount', topic.stat.shouts.toString())
  }

  // Add numeric options as strings
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())

  return `${OG_BASE_URL}/topic?${params.toString()}`
}

/**
 * Generate basic OG image for general pages
 * Usage: For pages without specific content (home, about, etc.)
 * Returns simple white background with centered logo
 */
export function getBasicOGImage(): string {
  return `${OG_BASE_URL}/basic`
}

/**
 * Smart OG image generator that automatically detects content type
 * This is the main function you should use in most cases
 */
export function generateOGImage(
  content: Shout | Author | Topic | string,
  options: OGImageOptions = {}
): string {
  // Article
  if (typeof content === 'object' && 'title' in content && 'body' in content) {
    return getArticleOGImage(content as Shout, options)
  }

  // Author
  if (typeof content === 'object' && 'name' in content) {
    return getAuthorOGImage(content as Author, options)
  }

  // Topic
  if (typeof content === 'object' && 'title' in content && !('body' in content)) {
    return getTopicOGImage(content as Topic, options)
  }

  // Basic string title
  if (typeof content === 'string') {
    return getBasicOGImage()
  }

  // Fallback
  return getBasicOGImage()
}
