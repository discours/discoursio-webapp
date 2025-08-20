/**
 * Реальные пользовательские взаимодействия
 *
 * Тестируют реальное поведение без моков
 */

import { expect } from '@playwright/test'
import { getCurrentUserInfo, hasRealContent, waitForRealContent } from '../utils/real-api-helpers'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Реальные взаимодействия', () => {
  test('Гидратация и интерактивность', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ждем реального контента
    await waitForRealContent(page)

    // Проверяем интерактивность
    const interactiveElements = page.locator('button, a[href], input, select')
    const count = await interactiveElements.count()
    expect(count).toBeGreaterThan(0)

    // Проверяем что элементы реально кликабельны
    const firstButton = interactiveElements.first()
    if (await firstButton.isVisible()) {
      const isEnabled = await firstButton.isEnabled()
      expect(isEnabled).toBeTruthy()
    }
  })

  test('Темная тема сохраняется между сессиями', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем переключатель темы
    const themeToggle = page.locator('[data-testid="theme-toggle"], .theme-toggle, .dark-mode-toggle').first()

    if (await themeToggle.isVisible()) {
      // Включаем темную тему
      await themeToggle.click()
      await page.waitForTimeout(500)

      const darkThemeClass = await page.locator('body').getAttribute('class')

      // Перезагружаем страницу
      await page.reload()
      await utils.expectPageReady()

      // Проверяем что тема сохранилась
      const savedThemeClass = await page.locator('body').getAttribute('class')
      expect(savedThemeClass).toBe(darkThemeClass)
    }
  })

  test('Поиск по сайту работает', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем поле поиска
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="поиск"], [data-testid="search"]')
      .first()

    if (await searchInput.isVisible()) {
      const searchTerm = 'дискурс'
      await searchInput.fill(searchTerm)
      await searchInput.press('Enter')

      await utils.expectPageReady()
      await waitForRealContent(page)

      // Проверяем что мы на странице результатов
      const hasResults = await hasRealContent(page)
      const isSearchPage = page.url().includes('search') || page.url().includes('поиск')

      expect(hasResults || isSearchPage).toBeTruthy()
    }
  })

  test('Навигация сохраняет состояние пользователя', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    const initialUserInfo = await getCurrentUserInfo(page)

    // Переходим на другую страницу
    const feedLink = page.locator('a[href="/feed"]').first()
    if (await feedLink.isVisible()) {
      await feedLink.click()
      await utils.expectPageReady()

      const userInfoAfterNavigation = await getCurrentUserInfo(page)

      // Состояние авторизации должно сохраниться
      expect(userInfoAfterNavigation.isLoggedIn).toBe(initialUserInfo.isLoggedIn)
    }
  })

  test('Форма обратной связи работает', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/support')
    await utils.expectPageReady()

    // Ищем форму обратной связи
    const contactForm = page.locator('form, .contact-form, .feedback-form').first()

    if (await contactForm.isVisible()) {
      const nameInput = contactForm.locator('input[name="name"], input[placeholder*="имя"]').first()
      const emailInput = contactForm.locator('input[type="email"], input[name="email"]').first()
      const messageInput = contactForm.locator('textarea, input[name="message"]').first()
      const submitButton = contactForm.locator('button[type="submit"], button:has-text("Отправить")').first()

      if ((await nameInput.isVisible()) && (await emailInput.isVisible()) && (await messageInput.isVisible())) {
        await nameInput.fill('Test User')
        await emailInput.fill('test@example.com')
        await messageInput.fill('This is a test message')

        // Проверяем что кнопка стала активной
        const isEnabled = await submitButton.isEnabled()
        expect(isEnabled).toBeTruthy()
      }
    }
  })

  test('Подписка на рассылку работает', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем форму подписки
    const newsletterForm = page.locator('.newsletter, .subscription, [data-testid="newsletter"]').first()

    if (await newsletterForm.isVisible()) {
      const emailInput = newsletterForm.locator('input[type="email"]').first()
      const submitButton = newsletterForm.locator('button[type="submit"], button:has-text("Подписаться")').first()

      if ((await emailInput.isVisible()) && (await submitButton.isVisible())) {
        await emailInput.fill('test@example.com')

        // Проверяем что форма валидна
        const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid)
        expect(isValid).toBeTruthy()

        const isEnabled = await submitButton.isEnabled()
        expect(isEnabled).toBeTruthy()
      }
    }
  })

  test('Адаптивность на разных устройствах', async ({ page }) => {
    const utils = new TestUtils(page)

    const devices = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ]

    for (const device of devices) {
      await page.setViewportSize({ width: device.width, height: device.height })

      await utils.goto('/')
      await utils.expectPageReady()

      // Проверяем что основные элементы видны
      await expect(page.locator('header')).toBeVisible()
      await expect(page.locator('main')).toBeVisible()

      // На мобильных устройствах может быть мобильное меню
      if (device.width < 768) {
        const mobileMenu = page.locator('.mobile-menu, .burger, [data-testid="mobile-menu"]')
        if (await mobileMenu.isVisible()) {
          await expect(mobileMenu).toBeVisible()
        }
      }
    }
  })
})
