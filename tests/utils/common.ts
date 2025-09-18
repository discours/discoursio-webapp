/**
 * Общие утилиты для тестов
 * Созданы для избежания циклических импортов
 */

import { type Page } from '@playwright/test'
import { config } from 'dotenv'

// Загружаем переменные окружения из .env файла
config()

// Базовый URL для E2E тестов - отдельный инстанс на порту 3001
export const baseUrl = process.env.E2E_BASE_URL || 'https://localhost:3001'

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
 * Проверяет доступность API сервера
 * @returns {Promise<boolean>} - Возвращает true, если API сервер доступен
 */
export async function checkApiServer(): Promise<boolean> {
  try {
    const response = await fetch('https://v3.dscrs.site/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '{ __typename }'
      })
    })

    if (response.ok) {
      console.log('✅ API сервер доступен')
      return true
    } else {
      console.log('⚠️ API сервер отвечает с ошибкой:', response.status)
      return false
    }
  } catch (error) {
    console.log('❌ API сервер недоступен:', error)
    return false
  }
}

/**
 * Проверяет доступность локального dev сервера
 * @param page - Экземпляр страницы Playwright
 * @returns {Promise<boolean>} - Возвращает true, если сервер доступен
 */
export async function checkLocalServer(page: Page): Promise<boolean> {
  try {
    console.log('🔍 Проверка доступности локального сервера...')
    await page.goto(baseUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.warn('⚠️ Тайм-аут при ожидании networkidle, продолжаем...')
    })
    console.log('✅ Локальный сервер доступен и отвечает')
    return true
  } catch (e) {
    console.error('❌ Локальный сервер недоступен:', e)
    return false
  }
}

/**
 * Генератор случайных строк для тестов
 * @param length - длина генерируемой строки
 * @returns случайная строка из букв и цифр
 */
export function generateRandomString(length = 10): string {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
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
