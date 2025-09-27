/**
 * Утилиты для работы с реальным API в E2E тестах
 *
 * Не используют моки, работают с настоящим бэкендом
 */

import { type Page } from '@playwright/test'

/**
 * Проверяет доступность API без моков
 */
export async function checkRealApiConnection(page: Page): Promise<boolean> {
  try {
    // Проверяем что GraphQL endpoint отвечает (прямо к API)
    const response = await page.request.post('https://v3.dscrs.site/graphql', {
      data: {
        query: `
          query HealthCheck {
            __schema {
              queryType {
                name
              }
            }
          }
        `
      }
    })

    return response.ok()
  } catch (error) {
    console.warn('API connection check failed:', error)
    return false
  }
}

/**
 * Ждет завершения реальных API запросов
 */
export async function waitForApiRequests(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout })
}

/**
 * Проверяет что страница полностью загружена с данными
 */
export async function waitForContentLoad(page: Page): Promise<void> {
  // Ждем DOM
  await page.waitForLoadState('domcontentloaded')

  // Ждем сетевых запросов
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    console.warn('Network idle timeout - continuing anyway')
  })

  // Проверяем что основной контент загрузился
  await page.waitForSelector('main, .content, .page-content', { timeout: 10000 }).catch(() => {
    console.warn('Main content selector not found')
  })
}

/**
 * Получает реальные данные пользователя из DOM
 */
export async function getCurrentUserInfo(page: Page): Promise<{
  isLoggedIn: boolean
  username?: string
  email?: string
}> {
  return await page.evaluate(() => {
    // Ищем индикаторы авторизованного пользователя
    const userAvatar = document.querySelector('.user-avatar, .userpic, [data-testid="user-avatar"]')
    const userMenu = document.querySelector('.user-menu, [data-testid="user-menu"]')
    const loginButton = document.querySelector('button:has-text("Войти"), a:has-text("Войти")')

    const isLoggedIn = !!(userAvatar || userMenu) && !loginButton

    let username: string | undefined
    let email: string | undefined

    if (isLoggedIn) {
      // Пытаемся извлечь имя пользователя из DOM
      const nameElement = document.querySelector('.user-name, .username, [data-testid="username"]')
      if (nameElement) {
        username = nameElement.textContent?.trim()
      }

      // Email обычно не отображается в UI, но может быть в data-атрибутах
      const emailElement = document.querySelector('[data-email]')
      if (emailElement) {
        email = emailElement.getAttribute('data-email') || undefined
      }
    }

    return {
      isLoggedIn,
      username,
      email
    }
  })
}

/**
 * Проверяет реальное состояние формы без моков
 */
export async function getFormValidationState(
  page: Page,
  formSelector = 'form'
): Promise<{
  isValid: boolean
  invalidFields: string[]
  validFields: string[]
}> {
  return await page.evaluate((selector) => {
    const form = document.querySelector(selector) as HTMLFormElement
    if (!form) {
      return { isValid: false, invalidFields: [], validFields: [] }
    }

    const inputs = Array.from(form.querySelectorAll('input, textarea, select')) as HTMLInputElement[]
    const invalidFields: string[] = []
    const validFields: string[] = []

    inputs.forEach((input) => {
      const fieldName = input.name || input.placeholder || input.type
      if (!input.validity.valid) {
        invalidFields.push(fieldName)
      } else {
        validFields.push(fieldName)
      }
    })

    return {
      isValid: form.checkValidity(),
      invalidFields,
      validFields
    }
  }, formSelector)
}

/**
 * Получает реальные ошибки валидации из UI
 */
export async function getValidationErrors(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const errorElements = document.querySelectorAll('.error, .validation-error, .field-error, [role="alert"]')
    return Array.from(errorElements)
      .map((el) => el.textContent?.trim() || '')
      .filter(Boolean)
  })
}

/**
 * Проверяет что контент действительно загружен (не пустые плейсхолдеры)
 */
export async function hasRealContent(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    // Ищем реальный контент
    const contentElements = document.querySelectorAll('article, .post, .content-item, .card')

    if (contentElements.length === 0) {
      return false
    }

    // Проверяем что контент не состоит из плейсхолдеров/скелетонов
    for (let i = 0; i < contentElements.length; i++) {
      const element = contentElements[i]
      const classList = element.classList.toString()
      const isPlaceholder =
        classList.includes('skeleton') || classList.includes('placeholder') || classList.includes('loading')

      if (!isPlaceholder) {
        // Проверяем что есть реальный текст
        const textContent = element.textContent?.trim()
        if (textContent && textContent.length > 10) {
          return true
        }
      }
    }

    return false
  })
}

/**
 * Ждет появления реального контента (не скелетонов)
 */
export async function waitForRealContent(page: Page, timeout = 15000): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const contentElements = document.querySelectorAll('article, .post, .content-item')

        for (let i = 0; i < contentElements.length; i++) {
          const element = contentElements[i]
          const classList = element.classList.toString()
          const isPlaceholder =
            classList.includes('skeleton') || classList.includes('placeholder') || classList.includes('loading')

          if (!isPlaceholder && element.textContent?.trim() && element.textContent.trim().length > 10) {
            return true
          }
        }

        return false
      },
      {},
      { timeout }
    )
    .catch(() => {
      console.warn('Real content did not appear within timeout')
    })
}

/**
 * Проверяет производительность загрузки страницы
 */
export async function getPagePerformance(page: Page): Promise<{
  loadTime: number
  domContentLoaded: number
  networkRequests: number
}> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType('resource')

    return {
      loadTime: navigation.loadEventEnd - navigation.startTime,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
      networkRequests: resources.length
    }
  })
}
