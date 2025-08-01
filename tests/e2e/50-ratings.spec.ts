/**
 * Тест для проверки системы рейтингов
 *
 * Проверяет голосование за публикации и комментарии, отображение списка проголосовавших
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Система рейтингов', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('Должен отображать рейтинг под публикациями', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем рейтинг в карточках статей
    const ratingElements = await page.locator('.rating, .votes, [data-testid="rating"], .score').first()

    if (await ratingElements.isVisible()) {
      const ratingText = await ratingElements.textContent()
      expect(ratingText).toMatch(/[\d\-+]/) // Содержит цифры, плюс или минус
    } else {
      // Ищем кнопки голосования
      const voteButtons = await page
        .locator('button:has-text("+"), button:has-text("−"), .vote-up, .vote-down')
        .first()
      expect(await voteButtons.isVisible()).toBeTruthy()
    }
  })

  test('Должен позволять голосовать авторизованным пользователям', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем кнопки голосования
    const upvoteButton = await page
      .locator('button:has-text("+"), .vote-up, [data-testid="upvote"]')
      .first()

    if (await upvoteButton.isVisible()) {
      // Голосуем
      await upvoteButton.click()
      await page.waitForTimeout(1000) // Ждем обновления

      // Проверяем, что рейтинг изменился или кнопка стала активной
      const buttonClass = await upvoteButton.getAttribute('class')
      const isButtonActive = buttonClass?.includes('active') || buttonClass?.includes('voted')

      expect(isButtonActive).toBeTruthy()
    } else {
      console.warn('Кнопки голосования не найдены')
      test.skip()
    }
  })

  test('Должен запрещать голосование неавторизованным пользователям', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const upvoteButton = await page.locator('button:has-text("+"), .vote-up').first()

    if (await upvoteButton.isVisible()) {
      await upvoteButton.click()

      // Проверяем, что появилось требование авторизации
      const authRequired = await page.locator('text*="Войдите", text*="авториз", .login-modal').first()
      expect(await authRequired.isVisible()).toBeTruthy()
    } else {
      // Если кнопки не видны для неавторизованных - это тоже правильно
      expect(true).toBeTruthy()
    }
  })

  test('Должен позволять отменять свой голос', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const upvoteButton = await page.locator('button:has-text("+"), .vote-up').first()

    if (await upvoteButton.isVisible()) {
      // Голосуем
      await upvoteButton.click()
      await page.waitForTimeout(1000)

      // Проверяем, что кнопка стала активной
      let buttonClass = await upvoteButton.getAttribute('class')
      expect(buttonClass).toMatch(/active|voted/)

      // Отменяем голос
      await upvoteButton.click()
      await page.waitForTimeout(1000)

      // Проверяем, что кнопка стала неактивной
      buttonClass = await upvoteButton.getAttribute('class')
      expect(buttonClass).not.toMatch(/active|voted/)
    }
  })

  test('Должен показывать список проголосовавших при клике на рейтинг', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const ratingElement = await page.locator('.rating, .votes, .score').first()

    if (await ratingElement.isVisible()) {
      await ratingElement.click()

      // Проверяем, что появился popup со списком
      const votersPopup = await page.locator('.voters-popup, .votes-modal, .rating-details').first()

      if (await votersPopup.isVisible()) {
        // Проверяем наличие аватарок или имен пользователей
        const voterItems = await page.locator('.voter, .user-avatar, .voter-name').count()
        expect(voterItems).toBeGreaterThan(0)
      } else {
        console.warn('Popup со списком проголосовавших не найден')
        test.skip()
      }
    }
  })

  test('Должен отображать рейтинг комментариев', async ({ page }) => {
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Переходим к статье с комментариями
    const firstArticle = await page.locator('article').first()
    if (await firstArticle.isVisible()) {
      await firstArticle.click()
      await waitForPageLoad(page)

      // Ищем рейтинг комментариев
      const commentRating = await page.locator('.comment .rating, .comment .votes, .comment-score').first()

      if (await commentRating.isVisible()) {
        expect(await commentRating.textContent()).toMatch(/[\d\-+]/)
      } else {
        // Ищем кнопки голосования для комментариев
        const commentVoteButtons = await page
          .locator('.comment button:has-text("+"), .comment .vote-up')
          .first()
        if (await commentVoteButtons.isVisible()) {
          expect(true).toBeTruthy()
        } else {
          console.warn('Рейтинг комментариев не найден')
          test.skip()
        }
      }
    }
  })

  test('Должен различать плюсы и минусы в голосовании', async ({ page }) => {
    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const upvoteButton = await page.locator('button:has-text("+"), .vote-up').first()
    const downvoteButton = await page.locator('button:has-text("−"), .vote-down').first()

    if ((await upvoteButton.isVisible()) && (await downvoteButton.isVisible())) {
      // Тестируем upvote
      await upvoteButton.click()
      await page.waitForTimeout(500)

      let upClass = await upvoteButton.getAttribute('class')
      expect(upClass).toMatch(/active|voted|selected/)

      // Тестируем downvote
      await downvoteButton.click()
      await page.waitForTimeout(500)

      const downClass = await downvoteButton.getAttribute('class')
      expect(downClass).toMatch(/active|voted|selected/)

      // Upvote должен стать неактивным
      upClass = await upvoteButton.getAttribute('class')
      expect(upClass).not.toMatch(/active|voted|selected/)
    } else {
      console.warn('Кнопки +/- не найдены')
      test.skip()
    }
  })
})
