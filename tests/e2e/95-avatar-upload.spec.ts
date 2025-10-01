/**
 * E2E тест для загрузки аватара пользователя
 *
 * Проверяет полный workflow загрузки аватара:
 * 1. Авторизация
 * 2. Переход в настройки профиля
 * 3. Загрузка изображения
 * 4. Кроп изображения
 * 5. Сохранение аватара
 * 6. Проверка отображения в header
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { performLogin as setupAuthState } from '../utils/auth-helpers'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

// Тесты для загрузки аватара
test.describe('Загрузка аватара пользователя', () => {
  // Перед каждым тестом устанавливаем состояние авторизации
  test.beforeEach(async ({ page }) => {
    // Устанавливаем авторизацию
    await setupAuthState(page)

    // Переходим на страницу настроек
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)
  })

  test('Должна успешно загружать и отображать аватар', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для загрузки аватара')
      return
    }

    // Ждем загрузки страницы настроек
    await expect(page).toHaveTitle('Настройки', { timeout: 15000 })

    // Ищем секцию с аватаром
    const userpicSection = page.locator('h4:has-text("Userpic"), h4:has-text("Аватар"), h4:has-text("Фото")').first()
    await expect(userpicSection).toBeVisible({ timeout: 10000 })

    // Ищем кнопку загрузки аватара
    const uploadButton = page.locator('button[title*="Upload"], button[title*="Загрузить"], .control:has(svg)').first()
    await expect(uploadButton).toBeVisible({ timeout: 5000 })

    // Создаем простое тестовое изображение если его нет
    await page.evaluate(() => {
      // Создаем canvas с тестовым изображением
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Рисуем простой градиент
        const gradient = ctx.createLinearGradient(0, 0, 200, 200)
        gradient.addColorStop(0, '#ff6b6b')
        gradient.addColorStop(1, '#4ecdc4')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 200, 200)

        // Добавляем текст
        ctx.fillStyle = 'white'
        ctx.font = '20px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('TEST', 100, 100)
      }

      // Конвертируем в blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Создаем File объект
          const file = new File([blob], 'test-avatar.jpg', { type: 'image/jpeg' })

          // Сохраняем в window для использования в тесте
          // biome-ignore lint/suspicious/noExplicitAny: test
          ;(window as any).testImageFile = file
        }
      }, 'image/jpeg')
    })

    // Настраиваем перехват файлового диалога
    await page.route('**/files.dscrs.site/**', async (route) => {
      // Мокаем успешный ответ от quoter
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'test-avatar-12345.jpg'
      })
    })

    // Настраиваем перехват GraphQL мутации обновления профиля
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('updateProfile')) {
        // Мокаем успешный ответ обновления профиля
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              updateProfile: {
                success: true,
                author: {
                  id: '123',
                  name: 'Test User',
                  pic: 'https://files.dscrs.site/test-avatar-12345.jpg'
                }
              }
            }
          })
        })
      } else {
        // Пропускаем другие GraphQL запросы
        await route.continue()
      }
    })

    // Кликаем на кнопку загрузки аватара
    await uploadButton.click()

    // Ждем появления модального окна кропа
    const cropModal = page
      .locator('[role="dialog"]:has-text("Crop"), .modal:has-text("Crop"), h2:has-text("Crop")')
      .first()
    await expect(cropModal).toBeVisible({ timeout: 10000 })

    // Ищем кнопку сохранения в модальном окне
    const saveButton = page
      .locator('button:has-text("Save"), button:has-text("Сохранить"), button[type="submit"]')
      .first()
    await expect(saveButton).toBeVisible({ timeout: 5000 })

    // Кликаем на кнопку сохранения
    await saveButton.click()

    // Ждем закрытия модального окна
    await expect(cropModal).not.toBeVisible({ timeout: 15000 })

    // Проверяем, что появилось уведомление об успешной загрузке
    const successToast = page.locator('.toast, [role="alert"], .notification').first()
    await expect(successToast).toBeVisible({ timeout: 10000 })

    // Проверяем, что аватар обновился в секции настроек
    const updatedAvatar = page.locator('.userpicImage, [style*="background-image"]').first()
    await expect(updatedAvatar).toBeVisible({ timeout: 5000 })

    // Переходим на главную страницу для проверки аватара в header
    await page.goto(`${baseUrl}/`)
    await waitForPageLoad(page)

    // Проверяем, что аватар отображается в header
    const headerAvatar = page.locator('header .userpic, header [data-testid="user-avatar"], .userpic').first()
    await expect(headerAvatar).toBeVisible({ timeout: 10000 })
  })

  test('Должна показывать ошибку при неудачной загрузке', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для тестирования ошибок загрузки')
      return
    }

    // Настраиваем перехват файлового диалога с ошибкой
    await page.route('**/files.dscrs.site/**', async (route) => {
      // Мокаем ошибку 401 Unauthorized
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      })
    })

    // Ищем кнопку загрузки аватара
    const uploadButton = page.locator('button[title*="Upload"], button[title*="Загрузить"], .control:has(svg)').first()
    await expect(uploadButton).toBeVisible({ timeout: 5000 })

    // Кликаем на кнопку загрузки
    await uploadButton.click()

    // Ждем появления модального окна
    const cropModal = page.locator('[role="dialog"]:has-text("Crop"), .modal:has-text("Crop")').first()
    await expect(cropModal).toBeVisible({ timeout: 10000 })

    // Кликаем на кнопку сохранения
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Сохранить")').first()
    await saveButton.click()

    // Проверяем, что появилось уведомление об ошибке
    const errorToast = page.locator('.toast, [role="alert"], .notification').first()
    await expect(errorToast).toBeVisible({ timeout: 10000 })

    // Проверяем, что в уведомлении есть текст об ошибке
    await expect(errorToast).toContainText(/error|ошибка|failed|не удалось/i)
  })

  test('Должна корректно обрабатывать отмену загрузки', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для тестирования отмены загрузки')
      return
    }

    // Ищем кнопку загрузки аватара
    const uploadButton = page.locator('button[title*="Upload"], button[title*="Загрузить"], .control:has(svg)').first()
    await expect(uploadButton).toBeVisible({ timeout: 5000 })

    // Кликаем на кнопку загрузки
    await uploadButton.click()

    // Ждем появления модального окна
    const cropModal = page.locator('[role="dialog"]:has-text("Crop"), .modal:has-text("Crop")').first()
    await expect(cropModal).toBeVisible({ timeout: 10000 })

    // Ищем кнопку отмены
    const cancelButton = page
      .locator('button:has-text("Cancel"), button:has-text("Отмена"), button:has-text("Decline")')
      .first()
    await expect(cancelButton).toBeVisible({ timeout: 5000 })

    // Кликаем на кнопку отмены
    await cancelButton.click()

    // Проверяем, что модальное окно закрылось
    await expect(cropModal).not.toBeVisible({ timeout: 5000 })

    // Проверяем, что мы остались на странице настроек
    await expect(page).toHaveURL(/.*settings/)
  })
})
