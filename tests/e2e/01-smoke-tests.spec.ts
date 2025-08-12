/**
 * Дымовые тесты - базовая проверка работоспособности
 *
 * Проверяют что основные страницы загружаются и интерактивны
 */

import { expect } from '@playwright/test'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Дымовые тесты', () => {
  test('@smoke Главная страница загружается', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Проверяем основные элементы
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('nav, .navigation')).toBeVisible()
  })

  test('@smoke Навигация между страницами работает', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Тестируем основные ссылки навигации
    const navLinks = [
      { selector: 'a[href="/feed"]', expectedPath: '/feed' },
      { selector: 'a[href="/topics"]', expectedPath: '/topics' },
      { selector: 'a[href="/authors"]', expectedPath: '/authors' }
    ]

    for (const link of navLinks) {
      const linkElement = page.locator(link.selector).first()
      if (await linkElement.isVisible()) {
        await linkElement.click()
        await utils.expectPageReady()
        expect(page.url()).toContain(link.expectedPath)

        // Возвращаемся на главную
        await utils.goto('/')
        await utils.expectPageReady()
      }
    }
  })

  test('@smoke Поиск работает', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем поле поиска
    const searchField = page
      .locator('input[type="search"], input[placeholder*="поиск"], input[placeholder*="search"]')
      .first()

    if (await searchField.isVisible()) {
      await searchField.fill('тест')
      await searchField.press('Enter')

      await utils.expectPageReady()
      // Проверяем что мы попали на страницу поиска
      expect(page.url()).toMatch(/search|поиск/)
    }
  })

  test('@smoke Темная тема переключается', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем переключатель темы
    const themeToggle = page
      .locator('[data-testid="theme-toggle"], .theme-toggle, .dark-mode-toggle')
      .first()

    if (await themeToggle.isVisible()) {
      // Получаем текущую тему
      const bodyClass = await page.locator('body').getAttribute('class')

      await themeToggle.click()
      await page.waitForTimeout(500)

      // Проверяем что тема изменилась
      const newBodyClass = await page.locator('body').getAttribute('class')
      expect(newBodyClass).not.toBe(bodyClass)
    }
  })

  test('@smoke Мобильное меню работает', async ({ page }) => {
    // Устанавливаем мобильный viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const utils = new TestUtils(page)
    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем бургер-меню
    const menuToggle = page.locator('.menu-toggle, .burger, [data-testid="menu-toggle"]').first()

    if (await menuToggle.isVisible()) {
      await menuToggle.click()

      // Проверяем что меню открылось
      const mobileMenu = page.locator('.mobile-menu, .nav-menu, [data-testid="mobile-menu"]').first()
      await expect(mobileMenu).toBeVisible()

      // Закрываем меню
      await menuToggle.click()
      await expect(mobileMenu).not.toBeVisible()
    }
  })
})
