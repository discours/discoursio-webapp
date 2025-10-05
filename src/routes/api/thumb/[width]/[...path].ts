import sharp from 'sharp'

const cdnUrl = process.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'

/**
 * thumbnail generation
 * Генерирует thumbnails на лету
 *
 * Usage: /api/thumb/640/image.jpg
 * Fetches: https://files.dscrs.site/image.jpg
 * Returns: Resized image (WebP if supported)
 */
export async function GET({ request, params }: { request: Request; params: Record<string, string> }) {
  const startTime = Date.now()

  try {
    // В SolidStart используем params вместо парсинга URL
    const width = Number.parseInt(params.width, 10)
    const imagePath = params.path // SolidStart передает [...path] как одну строку

    console.log(`[thumb] Width: ${width}, Path: ${imagePath}`)

    // Валидация
    if (!width || width < 10 || width > 2000) {
      return new Response('Invalid width', { status: 400 })
    }

    if (!imagePath) {
      return new Response('Image path required', { status: 400 })
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

    return new Response(new Uint8Array(thumbnailBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('[thumb] Error:', error)
    return new Response('Thumbnail generation failed', {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
  }
}
