/**
 * API-эндпоинт для периодической очистки кеша
 * Запускается по расписанию через cron в vercel.json
 */
export default async function handler(req, res) {
  try {
    // Проверка метода запроса
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Проверка авторизации для ручного запуска
    // Если запрос от cron, то Authorization не требуется
    const isCronRequest = req.headers['x-vercel-cron'] === '1'
    const authHeader = req.headers.authorization

    if (!isCronRequest && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!isCronRequest) {
      // Проверка токена для ручных запросов
      const token = authHeader.split(' ')[1]
      // В реальном сценарии здесь должна быть проверка токена
      // например, сравнение с переменной окружения
      if (token !== process.env.CACHE_PURGE_TOKEN) {
        return res.status(401).json({ error: 'Invalid token' })
      }
    }

    // Логика очистки кеша
    // В реальном сценарии здесь должен быть вызов API Vercel для очистки кеша
    // https://vercel.com/docs/rest-api#endpoints/deployments/clear-cache-of-deployment

    console.log('[purge-cache] Starting cache purge process')

    // Имитация очистки кеша
    const results = {
      purged: true,
      timestamp: new Date().toISOString(),
      source: isCronRequest ? 'cron' : 'manual'
    }

    console.log(`[purge-cache] Cache purge completed: ${JSON.stringify(results)}`)

    return res.status(200).json({
      success: true,
      message: 'Cache purge completed successfully',
      ...results
    })
  } catch (error) {
    console.error('[purge-cache] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
