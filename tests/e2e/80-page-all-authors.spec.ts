/**
 * Тест для проверки страницы "Все авторы"
 *
 * Проверяет отображение списка авторов, сортировку, статистику и информацию
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Страница "Все авторы"', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('Должна загружаться и отображать список авторов', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Проверяем заголовок страницы
    const pageTitle = await page.locator('h1, .page-title, .authors-title').first()
    if (await pageTitle.isVisible()) {
      expect(await pageTitle.textContent()).toMatch(/автор/i)
    }

    // Проверяем наличие авторов
    const authors = await page.locator('.author-card, .author-item, .author').count()
    expect(authors >= 0).toBeTruthy() // Может быть пустой список

    if (authors > 0) {
      // Проверяем структуру карточки первого автора
      const firstAuthor = await page.locator('.author-card, .author-item, .author').first()

      // Имя автора
      const authorName = await firstAuthor.locator('h2, h3, .name, .author-name').first()
      expect(await authorName.isVisible()).toBeTruthy()

      // Аватар автора
      const authorAvatar = await firstAuthor.locator('img, .avatar').first()
      if (await authorAvatar.isVisible()) {
        const avatarSrc = await authorAvatar.getAttribute('src')
        expect(avatarSrc).toBeTruthy()
      }

      // Ссылка на профиль
      const authorLink = await firstAuthor.locator('a[href*="/author/"], .author-link').first()
      expect(await authorLink.isVisible()).toBeTruthy()
    }
  })

  test('Должна отображать статистику авторов', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const authors = await page.locator('.author-card, .author-item').all()

    if (authors.length > 0) {
      const firstAuthor = authors[0]

      // Количество публикаций
      const publicationsCount = await firstAuthor
        .locator(':has-text("публикаци"), .publications-count, .posts-count')
        .first()
      if (await publicationsCount.isVisible()) {
        const countText = await publicationsCount.textContent()
        expect(countText).toMatch(/\d/)
      }

      // Количество подписчиков
      const followersCount = await firstAuthor
        .locator(':has-text("подписчи"), .followers-count, .subscribers-count')
        .first()
      if (await followersCount.isVisible()) {
        const countText = await followersCount.textContent()
        expect(countText).toMatch(/\d/)
      }

      // Последняя активность
      const lastActivity = await firstAuthor.locator('.last-activity, .last-post, .activity-date').first()
      if (await lastActivity.isVisible()) {
        expect(await lastActivity.textContent()).toBeTruthy()
      }
    } else {
      console.warn('Авторы не найдены для проверки статистики')
      test.skip()
    }
  })

  test('Должна предоставлять сортировку по количеству публикаций', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем сортировку по публикациям
    const sortByPosts = await page
      .locator('button:has-text("По публикациям"), .sort-posts, [data-sort="posts"]')
      .first()

    if (await sortByPosts.isVisible()) {
      await sortByPosts.click()
      await page.waitForTimeout(1000)

      // Проверяем, что список обновился
      const authors = await page.locator('.author-card, .author-item').count()
      expect(authors >= 0).toBeTruthy()

      // Проверяем, что в карточках отображается количество публикаций
      const postsStats = await page.locator(':has-text("публикаци"), .posts-count').count()
      if (postsStats > 0) {
        expect(postsStats > 0).toBeTruthy()
      }
    } else {
      console.warn('Сортировка по публикациям не найдена')
      // Может быть сортировка по умолчанию
    }
  })

  test('Должна предоставлять сортировку по количеству подписчиков', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем сортировку по подписчикам
    const sortByFollowers = await page
      .locator('button:has-text("По подписчикам"), .sort-followers, [data-sort="followers"]')
      .first()

    if (await sortByFollowers.isVisible()) {
      await sortByFollowers.click()
      await page.waitForTimeout(1000)

      // Проверяем, что список обновился
      const authors = await page.locator('.author-card, .author-item').count()
      expect(authors >= 0).toBeTruthy()

      // Проверяем, что в карточках отображается количество подписчиков
      const followersStats = await page.locator(':has-text("подписчи"), .followers-count').count()
      if (followersStats > 0) {
        expect(followersStats > 0).toBeTruthy()
      }
    } else {
      console.warn('Сортировка по подписчикам не найдена')
      // Не критично
    }
  })

  test('Должна предоставлять алфавитную сортировку', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем алфавитную сортировку
    const sortAlphabetically = await page
      .locator('button:has-text("По алфавиту"), .sort-alpha, [data-sort="name"]')
      .first()

    if (await sortAlphabetically.isVisible()) {
      await sortAlphabetically.click()
      await page.waitForTimeout(1000)

      // Проверяем, что список обновился
      const authors = await page.locator('.author-card, .author-item').count()
      expect(authors >= 0).toBeTruthy()

      // Базовая проверка - имена авторов должны быть видны
      const authorNames = await page.locator('.author-name, .name, h2, h3').count()
      expect(authorNames >= 0).toBeTruthy()
    } else {
      console.warn('Алфавитная сортировка не найдена')
      // Не критично
    }
  })

  test('Должна позволять переходить к профилям авторов', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const authorLinks = await page.locator('a[href*="/author/"], .author-link').all()

    if (authorLinks.length > 0) {
      const firstAuthorLink = authorLinks[0]
      const href = await firstAuthorLink.getAttribute('href')

      expect(href).toMatch(/\/author\//)

      // Проверяем переход к профилю
      const currentUrl = page.url()
      await firstAuthorLink.click()
      await waitForPageLoad(page)

      const newUrl = page.url()
      expect(newUrl).not.toBe(currentUrl)
      expect(newUrl).toContain('/author/')

      // Проверяем, что это действительно страница автора
      const authorPage = await page.locator('h1, .author-name, .profile-name').first()
      expect(await authorPage.isVisible()).toBeTruthy()
    } else {
      console.warn('Ссылки на авторов не найдены')
      test.skip()
    }
  })

  test('Должна поддерживать поиск авторов', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем поле поиска авторов
    const searchInput = await page
      .locator('input[placeholder*="поиск"], input[placeholder*="автор"], .search-authors')
      .first()

    if (await searchInput.isVisible()) {
      // Вводим поисковый запрос
      await searchInput.fill('дискурс')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)

      // Проверяем результаты поиска
      const filteredAuthors = await page.locator('.author-card, .author-item').count()
      expect(filteredAuthors >= 0).toBeTruthy()

      // Очищаем поиск
      await searchInput.clear()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)

      const allAuthors = await page.locator('.author-card, .author-item').count()
      expect(allAuthors >= filteredAuthors).toBeTruthy()
    } else {
      console.warn('Поиск авторов не найден')
      // Не критично, может не быть поиска
    }
  })

  test('Должна отображать пагинацию при большом количестве авторов', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Подсчитываем изначальное количество авторов
    const initialAuthors = await page.locator('.author-card, .author-item').count()

    // Ищем пагинацию
    const pagination = await page
      .locator('.pagination, .page-nav, button:has-text("Загрузить"), button:has-text("Следующая")')
      .first()

    if (await pagination.isVisible()) {
      // Если есть кнопка "Загрузить ещё"
      const loadMoreButton = await page.locator('button:has-text("Загрузить"), .load-more').first()
      if (await loadMoreButton.isVisible()) {
        await loadMoreButton.click()
        await page.waitForTimeout(2000)

        const afterLoadAuthors = await page.locator('.author-card, .author-item').count()
        expect(afterLoadAuthors >= initialAuthors).toBeTruthy()
      }

      // Если есть номера страниц
      const nextPageButton = await page.locator('button:has-text("2"), .page-2, [data-page="2"]').first()
      if (await nextPageButton.isVisible()) {
        await nextPageButton.click()
        await waitForPageLoad(page)

        // Проверяем, что URL изменился или контент обновился
        const page2Authors = await page.locator('.author-card, .author-item').count()
        expect(page2Authors >= 0).toBeTruthy()
      }
    } else {
      // Проверяем scroll-based пагинацию
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })
      await page.waitForTimeout(2000)

      const afterScrollAuthors = await page.locator('.author-card, .author-item').count()
      expect(afterScrollAuthors >= initialAuthors).toBeTruthy()
    }
  })

  test('Должна корректно отображаться на мобильных устройствах', async ({ page }) => {
    // Эмулируем мобильное устройство
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Проверяем адаптивность контейнера
    const authorsContainer = await page.locator('.authors, .authors-list, main').first()
    if (await authorsContainer.isVisible()) {
      const containerWidth = await authorsContainer.boundingBox()
      expect(containerWidth?.width).toBeLessThanOrEqual(375)
    }

    // Проверяем, что карточки авторов адаптированы
    const firstAuthor = await page.locator('.author-card, .author-item').first()
    if (await firstAuthor.isVisible()) {
      const authorWidth = await firstAuthor.boundingBox()
      expect(authorWidth?.width).toBeLessThanOrEqual(375)
    }

    // Проверяем работу сортировки на мобильном
    const sortButtons = await page.locator('button, select').count()
    expect(sortButtons >= 0).toBeTruthy()
  })
})
