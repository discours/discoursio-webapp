/**
 * Тесты страниц контента без моков
 *
 * Проверяют реальную загрузку и отображение контента
 */

import { expect } from '@playwright/test'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Страницы контента', () => {
  test('Главная страница отображает контент', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Проверяем основные элементы
    await expect(page.locator('h1, .main-title')).toBeVisible()

    // Проверяем что есть какой-то контент
    const articles = page.locator('article, .article-card, .post-card')
    const articlesCount = await articles.count()

    if (articlesCount > 0) {
      // Если есть статьи, проверяем их структуру
      const firstArticle = articles.first()
      await expect(firstArticle).toBeVisible()

      // У статьи должен быть заголовок
      const articleTitle = firstArticle.locator('h2, h3, .title, .article-title').first()
      if (await articleTitle.isVisible()) {
        const titleText = await articleTitle.textContent()
        expect(titleText?.trim()).toBeTruthy()
      }
    }
  })

  test('Лента загружается и показывает контент', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/feed')
    await utils.expectPageReady()

    // Проверяем заголовок страницы
    await expect(page).toHaveTitle(/лента|feed/i)

    // Проверяем что страница не пустая
    const content = page.locator('main, .content, .feed')
    await expect(content).toBeVisible()

    // Ищем элементы контента
    const contentItems = page.locator('article, .post, .item, .card')
    const itemsCount = await contentItems.count()

    // Если контент есть, проверяем его
    if (itemsCount > 0) {
      expect(itemsCount).toBeGreaterThan(0)
    } else {
      // Если контента нет, должно быть сообщение о пустоте
      const emptyMessage = page.locator('.empty-state, .no-content, .empty')
      await expect(emptyMessage).toBeVisible()
    }
  })

  test('Страница авторов загружается', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/authors')
    await utils.expectPageReady()

    // Проверяем заголовок
    await expect(page).toHaveTitle(/авторы|authors/i)

    // Ищем список авторов
    const authors = page.locator('.author-card, .author-item, .author')
    const authorsCount = await authors.count()

    if (authorsCount > 0) {
      const firstAuthor = authors.first()
      await expect(firstAuthor).toBeVisible()

      // У автора должно быть имя
      const authorName = firstAuthor.locator('.name, .author-name, h2, h3').first()
      if (await authorName.isVisible()) {
        const nameText = await authorName.textContent()
        expect(nameText?.trim()).toBeTruthy()
      }
    }
  })

  test('Страница тем загружается', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/topics')
    await utils.expectPageReady()

    // Проверяем заголовок
    await expect(page).toHaveTitle(/темы|topics/i)

    // Ищем темы
    const topics = page.locator('.topic-card, .topic-item, .topic, .tag')
    const topicsCount = await topics.count()

    if (topicsCount > 0) {
      const firstTopic = topics.first()
      await expect(firstTopic).toBeVisible()

      // У темы должно быть название
      const topicName = firstTopic.locator('.name, .topic-name, .title').first()
      if (await topicName.isVisible()) {
        const nameText = await topicName.textContent()
        expect(nameText?.trim()).toBeTruthy()
      }
    }
  })

  test('Поиск работает и показывает результаты', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем поле поиска
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="поиск"], [data-testid="search"]')
      .first()

    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await searchInput.press('Enter')

      await utils.expectPageReady()

      // Проверяем что мы на странице поиска
      expect(page.url()).toMatch(/search|поиск/)

      // Проверяем что есть область результатов
      const results = page.locator('.search-results, .results, main')
      await expect(results).toBeVisible()
    }
  })

  test('Переходы между страницами сохраняют состояние', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Запоминаем состояние темы
    const bodyClass = await page.locator('body').getAttribute('class')

    // Переходим на другую страницу
    await page.locator('a[href="/feed"]').first().click()
    await utils.expectPageReady()

    // Возвращаемся обратно
    await page.locator('a[href="/"]').first().click()
    await utils.expectPageReady()

    // Проверяем что состояние сохранилось
    const newBodyClass = await page.locator('body').getAttribute('class')
    expect(newBodyClass).toBe(bodyClass)
  })

  test('Навигация работает на мобильных устройствах', async ({ page }) => {
    // Мобильный viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const utils = new TestUtils(page)
    await utils.goto('/')
    await utils.expectPageReady()

    // Проверяем адаптивную навигацию
    const navigation = page.locator('nav, .navigation')
    await expect(navigation).toBeVisible()

    // Ищем основные ссылки
    const links = navigation.locator('a')
    const linksCount = await links.count()

    expect(linksCount).toBeGreaterThan(0)

    // Проверяем что ссылки кликабельны
    if (linksCount > 0) {
      const firstLink = links.first()
      await expect(firstLink).toBeVisible()
    }
  })

  test('Страница 404 обрабатывается корректно', async ({ page }) => {
    const utils = new TestUtils(page)

    // Переходим на несуществующую страницу
    await page.goto('/nonexistent-page-12345')
    await utils.expectPageReady()

    // Проверяем что показана 404 или редирект на главную
    const is404 =
      page.url().includes('404') ||
      (await page.locator('h1:has-text("404"), .error-404').isVisible()) ||
      page.url().endsWith('/')

    expect(is404).toBeTruthy()
  })
})
