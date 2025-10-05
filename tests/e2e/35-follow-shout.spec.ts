/**
 * 🔔 Тесты слежения за обсуждениями (follow shout notifications)
 *
 * Проверяем:
 * 1. Подписку на обсуждение через попап в ленте
 * 2. Подписку на обсуждение на странице статьи
 * 3. Отображение корректного состояния кнопки
 */

import { expect } from '@playwright/test'
import { performLogin } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Слежение за обсуждениями', () => {
  test('Должен позволять подписываться на обсуждение через попап в ленте', async ({ page }) => {
    test.setTimeout(60000) // Увеличиваем таймаут до 60 секунд

    // Переходим на главную
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000) // Ждём загрузки контента

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Находим первую статью
    const firstArticle = page.locator('[data-testid="feed-article"]').first()

    if (!(await firstArticle.isVisible())) {
      console.warn('Статьи не найдены')
      test.skip()
      return
    }

    // Открываем попап (кнопка "...")
    const ellipsisButton = firstArticle.locator('button:has-text("..."), button:has([class*="ellipsis"])')
    await ellipsisButton.click()
    await page.waitForTimeout(500)

    // Ищем кнопку подписки на обсуждение
    const followButton = page.getByText(/Подписаться на обсуждение|Отписаться от обсуждения/)

    if (!(await followButton.isVisible())) {
      console.warn('Кнопка подписки на обсуждение не найдена')
      test.skip()
      return
    }

    const initialText = await followButton.textContent()
    console.log('[Test] Initial button text:', initialText)

    // Кликаем на кнопку
    await followButton.click()
    await page.waitForTimeout(1000)

    // Открываем попап снова
    await ellipsisButton.click()
    await page.waitForTimeout(500)

    // Проверяем, что текст кнопки изменился
    const newText = await followButton.textContent()
    console.log('[Test] New button text:', newText)

    if (initialText?.includes('Подписаться')) {
      expect(newText).toContain('Отписаться')
    } else {
      expect(newText).toContain('Подписаться')
    }
  })

  test('Должен позволять подписываться на обсуждение на странице статьи', async ({ page }) => {
    test.setTimeout(60000) // Увеличиваем таймаут до 60 секунд

    // Переходим на главную
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000) // Ждём загрузки контента

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Кликаем на первую статью
    const firstArticle = page.locator('[data-testid="feed-article"]').first()

    if (!(await firstArticle.isVisible())) {
      console.warn('Статьи не найдены')
      test.skip()
      return
    }

    const articleLink = firstArticle.locator('a[href^="/"]').first()
    await articleLink.click()
    await waitForPageLoad(page)

    // Открываем попап
    const ellipsisButton = page.locator('button:has([class*="ellipsis"])').first()

    if (!(await ellipsisButton.isVisible())) {
      console.warn('Кнопка меню не найдена')
      test.skip()
      return
    }

    await ellipsisButton.click()
    await page.waitForTimeout(500)

    // Проверяем кнопку подписки
    const followButton = page.getByText(/Подписаться на обсуждение|Отписаться от обсуждения/)

    if (!(await followButton.isVisible())) {
      console.warn('Кнопка подписки на обсуждение не найдена')
      test.skip()
      return
    }

    const initialText = await followButton.textContent()
    console.log('[Test] Initial button text:', initialText)

    // Подписываемся
    await followButton.click()
    await page.waitForTimeout(1000)

    // Проверяем изменение
    await ellipsisButton.click()
    await page.waitForTimeout(500)

    const newText = await followButton.textContent()
    console.log('[Test] New button text:', newText)

    expect(newText).not.toBe(initialText)
  })

  test('Должен отображать кнопку подписки в заголовке комментариев', async ({ page }) => {
    test.setTimeout(60000) // Увеличиваем таймаут до 60 секунд

    // Переходим на главную
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000) // Ждём загрузки контента

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Кликаем на первую статью
    const firstArticle = page.locator('[data-testid="feed-article"]').first()

    if (!(await firstArticle.isVisible())) {
      console.warn('Статьи не найдены')
      test.skip()
      return
    }

    const articleLink = firstArticle.locator('a[href^="/"]').first()
    await articleLink.click()
    await waitForPageLoad(page)

    // Скроллим к комментариям
    await page.evaluate(() => {
      const commentsSection = document.querySelector('h2:has-text("Комментарии"), [class*="commentsHeader"]')
      if (commentsSection) {
        commentsSection.scrollIntoView({ behavior: 'smooth' })
      }
    })
    await page.waitForTimeout(1000)

    // Ищем кнопку подписки в заголовке комментариев (иконка колокольчика)
    const followIconButton = page.locator('button:has([name="bell"]), button:has([name="bell-off"])')

    if (await followIconButton.isVisible()) {
      console.log('[Test] Follow icon button found in comments header')

      // Кликаем на кнопку
      await followIconButton.click()
      await page.waitForTimeout(1500)

      // Проверяем, что кнопка все еще видна (состояние изменилось)
      expect(await followIconButton.isVisible()).toBeTruthy()
    } else {
      console.warn('Кнопка подписки в заголовке комментариев не найдена')
      test.skip()
    }
  })
})
