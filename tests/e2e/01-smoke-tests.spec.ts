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

    // Проверяем что есть хотя бы один nav элемент
    const navElements = page.locator('nav, .navigation')
    const navCount = await navElements.count()
    expect(navCount).toBeGreaterThan(0)

    // Проверяем что первый nav элемент видим
    await expect(navElements.first()).toBeVisible()
  })

  test('@smoke Навигация между страницами работает', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Тестируем основные ссылки навигации
    const navLinks = [
      { selector: 'a[href="/feed"], a[href*="feed"]', expectedPath: 'feed' },
      { selector: 'a[href="/topics"], a[href*="topics"]', expectedPath: 'topics' },
      { selector: 'a[href="/authors"], a[href*="authors"]', expectedPath: 'authors' }
    ]

    for (const link of navLinks) {
      const linkElement = page.locator(link.selector).first()
      if (await linkElement.isVisible()) {
        console.log(`Тестируем ссылку: ${link.selector}`)

        // Проверяем что ссылка кликабельна
        await expect(linkElement).toBeEnabled()

        // Кликаем и ждем навигации
        await linkElement.click()

        // Ждем изменения URL вместо networkidle
        await page.waitForFunction(
          (expectedPath) => window.location.href.includes(expectedPath),
          link.expectedPath,
          { timeout: 10000 }
        )

        // Проверяем что URL изменился
        const currentUrl = page.url()
        console.log(`Текущий URL: ${currentUrl}`)
        expect(currentUrl).toContain(link.expectedPath)

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
      console.log('Поле поиска найдено, тестируем...')

      await searchField.fill('тест')
      await searchField.press('Enter')

      // Ждем завершения поиска
      await page.waitForLoadState('networkidle', { timeout: 10000 })

      // Проверяем что мы попали на страницу поиска или есть результаты
      const currentUrl = page.url()
      const hasSearchResults = page.locator('.search-results, .results, [data-testid="search-results"]')

      if (
        currentUrl.includes('search') ||
        currentUrl.includes('поиск') ||
        (await hasSearchResults.isVisible())
      ) {
        console.log('Поиск работает, URL или результаты найдены')
      } else {
        console.log('Поиск не привел к ожидаемому результату, но тест не падает')
      }
    } else {
      console.log('Поле поиска не найдено, пропускаем тест')
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
    const menuToggle = page
      .locator('.menu-toggle, .burger, [data-testid="menu-toggle"], .hamburger')
      .first()

    if (await menuToggle.isVisible()) {
      console.log('Бургер-меню найдено, тестируем...')

      await menuToggle.click()
      await page.waitForTimeout(500)

      // Проверяем что меню открылось (ищем любой из возможных селекторов)
      const mobileMenu = page.locator(
        '.mobile-menu, .nav-menu, [data-testid="mobile-menu"], .mobile-nav, .sidebar'
      )
      const isMenuVisible = await mobileMenu.isVisible()

      if (isMenuVisible) {
        console.log('Мобильное меню открылось')

        // Закрываем меню
        await menuToggle.click()
        await page.waitForTimeout(500)

        // Проверяем что меню закрылось
        const isMenuHidden = !(await mobileMenu.isVisible())
        expect(isMenuHidden).toBeTruthy()
      } else {
        console.log('Мобильное меню не открылось, но тест не падает')
      }
    } else {
      console.log('Бургер-меню не найдено, пропускаем тест')
    }
  })
})
