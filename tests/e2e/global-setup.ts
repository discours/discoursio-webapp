import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium, type FullConfig } from '@playwright/test'
import { config } from 'dotenv'
import { baseUrl } from '../utils/common'

config()

const email = process.env.TEST_USERNAME || ''
const password = process.env.TEST_PASSWORD || ''

// Глобальный setup: логинимся через реальный API/UI и сохраняем storage state для @auth тестов
export default async function globalSetup(_config: FullConfig) {
  // В CI используем headless режим и проверяем доступность браузеров
  if (process.env.CI) {
    console.log('Running in CI mode, checking browser availability...')
    try {
      const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage({ ignoreHTTPSErrors: true })

      // Открываем главную и ждем готовности
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})

      // Пробуем открыть форму входа через ссылку в хедере
      const loginLink = page
        .locator(
          'a[href*="?m=auth"], .loginbtn a, [data-testid="login-link"], a:has-text("Войти"), a:has-text("Enter")'
        )
        .first()

      if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await loginLink.click({ force: true })
      }

      const emailInput = page
        .locator('input[type="email"], input[name="email"], [data-testid="login-email"]')
        .first()
      const passwordInput = page
        .locator('input[type="password"], input[name="password"], [data-testid="login-password"]')
        .first()

      const hasForm = await emailInput.isVisible({ timeout: 10000 }).catch(() => false)
      if (hasForm && email && password) {
        await emailInput.fill(email)
        await passwordInput.fill(password)

        const submit = page.locator('button[type="submit"], [data-testid="login-submit"]').first()
        await submit.click({ timeout: 10000 })

        // Ждем появления аватарки как маркера авторизации
        const avatar = page.locator('.userControlItemUserpic button, [data-testid="user-avatar"]').first()
        await avatar.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
      }

      // Сохраняем состояние
      const statePath = 'playwright/.auth/user.json'
      await mkdir(dirname(statePath), { recursive: true })
      await page.context().storageState({ path: statePath })
      await browser.close()
    } catch (error) {
      console.error('Failed to setup browser in CI:', error)
      throw error
    }
  } else {
    // Локальный режим - обычный запуск
    const browser = await chromium.launch()
    const page = await browser.newPage({ ignoreHTTPSErrors: true })

    // Открываем главную и ждем готовности
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})

    // Пробуем открыть форму входа через ссылку в хедере
    const loginLink = page
      .locator(
        'a[href*="?m=auth"], .loginbtn a, [data-testid="login-link"], a:has-text("Войти"), a:has-text("Enter")'
      )
      .first()

    if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginLink.click({ force: true })
    }

    const emailInput = page
      .locator('input[type="email"], input[name="email"], [data-testid="login-email"]')
      .first()
    const passwordInput = page
      .locator('input[type="password"], input[name="password"], [data-testid="login-password"]')
      .first()

    const hasForm = await emailInput.isVisible({ timeout: 10000 }).catch(() => false)
    if (hasForm && email && password) {
      await emailInput.fill(email)
      await passwordInput.fill(password)

      const submit = page.locator('button[type="submit"], [data-testid="login-submit"]').first()
      await submit.click({ timeout: 10000 })

      // Ждем появления аватарки как маркера авторизации
      const avatar = page.locator('.userControlItemUserpic button, [data-testid="user-avatar"]').first()
      await avatar.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    }

    // Сохраняем состояние
    const statePath = 'playwright/.auth/user.json'
    await mkdir(dirname(statePath), { recursive: true })
    await page.context().storageState({ path: statePath })
    await browser.close()
  }
}
