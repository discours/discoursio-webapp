import { Shout, Author, Topic } from '~/graphql/schema/core.gen'

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

const OG_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://testing.discours.io/api/og' // production domain
  : 'https://localhost:3000/api/og'

/**
 * Generate OG image for articles
 * Usage: When sharing article links on social media
 */
export function getArticleOGImage(
  article: Shout, 
  options: OGImageOptions = {}
): string {
  // Debug: log the article data we receive
  console.log('getArticleOGImage received article:', {
    title: article.title,
    slug: article.slug,
    cover: article.cover,
    authors: article.authors,
    topics: article.topics
  })
  
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
export function getAuthorOGImage(
  author: Author,
  options: OGImageOptions = {}
): string {
  const params = new URLSearchParams()
  
  params.append('name', author.name || 'Author')
  // Only include bio if it's short and meaningful
  if (author.bio && author.bio.length <= 100) {
    params.append('bio', author.bio)
  } else if (author.about && author.about.length <= 100) {
    params.append('bio', author.about)
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
export function getTopicOGImage(
  topic: Topic,
  options: OGImageOptions = {}
): string {
  const params = new URLSearchParams()
  
  params.append('title', topic.title || 'Topic')
  // Only include description if it's short
  if (topic.body && topic.body.length <= 100) {
    const cleanDescription = topic.body
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    params.append('description', cleanDescription)
  }
  params.append('icon', getTopicIcon(topic.title || ''))
  
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
 */
export function getBasicOGImage(
  title: string,
  options: { author?: string; topic?: string } & OGImageOptions = {}
): string {
  const params = new URLSearchParams()
  
  params.append('title', title)
  
  if (options.author) {
    params.append('author', options.author)
  }
  
  if (options.topic) {
    params.append('topic', options.topic)
  }
  
  // Add numeric options as strings
  if (options.width) params.append('width', options.width.toString())
  if (options.height) params.append('height', options.height.toString())
  if (options.quality) params.append('quality', options.quality.toString())
  
  return `${OG_BASE_URL}/basic?${params.toString()}`
}

/**
 * Map topic titles to appropriate emojis/icons
 * This creates more engaging visual representations
 */
function getTopicIcon(topicTitle: string): string {
  const iconMap: Record<string, string> = {
    // Science & Technology
    'наука': '🔬',
    'science': '🔬',
    'технологии': '💻',
    'technology': '💻',
    'ai': '🤖',
    'искусственный интеллект': '🤖',
    
    // Arts & Culture
    'искусство': '🎨',
    'art': '🎨',
    'культура': '🎭',
    'culture': '🎭',
    'музыка': '🎵',
    'music': '🎵',
    'кино': '🎬',
    'cinema': '🎬',
    'литература': '📚',
    'literature': '📚',
    
    // Politics & Society
    'политика': '🏛️',
    'politics': '🏛️',
    'общество': '👥',
    'society': '👥',
    'экономика': '📈',
    'economics': '📈',
    
    // Philosophy & Ideas
    'философия': '🤔',
    'philosophy': '🤔',
    'психология': '🧠',
    'psychology': '🧠',
    'образование': '🎓',
    'education': '🎓',
    
    // Nature & Environment
    'экология': '🌱',
    'ecology': '🌱',
    'природа': '🌿',
    'nature': '🌿',
    
    // Default fallback
    'default': '📚'
  }
  
  const lowerTitle = topicTitle.toLowerCase()
  
  // Try to find exact match first
  if (iconMap[lowerTitle]) {
    return iconMap[lowerTitle]
  }
  
  // Try to find partial match
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lowerTitle.includes(key) || key.includes(lowerTitle)) {
      return icon
    }
  }
  
  return iconMap.default
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
    return getBasicOGImage(content, options)
  }
  
  // Fallback
  return getBasicOGImage('Discours', options)
}
