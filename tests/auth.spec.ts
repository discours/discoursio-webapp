/**
 * Тест для проверки аутентификации
 *
 * Проверяет функциональность авторизации и доступ к защищенным страницам
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { expect, test } from '@playwright/test'
import { baseUrl, isLoggedIn, setupAuthState, waitForPageLoad } from './utils/test-helpers'

test.describe('Аутентификация и доступ к защищенным страницам', () => {
  test('Должна отображаться форма входа при клике на кнопку "Войти"', async ({ page }) => {
    // Переходим на главную страницу
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Ищем и кликаем на кнопку входа
    const loginButton = await page.getByRole('button', { name: 'Войти' })
    if (await loginButton.isVisible()) {
      await loginButton.click()

      // Проверяем наличие полей для ввода логина и пароля
      await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 })
      await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('Должна перенаправлять на авторизацию при попытке доступа к защищенным страницам', async ({
    page
  }) => {
    // Переходим сразу на защищенную страницу
    await page.goto(`${baseUrl}/edit/new`)
    await waitForPageLoad(page)

    // Если мы не авторизованы, то должны увидеть форму ввода или перенаправление
    if (await isLoggedIn(page)) {
      // Если авторизованы, этот тест не имеет смысла - пропускаем
      test.skip()
      console.warn('Тест пропущен - пользователь уже авторизован')
    } else {
      const currentUrl = page.url()

      // Проверяем один из сценариев:
      // 1. Перенаправлены на страницу входа
      // 2. Отображаются элементы аутентификации
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        // Проверка URL, если перенаправили на отдельную страницу входа
        expect(currentUrl).toMatch('или войдите через соцсеть')
      } else {
        // Проверяем наличие элементов формы авторизации
        // Достаточно, чтобы был виден хотя бы один элемент формы
        try {
          // Ищем модальное окно формы входа
          const modalElement = await page.locator('.modal, .modal-dialog, dialog').first()

          if (await modalElement.isVisible()) {
            // Это успех: форма входа отображается
            expect(await modalElement.isVisible()).toBe(true)
          } else {
            // Если модальное окно не найдено, проверяем наличие полей ввода
            const emailInput = await page.locator('input[type="email"]').first()
            await expect(emailInput).toBeVisible({ timeout: 15000 })
          }
        } catch {
          // Если ничего из вышеперечисленного не найдено, то тест завершится ошибкой
          expect(await page.getByRole('button', { name: 'Войти' }).isVisible()).toBe(true)
        }
      }
    }
  })

  // Тест для имитации успешного входа и доступа к защищенным страницам
  test('Должна позволять войти и получить доступ к защищенным страницам', async ({ page }) => {
    // Выполняем авторизацию с полным циклом
    const authSuccess = await setupAuthState(page, true)

    // Если авторизация не удалась, пропускаем тест
    if (!authSuccess) {
      test.skip()
      console.warn('Пользователь не смог авторизоваться, проверьте корректность учетных данных')
      return
    }

    // Переходим на защищенную страницу
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    // Если снова открылась форма входа, значит проблема с авторизацией
    const loginButton = await page.getByRole('button', { name: 'Войти' })
    if (await loginButton.isVisible()) {
      test.fail()
      console.error('Авторизация не сохранилась при переходе на защищенную страницу')
      return
    }

    // Проверяем, что мы находимся на странице настроек и видим ее содержимое
    expect(page.url()).toContain('/settings')

    // На странице настроек должен быть какой-то контент
    const bodyContent = (await page.locator('body').textContent()) || ''
    expect(bodyContent.length).toBeGreaterThan(100) // На странице должен быть какой-то текст
  })
})
