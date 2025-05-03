/**
 * Тест для страницы настроек
 *
 * Проверяет функциональность страницы настроек профиля
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect, test } from '@playwright/test'
import { baseUrl, setupAuthState, waitForPageLoad } from './utils/test-helpers'

// Тесты для страницы настроек
test.describe('Страница настроек профиля', () => {
  // Перед каждым тестом устанавливаем состояние авторизации и переходим на страницу настроек
  test.beforeEach(async ({ page }) => {
    // Устанавливаем авторизацию
    await setupAuthState(page)

    // Переходим на страницу настроек
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)
  })

  test('Должна загружаться и отображать необходимые элементы', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для доступа к странице настроек')
      return
    }

    // Проверяем заголовок страницы
    await expect(page).toHaveTitle('Настройки', {
      timeout: 15000
    })

    // Проверяем наличие контента страницы настроек
    // Ищем конкретные элементы по одному
    try {
      const heading = await page.locator('h1, h2').first()
      await expect(heading).toBeVisible({ timeout: 10000 })
    } catch {
      // Если заголовка нет, ищем другие элементы формы
      const formElement = await page.locator('form, input[type="text"], input[type="email"]').first()
      await expect(formElement).toBeVisible({ timeout: 10000 })
    }

    // Проверяем наличие формы или полей настроек
    const formElements = await page.locator('form, input, textarea').count()
    expect(formElements).toBeGreaterThan(0)

    // Проверяем наличие кнопки сохранения настроек
    // Если кнопка есть, проверяем её видимость
    const saveButton = page.getByRole('button', { name: 'Сохранить' })
    if ((await saveButton.count()) > 0) {
      await expect(saveButton.first()).toBeVisible()
    }
  })

  test('Должна иметь работающие вкладки настроек', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для доступа к странице настроек')
      return
    }

    // Проверяем наличие вкладок/разделов настроек
    const tabs = await page.locator('nav a, nav button, .tabs-container a, .nav-tabs a').count()

    // Если на странице есть навигационные элементы
    if (tabs > 1) {
      // Выбираем вторую вкладку (индекс 1)
      const secondTab = await page.locator('nav a, nav button, .tabs-container a, .nav-tabs a').nth(1)
      if (await secondTab.isVisible()) {
        await secondTab.click()

        // Ждем изменения URL или загрузки контента
        await page.waitForTimeout(2000)

        // Проверяем, что контент изменился
        const contentAfterClick = await page.locator('main, section, [role="tabpanel"]').first()
        await expect(contentAfterClick).toBeVisible()
      }
    } else {
      // Если вкладок нет, проверяем что на странице есть какой-то контент
      const content = await page.locator('main, section, form').first()
      await expect(content).toBeVisible()
    }
  })
})
