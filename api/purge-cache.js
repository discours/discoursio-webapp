/**
 * API для очистки кеша Vercel CDN
 *
 * Поддерживает два режима:
 * 1. Запуск по cron (автоматически)
 * 2. Ручной запуск с авторизацией по токену
 *
 * Документация: https://vercel.com/docs/infrastructure/data-cache/manage-data-cache
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

    console.log('[purge-cache] Starting cache purge process')

    // Получаем токен для API Vercel из переменных окружения
    const vercelToken = process.env.VERCEL_TOKEN
    const teamId = process.env.VERCEL_TEAM_ID
    const projectId = process.env.VERCEL_PROJECT_ID

    if (!vercelToken || !projectId) {
      return res.status(500).json({
        error: 'Missing required environment variables (VERCEL_TOKEN, VERCEL_PROJECT_ID)'
      })
    }

    // Формируем URL для API Vercel
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}/cache`
    if (teamId) {
      apiUrl += `?teamId=${teamId}`
    }

    // Отправляем запрос на очистку кеша
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[purge-cache] Error from Vercel API:', errorData)
      return res.status(response.status).json({
        error: 'Failed to purge cache',
        details: errorData
      })
    }

    const data = await response.json()

    const results = {
      purged: true,
      timestamp: new Date().toISOString(),
      source: isCronRequest ? 'cron' : 'manual',
      vercelResponse: data
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
