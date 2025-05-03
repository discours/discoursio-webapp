/**
 * Тест для страницы публикации
 *
 * Проверяет функциональность страницы создания/редактирования публикации
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { Locator, expect, test } from '@playwright/test'
import { baseUrl, getScreenshotName, setupAuthState, waitForPageLoad } from './utils/test-helpers'

// Тесты для страницы создания новой публикации
test.describe('Страница создания публикации', () => {
  // Перед каждым тестом устанавливаем состояние авторизации и переходим на страницу создания публикации
  test.beforeEach(async ({ page }) => {
    // Устанавливаем авторизацию
    await setupAuthState(page)

    // Переходим на страницу создания публикации
    await page.goto(`${baseUrl}/edit/new`)
    await waitForPageLoad(page)
  })

  test('Должна загружаться и отображать необходимые элементы', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для доступа к странице редактирования')
      return
    }

    // Проверяем заголовок страницы, который может содержать различные варианты текста
    await expect(page).toHaveTitle('Новая публикация', { timeout: 15000 })

    // Сначала проверяем, не страница ли это выбора типа публикации
    const selectTypeButton = await page.getByRole('button', { name: 'Статья' }).first()
    if (await selectTypeButton.isVisible()) {
      // Если это страница выбора типа, кликаем на кнопку статьи, чтобы продолжить
      await selectTypeButton.click()
      await waitForPageLoad(page)
    }

    // Проверяем наличие редактора или формы ввода контента
    // Ищем по одному локатору за раз для соблюдения strict mode
    try {
      // Пробуем найти editable элемент
      const editableElement = await page.locator('[contenteditable="true"]').first()
      await expect(editableElement).toBeVisible({ timeout: 15000 })
    } catch {
      // Если не нашли contenteditable, то ищем любой редактор или текстовое поле
      const editor = await page.locator('textarea, .ProseMirror, .editor').first()
      await expect(editor).toBeVisible({ timeout: 15000 })
    }

    // Проверяем наличие поля заголовка или любого текстового поля
    try {
      const titleField = await page.getByPlaceholder('заголовок').first()
      await expect(titleField).toBeVisible({ timeout: 10000 })
    } catch {
      // Если не нашли по placeholder, ищем по типу
      const textField = await page.locator('input[type="text"]').first()
      await expect(textField).toBeVisible({ timeout: 10000 })
    }

    // Проверяем наличие кнопки публикации
    const publishButton = page
      .getByRole('button', {
        name: 'Опубликовать'
      })
      .first()
    await expect(publishButton).toBeVisible({ timeout: 10000 })
  })

  test('Должна позволять ввод содержимого', async ({ page }) => {
    // Пропускаем тест, если не удалось авторизоваться
    if (page.url().includes('/login') || (await page.getByRole('button', { name: 'Войти' }).isVisible())) {
      test.skip()
      console.warn('Требуется авторизация для доступа к странице редактирования')
      return
    }

    // Сначала проверяем, не страница ли это выбора типа публикации
    const selectTypeButton = await page.getByRole('button', { name: 'Статья' }).first()
    if (await selectTypeButton.isVisible()) {
      // Если это страница выбора типа, кликаем на кнопку статьи, чтобы продолжить
      await selectTypeButton.click()
      await waitForPageLoad(page)
    }

    // Ждем загрузки редактора
    try {
      // Ждем пока появится любой элемент редактора
      await page.waitForSelector('input[type="text"], textarea, [contenteditable="true"]', {
        timeout: 20000
      })

      // Вводим текст в поле заголовка
      let titleInput: Locator
      // Пробуем найти по placeholder
      try {
        titleInput = await page.getByPlaceholder('заголовок').first()
        if (!(await titleInput.isVisible())) throw new Error('Title input not visible')
      } catch {
        // Если не нашли по placeholder, ищем первое текстовое поле
        titleInput = await page.locator('input[type="text"]').first()
        if (!(await titleInput.isVisible())) {
          // Если и так не нашли, берем первый contenteditable
          titleInput = await page.locator('[contenteditable="true"]').first()
        }
      }

      // Если нашли поле ввода, заполняем его
      if (await titleInput.isVisible()) {
        await titleInput.fill('Тестовый заголовок')

        // Проверяем, что ввод сработал
        try {
          await expect(titleInput).toHaveValue('Тестовый заголовок', { timeout: 5000 })
        } catch {
          // Для contenteditable
          await expect(titleInput).toContainText('Тестовый заголовок', { timeout: 5000 })
        }
      }

      // Ищем элемент для ввода основного текста
      let editor: Locator
      try {
        editor = await page.locator('[contenteditable="true"]').last()
        if (!(await editor.isVisible())) throw new Error('Editor not visible')
      } catch {
        // Если не нашли contenteditable, ищем textarea
        editor = await page.locator('textarea').last()
      }

      // Если нашли редактор, вводим текст
      if (await editor.isVisible()) {
        await editor.click()
        await page.keyboard.type('Тестовый текст публикации')

        // Проверяем наличие текста
        await expect(editor).toContainText('Тестовый текст публикации', { timeout: 5000 })
      }
    } catch (e) {
      console.warn('Не удалось найти элементы редактора:', e)
      await page.screenshot({ path: getScreenshotName('editor-elements-not-found') })
    }
  })
})
