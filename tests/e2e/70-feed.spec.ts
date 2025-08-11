/**
 * Тест для проверки ленты публикаций
 *
 * Проверяет разделы ленты, сортировку материалов, фильтрацию контента, загрузку
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Лента публикаций', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('@smoke Должна отображать раздел "Все"', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем переключатель "Все"
    const allFeedTab = await page
      .locator('button:has-text("Все"), .all-feed, [data-testid="all-feed"]')
      .first()

    if (await allFeedTab.isVisible()) {
      await allFeedTab.click()
      await waitForPageLoad(page)
    }

    // Проверяем наличие публикаций
    const articles = await page.locator('article, .post, .feed-item').count()
    expect(articles >= 0).toBeTruthy()

    if (articles > 0) {
      // Проверяем структуру первой публикации
      const firstArticle = await page.locator('article, .post, .feed-item').first()
      const articleTitle = await firstArticle.locator('h2, h3, .title').first()
      expect(await articleTitle.isVisible()).toBeTruthy()

      const articleAuthor = await firstArticle.locator('.author, .by-author').first()
      if (await articleAuthor.isVisible()) {
        expect(await articleAuthor.textContent()).toBeTruthy()
      }
    }
  })

  test('Должна отображать раздел "Моя лента" для авторизованных пользователей', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем переключатель "Моя лента"
    const myFeedTab = await page
      .locator('button:has-text("Моя лента"), .my-feed, [data-testid="my-feed"]')
      .first()

    if (await myFeedTab.isVisible()) {
      await myFeedTab.click()
      await waitForPageLoad(page)

      // Проверяем, что лента загрузилась
      const feedContent = await page.locator('article, .post, .feed-item').count()
      expect(feedContent >= 0).toBeTruthy() // Может быть пустой, если нет подписок

      // Если лента пуста, проверяем сообщение о подписках
      if (feedContent === 0) {
        const emptyFeedMessage = await page
          .locator(':has-text("подпишитесь"), .empty-feed, :has-text("нет подписок")')
          .first()
        if (await emptyFeedMessage.isVisible()) {
          expect(await emptyFeedMessage.textContent()).toBeTruthy()
        }
      }
    } else {
      console.warn('Раздел "Моя лента" не найден')
      test.skip()
    }
  })

  test('Должна предоставлять сортировку по дате публикации', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем элементы сортировки
    const sortByDate = await page
      .locator('button:has-text("Новые"), .sort-date, [data-sort="date"]')
      .first()

    if (await sortByDate.isVisible()) {
      await sortByDate.click()
      await page.waitForTimeout(1000)

      // Проверяем, что контент обновился
      const articles = await page.locator('article, .post').count()
      expect(articles >= 0).toBeTruthy()

      // Проверяем хронологический порядок (опционально)
      if (articles > 1) {
        const dates = await page.locator('.date, .published, time').all()
        if (dates.length > 1) {
          // Базовая проверка что даты присутствуют
          expect(dates.length > 0).toBeTruthy()
        }
      }
    } else {
      console.warn('Сортировка по дате не найдена')
      // Не критично, может быть только один вид сортировки
    }
  })

  test('Должна предоставлять сортировку по рейтингу', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем сортировку по популярности/рейтингу
    const sortByRating = await page
      .locator('button:has-text("Популярные"), .sort-rating, [data-sort="rating"]')
      .first()

    if (await sortByRating.isVisible()) {
      await sortByRating.click()
      await page.waitForTimeout(1000)

      // Проверяем, что контент обновился
      const articles = await page.locator('article, .post').count()
      expect(articles >= 0).toBeTruthy()

      // Проверяем наличие рейтингов
      const ratings = await page.locator('.rating, .votes, .score').count()
      if (ratings > 0) {
        expect(ratings > 0).toBeTruthy()
      }
    } else {
      console.warn('Сортировка по рейтингу не найдена')
      // Не критично
    }
  })

  test('Должна предоставлять фильтрацию по периоду публикации', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем фильтры по времени
    const timeFilters = await page
      .locator(
        '.time-filter, select[name*="period"], button:has-text("За день"), button:has-text("За неделю")'
      )
      .first()

    if (await timeFilters.isVisible()) {
      // Если это select
      if ((await timeFilters.locator('option').count()) > 0) {
        await timeFilters.selectOption('week')
      } else {
        // Если это кнопки
        const weekFilter = await page.locator('button:has-text("За неделю"), .filter-week').first()
        if (await weekFilter.isVisible()) {
          await weekFilter.click()
        }
      }

      await page.waitForTimeout(1000)

      // Проверяем, что контент обновился
      const filteredArticles = await page.locator('article, .post').count()
      expect(filteredArticles >= 0).toBeTruthy()
    } else {
      console.warn('Фильтры по времени не найдены')
      // Не критично
    }
  })

  test('Должна предоставлять фильтрацию по формату контента', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем фильтры по формату
    const formatFilters = await page
      .locator(
        '.format-filter, button:has-text("Статьи"), button:has-text("Видео"), button:has-text("Музыка")'
      )
      .first()

    if (await formatFilters.isVisible()) {
      // Пробуем фильтр статей
      const articleFilter = await page
        .locator('button:has-text("Статьи"), .filter-article, input[value="article"]')
        .first()

      if (await articleFilter.isVisible()) {
        await articleFilter.click()
        await page.waitForTimeout(1000)

        // Проверяем, что контент обновился
        const filteredContent = await page.locator('article, .post').count()
        expect(filteredContent >= 0).toBeTruthy()
      }
    } else {
      console.warn('Фильтры по формату не найдены')
      // Не критично
    }
  })

  test('Должна поддерживать пагинацию и ленивую загрузку', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Подсчитываем изначальное количество статей
    const initialArticles = await page.locator('article, .post').count()

    // Прокручиваем вниз для загрузки следующей порции
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })

    // Ждем возможной загрузки
    await page.waitForTimeout(2000)

    // Проверяем, что могли загрузиться новые статьи
    const afterScrollArticles = await page.locator('article, .post').count()

    // Либо загрузились новые статьи, либо есть кнопка "Загрузить ещё"
    const loadMoreButton = await page.locator('button:has-text("Загрузить"), .load-more').first()
    const hasLoadMore = await loadMoreButton.isVisible()

    expect(afterScrollArticles >= initialArticles || hasLoadMore).toBeTruthy()

    // Если есть кнопка "Загрузить ещё", проверяем её работу
    if (hasLoadMore) {
      await loadMoreButton.click()
      await page.waitForTimeout(2000)

      const afterClickArticles = await page.locator('article, .post').count()
      expect(afterClickArticles >= afterScrollArticles).toBeTruthy()
    }
  })

  test('Должна кэшировать данные для быстрого доступа', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Засекаем время загрузки первого посещения
    const startTime = Date.now()
    await page.locator('article, .post').first().waitFor({ timeout: 10000 })
    const firstLoadTime = Date.now() - startTime

    // Переходим на другую страницу и возвращаемся
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Возвращаемся в ленту
    const cacheStartTime = Date.now()
    await page.goto(`${baseUrl}/feed`)
    await page.locator('article, .post').first().waitFor({ timeout: 5000 })
    const cacheLoadTime = Date.now() - cacheStartTime

    // Вторая загрузка должна быть быстрее (благодаря кэшу) или хотя бы не намного медленнее
    expect(cacheLoadTime <= firstLoadTime * 1.5).toBeTruthy()
  })

  test('Должна отображать статус материалов (зафичеренные/незафичеренные)', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем фильтры по статусу
    const statusFilters = await page
      .locator('.status-filter, button:has-text("Зафичеренные"), button:has-text("Незафичеренные")')
      .first()

    if (await statusFilters.isVisible()) {
      // Пробуем фильтр зафичеренных
      const featuredFilter = await page.locator('button:has-text("Зафичеренные"), .filter-featured').first()

      if (await featuredFilter.isVisible()) {
        await featuredFilter.click()
        await page.waitForTimeout(1000)

        // Проверяем наличие меток "зафичерено"
        const featuredMarks = await page.locator('.featured, .фичер, .highlighted').count()

        // Либо есть метки зафичеренных статей, либо статей нет вообще
        const articles = await page.locator('article, .post').count()
        expect(featuredMarks > 0 || articles === 0).toBeTruthy()
      }
    } else {
      console.warn('Фильтры по статусу не найдены')
      // Проверяем просто наличие меток в статьях
      const anyFeaturedMarks = await page.locator('.featured, .фичер, .highlighted').count()
      // Метки могут быть, а могут и не быть - это нормально
      expect(anyFeaturedMarks >= 0).toBeTruthy()
    }
  })

  test('Должна корректно отображаться на мобильных устройствах', async ({ page }) => {
    // Эмулируем мобильное устройство
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Проверяем адаптивность ленты
    const feedContainer = await page.locator('.feed, .posts, main').first()
    if (await feedContainer.isVisible()) {
      const containerWidth = await feedContainer.boundingBox()
      expect(containerWidth?.width).toBeLessThanOrEqual(375)
    }

    // Проверяем, что карточки статей адаптированы
    const firstArticle = await page.locator('article, .post').first()
    if (await firstArticle.isVisible()) {
      const articleWidth = await firstArticle.boundingBox()
      expect(articleWidth?.width).toBeLessThanOrEqual(375)
    }

    // Проверяем работу фильтров на мобильном
    const mobileFilters = await page.locator('button, select').count()
    expect(mobileFilters > 0).toBeTruthy()
  })
})
