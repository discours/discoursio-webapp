import sharp from 'sharp'

// Базовые настройки
const cdnUrl = process.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'
const defaultImage = `${cdnUrl}/logo_sign.png`

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

// Переводы
const translations = {
  ru: {
    'Discours — open magazine': 'Дискурс — открытый журнал',
    'About culture, science and society': 'О культуре, науке и обществе',
    'Featured': 'Рекомендуем',
    'Read now': 'Читайте сейчас',
    'and other materials': 'и другие материалы',
    'articles': 'статей',
    'followers': 'подписчиков'
  },
  en: {}
}

function t(key, locale = 'ru') {
  return translations[locale]?.[key] || translations['ru'][key] || key
}

// CORS заголовки
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

/**
 * SVG-based OG image generation
 * Использует SVG templates + sharp для конвертации в PNG
 */
export async function GET(request) {
  const startTime = Date.now()

  console.log('[OG] Request:', request.url)

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS
    })
  }

  try {
    const { searchParams, pathname } = new URL(request.url)
    const pathSegments = pathname.split('/')
    
    // Определяем тип: /api/og/article -> article
    let type = 'basic'
    if (pathSegments.length > 2) {
      const lastSegment = pathSegments[pathSegments.length - 1]
      if (lastSegment && lastSegment !== 'og') {
        type = lastSegment
      }
    }

    const params = Object.fromEntries(searchParams)
    const locale = params.locale || 'ru'
    const title = params.title || ''
    const description = params.description || ''
    const cover = params.cover || ''

    console.log(`[OG] Type: ${type}, Title: ${title}`)

    // Создаем SVG в зависимости от типа
    let svg
    switch (type) {
      case 'article':
        svg = createArticleSVG({
          title,
          author: params.author || '',
          topic: params.topic || '',
          cover
        })
        break
      case 'author':
        svg = createAuthorSVG({
          name: params.name || title,
          bio: params.bio || description,
          avatar: params.avatar || cover,
          articlesCount: params.articlesCount || '',
          followersCount: params.followersCount || '',
          locale
        })
        break
      case 'topic':
        svg = createTopicSVG({
          title,
          description,
          cover,
          articlesCount: params.articlesCount || '',
          locale
        })
        break
      default:
        svg = createBasicSVG({
          title: t('Discours — open magazine', locale),
          description: t('About culture, science and society', locale)
        })
    }

    // Конвертируем SVG → PNG через sharp
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)
      .png()
      .toBuffer()

    console.log(`[OG] Generated in ${Date.now() - startTime}ms`)

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000'
      }
    })
  } catch (error) {
    console.error('[OG] Error:', error)

    // Fallback: простое изображение
    try {
      const fallbackSVG = createBasicSVG({
        title: 'Дискурс',
        description: 'О культуре, науке и обществе'
      })
      
      const pngBuffer = await sharp(Buffer.from(fallbackSVG))
        .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT)
        .png()
        .toBuffer()

      return new Response(pngBuffer, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'image/png'
        }
      })
    } catch (fallbackError) {
      console.error('[OG] Fallback error:', fallbackError)
      return new Response('OG generation failed', {
        status: 500,
        headers: CORS_HEADERS
      })
    }
  }
}

// Netlify handler
export const handler = (event) =>
  GET(
    new Request(
      `https://${event.headers.host || 'localhost'}${event.path}?${new URLSearchParams(event.queryStringParameters || {}).toString()}`
    )
  )
    .then(async (res) => ({
      statusCode: res.status,
      headers: Object.fromEntries(res.headers),
      body: Buffer.from(await res.arrayBuffer()).toString('base64'),
      isBase64Encoded: true
    }))
    .catch(() => ({ statusCode: 500, body: 'Error' }))

/**
 * SVG Templates
 */

function createBasicSVG({ title, description }) {
  return `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font: 700 62px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; fill: #1f2937; }
      .desc { font: 400 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; fill: #6b7280; }
    </style>
  </defs>
  
  <rect width="100%" height="100%" fill="white"/>
  
  <!-- Logo (центрировано) -->
  <circle cx="600" cy="250" r="80" fill="#2638d9" opacity="0.1"/>
  <text x="600" y="270" text-anchor="middle" font-size="72" font-weight="bold" fill="#2638d9">Д</text>
  
  <!-- Title -->
  <text x="600" y="400" text-anchor="middle" class="title">${escapeXml(title)}</text>
  
  <!-- Description -->
  <text x="600" y="480" text-anchor="middle" class="desc">${escapeXml(description)}</text>
</svg>
`.trim()
}

function createArticleSVG({ title, author, topic, cover }) {
  const hasCover = !!cover
  const bgColor = hasCover ? '#1f2937' : 'white'
  const titleColor = hasCover ? 'white' : '#1f2937'
  const authorColor = hasCover ? 'rgba(255,255,255,0.8)' : '#6b7280'

  return `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font: 700 ${title.length > 50 ? 50 : 62}px -apple-system, BlinkMacSystemFont, sans-serif; fill: ${titleColor}; }
      .author { font: 400 32px -apple-system, BlinkMacSystemFont, sans-serif; fill: ${authorColor}; }
      .topic { font: 400 24px -apple-system, BlinkMacSystemFont, sans-serif; fill: white; }
    </style>
    ${hasCover ? `
    <clipPath id="coverClip">
      <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}"/>
    </clipPath>
    ` : ''}
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="${bgColor}"/>
  
  ${hasCover ? `
  <!-- Cover image -->
  <image href="${cover}" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" 
         clip-path="url(#coverClip)" opacity="0.3"/>
  <rect width="100%" height="100%" fill="url(#gradient)"/>
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(0,0,0,0.5);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgba(0,0,0,0.7);stop-opacity:1" />
    </linearGradient>
  </defs>
  ` : ''}
  
  <!-- Logo -->
  <circle cx="60" cy="60" r="30" fill="#2638d9"/>
  <text x="60" y="72" text-anchor="middle" font-size="32" font-weight="bold" fill="white">Д</text>
  
  ${topic ? `
  <!-- Topic badge -->
  <rect x="120" y="40" rx="20" fill="rgba(255,255,255,0.25)" width="${topic.length * 14 + 24}" height="40"/>
  <text x="132" y="66" class="topic">${escapeXml(topic)}</text>
  ` : ''}
  
  <!-- Title -->
  <text x="60" y="${OG_IMAGE_HEIGHT / 2 - 20}" class="title" textLength="${Math.min(title.length * 30, 1080)}">
    ${escapeXml(truncate(title, 80))}
  </text>
  
  <!-- Author -->
  ${author ? `
  <text x="60" y="${OG_IMAGE_HEIGHT - 60}" class="author">${escapeXml(author)}</text>
  ` : ''}
</svg>
`.trim()
}

function createAuthorSVG({ name, bio, avatar, articlesCount, followersCount, locale }) {
  const stats = [
    articlesCount && `${articlesCount} ${t('articles', locale)}`,
    followersCount && `${followersCount} ${t('followers', locale)}`
  ].filter(Boolean).join('  •  ')

  return `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .name { font: 700 62px -apple-system, BlinkMacSystemFont, sans-serif; fill: #1f2937; }
      .bio { font: 400 32px -apple-system, BlinkMacSystemFont, sans-serif; fill: #6b7280; }
      .stats { font: 400 28px -apple-system, BlinkMacSystemFont, sans-serif; fill: #9ca3af; }
    </style>
    <clipPath id="avatarClip">
      <circle cx="150" cy="315" r="120"/>
    </clipPath>
  </defs>
  
  <rect width="100%" height="100%" fill="white"/>
  
  <!-- Logo -->
  <circle cx="60" cy="60" r="30" fill="#2638d9"/>
  <text x="60" y="72" text-anchor="middle" font-size="32" font-weight="bold" fill="white">Д</text>
  
  ${stats ? `
  <!-- Stats -->
  <text x="${OG_IMAGE_WIDTH - 60}" y="66" text-anchor="end" class="stats">${escapeXml(stats)}</text>
  ` : ''}
  
  <!-- Avatar -->
  ${avatar ? `
  <image href="${avatar}" x="30" y="195" width="240" height="240" clip-path="url(#avatarClip)"/>
  ` : `
  <circle cx="150" cy="315" r="120" fill="#e5e7eb"/>
  <text x="150" y="340" text-anchor="middle" font-size="72" fill="#9ca3af">?</text>
  `}
  
  <!-- Name -->
  <text x="320" y="280" class="name">${escapeXml(truncate(name, 40))}</text>
  
  <!-- Bio -->
  ${bio ? `
  <text x="320" y="350" class="bio">${escapeXml(truncate(bio, 100))}</text>
  ` : ''}
</svg>
`.trim()
}

function createTopicSVG({ title, description, cover, articlesCount, locale }) {
  const hasCover = !!cover
  const bgColor = hasCover ? '#1f2937' : 'white'
  const titleColor = hasCover ? 'white' : '#1f2937'
  const descColor = hasCover ? 'rgba(255,255,255,0.8)' : '#6b7280'

  return `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font: 700 62px -apple-system, BlinkMacSystemFont, sans-serif; fill: ${titleColor}; }
      .desc { font: 400 32px -apple-system, BlinkMacSystemFont, sans-serif; fill: ${descColor}; }
      .count { font: 400 28px -apple-system, BlinkMacSystemFont, sans-serif; fill: rgba(255,255,255,0.8); }
    </style>
  </defs>
  
  <rect width="100%" height="100%" fill="${bgColor}"/>
  
  ${hasCover ? `
  <image href="${cover}" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" opacity="0.3"/>
  ` : ''}
  
  <!-- Logo -->
  <circle cx="60" cy="60" r="30" fill="#2638d9"/>
  <text x="60" y="72" text-anchor="middle" font-size="32" font-weight="bold" fill="white">Д</text>
  
  ${articlesCount ? `
  <!-- Articles count -->
  <text x="${OG_IMAGE_WIDTH - 60}" y="66" text-anchor="end" class="count">
    ${articlesCount} ${t('articles', locale)}
  </text>
  ` : ''}
  
  <!-- Title -->
  <text x="60" y="${OG_IMAGE_HEIGHT / 2 - 20}" class="title">
    ${escapeXml(truncate(title, 60))}
  </text>
  
  <!-- Description -->
  ${description ? `
  <text x="60" y="${OG_IMAGE_HEIGHT - 60}" class="desc">
    ${escapeXml(truncate(description, 120))}
  </text>
  ` : ''}
</svg>
`.trim()
}

/**
 * Utilities
 */
function escapeXml(unsafe) {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}
