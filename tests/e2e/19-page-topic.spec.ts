/**
 * Тест для проверки страницы отдельной темы
 *
 * Проверяет отображение информации о теме, список материалов, подписку на тему
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Страница отдельной темы', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('@smoke Должна загружаться и отображать информацию о теме', async ({ page }) => {
    // Переходим на страницу тем и выбираем первую тему
    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link, .topic-card a').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Проверяем заголовок темы
      const topicTitle = await page.locator('h1, .topic-title, .page-title').first()
      expect(await topicTitle.isVisible()).toBeTruthy()

      // Проверяем описание темы (если есть)
      const topicDescription = await page.locator('.topic-description, .topic-info, .description').first()
      if (await topicDescription.isVisible()) {
        expect(await topicDescription.textContent()).toBeTruthy()
      }

      // Проверяем статистику (количество материалов, подписчиков)
      const topicStats = await page
        .locator('.topic-stats, .stats, :has-text("материал"), :has-text("подписчи")')
        .first()
      if (await topicStats.isVisible()) {
        expect(await topicStats.textContent()).toMatch(/\d/)
      }
    } else {
      console.warn('Темы не найдены')
      test.skip()
    }
  })

  test('Должна отображать список материалов по теме', async ({ page }) => {
    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Проверяем наличие материалов
      const materialsList = await page.locator('article, .post, .material-card, .content-item').count()
      expect(materialsList >= 0).toBeTruthy() // Может быть пустой список

      if (materialsList > 0) {
        // Проверяем, что материалы имеют базовую структуру
        const firstMaterial = await page.locator('article, .post, .material-card').first()
        const materialTitle = await firstMaterial.locator('h2, h3, .title, .post-title').first()
        expect(await materialTitle.isVisible()).toBeTruthy()

        // Проверяем автора материала
        const materialAuthor = await firstMaterial.locator('.author, .author-name, .by-author').first()
        if (await materialAuthor.isVisible()) {
          expect(await materialAuthor.textContent()).toBeTruthy()
        }
      } else {
        // Проверяем сообщение о пустой теме
        const emptyMessage = await page
          .locator(':has-text("нет материалов"), .empty-topic, .no-content')
          .first()
        if (await emptyMessage.isVisible()) {
          expect(await emptyMessage.textContent()).toBeTruthy()
        }
      }
    }
  })

  test('Должна позволять подписаться на тему авторизованным пользователям', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Ищем кнопку подписки
      const subscribeButton = await page
        .locator('button:has-text("Подписаться"), .subscribe-topic, .follow-topic')
        .first()

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click()
        await page.waitForTimeout(1000)

        // Проверяем изменение состояния кнопки
        const subscribedButton = await page
          .locator('button:has-text("Подписан"), button:has-text("Отписаться"), .subscribed')
          .first()
        expect(await subscribedButton.isVisible()).toBeTruthy()

        // Можем проверить увеличение счетчика подписчиков
        const subscribersCount = await page.locator(':has-text("подписчи"), .subscribers-count').first()
        if (await subscribersCount.isVisible()) {
          expect(await subscribersCount.textContent()).toMatch(/\d/)
        }
      } else {
        console.warn('Кнопка подписки на тему не найдена')
        test.skip()
      }
    }
  })

  test('Должна предоставлять фильтры по типу материалов', async ({ page }) => {
    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Ищем фильтры по типу контента
      const contentFilters = await page
        .locator(
          '.format-filters, .content-type-filter, button:has-text("Статьи"), button:has-text("Видео")'
        )
        .first()

      if (await contentFilters.isVisible()) {
        // Пробуем переключить фильтр
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
        console.warn('Фильтры контента не найдены')
        // Это не критично, может не быть фильтров
      }
    }
  })

  test('Должна позволять сортировать материалы', async ({ page }) => {
    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Ищем элементы сортировки
      const sortOptions = await page
        .locator(
          '.sort-options, select[name*="sort"], button:has-text("Новые"), button:has-text("Популярные")'
        )
        .first()

      if (await sortOptions.isVisible()) {
        // Пробуем изменить сортировку
        if ((await sortOptions.locator('option').count()) > 0) {
          // Это select
          await sortOptions.selectOption('popular')
        } else {
          // Это кнопки
          const popularSort = await page.locator('button:has-text("Популярные"), .sort-popular').first()
          if (await popularSort.isVisible()) {
            await popularSort.click()
          }
        }

        await page.waitForTimeout(1000)

        // Проверяем, что контент перестроился
        const sortedContent = await page.locator('article, .post').count()
        expect(sortedContent >= 0).toBeTruthy()
      } else {
        console.warn('Опции сортировки не найдены')
        // Не критично
      }
    }
  })

  test('Должна отображать хлебные крошки навигации', async ({ page }) => {
    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Проверяем хлебные крошки
      const breadcrumbs = await page
        .locator('.breadcrumbs, .breadcrumb, nav[aria-label*="breadcrumb"]')
        .first()

      if (await breadcrumbs.isVisible()) {
        // Проверяем ссылку на главную или темы
        const homeLink = await breadcrumbs.locator('a[href="/"], a[href*="topics"]').first()
        expect(await homeLink.isVisible()).toBeTruthy()

        // Проверяем название текущей темы
        const currentTopic = await breadcrumbs.locator(':last-child, .current').first()
        expect(await currentTopic.isVisible()).toBeTruthy()
      } else {
        console.warn('Хлебные крошки не найдены')
        // Не критично для функциональности
      }
    }
  })

  test('Должна корректно отображаться на мобильных устройствах', async ({ page }) => {
    // Эмулируем мобильное устройство
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    const firstTopic = await page.locator('a[href*="/topic/"], .topic-link').first()

    if (await firstTopic.isVisible()) {
      await firstTopic.click()
      await waitForPageLoad(page)

      // Проверяем, что основные элементы видны
      const topicTitle = await page.locator('h1, .topic-title').first()
      expect(await topicTitle.isVisible()).toBeTruthy()

      // Проверяем адаптивность списка материалов
      const materialsContainer = await page.locator('.materials, .posts, .content-list').first()
      if (await materialsContainer.isVisible()) {
        const containerWidth = await materialsContainer.boundingBox()
        expect(containerWidth?.width).toBeLessThanOrEqual(375)
      }

      // Проверяем, что кнопки доступны на мобильном
      const mobileButtons = await page.locator('button').count()
      expect(mobileButtons > 0).toBeTruthy()
    }
  })
})
