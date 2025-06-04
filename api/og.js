import { ImageResponse } from '@vercel/og'

const baseUrl = 'https://files.dscrs.site'
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

/**
 * Обработчик для генерации OG изображений
 * Поддерживает пути: /api/og/article, /api/og/author, /api/og/topic и /api/og (базовый)
 */
export default async (req, _res) => {
  try {
    // Определяем тип запроса по URL
    const { url } = req
    const { pathname } = new URL(url)
    const pathSegments = pathname.split('/')
    const type = pathSegments.length > 2 ? pathSegments[pathSegments.length - 1] : 'basic'

    // Извлекаем параметры запроса
    const params = req.query

    // Общие параметры ответа
    const responseData = {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    }

    // Формируем изображение в зависимости от типа запроса
    switch (type) {
      case 'article':
        return new ImageResponse(
          createOGImage({
            title: params.title || 'Discours Article',
            description: params.author,
            cover: params.cover,
            topRight: params.topic ? createTopicBadge(params.topic) : null,
            theme: 'dark'
          }),
          responseData
        )
      case 'author':
        return new ImageResponse(
          createOGImage({
            title: params.name || params.title || 'Author Profile',
            description: params.bio || params.description,
            cover: params.avatar || params.cover,
            topRight: createStatsBar([
              params.articlesCount ? { text: `${params.articlesCount} статей` } : null,
              params.followersCount ? { text: `${params.followersCount} подписчиков` } : null
            ]),
            theme: 'dark'
          }),
          responseData
        )
      case 'topic':
        return new ImageResponse(
          createOGImage({
            title: params.title || 'Topic',
            description: params.description,
            cover: params.cover,
            topRight: params.articlesCount
              ? {
                  type: 'div',
                  props: {
                    style: { fontSize: 24 },
                    children: `${params.articlesCount} статей`
                  }
                }
              : null,
            theme: params.cover ? 'dark' : 'light'
          }),
          responseData
        )
      default:
        return new ImageResponse(createBasicOGImage(), responseData)
    }
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
  const isDark = theme === 'dark' || cover

  // Фон изображения
  const backgroundStyle = cover
    ? {
        background: `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${cover})`,
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
        left: 135, // Логотип 60px шириной + 15px отступ
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
  if (!items || items.filter(Boolean).length === 0) return null

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
      children: items.filter(Boolean).map((item) => ({
        type: 'div',
        props: {
          style: { fontSize: 24 },
          children: item.text
        }
      }))
    }
  }
}
