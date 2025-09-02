import { ImageResponse } from '@vercel/og'

// Легковесная React-like функция для @vercel/og
// Оптимальна для простых оверлеев без лишнего overhead
function h(type, props, ...children) {
  return { type, props: { ...(props || {}), children } }
}

// Базовые настройки
const cdnUrl = 'https://files.dscrs.site'
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
  en: {
    'Discours — open magazine': 'Discours — open magazine',
    'About culture, science and society': 'About culture, science and society',
    Featured: 'Featured',
    'Read now': 'Read now',
    'and other materials': 'and other materials',
    articles: 'articles',
    followers: 'followers'
  }
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
 * Обрабатывает cover изображения для OG
 */
function getCoverForOG(cover) {
  if (!cover) return null

  // Если это относительный путь, делаем абсолютным
  if (cover.startsWith('/')) {
    return `${cdnUrl}${cover}`
  }

  // Если это уже полный URL с нашим CDN, возвращаем как есть
  if (cover.includes('files.dscrs.site') || cover.includes('cdn.discours.io')) {
    return cover
  }

  // Для обычных изображений добавляем CDN префикс
  return `${cdnUrl}/production/image/${cover}`
}

/**
 * Современный обработчик для генерации OG изображений социальных сетей
 * Использует @vercel/og v1.0+ с поддержкой:
 * - Кастомных шрифтов
 * - Продвинутого кэширования
 * - Оптимизированной производительности
 *
 * Поддерживает пути: /api/og, /api/og/article, /api/og/author, /api/og/topic
 * Размер: строго 1200x630px для Facebook/Twitter/LinkedIn
 */
export async function GET(request) {
  // Обработка CORS для preflight запросов
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS
    })
  }

  try {
    const { searchParams, pathname } = new URL(request.url)

    // Определяем тип запроса по URL
    const pathSegments = pathname.split('/')

    // Получаем тип из последнего сегмента пути: /api/og/article -> article
    // Если путь просто /api/og, используем 'basic'
    let type = 'basic'
    if (pathSegments.length > 2) {
      const lastSegment = pathSegments[pathSegments.length - 1]
      if (lastSegment && lastSegment !== 'og') {
        type = lastSegment
      }
    }

    // Получаем параметры из URL
    const params = Object.fromEntries(searchParams)
    const locale = params.locale || 'ru'

    // Общие параметры для всех типов
    const title = params.title || ''

    // 💋 Минимальное логирование для production
    console.log(`[OG] ${type}:`, title ? title.slice(0, 50) : 'basic')
    const description = params.description || ''
    const cover = params.cover || ''
    const isDark = type !== 'basic' && (cover || type === 'article')

    // Формируем контент в зависимости от типа
    let content
    let topRight = null // Для дополнительных элементов (бейджи)

    switch (type) {
      case 'article': {
        topRight = params.topic ? createTopicBadge(params.topic) : null
        content = { title, description: params.author, cover }
        break
      }
      case 'author': {
        // Формируем статистику для автора
        const stats = [
          params.articlesCount && { text: `${params.articlesCount} ${t('articles', locale)}` },
          params.followersCount && { text: `${params.followersCount} ${t('followers', locale)}` }
        ].filter(Boolean)

        topRight = stats.length ? createStatsBar(stats) : null
        content = {
          title: params.name || title,
          description: params.bio || description,
          cover: params.avatar || cover
        }
        break
      }
      case 'topic': {
        topRight = params.articlesCount
          ? createStatsBar([{ text: `${params.articlesCount} ${t('articles', locale)}` }])
          : null
        content = { title, description, cover }
        break
      }

      default: {
        // Базовый OG - включая homepage
        const featured = params.featured || ''
        content = {
          title: t('Discours — open magazine', locale),
          description: featured
            ? `${t('Read now', locale)}: ${featured.slice(0, 100)}... ${t('and other materials', locale)}`
            : t('About culture, science and society', locale),
          cover: null
        }
        topRight = featured ? createFeaturedBadge(t('Featured', locale)) : null
        return new ImageResponse(createBasicOGImage(), {
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          headers: {
            // 💋 Улучшенное кэширование для статичного лого
            'Cache-Control': 'public, max-age=31536000, immutable',
            'CDN-Cache-Control': 'public, max-age=31536000, immutable',
            ...CORS_HEADERS
          }
        })
      }
    }

    // Создаем OG изображение с оптимизированным кэшированием
    const cacheKey = `${type}-${Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 16)}`

    return new ImageResponse(
      createOGImage({
        title: content.title,
        description: content.description,
        cover: content.cover,
        topRight,
        theme: cover ? 'dark' : isDark ? 'dark' : 'light'
      }),
      {
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
      }
    )
  } catch (error) {
    console.error(`[OG] Error for ${type}:`, error.message)

    // 💋 Graceful fallback - возвращаем базовый OG при ошибке
    try {
      return new ImageResponse(createBasicOGImage(), {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        headers: {
          'Cache-Control': 'public, max-age=300', // Короткий кэш для fallback
          ...CORS_HEADERS
        }
      })
    } catch (fallbackError) {
      console.error('[OG] Fallback failed:', fallbackError.message)
      return new Response('OG image generation failed', { status: 500 })
    }
  }
}

/**
 * Создает основную структуру OG-изображения
 */
function createOGImage({ title, description, cover, topRight = null, theme = 'light' }) {
  const isDark = theme === 'dark'
  const backgroundStyle = cover
    ? {
        background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${getCoverForOG(cover)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: isDark ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'
      }

  const children = [
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
        src: `${cdnUrl}/logo_sign.png`,
        width: 60,
        height: 60,
        style: { width: 60, height: 60, objectFit: 'contain', borderRadius: '16px' }
      })
    ),
    topRight || null,
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
  ]

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
  return h(
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
      src: `${cdnUrl}/logo_sign.png`,
      width: 200,
      height: 200,
      style: { width: 200, height: 200, objectFit: 'contain' }
    })
  )
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
