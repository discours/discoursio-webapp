import { ImageResponse } from '@vercel/og'

// Используем квотер только для динамических изображений, статика напрямую
const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://discours.io'
const staticUrl = 'https://files.dscrs.site' // Только для динамических изображений
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630
const IMAGE_PATH_REGEX = /^image\//
const CDN_PATH_REGEX = /\/production\/(.+)$/

/**
 * Обрабатывает cover изображения для OG - через квотер с правильным размером
 */
function getCoverForOG(cover) {
  if (!cover) return cover

  // Если уже обработано квотером - возвращаем как есть
  if (cover.includes('files.dscrs.site')) return cover

  // Извлекаем path из CDN URL
  let imagePath = cover
  if (cover.includes('cdn.discours.io')) {
    const pathMatch = cover.match(CDN_PATH_REGEX)
    if (pathMatch) {
      imagePath = pathMatch[1]
    }
  }

  // Возвращаем через квотер с оптимальным размером для OG
  return `${staticUrl}/image/${imagePath.replace(IMAGE_PATH_REGEX, '')}_1200.jpg`
}

/**
 * Обработчик для генерации OG изображений социальных сетей
 * НЕ смешивается с квотер-оверлеями (те используются для shout в контенте)
 *
 * Поддерживает пути: /api/og, /api/og/article, /api/og/author, /api/og/topic
 * Размер: строго 1200x630px для Facebook/Twitter/LinkedIn
 */
export default async (req, _res) => {
  try {
    // Определяем тип запроса по URL
    const { url } = req
    const { pathname, searchParams } = new URL(url)
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

    // Объединяем параметры из URL и query
    const params = { ...Object.fromEntries(searchParams), ...req.query }

    // Логируем запрос для отладки
    console.log(`[OG] Generating image for type: ${type}, params:`, params)

    // Общие параметры ответа с правильными заголовками для OG
    const responseData = {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        // Дополнительные заголовки для OG
        'X-OG-Image-Type': 'image/png',
        'X-OG-Image-Width': OG_IMAGE_WIDTH.toString(),
        'X-OG-Image-Height': OG_IMAGE_HEIGHT.toString(),
        'X-OG-Image-Alt': params.title || 'Discours'
      }
    }

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
          ? {
              type: 'div',
              props: {
                style: { fontSize: 24 },
                children: `${params.articlesCount} статей`
              }
            }
          : null
        content = { title, description, cover }
        break
      }
      default: {
        // Базовый OG
        return new ImageResponse(createBasicOGImage(), responseData)
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
      responseData
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

  // Создаем логотип
  const logo = createLogo()

  // Создаем заголовок
  const mainTitle = createTitle(title, isDark)

  // Создаем описание, если оно есть
  const bottomText = description ? createDescription(description, isDark) : null

  // Финальная сборка
  return {
    type: 'div',
    props: {
      style: {
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...backgroundStyle
      },
      children: [logo, topRight, mainTitle, bottomText].filter(Boolean)
    }
  }
}

/**
 * Создает базовое OG-изображение с центрированным логотипом
 */
function createBasicOGImage() {
  return {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white'
      },
      children: {
        type: 'img',
        props: {
          src: `${baseUrl}/logo_sign.png`,
          width: 200,
          height: 200,
          style: {
            width: 200,
            height: 200,
            objectFit: 'contain'
          }
        }
      }
    }
  }
}

/**
 * Создает элемент с логотипом
 */
function createLogo() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 40,
        left: 60,
        display: 'flex',
        alignItems: 'center'
      },
      children: [
        {
          type: 'img',
          props: {
            src: `${baseUrl}/logo_sign.png`,
            width: 60,
            height: 60,
            style: {
              width: 60,
              height: 60,
              objectFit: 'contain',
              borderRadius: '16px'
            }
          }
        }
      ]
    }
  }
}

/**
 * Создает элемент с заголовком
 */
function createTitle(text, isDark = false) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: '50%',
        left: 60,
        transform: 'translateY(-50%)',
        maxWidth: 900,
        textAlign: 'left',
        color: isDark ? 'white' : '#1f2937',
        fontWeight: 900,
        fontSize: text.length > 50 ? 50 : 62,
        lineHeight: 1.12,
        textShadow: isDark ? '2px 2px 7px rgba(0,0,0,0.55)' : 'none',
        letterSpacing: '-1px'
      },
      children: text
    }
  }
}

/**
 * Создает элемент с описанием
 */
function createDescription(text, isDark = false) {
  return {
    type: 'div',
    props: {
      style: {
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
      },
      children: text.length > 120 ? `${text.substring(0, 120)}...` : text
    }
  }
}

/**
 * Создает бейдж для темы
 */
function createTopicBadge(text) {
  return {
    type: 'div',
    props: {
      style: {
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
      },
      children: text
    }
  }
}

/**
 * Создает панель статистики для правого верхнего угла
 */
function createStatsBar(items) {
  if (!items || items.length === 0) return null

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 40,
        right: 60,
        display: 'flex',
        gap: 20,
        color: 'rgba(255,255,255,0.8)'
      },
      children: items.map((item) => ({
        type: 'div',
        props: {
          style: { fontSize: 24 },
          children: item.text
        }
      }))
    }
  }
}
