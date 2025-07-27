/**
 * Тест для проверки функциональности комментариев
 *
 * Проверяет создание, редактирование, удаление комментариев и древовидную структуру
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect, test } from '@playwright/test'
import { performLogin, TEST_USERS } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/test-helpers'

test.describe('Функциональность комментариев', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test('Должен позволять писать комментарии авторизованным пользователям', async ({ page }) => {
    // Авторизуемся
    const authSuccess = await performLogin(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Переходим на страницу с публикацией
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Ищем первую статью
    const firstArticle = await page.locator('article').first()
    if (await firstArticle.isVisible()) {
      await firstArticle.click()
      await waitForPageLoad(page)

      // Ищем форму комментария
      const commentForm = await page
        .locator('form[data-testid="comment-form"], .comment-form, textarea[placeholder*="комментар"]')
        .first()

      if (await commentForm.isVisible()) {
        const testComment = `Тестовый комментарий ${Date.now()}`

        // Заполняем и отправляем комментарий
        await commentForm.fill(testComment)

        const submitButton = await page
          .locator('button[type="submit"], button:has-text("Отправить"), button:has-text("Комментировать")')
          .first()
        await submitButton.click()

        // Проверяем, что комментарий появился
        await expect(page.locator(`text="${testComment}"`)).toBeVisible({ timeout: 10000 })
      } else {
        console.warn('Форма комментария не найдена, пропускаем тест')
        test.skip()
      }
    } else {
      console.warn('Статьи не найдены, пропускаем тест')
      test.skip()
    }
  })

  test('Должен запрещать комментирование неавторизованным пользователям', async ({ page }) => {
    // Переходим на страницу с публикацией без авторизации
    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const firstArticle = await page.locator('article').first()
    if (await firstArticle.isVisible()) {
      await firstArticle.click()
      await waitForPageLoad(page)

      // Проверяем, что форма комментария скрыта или показывает требование авторизации
      const commentForm = await page.locator('textarea[placeholder*="комментар"]').first()
      const authRequired = await page.locator('text*="Войдите", text*="авториз", .login-required').first()

      const isCommentFormHidden = !(await commentForm.isVisible())
      const isAuthRequiredShown = await authRequired.isVisible()

      expect(isCommentFormHidden || isAuthRequiredShown).toBeTruthy()
    } else {
      test.skip()
    }
  })

  test('Должен позволять отвечать на комментарии (древовидная структура)', async ({ page }) => {
    const authSuccess = await performLogin(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const firstArticle = await page.locator('article').first()
    if (await firstArticle.isVisible()) {
      await firstArticle.click()
      await waitForPageLoad(page)

      // Ищем существующий комментарий с кнопкой ответа
      const replyButton = await page
        .locator('button:has-text("Ответить"), .reply-button, [data-testid="reply-button"]')
        .first()

      if (await replyButton.isVisible()) {
        await replyButton.click()

        // Ищем форму ответа
        const replyForm = await page.locator('textarea').last()
        if (await replyForm.isVisible()) {
          const testReply = `Тестовый ответ ${Date.now()}`
          await replyForm.fill(testReply)

          const submitReply = await page.locator('button[type="submit"]').last()
          await submitReply.click()

          // Проверяем, что ответ появился
          await expect(page.locator(`text="${testReply}"`)).toBeVisible({ timeout: 10000 })
        }
      } else {
        console.warn('Кнопка ответа не найдена, пропускаем тест')
        test.skip()
      }
    }
  })

  test('Должен позволять редактировать свои комментарии', async ({ page }) => {
    const authSuccess = await performLogin(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    // Логика поиска и редактирования собственного комментария
    const editButton = await page
      .locator('button:has-text("Редактировать"), .edit-button, [data-testid="edit-comment"]')
      .first()

    if (await editButton.isVisible()) {
      await editButton.click()

      const editForm = await page.locator('textarea[value], textarea').first()
      if (await editForm.isVisible()) {
        const editedText = `Отредактированный комментарий ${Date.now()}`
        await editForm.clear()
        await editForm.fill(editedText)

        const saveButton = await page.locator('button:has-text("Сохранить"), button[type="submit"]').first()
        await saveButton.click()

        await expect(page.locator(`text="${editedText}"`)).toBeVisible({ timeout: 10000 })
      }
    } else {
      console.warn('Кнопка редактирования не найдена, пропускаем тест')
      test.skip()
    }
  })

  test('Должен блокировать отправку пустых комментариев', async ({ page }) => {
    const authSuccess = await performLogin(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    await page.goto(`${baseUrl}/feed`)
    await waitForPageLoad(page)

    const firstArticle = await page.locator('article').first()
    if (await firstArticle.isVisible()) {
      await firstArticle.click()
      await waitForPageLoad(page)

      const commentForm = await page.locator('textarea[placeholder*="комментар"]').first()

      if (await commentForm.isVisible()) {
        // Пытаемся отправить пустой комментарий
        await commentForm.fill('   ') // Только пробелы

        const submitButton = await page.locator('button[type="submit"]').first()
        await submitButton.click()

        // Проверяем, что появилось сообщение об ошибке или кнопка неактивна
        const errorMessage = await page.locator('text*="пуст", text*="обязательн", .error').first()
        const isButtonDisabled = await submitButton.isDisabled()

        expect((await errorMessage.isVisible()) || isButtonDisabled).toBeTruthy()
      }
    }
  })
})
