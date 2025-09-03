/**
 * Serverless function для проксирования статических файлов через квотер
 * Обрабатывает изображения и аудио файлы
 */

export default async function handler(req, res) {
  const { path } = req.query

  if (!path || Array.isArray(path)) {
    return res.status(400).json({ error: 'Invalid path parameter' })
  }

  // Определяем тип файла по расширению
  const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path)
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i.test(path)

  if (!isAudio && !isImage) {
    return res.status(400).json({ error: 'Unsupported file type' })
  }

  try {
    // Извлекаем только имя файла из пути
    const filename = path.split('/').pop() || path

    // URL квотера - имя файла как есть
    const quoterUrl = `https://files.dscrs.site/${filename}`

    const response = await fetch(quoterUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Discours-Proxy/1.0'
      }
    })

    if (!response.ok) {
      console.error(`[Proxy] Quoter error: ${response.status} ${response.statusText}`)
      return res.status(response.status).json({
        error: 'File not found in quoter',
        quoterStatus: response.status
      })
    }

    // Получаем контент
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || (isAudio ? 'audio/mpeg' : 'image/jpeg')

    console.log('[Proxy] Response details:', {
      status: response.status,
      contentType: contentType,
      contentLength: buffer.byteLength,
      filename: filename
    })

    // Устанавливаем заголовки кеширования
    const cacheControl = isImage
      ? 'public, max-age=3600, stale-while-revalidate=86400'
      : 'public, max-age=7200, stale-while-revalidate=172800'

    // Базовые заголовки
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', cacheControl)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')

    // Дополнительные заголовки для аудио
    if (isAudio) {
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Length', buffer.byteLength)

      // Для MP3 файлов
      if (filename.toLowerCase().endsWith('.mp3')) {
        res.setHeader('Content-Type', 'audio/mpeg')
      }
    }

    // Отправляем файл
    res.status(200).send(Buffer.from(buffer))
  } catch (error) {
    console.error('[Proxy] Error:', error)
    res.status(500).json({
      error: 'Proxy error',
      message: error.message
    })
  }
}
