import { expect } from '@playwright/test'
import { test } from '../utils/test-helpers'

test.describe('OAuth Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Mock localStorage для тестирования
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
  })

  test('should display OAuth providers in login modal', async ({ page }) => {
    await page.goto('/')

    // Открываем модал входа
    await page.click('[data-testid="auth-button"]')

    // Проверяем наличие OAuth провайдеров
    await expect(page.locator('[data-testid="oauth-google"]')).toBeVisible()
    await expect(page.locator('[data-testid="oauth-facebook"]')).toBeVisible()
    await expect(page.locator('[data-testid="oauth-github"]')).toBeVisible()
    await expect(page.locator('[data-testid="oauth-vk"]')).toBeVisible()
    await expect(page.locator('[data-testid="oauth-yandex"]')).toBeVisible()
  })

  test('should initiate OAuth flow for Google', async ({ page }) => {
    await page.goto('/')

    // Мокаем console.info для проверки логов
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'info') {
        consoleLogs.push(msg.text())
      }
    })

    // Открываем модал входа
    await page.click('[data-testid="auth-button"]')

    // Мокаем редирект для предотвращения реального перехода
    await page.route('**/oauth/google*', (route) => {
      route.fulfill({
        status: 200,
        body: 'OAuth redirect intercepted'
      })
    })

    // Кликаем на Google OAuth
    await page.click('[data-testid="oauth-google"]')

    // Проверяем, что OAuth flow инициирован
    expect(
      consoleLogs.some((log) => log.includes('[oauth] Starting OAuth flow for provider: google'))
    ).toBeTruthy()
  })

  test('should handle OAuth callback with valid state', async ({ page }) => {
    // Устанавливаем мок OAuth state в localStorage
    await page.addInitScript(() => {
      const oauthState = {
        state: 'test-state-123',
        provider: 'google',
        timestamp: Date.now(),
        redirectUri: 'http://localhost:3000'
      }
      localStorage.setItem('oauth_state', JSON.stringify(oauthState))
    })

    // Переходим на страницу с OAuth callback параметрами
    await page.goto('/?state=test-state-123&access_token=mock-access-token')

    // Проверяем, что происходит обработка OAuth callback
    await expect(page.locator('body')).toContainText('Processing OAuth callback', { timeout: 5000 })
  })

  test('should handle OAuth callback with invalid state', async ({ page }) => {
    // Устанавливаем мок OAuth state в localStorage
    await page.addInitScript(() => {
      const oauthState = {
        state: 'valid-state-123',
        provider: 'google',
        timestamp: Date.now(),
        redirectUri: 'http://localhost:3000'
      }
      localStorage.setItem('oauth_state', JSON.stringify(oauthState))
    })

    // Переходим на страницу с неверным state
    await page.goto('/?state=invalid-state-456&access_token=mock-access-token')

    // Проверяем, что показывается ошибка
    await expect(page.locator('[data-testid="auth-error"]')).toContainText(
      'OAuth security validation failed'
    )
  })

  test('should handle expired OAuth state', async ({ page }) => {
    // Устанавливаем истекший OAuth state
    await page.addInitScript(() => {
      const expiredTimestamp = Date.now() - 15 * 60 * 1000 // 15 минут назад
      const oauthState = {
        state: 'test-state-123',
        provider: 'google',
        timestamp: expiredTimestamp,
        redirectUri: 'http://localhost:3000'
      }
      localStorage.setItem('oauth_state', JSON.stringify(oauthState))
    })

    // Переходим на страницу с OAuth callback
    await page.goto('/?state=test-state-123&access_token=mock-access-token')

    // Проверяем, что показывается ошибка об истечении
    await expect(page.locator('[data-testid="auth-error"]')).toContainText('OAuth session expired')
  })

  test('should clear OAuth state after successful processing', async ({ page }) => {
    // Устанавливаем мок OAuth state
    await page.addInitScript(() => {
      const oauthState = {
        state: 'test-state-123',
        provider: 'google',
        timestamp: Date.now(),
        redirectUri: 'http://localhost:3000'
      }
      localStorage.setItem('oauth_state', JSON.stringify(oauthState))
    })

    // Переходим на страницу с OAuth callback
    await page.goto('/?state=test-state-123&access_token=mock-access-token')

    // Ждем обработки OAuth
    await page.waitForTimeout(1000)

    // Проверяем, что OAuth state удален из localStorage
    const oauthState = await page.evaluate(() => {
      return localStorage.getItem('oauth_state')
    })

    expect(oauthState).toBeNull()
  })

  test('should validate supported OAuth providers', async ({ page }) => {
    await page.goto('/')

    // Открываем модал входа
    await page.click('[data-testid="auth-button"]')

    // Мокаем console.error для проверки ошибок
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Проверяем, что неподдерживаемые провайдеры не отображаются
    await expect(page.locator('[data-testid="oauth-unsupported"]')).not.toBeVisible()

    // Проверяем, что поддерживаемые провайдеры отображаются
    await expect(page.locator('[data-testid="oauth-google"]')).toBeVisible()
    await expect(page.locator('[data-testid="oauth-facebook"]')).toBeVisible()
  })

  test('should maintain backward compatibility with legacy OAuth state format', async ({ page }) => {
    // Устанавливаем OAuth state в старом формате (просто строка)
    await page.addInitScript(() => {
      localStorage.setItem('oauth_state', 'test-state-123')
    })

    // Переходим на страницу с OAuth callback
    await page.goto('/?state=test-state-123&access_token=mock-access-token')

    // Проверяем, что обработка проходит успешно
    await expect(page.locator('body')).toContainText('OAuth state verified successfully', { timeout: 5000 })
  })
})

test.describe('OAuth Error Handling', () => {
  test('should handle missing OAuth state', async ({ page }) => {
    // Переходим на страницу с OAuth callback без состояния в localStorage
    await page.goto('/?state=test-state-123&access_token=mock-access-token')

    // Проверяем ошибку об отсутствии состояния
    await expect(page.locator('[data-testid="auth-error"]')).toContainText('OAuth session expired')
  })

  test('should handle OAuth provider errors in URL', async ({ page }) => {
    // Переходим на страницу с ошибкой OAuth
    await page.goto('/?error=oauth_failed&message=Provider authentication failed')

    // Проверяем отображение ошибки
    await expect(page.locator('[data-testid="auth-error"]')).toContainText('OAuth login failed')
  })
})
