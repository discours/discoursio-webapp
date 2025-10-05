import sharp from 'sharp'

const cdnUrl = process.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'

// Vercel Serverless Function config (Node.js runtime для поддержки sharp)
export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
  // Увеличиваем memory для обработки больших изображений
  memory: 1024
}

/**
 * Vercel Serverless thumbnail generation
 * Генерирует thumbnails на лету с использованием sharp (Node.js runtime)
 *
 * Usage: /api/thumb/640/image.jpg
 * Fetches: https://files.dscrs.site/image.jpg
 * Returns: Resized image (WebP if supported)
 *
 * Caching: 1 year immutable cache для оптимальной производительности
 *
 * Note: Использует Node.js runtime вместо Edge для поддержки sharp
 */
export async function GET(request) {
  const startTime = Date.now()

  try {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)

    // /api/thumb/[width]/[...path]
    // pathSegments: ['api', 'thumb', '640', 'image.jpg']
    const widthIndex = pathSegments.indexOf('thumb') + 1
    const width = Number.parseInt(pathSegments[widthIndex], 10)
    const imagePath = pathSegments.slice(widthIndex + 1).join('/')

    console.log(`[thumb] Width: ${width}, Path: ${imagePath}`)

    // Валидация
    if (!width || width < 10 || width > 2000) {
      return new Response('Invalid width', { status: 400 })
    }

    if (!imagePath) {
      return new Response('Image path required', { status: 400 })
    }

    // Проверяем, что это изображение по расширению
    const extension = imagePath.split('.').pop()?.toLowerCase() || ''
    const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']
    if (!validImageExtensions.includes(extension)) {
      console.warn(`[thumb] Invalid image extension: ${extension}`)
      return new Response('Only image files are supported', { status: 400 })
    }

    // Fetch оригинал из Quoter
    const originalUrl = `${cdnUrl}/${imagePath}`
    console.log(`[thumb] Fetching: ${originalUrl}`)

    const originalResponse = await fetch(originalUrl)
    if (!originalResponse.ok) {
      console.error(`[thumb] Failed to fetch: ${originalResponse.status}`)
      return new Response('Image not found', { status: 404 })
    }

    const originalBuffer = await originalResponse.arrayBuffer()
    console.log(`[thumb] Original size: ${originalBuffer.byteLength} bytes`)

    // Определяем формат вывода по Accept header
    const accept = request.headers.get('accept') || ''
    const supportsWebP = accept.includes('image/webp')
    const supportsAVIF = accept.includes('image/avif')

    // Генерируем thumbnail
    let sharpInstance = sharp(Buffer.from(originalBuffer)).resize(width, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })

    // Выбираем оптимальный формат
    let contentType = 'image/jpeg'
    if (supportsAVIF) {
      sharpInstance = sharpInstance.avif({ quality: 80 })
      contentType = 'image/avif'
    } else if (supportsWebP) {
      sharpInstance = sharpInstance.webp({ quality: 85 })
      contentType = 'image/webp'
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: true })
    }

    const thumbnailBuffer = await sharpInstance.toBuffer()

    console.log(
      `[thumb] Generated ${contentType} in ${Date.now() - startTime}ms, size: ${thumbnailBuffer.byteLength} bytes`
    )

    return new Response(thumbnailBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Vercel Edge Cache best practices:
        // - public: cacheable by browsers and CDN
        // - s-maxage: CDN cache duration (1 year)
        // - max-age: browser cache duration (1 year)
        // - immutable: indicates the response will never change
        'Cache-Control': 'public, s-maxage=31536000, max-age=31536000, immutable',
        // Stale-while-revalidate for better UX
        'CDN-Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400'
      }
    })
  } catch (error) {
    console.error('[thumb] Error:', error)
    return new Response('Thumbnail generation failed', {
      status: 500,
      headers: {
        // Don't cache errors
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  }
}

// Netlify handler
export const handler = async (event) => {
  try {
    const response = await GET(
      new Request(
        `https://${event.headers.host || 'localhost'}${event.path}?${new URLSearchParams(event.queryStringParameters || {}).toString()}`
      )
    )

    const buffer = await response.arrayBuffer()

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true
    }
  } catch (error) {
    console.error('[thumb] Netlify handler error:', error)
    return {
      statusCode: 500,
      body: 'Error'
    }
  }
}
