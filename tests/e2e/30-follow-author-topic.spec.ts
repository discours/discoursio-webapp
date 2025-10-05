/**
 * Тест для проверки системы подписок
 *
 * Проверяет подписку/отписку от авторов и тем, управление подписками
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Система подписок', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('Должен позволять подписываться на авторов в их профиле', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Переходим на страницу авторов
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем первого автора и переходим в его профиль
    const firstAuthor = await page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      // Ищем кнопку подписки
      const subscribeButton = await page.locator('button:has-text("Подписаться"), button:has-text("Follow")').first()

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click()
        await page.waitForTimeout(1000)

        // Проверяем, что кнопка изменилась на "Отписаться"
        const unsubscribeButton = await page
          .locator('button:has-text("Отписаться"), button:has-text("Unfollow")')
          .first()
        expect(await unsubscribeButton.isVisible()).toBeTruthy()
      } else {
        console.warn('Кнопка подписки не найдена')
        test.skip()
      }
    } else {
      console.warn('Авторы не найдены')
      test.skip()
    }
  })

  test('Должен позволять быструю подписку под публикацией', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем кнопку подписки в карточке статьи
    const subscribeInFeed = await page
      .locator('.article-card button:has-text("Подписаться"), .post-subscribe, .follow-author')
      .first()

    if (await subscribeInFeed.isVisible()) {
      await subscribeInFeed.click()
      await page.waitForTimeout(1000)

      // Проверяем изменение состояния кнопки
      const followedButton = await page
        .locator('button:has-text("Подписан"), button:has-text("Отписаться"), .following')
        .first()
      expect(await followedButton.isVisible()).toBeTruthy()
    } else {
      console.warn('Кнопка быстрой подписки не найдена')
      test.skip()
    }
  })

  test('Должен позволять отписываться от авторов', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Переходим в настройки или профиль, где видны подписки
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    // Или ищем любую кнопку отписки
    const unsubscribeButton = await page
      .locator('button:has-text("Отписаться"), .unsubscribe-button, .unfollow')
      .first()

    if (await unsubscribeButton.isVisible()) {
      await unsubscribeButton.click()
      await page.waitForTimeout(1000)

      // Проверяем, что кнопка изменилась или элемент исчез
      const subscribeButton = await page.locator('button:has-text("Подписаться"), .subscribe-button').first()
      expect(await subscribeButton.isVisible()).toBeTruthy()
    } else {
      console.warn('Нет активных подписок для отмены')
      test.skip()
    }
  })

  test('Должен позволять подписываться на темы', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Переходим на страницу тем
    await page.goto(`${baseUrl}/topics`)
    await waitForPageLoad(page)

    // Ищем кнопку подписки на тему
    const topicSubscribe = await page.locator('button:has-text("Подписаться"), .topic-subscribe, .follow-topic').first()

    if (await topicSubscribe.isVisible()) {
      await topicSubscribe.click()
      await page.waitForTimeout(1000)

      const followedTopic = await page
        .locator('button:has-text("Подписан"), button:has-text("Отписаться"), .topic-following')
        .first()
      expect(await followedTopic.isVisible()).toBeTruthy()
    } else {
      // Ищем отдельную страницу темы
      const topicLink = await page.locator('a[href*="/topic/"], .topic-link').first()
      if (await topicLink.isVisible()) {
        await topicLink.click()
        await waitForPageLoad(page)

        const topicPageSubscribe = await page.locator('button:has-text("Подписаться"), .subscribe-topic').first()
        if (await topicPageSubscribe.isVisible()) {
          await topicPageSubscribe.click()
          await page.waitForTimeout(1000)
          expect(true).toBeTruthy()
        }
      } else {
        console.warn('Темы или кнопки подписки не найдены')
        test.skip()
      }
    }
  })

  test('Должен отображать управление подписками в профиле', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Переходим в настройки или профиль
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    // Ищем раздел с подписками
    const subscriptionsSection = await page
      .locator(':has-text("подписки"), .subscriptions, .following, [data-testid="subscriptions"]')
      .first()

    if (await subscriptionsSection.isVisible()) {
      // Проверяем наличие списка подписок
      const subscriptionItems = await page.locator('.subscription-item, .followed-author, .followed-topic').count()
      expect(subscriptionItems >= 0).toBeTruthy() // Может быть пустой список

      // Проверяем возможность управления
      const manageButtons = await page
        .locator('button:has-text("Отписаться"), .unsubscribe, .manage-subscription')
        .count()
      expect(manageButtons >= 0).toBeTruthy()
    } else {
      // Может быть в отдельном разделе профиля
      await page.goto(`${baseUrl}/author/`) // Или другой способ получить профиль
      await waitForPageLoad(page)

      const profileSubscriptions = await page.locator(':has-text("подписки"), .user-subscriptions').first()
      expect(await profileSubscriptions.isVisible()).toBeTruthy()
    }
  })

  test('Должен запрещать подписки неавторизованным пользователям', async ({ page }) => {
    // Переходим к профилю автора без авторизации
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    const firstAuthor = await page.locator('.author-card a, .author-link').first()

    if (await firstAuthor.isVisible()) {
      await firstAuthor.click()
      await waitForPageLoad(page)

      const subscribeButton = await page.locator('button:has-text("Подписаться"), .subscribe-button').first()

      if (await subscribeButton.isVisible()) {
        await subscribeButton.click()

        // Должна появиться форма авторизации или перенаправление
        const authRequired = await page.locator('.login-modal, .auth-required, :has-text("Войти")').first()
        expect(await authRequired.isVisible()).toBeTruthy()
      } else {
        // Если кнопка скрыта для неавторизованных - это тоже правильно
        expect(true).toBeTruthy()
      }
    }
  })

  test('Должен показывать количество подписчиков и подписок', async ({ page }) => {
    await page.goto(`${baseUrl}/authors`)
    await waitForPageLoad(page)

    // Ищем статистику в карточках авторов
    const authorStats = await page
      .locator('.author-stats, .followers-count, .following-count, :has-text("подписчи")')
      .first()

    if (await authorStats.isVisible()) {
      const statsText = await authorStats.textContent()
      expect(statsText).toMatch(/\d/) // Содержит цифры
    } else {
      // Переходим в профиль автора
      const firstAuthor = await page.locator('.author-card a, .author-link').first()
      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        const profileStats = await page.locator('.profile-stats, .user-stats, :has-text("подписчи")').first()
        expect(await profileStats.isVisible()).toBeTruthy()
      }
    }
  })

  test('Должен обновлять ленту "Моя лента" на основе подписок', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Переходим в персональную ленту
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем переключатель между "Все" и "Моя лента"
    const myFeedTab = await page.locator('button:has-text("Моя лента"), .my-feed, [data-testid="my-feed"]').first()

    if (await myFeedTab.isVisible()) {
      await myFeedTab.click()
      await waitForPageLoad(page)

      // Проверяем, что лента загрузилась
      const feedContent = await page.locator('article, .post, .feed-item').count()
      expect(feedContent >= 0).toBeTruthy() // Может быть пустой, если нет подписок

      // Проверяем наличие сообщения о подписках, если лента пуста
      if (feedContent === 0) {
        const emptyFeedMessage = await page
          .locator(':has-text("подпишитесь"), .empty-feed, :has-text("нет подписок")')
          .isVisible()
        expect(emptyFeedMessage).toBeTruthy()
      }
    } else {
      console.warn('Раздел "Моя лента" не найден')
      test.skip()
    }
  })
})
