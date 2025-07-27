/**
 * Общие утилиты для тестов
 * Созданы для избежания циклических импортов
 */

import { type Page } from '@playwright/test'
import { config } from 'dotenv'

// Загружаем переменные окружения из .env файла
config({ path: '.env.e2e' })

// Базовый URL - должен соответствовать запущенному локальному серверу или значению из .env
export const baseUrl = process.env.E2E_BASE_URL || process.env.BASE_URL || 'https://localhost:3001'

/**
 * Ожидает загрузки страницы и всех сетевых запросов
 * @param page - Экземпляр страницы Playwright
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  } catch (_e) {
    console.warn('Тайм-аут при ожидании загрузки страницы, продолжаем тест...')
  }
}

/**
 * Проверяет доступность сервера без его запуска
 * Для использования в beforeAll хуках тестовых файлов
 *
 * @param page - Экземпляр страницы Playwright
 * @returns {Promise<boolean>} - Возвращает true, если сервер доступен
 */
export async function checkServerWithoutStarting(page: Page): Promise<boolean> {
  try {
    console.log('Проверка доступности сервера...')
    await page.goto(baseUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.warn('Тайм-аут при ожидании networkidle, продолжаем...')
    })
    console.log('Сервер доступен и отвечает')
    return true
  } catch (e) {
    console.error('Сервер недоступен:', e)
    return false
  }
}

/**
 * Общие константы для тестов
 */
export const TEST_TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 30000,
  NETWORK_IDLE: 15000
} as const
