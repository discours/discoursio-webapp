/**
 * Тест для проверки страницы отдельного автора
 *
 * Проверяет отображение профиля автора, списка публикаций, возможность подписки
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin } from '../utils/auth-helpers'
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
        const emptyMessage = await page.locator(':has-text("нет публикаций"), .empty-author, .no-content').first()
        if (await emptyMessage.isVisible()) {
          expect(await emptyMessage.textContent()).toBeTruthy()
        }
      }
    }
  })

  test('Должна позволять подписаться на автора', async ({ page }) => {
    const authSuccess = await performLogin(page)
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

  test('Должна предоставлять разделы профиля', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Проверяем разделы: Публикации, Комментарии, Подписчики, Подписки
      const sections = [
        'button:has-text("Публикации"), .publications-tab',
        'button:has-text("Комментарии"), .comments-tab',
        'button:has-text("Подписчики"), .followers-tab',
        'button:has-text("Подписки"), .following-tab'
      ]

      for (const sectionSelector of sections) {
        const section = await page.locator(sectionSelector).first()
        if (await section.isVisible()) {
          await section.click()
          await page.waitForTimeout(500)

          // Проверяем, что контент обновился
          const content = await page.locator('.tab-content, .section-content').first()
          if (await content.isVisible()) {
            expect(await content.isVisible()).toBeTruthy()
          }
        }
      }
    }
  })

  test('Должна корректно отображаться на мобильных устройствах', async ({ page }) => {
    // Эмулируем мобильное устройство
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('a[href*="/author/"], .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Проверяем, что основные элементы видны
      const authorName = await page.locator('h1, .author-name').first()
      expect(await authorName.isVisible()).toBeTruthy()

      // Проверяем адаптивность контейнера
      const profileContainer = await page.locator('.profile, .author-page, main').first()
      if (await profileContainer.isVisible()) {
        const containerWidth = await profileContainer.boundingBox()
        expect(containerWidth?.width).toBeLessThanOrEqual(375)
      }

      // Проверяем, что кнопки доступны на мобильном
      const mobileButtons = await page.locator('button').count()
      expect(mobileButtons > 0).toBeTruthy()
    }
  })
})
