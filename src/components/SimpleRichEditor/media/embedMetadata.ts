/**
 * @module media/embedMetadata
 * @description Получение мета-данных для embed preview без загрузки внешних SDK
 *
 * Использует Open Graph теги и oEmbed API для получения:
 * - title
 * - description
 * - thumbnail image
 *
 * Все запросы идут через наш backend для защиты приватности
 */

export interface EmbedMetadata {
  title?: string
  description?: string
  thumbnail?: string
  author?: string
  authorUrl?: string
  embedType?: 'video' | 'photo' | 'link' | 'rich'
}

/**
 * oEmbed endpoints для различных платформ
 */
export const OEMBED_ENDPOINTS: Record<string, string> = {
  youtube: 'https://www.youtube.com/oembed',
  vimeo: 'https://vimeo.com/api/oembed.json',
  twitch: 'https://api.twitch.tv/v5/oembed',
  ted: 'https://www.ted.com/services/v1/oembed.json',
  soundcloud: 'https://soundcloud.com/oembed',
  bandcamp: 'https://bandcamp.com/EmbeddedPlayer/oembed',
  instagram: 'https://graph.facebook.com/v12.0/instagram_oembed',
  facebook: 'https://graph.facebook.com/v12.0/oembed_post',
  twitter: 'https://publish.twitter.com/oembed',
  reddit: 'https://www.reddit.com/oembed',
  tiktok: 'https://www.tiktok.com/oembed',
  slideshare: 'https://www.slideshare.net/api/oembed/2',
  flickr: 'https://www.flickr.com/services/oembed',
  imgur: 'https://api.imgur.com/oembed'
  // Wikipedia не использует oEmbed, используется Open Graph
}

/**
 * Получает мета-данные через наш backend API
 * @param url URL для получения метаданных
 * @returns Promise с метаданными или null если недоступно
 */
export const fetchEmbedMetadata = async (url: string): Promise<EmbedMetadata | null> => {
  try {
    // Делаем запрос через наш backend endpoint
    // Это защищает приватность - внешние сервисы не узнают IP пользователя
    const response = await fetch('/api/embed/metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      console.warn('Failed to fetch embed metadata:', response.statusText)
      return null
    }

    const data = await response.json()
    return data as EmbedMetadata
  } catch (error) {
    console.error('Error fetching embed metadata:', error)
    return null
  }
}

/**
 * Получает мета-данные через oEmbed API (fallback, если нет backend)
 * @param url URL для получения метаданных
 * @param platform Платформа embed
 * @returns Promise с метаданными или null
 */
export const fetchOEmbedMetadata = async (
  url: string,
  platform: keyof typeof OEMBED_ENDPOINTS
): Promise<EmbedMetadata | null> => {
  const endpoint = OEMBED_ENDPOINTS[platform]
  if (!endpoint) return null

  try {
    const oembedUrl = `${endpoint}?url=${encodeURIComponent(url)}&format=json`
    const response = await fetch(oembedUrl)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    return {
      title: data.title,
      description: data.description,
      thumbnail: data.thumbnail_url,
      author: data.author_name,
      authorUrl: data.author_url,
      embedType: data.type
    }
  } catch (error) {
    console.error(`Error fetching oEmbed for ${platform}:`, error)
    return null
  }
}

/**
 * Кеш для мета-данных (в памяти)
 */
const metadataCache = new Map<string, EmbedMetadata>()

/**
 * Получает мета-данные с кешированием
 * @param url URL для получения метаданных
 * @param platform Платформа (опционально, для oEmbed fallback)
 * @returns Promise с метаданными или null
 */
export const getEmbedMetadata = async (
  url: string,
  platform?: keyof typeof OEMBED_ENDPOINTS
): Promise<EmbedMetadata | null> => {
  // Проверяем кеш
  if (metadataCache.has(url)) {
    return metadataCache.get(url) || null
  }

  // Пытаемся получить через backend
  let metadata = await fetchEmbedMetadata(url)

  // Если не получилось и есть platform, пробуем oEmbed напрямую
  if (!metadata && platform) {
    metadata = await fetchOEmbedMetadata(url, platform)
  }

  // Кешируем результат
  if (metadata) {
    metadataCache.set(url, metadata)
  }

  return metadata
}

/**
 * Создает HTML для preview с метаданными
 * @param metadata Мета-данные embed
 * @param platform Платформа
 * @returns HTML строка для preview
 */
export const createMetadataPreview = (metadata: EmbedMetadata, platform: string, platformColor: string): string => {
  const wrapper = document.createElement('div')
  wrapper.className = 'embed-metadata-preview'
  wrapper.style.display = 'flex'
  wrapper.style.gap = '12px'
  wrapper.style.padding = '12px'
  wrapper.style.border = '1px solid #e1e8ed'
  wrapper.style.borderRadius = '8px'
  wrapper.style.backgroundColor = '#fff'
  wrapper.style.marginBottom = '10px'

  // Thumbnail
  if (metadata.thumbnail) {
    const thumbnail = document.createElement('img')
    thumbnail.src = metadata.thumbnail
    thumbnail.alt = metadata.title || 'Embed thumbnail'
    thumbnail.style.width = '120px'
    thumbnail.style.height = '90px'
    thumbnail.style.objectFit = 'cover'
    thumbnail.style.borderRadius = '4px'
    thumbnail.style.flexShrink = '0'
    wrapper.appendChild(thumbnail)
  }

  // Content
  const content = document.createElement('div')
  content.style.flex = '1'
  content.style.minWidth = '0'

  // Platform badge
  const badge = document.createElement('div')
  badge.textContent = platform.toUpperCase()
  badge.style.display = 'inline-block'
  badge.style.fontSize = '10px'
  badge.style.fontWeight = '600'
  badge.style.color = platformColor
  badge.style.backgroundColor = `${platformColor}15`
  badge.style.padding = '2px 6px'
  badge.style.borderRadius = '3px'
  badge.style.marginBottom = '6px'
  content.appendChild(badge)

  // Title
  if (metadata.title) {
    const title = document.createElement('div')
    title.textContent = metadata.title
    title.style.fontWeight = '600'
    title.style.fontSize = '14px'
    title.style.color = '#14171a'
    title.style.marginBottom = '4px'
    title.style.overflow = 'hidden'
    title.style.textOverflow = 'ellipsis'
    title.style.whiteSpace = 'nowrap'
    content.appendChild(title)
  }

  // Description
  if (metadata.description) {
    const description = document.createElement('div')
    description.textContent = metadata.description
    description.style.fontSize = '12px'
    description.style.color = '#657786'
    description.style.overflow = 'hidden'
    description.style.textOverflow = 'ellipsis'
    description.style.display = '-webkit-box'
    description.style.webkitLineClamp = '2'
    description.style.webkitBoxOrient = 'vertical'
    description.style.lineHeight = '1.4'
    content.appendChild(description)
  }

  // Author
  if (metadata.author) {
    const author = document.createElement('div')
    author.textContent = `by ${metadata.author}`
    author.style.fontSize = '11px'
    author.style.color = '#AAB8C2'
    author.style.marginTop = '4px'
    content.appendChild(author)
  }

  wrapper.appendChild(content)
  return wrapper.outerHTML
}

/**
 * Очищает кеш метаданных
 */
export const clearMetadataCache = (): void => {
  metadataCache.clear()
}
