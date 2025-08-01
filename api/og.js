import { ImageResponse } from '@vercel/og'

// Базовые настройки
const cdnUrl = 'https://files.dscrs.site'
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

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
 * Обработчик для генерации OG изображений социальных сетей
 * НЕ смешивается с квотер-оверлеями (те используются для shout в контенте)
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

    // Логируем запрос для отладки
    console.log(`[OG] Generating image for type: ${type}, params:`, JSON.stringify(params, null, 2))

    // Общие параметры для всех типов
    const title = params.title || ''
    const description = params.description || ''
    const cover = params.cover || ''
    const isDark = type !== 'basic' && (cover || type === 'article')

    // Формируем контент в зависимости от типа
    let content
    let topRight = null

    switch (type) {
      case 'article': {
        topRight = params.topic ? createTopicBadge(params.topic) : null
        content = { title, description: params.author, cover }
        break
      }
      case 'author': {
        // Формируем статистику для автора
        const stats = [
          params.articlesCount && { text: `${params.articlesCount} статей` },
          params.followersCount && { text: `${params.followersCount} подписчиков` }
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
          ? createStatsBar([{ text: `${params.articlesCount} статей` }])
          : null
        content = { title, description, cover }
        break
      }
      default: {
        // Базовый OG
        return new ImageResponse(createBasicOGImage(), {
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=31536000',
            'CDN-Cache-Control': 'public, max-age=31536000',
            ...CORS_HEADERS
          }
        })
      }
    }

    // Создаем OG изображение с общей структурой
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
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=31536000',
          'CDN-Cache-Control': 'public, max-age=31536000',
          ...CORS_HEADERS
        }
      }
    )
  } catch (error) {
    console.error('Error generating OG image:', error)
    return new Response(`Failed to generate image: ${error.message}`, {
      status: 500
    })
  }
}

/**
 * Создает основную структуру OG-изображения
 */
function createOGImage({
  title,
  description,
  cover,
  topRight = null,
  theme = 'light' // light или dark
}) {
  // Определяем стили на основе темы и наличия обложки
  const isDark = theme === 'dark'

  // Фон изображения - обложки через квотер для правильного размера OG
  const backgroundStyle = cover
    ? {
        background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${getCoverForOG(cover)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        background: isDark ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'
      }

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...backgroundStyle
      }}
    >
      {/* Логотип */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 60,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <img
          src={`${cdnUrl}/logo_sign.png`}
          width={60}
          height={60}
          style={{
            width: 60,
            height: 60,
            objectFit: 'contain',
            borderRadius: '16px'
          }}
        />
      </div>

      {/* Правый верхний элемент */}
      {topRight}

      {/* Заголовок */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 60,
          transform: 'translateY(-50%)',
          maxWidth: 900,
          textAlign: 'left',
          color: isDark ? 'white' : '#1f2937',
          fontWeight: 900,
          fontSize: title.length > 50 ? 50 : 62,
          lineHeight: 1.12,
          textShadow: isDark ? '2px 2px 7px rgba(0,0,0,0.55)' : 'none',
          letterSpacing: '-1px'
        }}
      >
        {title}
      </div>

      {/* Описание */}
      {description && (
        <div
          style={{
            position: 'absolute',
            left: 60,
            bottom: 44,
            fontSize: 32,
            color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(31,41,55,0.7)',
            fontWeight: 300,
            letterSpacing: 0.5,
            textShadow: isDark ? '1px 1px 2px rgba(0,0,0,0.34)' : 'none',
            maxWidth: 900,
            lineHeight: 1.3
          }}
        >
          {description.length > 120 ? `${description.substring(0, 120)}...` : description}
        </div>
      )}
    </div>
  )
}

/**
 * Создает базовое OG-изображение с центрированным логотипом
 */
function createBasicOGImage() {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white'
      }}
    >
      <img
        src={`${cdnUrl}/logo_sign.png`}
        width={200}
        height={200}
        style={{
          width: 200,
          height: 200,
          objectFit: 'contain'
        }}
      />
    </div>
  )
}

/**
 * Создает бейдж для темы
 */
function createTopicBadge(text) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: 135,
        padding: '4px 12px',
        background: 'rgba(255, 255, 255, 0.25)',
        color: 'white',
        borderRadius: 30,
        fontSize: 24,
        backdropFilter: 'blur(4px)',
        textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
      }}
    >
      {text}
    </div>
  )
}

/**
 * Создает панель статистики для правого верхнего угла
 */
function createStatsBar(items) {
  if (!items || items.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 60,
        display: 'flex',
        gap: 20,
        color: 'rgba(255,255,255,0.8)'
      }}
    >
      {items.map((item, index) => (
        <div key={`stat-${item.text}-${index}`} style={{ fontSize: 24 }}>
          {item.text}
        </div>
      ))}
    </div>
  )
}
