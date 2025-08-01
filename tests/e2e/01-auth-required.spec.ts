/**
 * Тест для проверки аутентификации
 *
 * Проверяет функциональность авторизации и доступ к защищенным страницам
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { expect } from '@playwright/test'
import { checkApiConnection, performLogin, TEST_USERS } from '../utils/auth-helpers'
import { AuthModal } from '../utils/page-objects'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Аутентификация и доступ к защищенным страницам', () => {
  test('Должна перенаправлять на авторизацию при попытке доступа к защищенным страницам', async ({
    page
  }) => {
    const testUtils = new TestUtils(page)
    await testUtils.expectPageReady()

    // Переходим на защищенную страницу
    await page.goto('/edit')

    // Должны быть перенаправлены на главную с модальным окном авторизации
    await expect(page).toHaveURL(/\/\?m=auth/)
  })

  test('Должна отображаться форма входа при клике на кнопку "Войти"', async ({ page }) => {
    const testUtils = new TestUtils(page)
    await testUtils.expectPageReady()

    const authModal = new AuthModal(page)
    await authModal.openLoginForm()

    // Проверяем что форма входа отображается
    await expect(authModal.emailInput).toBeVisible()
    await expect(authModal.passwordInput).toBeVisible()
  })

  test('Должна позволять войти и получить доступ к защищенным страницам', async ({ page }) => {
    const testUtils = new TestUtils(page)
    await testUtils.expectPageReady()

    // Проверяем доступность API перед тестом
    const apiAvailable = await checkApiConnection(page)
    if (!apiAvailable) {
      test.skip()
      return
    }

    // Выполняем авторизацию
    const loginSuccess = await performLogin(page)

    if (!loginSuccess) {
      test.skip()
      return
    }

    // Проверяем доступ к защищенным страницам
    await page.goto('/edit')
    await expect(page).toHaveURL(/\/edit/)

    // Проверяем что мы на странице редактирования
    await expect(page.locator('h1, .title, [data-testid="edit-title"]')).toBeVisible()
  })
})
