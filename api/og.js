import { ImageResponse } from '@vercel/og'

// Легковесная React-like функция для @vercel/og
// Оптимальна для простых оверлеев без лишнего overhead
function h(type, props, ...children) {
  return { type, props: { ...(props || {}), children } }
}

// Базовые настройки
const cdnUrl = 'https://files.dscrs.site'
const defaultImage = `${cdnUrl}/logo_sign.png`

// Функция для правильной обработки CDN URL
const getCdnUrl = (url, width) => {
  if (!url) return url
  let filepath = ''
  try {
    filepath = new URL(url).pathname
  } catch {
    filepath = url
  }
  const fileparts = filepath.split('/')
  let filename = fileparts.pop() || ''
  if (!filename) filename = filepath
  if (filename.toLowerCase() === 'webp') filename = fileparts.pop() || ''
  if (!filename) return url
  if (width) {
    const extension = filename.split('.').pop() || ''
    if (extension && !filename.includes(`_${width}`)) {
      filename = filename.replace(`.${extension}`, `_${width}.${extension}`)
    }
  }
  return `${cdnUrl}/${filename}`
}

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

// Переводы для Edge Runtime
const translations = {
  ru: {
    'Discours — open magazine': 'Дискурс — открытый журнал',
    'About culture, science and society': 'О культуре, науке и обществе',
    Featured: 'Рекомендуем',
    'Read now': 'Читайте сейчас',
    'and other materials': 'и другие материалы',
    articles: 'статей',
    followers: 'подписчиков'
  },
  en: {}
}

// Простая функция перевода для Edge Runtime
function t(key, locale = 'ru') {
  return translations[locale]?.[key] || translations['ru'][key] || key
}

// Добавляем CORS заголовки
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

/**
 * Современный обработчик для генерации OG изображений социальных сетей
 * Использует @vercel/og v1.0+ с поддержкой:
 * - Кастомной h() функции для элементов
 * - Продвинутого кэширования
 * - Оптимизированной производительности
 *
 * Поддерживает пути: /api/og, /api/og/article, /api/og/author, /api/og/topic
 * Размер: строго 1200x630px для Facebook/Twitter/LinkedIn
 */
export async function GET(request) {
  const startTime = Date.now()

  // 🔍 ДИАГНОСТИКА: Начальные логи
  console.log('[OG] ===== REQUEST START =====')
  console.log(`[OG] Timestamp: ${new Date().toISOString()}`)
  console.log(`[OG] Method: ${request.method}`)
  console.log(`[OG] URL: ${request.url}`)
  console.log('[OG] Headers:', Object.fromEntries(request.headers.entries()))

  // Обработка CORS для preflight запросов
  if (request.method === 'OPTIONS') {
    console.log('[OG] CORS preflight request')
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS
    })
  }

  try {
    const { searchParams, pathname } = new URL(request.url)

    // 🔍 ДИАГНОСТИКА: URL парсинг
    console.log(`[OG] Parsed pathname: ${pathname}`)
    console.log('[OG] Search params:', Object.fromEntries(searchParams))

    // Определяем тип запроса по URL
    const pathSegments = pathname.split('/')

    // 🔍 ДИАГНОСТИКА: Разбор пути
    console.log('[OG] Path segments:', pathSegments)

    // Получаем тип из последнего сегмента пути: /api/og/article -> article
    // Если путь просто /api/og, используем 'basic'
    let type = 'basic'
    if (pathSegments.length > 2) {
      const lastSegment = pathSegments[pathSegments.length - 1]
      console.log(`[OG] Last segment: "${lastSegment}"`)
      if (lastSegment && lastSegment !== 'og') {
        type = lastSegment
      }
    }

    console.log(`[OG] Determined type: "${type}"`)

    // Получаем параметры из URL
    const params = Object.fromEntries(searchParams)
    const locale = params.locale || 'ru'

    // Общие параметры для всех типов
    const title = params.title || ''

    // 🔍 ДИАГНОСТИКА: Подробные параметры
    console.log(`[OG] Processing type: "${type}"`)
    console.log(`[OG] Title: "${title}"`)
    console.log(`[OG] Locale: "${locale}"`)
    console.log('[OG] All params:', params)
    const description = params.description || ''
    const cover = params.cover || ''
    const isDark = type !== 'basic' && (cover || type === 'article')

    // Формируем контент в зависимости от типа
    let content
    let topRight = null // Для дополнительных элементов (бейджи)

    console.log(`[OG] Switching on type: "${type}"`)

    switch (type) {
      case 'article': {
        console.log(`[OG] Processing article with topic: "${params.topic}", author: "${params.author}"`)
        topRight = params.topic ? createTopicBadge(params.topic) : null
        content = { title, description: params.author, cover }
        console.log('[OG] Article content:', content)
        break
      }
      case 'author': {
        console.log(`[OG] Processing author with name: "${params.name}", bio: "${params.bio}"`)
        // Формируем статистику для автора
        const stats = [
          params.articlesCount && { text: `${params.articlesCount} ${t('articles', locale)}` },
          params.followersCount && { text: `${params.followersCount} ${t('followers', locale)}` }
        ].filter(Boolean)

        console.log('[OG] Author stats:', stats)
        topRight = stats.length ? createStatsBar(stats) : null
        content = {
          title: params.name || title,
          description: params.bio || description,
          cover: params.avatar || cover
        }
        console.log('[OG] Author content:', content)
        break
      }
      case 'topic': {
        console.log(`[OG] Processing topic with title: "${title}", articlesCount: "${params.articlesCount}"`)
        topRight = params.articlesCount
          ? createStatsBar([{ text: `${params.articlesCount} ${t('articles', locale)}` }])
          : null
        content = { title, description, cover }
        console.log('[OG] Topic content:', content)
        break
      }

      default: {
        console.log(`[OG] Processing default/basic type with featured: "${params.featured}"`)
        // Базовый OG - включая homepage
        const featured = params.featured || ''
        content = {
          title: t('Discours — open magazine', locale),
          description: featured
            ? `${t('Read now', locale)}: ${featured.slice(0, 100)}... ${t('and other materials', locale)}`
            : t('About culture, science and society', locale),
          cover: null
        }
        console.log('[OG] Basic content:', content)
        topRight = featured ? createFeaturedBadge(t('Featured', locale)) : null

        console.log('[OG] Creating basic OG image...')
        const basicImage = createBasicOGImage()
        console.log('[OG] Basic image created:', basicImage)

        const response = new ImageResponse(basicImage, {
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          headers: {
            // 💋 Улучшенное кэширование для статичного лого
            'Cache-Control': 'public, max-age=31536000, immutable',
            'CDN-Cache-Control': 'public, max-age=31536000, immutable',
            ...CORS_HEADERS
          }
        })

        console.log(`[OG] Returning basic response, duration: ${Date.now() - startTime}ms`)
        return response
      }
    }

    // Создаем OG изображение с оптимизированным кэшированием
    const cacheKey = `${type}-${Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 16)}`
    console.log(`[OG] Cache key: "${cacheKey}"`)

    const theme = cover ? 'dark' : isDark ? 'dark' : 'light'
    console.log(`[OG] Theme: "${theme}", isDark: ${isDark}, hasCover: ${!!cover}`)

    const ogImageProps = {
      title: content.title,
      description: content.description,
      cover: content.cover,
      topRight,
      theme
    }
    console.log(`[OG] Creating OG image with props:`, ogImageProps)

    const ogImage = createOGImage(ogImageProps)
    console.log(`[OG] OG image created:`, ogImage)

    const response = new ImageResponse(ogImage, {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      // fonts: await loadCustomFonts(), // 💋 Отключено для edge runtime
      headers: {
        // 💋 Динамическое кэширование на основе контента
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000',
        'CDN-Cache-Control': 'public, max-age=2592000',
        ETag: `"${cacheKey}"`,
        Vary: 'Accept-Encoding',
        ...CORS_HEADERS
      }
    })

    console.log(`[OG] ===== REQUEST SUCCESS =====`)
    console.log(`[OG] Duration: ${Date.now() - startTime}ms`)
    console.log(`[OG] Response headers:`, response.headers)

    return response
  } catch (error) {
    console.error(`[OG] ===== REQUEST ERROR =====`)
    console.error(`[OG] Error type: ${error.constructor.name}`)
    console.error(`[OG] Error message: ${error.message}`)
    console.error(`[OG] Error stack:`, error.stack)
    console.error(`[OG] Duration before error: ${Date.now() - startTime}ms`)

    // 💋 Graceful fallback - возвращаем базовый OG при ошибке
    try {
      console.log(`[OG] Attempting fallback with basic image...`)
      const fallbackImage = createBasicOGImage()
      console.log(`[OG] Fallback image created:`, fallbackImage)
      
      const fallbackResponse = new ImageResponse(fallbackImage, {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        headers: {
          'Cache-Control': 'public, max-age=300', // Короткий кэш для fallback
          ...CORS_HEADERS
        }
      })
      
      console.log(`[OG] ===== FALLBACK SUCCESS =====`)
      console.log(`[OG] Fallback duration: ${Date.now() - startTime}ms`)
      return fallbackResponse
      
    } catch (fallbackError) {
      console.error(`[OG] ===== FALLBACK ERROR =====`)
      console.error(`[OG] Fallback error type: ${fallbackError.constructor.name}`)
      console.error(`[OG] Fallback error message: ${fallbackError.message}`)
      console.error(`[OG] Fallback error stack:`, fallbackError.stack)
      console.error(`[OG] Total duration: ${Date.now() - startTime}ms`)
      
      return new Response('OG image generation failed', { 
        status: 500,
        headers: CORS_HEADERS
      })
    }
  }
}

/**
 * Создает основную структуру OG-изображения
 */
function createOGImage({ title, description, cover, topRight = null, theme = 'light' }) {
  console.log(`[OG] createOGImage called with:`, { title, description, cover, topRight: !!topRight, theme })
  
  const isDark = theme === 'dark'
  console.log(`[OG] isDark: ${isDark}`)
  const backgroundStyle = cover
    ? {
        background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${getCdnUrl(cover)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: isDark ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'
      }
      
  console.log(`[OG] Background style:`, backgroundStyle)
  
  if (cover) {
    const processedCoverUrl = getCdnUrl(cover)
    console.log(`[OG] Cover URL: "${cover}" -> processed: "${processedCoverUrl}"`)
  }

  const children = [
    // Logo
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: 40,
          left: 60,
          display: 'flex',
          alignItems: 'center'
        }
      },
      h('img', {
        src: defaultImage,
        width: 60,
        height: 60,
        style: { width: 60, height: 60, objectFit: 'contain', borderRadius: '16px' }
      })
    ),

    // Top right element (badge/stats)
    topRight,

    // Main title
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: '50%',
          left: 60,
          transform: 'translateY(-50%)',
          maxWidth: 900,
          textAlign: 'left',
          color: isDark ? 'white' : '#1f2937',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
          fontWeight: 700,
          fontSize: title.length > 50 ? 50 : 62,
          lineHeight: 1.12,
          textShadow: isDark ? '2px 2px 7px rgba(0,0,0,0.55)' : 'none',
          letterSpacing: '-1px'
        }
      },
      title
    )
  ].filter(Boolean) // Удаляем null элементы

  // Description (если есть)
  if (description) {
    children.push(
      h(
        'div',
        {
          style: {
            position: 'absolute',
            left: 60,
            bottom: 44,
            fontSize: 32,
            color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(31,41,55,0.7)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
            fontWeight: 400,
            letterSpacing: 0.5,
            textShadow: isDark ? '1px 1px 2px rgba(0,0,0,0.34)' : 'none',
            maxWidth: 900,
            lineHeight: 1.3
          }
        },
        description.length > 120 ? `${description.substring(0, 120)}...` : description
      )
    )
  }

  return h(
    'div',
    {
      style: {
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...backgroundStyle
      }
    },
    ...children
  )
}

/**
 * Создает базовое OG-изображение с центрированным логотипом
 */
function createBasicOGImage() {
  console.log(`[OG] createBasicOGImage called`)
  console.log(`[OG] Using default image: "${defaultImage}"`)
  
  const result = h(
    'div',
    {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white'
      }
    },
    h('img', {
      src: defaultImage,
      width: 200,
      height: 200,
      style: { width: 200, height: 200, objectFit: 'contain' }
    })
  )
  
  console.log(`[OG] Basic image result:`, result)
  return result
}

/**
 * Создает бейдж для темы
 */
function createTopicBadge(text) {
  return h(
    'div',
    {
      style: {
        position: 'absolute',
        top: 40,
        left: 135,
        padding: '4px 12px',
        background: 'rgba(255, 255, 255, 0.25)',
        color: 'white',
        borderRadius: 30,
        fontSize: 24,
        fontFamily: 'Muller, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: 400,
        backdropFilter: 'blur(4px)',
        textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
      }
    },
    text
  )
}

/**
 * Создает панель статистики для правого верхнего угла
 */
function createStatsBar(items) {
  if (!items || items.length === 0) return null

  return h(
    'div',
    {
      style: {
        position: 'absolute',
        top: 40,
        right: 60,
        display: 'flex',
        gap: 20,
        color: 'rgba(255,255,255,0.8)'
      }
    },
    ...items.map((item, index) =>
      h(
        'div',
        {
          key: `stat-${item.text}-${index}`,
          style: {
            fontSize: 24,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
            fontWeight: 400
          }
        },
        item.text
      )
    )
  )
}

/**
 * Создает бейдж "Рекомендуем" для главной страницы
 */
function createFeaturedBadge(text) {
  return h(
    'div',
    {
      style: {
        position: 'absolute',
        top: 40,
        right: 60,
        padding: '8px 16px',
        background: 'rgba(34, 197, 94, 0.9)', // Зеленый цвет для "рекомендуем"
        color: 'white',
        borderRadius: 8,
        fontSize: 24,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        fontWeight: 600,
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    },
    text
  )
}
