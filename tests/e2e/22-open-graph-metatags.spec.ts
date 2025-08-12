/**
 * Тесты для проверки Open Graph метатегов на страницах
 *
 * Проверяет наличие и корректность OG метатегов в HTML страниц
 * сгенерированных компонентом PageLayout
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

// Константы для регулярных выражений (исправление lint/performance/useTopLevelRegex)
const IMAGE_URL_REGEX = /https?:\/\/.*\.(png|jpg|jpeg|webp)/
const HTTPS_URL_REGEX = /^https:\/\//
const IMAGE_CONTENT_TYPE_REGEX = /image/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/

test.describe('Open Graph Meta Tags Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на главную страницу для каждого теста
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('главная страница должна содержать базовые OG метатеги', async ({ page }) => {
    // Проверяем обязательные базовые OG теги
    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content')
    expect(ogType).toBeTruthy()
    expect(['website', 'article', 'profile']).toContain(ogType)

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(ogTitle).toBeTruthy()
    expect(ogTitle?.length).toBeGreaterThan(0)

    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content')
    expect(ogDescription).toBeTruthy()
    expect(ogDescription?.length).toBeGreaterThan(0)

    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content')
    expect(ogUrl).toBeTruthy()

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage).toBeTruthy()
    expect(ogImage).toMatch(IMAGE_URL_REGEX)

    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content')
    expect(ogSiteName).toBeTruthy()

    const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content')
    expect(ogLocale).toBe('ru')
  })

  test('должны присутствовать дополнительные метатеги изображений', async ({ page }) => {
    const ogImageWidth = await page.locator('meta[property="og:image:width"]').getAttribute('content')
    expect(ogImageWidth).toBe('1200')

    const ogImageHeight = await page.locator('meta[property="og:image:height"]').getAttribute('content')
    expect(ogImageHeight).toBe('630')

    const ogImageAlt = await page.locator('meta[property="og:image:alt"]').getAttribute('content')
    expect(ogImageAlt).toBeTruthy()
    expect(ogImageAlt).toContain('Discours')

    const ogImageType = await page.locator('meta[property="og:image:type"]').getAttribute('content')
    expect(ogImageType).toBe('image/png')

    const ogImageSecureUrl = await page
      .locator('meta[property="og:image:secure_url"]')
      .getAttribute('content')
    expect(ogImageSecureUrl).toBeTruthy()
    expect(ogImageSecureUrl).toMatch(HTTPS_URL_REGEX)
  })

  test('должны присутствовать Twitter Card метатеги', async ({ page }) => {
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content')
    expect(twitterCard).toBe('summary_large_image')

    const twitterSite = await page.locator('meta[name="twitter:site"]').getAttribute('content')
    expect(twitterSite).toBe('@discoursio')

    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content')
    expect(twitterTitle).toBeTruthy()

    const twitterDescription = await page
      .locator('meta[name="twitter:description"]')
      .getAttribute('content')
    expect(twitterDescription).toBeTruthy()

    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content')
    expect(twitterImage).toBeTruthy()

    const twitterImageAlt = await page.locator('meta[name="twitter:image:alt"]').getAttribute('content')
    expect(twitterImageAlt).toBeTruthy()
    expect(twitterImageAlt).toContain('Discours')
  })

  test('должны присутствовать метатеги для других соцсетей', async ({ page }) => {
    // VK метатеги
    const vkTitle = await page.locator('meta[name="vk:title"]').getAttribute('content')
    expect(vkTitle).toBeTruthy()

    const vkDescription = await page.locator('meta[name="vk:description"]').getAttribute('content')
    expect(vkDescription).toBeTruthy()

    const vkImage = await page.locator('meta[name="vk:image"]').getAttribute('content')
    expect(vkImage).toBeTruthy()

    // Telegram метатеги
    const telegramChannel = await page.locator('meta[name="telegram:channel"]').getAttribute('content')
    expect(telegramChannel).toBe('@discoursio')

    // LinkedIn метатеги
    const linkedinOwner = await page.locator('meta[name="linkedin:owner"]').getAttribute('content')
    expect(linkedinOwner).toBe('Discours')
  })

  test('должны присутствовать SEO метатеги', async ({ page }) => {
    // Канонический URL
    const canonicalLink = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonicalLink).toBeTruthy()

    // Robots метатеги
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots).toBe('index, follow')

    // Основное описание
    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description).toBeTruthy()
    expect(description?.length).toBeGreaterThanOrEqual(50)

    // Ключевые слова
    const keywords = await page.locator('meta[name="keywords"]').getAttribute('content')
    expect(keywords).toBeTruthy()
  })

  test('логотип должен быть доступен', async ({ page }) => {
    const ogLogo = await page.locator('meta[property="og:logo"]').getAttribute('content')
    expect(ogLogo).toBeTruthy()
    expect(ogLogo).toContain('/logo_sign.png')

    // Проверяем доступность логотипа
    const logoResponse = await page.request.get(ogLogo!)
    expect(logoResponse.status()).toBe(200)
    expect(logoResponse.headers()['content-type']).toMatch(IMAGE_CONTENT_TYPE_REGEX)
  })

  test('OG изображение должно быть доступно', async ({ page }) => {
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage).toBeTruthy()

    // Проверяем доступность OG изображения
    const imageResponse = await page.request.get(ogImage!)
    expect(imageResponse.status()).toBe(200)
    expect(imageResponse.headers()['content-type']).toBe('image/png')
    expect(imageResponse.headers()['x-og-image-width']).toBe('1200')
    expect(imageResponse.headers()['x-og-image-height']).toBe('630')
  })

  test('должна быть корректная структура JSON-LD (если есть)', async ({ page }) => {
    // Проверяем наличие structured data
    const jsonLdElements = await page.locator('script[type="application/ld+json"]').count()

    if (jsonLdElements > 0) {
      const jsonLdContent = await page.locator('script[type="application/ld+json"]').first().textContent()
      expect(jsonLdContent).toBeTruthy()

      // Проверяем, что это валидный JSON
      expect(() => JSON.parse(jsonLdContent!)).not.toThrow()

      const jsonData = JSON.parse(jsonLdContent!)
      expect(jsonData['@context']).toBeTruthy()
      expect(jsonData['@type']).toBeTruthy()
    }
  })

  // Тест для проверки на странице статьи (при наличии)
  test('страница статьи должна содержать специфичные article метатеги', async ({ page }) => {
    // Пробуем найти любую статью на сайте
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Ищем ссылку на статью
    const articleLink = await page.locator('a[href*="/article/"], a[href*="/slug/"]').first()

    if (await articleLink.isVisible()) {
      await articleLink.click()
      await waitForPageLoad(page)

      // Проверяем тип контента
      const ogType = await page.locator('meta[property="og:type"]').getAttribute('content')
      expect(ogType).toBe('article')

      // Проверяем специфичные для статей метатеги
      const articleAuthor = await page.locator('meta[property="article:author"]').first()
      if (await articleAuthor.isVisible()) {
        const authorContent = await articleAuthor.getAttribute('content')
        expect(authorContent).toBeTruthy()
        expect(authorContent?.length).toBeGreaterThan(0)
      }

      const articleSection = await page.locator('meta[property="article:section"]').first()
      if (await articleSection.isVisible()) {
        const sectionContent = await articleSection.getAttribute('content')
        expect(sectionContent).toBeTruthy()
      }

      const articlePublishedTime = await page.locator('meta[property="article:published_time"]').first()
      if (await articlePublishedTime.isVisible()) {
        const publishedTime = await articlePublishedTime.getAttribute('content')
        expect(publishedTime).toBeTruthy()
        expect(publishedTime).toMatch(ISO_DATE_REGEX)
      }

      // Проверяем теги статьи
      const articleTags = await page.locator('meta[property="article:tag"]').count()
      if (articleTags > 0) {
        const firstTag = await page.locator('meta[property="article:tag"]').first().getAttribute('content')
        expect(firstTag).toBeTruthy()
      }
    } else {
      console.warn('Не найдено ссылок на статьи, пропускаем тест специфичных article метатегов')
    }
  })

  test('страница автора должна содержать специфичные profile метатеги', async ({ page }) => {
    // Пробуем найти ссылку на автора
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    const authorLink = await page.locator('a[href*="/author/"]').first()

    if (await authorLink.isVisible()) {
      await authorLink.click()
      await waitForPageLoad(page)

      // Проверяем тип контента
      const ogType = await page.locator('meta[property="og:type"]').getAttribute('content')
      expect(ogType).toBe('profile')

      // Проверяем специфичные для профилей метатеги
      const profileFirstName = await page.locator('meta[property="profile:first_name"]').first()
      if (await profileFirstName.isVisible()) {
        const firstName = await profileFirstName.getAttribute('content')
        expect(firstName).toBeTruthy()
      }

      const profileUsername = await page.locator('meta[property="profile:username"]').first()
      if (await profileUsername.isVisible()) {
        const username = await profileUsername.getAttribute('content')
        expect(username).toBeTruthy()
      }
    } else {
      console.warn('Не найдено ссылок на авторов, пропускаем тест специфичных profile метатегов')
    }
  })
})
