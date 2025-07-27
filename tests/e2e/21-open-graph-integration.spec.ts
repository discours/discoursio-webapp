/**
 * Интеграционные тесты для системы Open Graph
 *
 * Проверяет работу всей системы OG метаданных:
 * - Генерацию изображений через API
 * - Корректность метатегов на страницах
 * - Совместимость с различными валидаторами
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

// Константы для регулярных выражений (исправление lint/performance/useTopLevelRegex)
const QUOTED_STRING_REGEX = /^".*"$/

test.describe('Open Graph Integration Tests', () => {
  test('полная интеграция OG на главной странице', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Получаем все базовые OG данные
    const ogData = await page.evaluate(() => {
      const getMeta = (property: string) => {
        const element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
        return element?.content || null
      }

      const getMetaByName = (name: string) => {
        const element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
        return element?.content || null
      }

      return {
        type: getMeta('og:type'),
        title: getMeta('og:title'),
        description: getMeta('og:description'),
        url: getMeta('og:url'),
        image: getMeta('og:image'),
        siteName: getMeta('og:site_name'),
        locale: getMeta('og:locale'),
        imageWidth: getMeta('og:image:width'),
        imageHeight: getMeta('og:image:height'),
        imageAlt: getMeta('og:image:alt'),
        imageType: getMeta('og:image:type'),
        twitterCard: getMetaByName('twitter:card'),
        twitterSite: getMetaByName('twitter:site'),
        robots: getMetaByName('robots')
      }
    })

    // Проверяем все обязательные поля
    expect(ogData.type).toBeTruthy()
    expect(ogData.title).toBeTruthy()
    expect(ogData.description).toBeTruthy()
    expect(ogData.url).toBeTruthy()
    expect(ogData.image).toBeTruthy()
    expect(ogData.siteName).toBe('Discours')
    expect(ogData.locale).toBe('ru')
    expect(ogData.imageWidth).toBe('1200')
    expect(ogData.imageHeight).toBe('630')
    expect(ogData.imageType).toBe('image/png')
    expect(ogData.twitterCard).toBe('summary_large_image')
    expect(ogData.twitterSite).toBe('@discoursio')
    expect(ogData.robots).toBe('index, follow')

    console.log('✅ OG данные корректны:', ogData)
  })

  test('OG изображение доступно и имеет правильные размеры', async ({ page, request }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage).toBeTruthy()

    // Проверяем доступность изображения
    const imageResponse = await request.get(ogImage!)
    expect(imageResponse.status()).toBe(200)
    expect(imageResponse.headers()['content-type']).toBe('image/png')

    // Проверяем заголовки изображения
    expect(imageResponse.headers()['x-og-image-width']).toBe('1200')
    expect(imageResponse.headers()['x-og-image-height']).toBe('630')

    console.log('✅ OG изображение доступно:', ogImage)
  })

  test('консистентность метаданных между различными форматами', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    const metaConsistency = await page.evaluate(() => {
      const getOGMeta = (property: string) => {
        const el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
        return el?.content || null
      }

      const getNameMeta = (name: string) => {
        const el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
        return el?.content || null
      }

      return {
        ogTitle: getOGMeta('og:title'),
        twitterTitle: getNameMeta('twitter:title'),
        vkTitle: getNameMeta('vk:title'),
        ogDescription: getOGMeta('og:description'),
        twitterDescription: getNameMeta('twitter:description'),
        vkDescription: getNameMeta('vk:description'),
        ogImage: getOGMeta('og:image'),
        twitterImage: getNameMeta('twitter:image'),
        vkImage: getNameMeta('vk:image')
      }
    })

    // Проверяем консистентность заголовков
    expect(metaConsistency.ogTitle).toBe(metaConsistency.twitterTitle)
    expect(metaConsistency.ogTitle).toBe(metaConsistency.vkTitle)

    // Проверяем консистентность описаний
    expect(metaConsistency.ogDescription).toBe(metaConsistency.twitterDescription)
    expect(metaConsistency.ogDescription).toBe(metaConsistency.vkDescription)

    // Проверяем консистентность изображений
    expect(metaConsistency.ogImage).toBe(metaConsistency.twitterImage)
    expect(metaConsistency.ogImage).toBe(metaConsistency.vkImage)

    console.log('✅ Метаданные консистентны между форматами')
  })

  test('проверка валидности структурированных данных', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Собираем все метаданные для проверки
    const allMetaTags = await page.evaluate(() => {
      const ogTags = Array.from(document.querySelectorAll('meta[property^="og:"]')).map((meta) => ({
        property: (meta as HTMLMetaElement).getAttribute('property'),
        content: (meta as HTMLMetaElement).content
      }))

      const twitterTags = Array.from(document.querySelectorAll('meta[name^="twitter:"]')).map((meta) => ({
        name: (meta as HTMLMetaElement).getAttribute('name'),
        content: (meta as HTMLMetaElement).content
      }))

      const articleTags = Array.from(document.querySelectorAll('meta[property^="article:"]')).map(
        (meta) => ({
          property: (meta as HTMLMetaElement).getAttribute('property'),
          content: (meta as HTMLMetaElement).content
        })
      )

      const profileTags = Array.from(document.querySelectorAll('meta[property^="profile:"]')).map(
        (meta) => ({
          property: (meta as HTMLMetaElement).getAttribute('property'),
          content: (meta as HTMLMetaElement).content
        })
      )

      return { ogTags, twitterTags, articleTags, profileTags }
    })

    // Проверяем минимальный набор OG тегов
    const requiredOGProperties = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image']
    for (const property of requiredOGProperties) {
      const tag = allMetaTags.ogTags.find((tag) => tag.property === property)
      expect(tag).toBeTruthy()
      expect(tag?.content).toBeTruthy()
    }

    // Проверяем минимальный набор Twitter тегов
    const requiredTwitterNames = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']
    for (const name of requiredTwitterNames) {
      const tag = allMetaTags.twitterTags.find((tag) => tag.name === name)
      expect(tag).toBeTruthy()
      expect(tag?.content).toBeTruthy()
    }

    console.log('✅ Структурированные данные валидны')
  })

  test('производительность загрузки OG изображений', async ({ page, request }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage).toBeTruthy()

    // Измеряем время загрузки изображения
    const startTime = Date.now()
    const imageResponse = await request.get(ogImage!)
    const loadTime = Date.now() - startTime

    expect(imageResponse.status()).toBe(200)
    expect(loadTime).toBeLessThan(5000) // Должно загружаться менее чем за 5 секунд

    // Проверяем размер изображения (должен быть разумным)
    const imageSize = Number.parseInt(imageResponse.headers()['content-length'] || '0')
    expect(imageSize).toBeGreaterThan(1000) // Минимум 1KB
    expect(imageSize).toBeLessThan(1000000) // Максимум 1MB

    console.log(`✅ OG изображение загружено за ${loadTime}ms, размер: ${Math.round(imageSize / 1024)}KB`)
  })

  test('корректная обработка специальных символов в метаданных', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    const metaContents = await page.evaluate(() => {
      const getMetaContent = (selector: string) => {
        const element = document.querySelector(selector) as HTMLMetaElement
        return element?.content || ''
      }

      return {
        title: getMetaContent('meta[property="og:title"]'),
        description: getMetaContent('meta[property="og:description"]')
      }
    })

    // Проверяем что контент не содержит опасные символы
    expect(metaContents.title).not.toContain('<script')
    expect(metaContents.title).not.toContain('</script')
    expect(metaContents.description).not.toContain('<script')
    expect(metaContents.description).not.toContain('</script')

    // Проверяем что контент корректно экранирован
    if (metaContents.title.includes('"')) {
      expect(metaContents.title).not.toMatch(QUOTED_STRING_REGEX) // Не должно быть в кавычках целиком
    }

    console.log('✅ Специальные символы обрабатываются корректно')
  })
})
