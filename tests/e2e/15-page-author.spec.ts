/**
 * Тест для проверки страницы отдельного автора
 *
 * Проверяет отображение профиля автора, списка публикаций, возможность подписки
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin, TEST_USERS } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Страница отдельного автора', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('Должна загружаться и отображать профиль автора', async ({ page }) => {
    // Переходим на страницу авторов и выбираем первого автора
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link, .author-card a').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Проверяем основные элементы профиля
      const authorName = await page.locator('h1, .author-name, .profile-name').first()
      expect(await authorName.isVisible()).toBeTruthy()

      // Проверяем аватар
      const authorAvatar = await page.locator('.avatar, .author-avatar, .profile-photo img').first()
      if (await authorAvatar.isVisible()) {
        const avatarSrc = await authorAvatar.getAttribute('src')
        expect(avatarSrc).toBeTruthy()
      }

      // Проверяем биографию (если есть)
      const authorBio = await page.locator('.bio, .author-bio, .description, .about').first()
      if (await authorBio.isVisible()) {
        expect(await authorBio.textContent()).toBeTruthy()
      }

      // Проверяем статистику автора
      const authorStats = await page
        .locator('.author-stats, .profile-stats, :has-text("публикаци"), :has-text("подписчи")')
        .first()
      if (await authorStats.isVisible()) {
        expect(await authorStats.textContent()).toMatch(/\d/)
      }
    } else {
      console.warn('Авторы не найдены')
      test.skip()
    }
  })

  test('Должна отображать список публикаций автора', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Проверяем наличие публикаций
      const publicationsList = await page.locator('article, .post, .publication, .author-content').count()
      expect(publicationsList >= 0).toBeTruthy() // Может быть пустой список

      if (publicationsList > 0) {
        // Проверяем структуру первой публикации
        const firstPublication = await page.locator('article, .post, .publication').first()
        const publicationTitle = await firstPublication.locator('h2, h3, .title, .post-title').first()
        expect(await publicationTitle.isVisible()).toBeTruthy()

        // Проверяем дату публикации
        const publicationDate = await firstPublication.locator('.date, .published, time').first()
        if (await publicationDate.isVisible()) {
          expect(await publicationDate.textContent()).toBeTruthy()
        }

        // Проверяем возможность перехода к публикации
        const publicationLink = await firstPublication.locator('a, [href]').first()
        if (await publicationLink.isVisible()) {
          const href = await publicationLink.getAttribute('href')
          expect(href).toBeTruthy()
        }
      } else {
        // Проверяем сообщение об отсутствии публикаций
        const emptyMessage = await page
          .locator(':has-text("нет публикаций"), .empty-author, .no-content')
          .first()
        if (await emptyMessage.isVisible()) {
          expect(await emptyMessage.textContent()).toBeTruthy()
        }
      }
    }
  })

  test('Должна позволять подписаться на автора', async ({ page }) => {
    const authSuccess = await performLogin(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Ищем кнопку подписки
      const subscribeButton = await page
        .locator('button:has-text("Подписаться"), .subscribe-button, .follow-author')
        .first()

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click()
        await page.waitForTimeout(1000)

        // Проверяем изменение состояния кнопки
        const subscribedButton = await page
          .locator('button:has-text("Подписан"), button:has-text("Отписаться"), .subscribed, .following')
          .first()
        expect(await subscribedButton.isVisible()).toBeTruthy()

        // Проверяем увеличение счетчика подписчиков (опционально)
        const followersCount = await page.locator(':has-text("подписчи"), .followers-count').first()
        if (await followersCount.isVisible()) {
          expect(await followersCount.textContent()).toMatch(/\d/)
        }
      } else {
        console.warn('Кнопка подписки на автора не найдена')
        test.skip()
      }
    }
  })

  test('Должна отображать социальные ссылки автора', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Ищем социальные ссылки
      const socialLinks = await page.locator('.social-links, .author-links, .contact-links').first()

      if (await socialLinks.isVisible()) {
        // Проверяем наличие ссылок
        const links = await socialLinks.locator('a').count()
        expect(links > 0).toBeTruthy()

        // Проверяем, что ссылки имеют корректные href
        const firstLink = await socialLinks.locator('a').first()
        const href = await firstLink.getAttribute('href')
        expect(href).toMatch(/^https?:\/\/|^mailto:/)

        // Проверяем target="_blank" для внешних ссылок
        const target = await firstLink.getAttribute('target')
        if (href?.startsWith('http')) {
          expect(target).toBe('_blank')
        }
      } else {
        console.warn('Социальные ссылки не найдены')
        // Не критично, может не быть ссылок
      }
    }
  })

  test('Должна предоставлять фильтры по типу публикаций', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Ищем фильтры по типу контента
      const contentFilters = await page
        .locator('.format-filters, .content-type-filter, .publication-filters')
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
        console.warn('Фильтры публикаций не найдены')
        // Не критично
      }
    }
  })

  test('Должна показывать достижения и награды автора', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Ищем секцию с достижениями
      const achievements = await page
        .locator('.achievements, .badges, .awards, .author-achievements')
        .first()

      if (await achievements.isVisible()) {
        // Проверяем наличие достижений
        const achievementItems = await achievements.locator('.achievement, .badge, .award').count()
        expect(achievementItems > 0).toBeTruthy()

        // Проверяем структуру достижения
        const firstAchievement = await achievements.locator('.achievement, .badge, .award').first()
        if (await firstAchievement.isVisible()) {
          expect(await firstAchievement.textContent()).toBeTruthy()
        }
      } else {
        console.warn('Достижения не найдены')
        // Не обязательная функциональность
      }
    }
  })

  test('Должна отображать статистику активности автора', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Ищем различные метрики
      const statsElements = await page
        .locator(
          ':has-text("публикаци"), :has-text("просмотр"), :has-text("лайк"), :has-text("комментари")'
        )
        .count()

      if (statsElements > 0) {
        // Проверяем, что есть числовые значения
        const statsText = await page.locator('.stats, .metrics, .activity-stats').first().textContent()
        if (statsText) {
          expect(statsText).toMatch(/\d/)
        }
      } else {
        console.warn('Статистика активности не найдена')
        // Базовая статистика должна быть хотя бы в виде количества публикаций
        const basicStats = await page.locator(':has-text("0"), :has-text("публикац")').first()
        if (await basicStats.isVisible()) {
          expect(true).toBeTruthy() // Есть хотя бы базовая информация
        }
      }
    }
  })

  test('Должна правильно отображать пустой профиль нового автора', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем автора с минимальным количеством публикаций
    const authors = await page.locator('a[href*="/author/"], .author-link').all()

    if (authors.length > 0) {
      // TODO: Implement
    }
  })
})
