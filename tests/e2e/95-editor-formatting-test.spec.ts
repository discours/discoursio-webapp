/**
 * Тест форматирования в редакторе - используем рабочие паттерны
 */

import { expect, test } from '@playwright/test'
import { TestUtils } from '../utils/test-helpers'

const username = process.env.TEST_USERNAME || 'test@example.com'
const password = process.env.TEST_PASSWORD || 'testPassword123!'

test.describe('Editor Formatting Test', () => {
  test.beforeEach(async ({ page }) => {
    const testUtils = new TestUtils(page)

    await testUtils.goto('/')
    await testUtils.expectPageReady()

    // Открываем форму входа (используем рабочий паттерн)
    await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()

    // Ждем появления формы входа
    await page.waitForSelector('input[name="email"], input[placeholder*="Email"], input[placeholder*="Почта"]', {
      timeout: 10000
    })

    // Заполняем форму входа (используем рабочий паттерн)
    await page.getByPlaceholder('Почта').or(page.getByPlaceholder('Email')).first().click()
    await page.getByPlaceholder('Почта').or(page.getByPlaceholder('Email')).first().fill(username)
    await page.getByPlaceholder('Пароль').or(page.getByPlaceholder('Password')).first().click()
    await page.getByPlaceholder('Пароль').or(page.getByPlaceholder('Password')).first().fill(password)

    // Отправляем форму входа
    const loginButton = page
      .getByRole('button', { name: 'Войти' })
      .or(page.getByRole('button', { name: 'Enter' }))
      .or(page.locator('button[type="submit"]'))
      .first()
    await loginButton.click()

    // Ждем завершения входа
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.log('Тайм-аут при ожидании после входа, продолжаем...')
    })

    // Ждем появления индикатора авторизованного пользователя
    await page
      .waitForSelector('button:has-text("Т.Р."), [data-testid="user-menu"], .user-avatar, .user-button', {
        timeout: 15000
      })
      .catch(() => {
        console.log('Не найден индикатор авторизованного пользователя, продолжаем...')
      })
  })

  test('тест жирного форматирования в редакторе', async ({ page }) => {
    console.log('[EditorTest] 🎯 Начинаем тест форматирования...')

    // Переходим на страницу создания статьи
    await page.goto('/edit')
    await page.waitForLoadState('networkidle')

    console.log('[EditorTest] 📝 Страница редактора загружена')

    // Ждем появления редактора (используем селекторы из кодабазы)
    const editorSelector = '[data-field-type="body"] [contenteditable="true"], [contenteditable="true"]'
    await page.waitForSelector(editorSelector, { timeout: 15000 })

    const editor = page.locator(editorSelector).first()
    await expect(editor).toBeVisible()

    console.log('[EditorTest] ✅ Редактор найден и видим')

    // Кликаем в редактор и вводим текст
    await editor.click()
    await editor.fill('Тестовый текст для проверки форматирования')

    console.log('[EditorTest] ✏️ Текст введен')

    // Выделяем первое слово "Тестовый"
    await editor.click()
    await page.keyboard.press('Home') // В начало
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right') // Выделяем первое слово
    await page.keyboard.up('Shift')

    console.log('[EditorTest] 🎯 Слово "Тестовый" выделено')

    // Применяем жирное форматирование
    await page.keyboard.press('Control+b')

    console.log('[EditorTest] 💪 Применено жирное форматирование (Ctrl+B)')

    // Ждем применения форматирования
    await page.waitForTimeout(2000)

    // Проверяем что появился тег <strong> или <b>
    const boldText = page.locator('strong, b').first()
    await expect(boldText).toBeVisible({ timeout: 5000 })
    await expect(boldText).toContainText('Тестовый')

    console.log('[EditorTest] ✅ Жирное форматирование применено успешно!')

    // Снимаем выделение и проверяем что форматирование сохранилось
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')

    // Проверяем что тег все еще есть
    await expect(boldText).toBeVisible()
    await expect(boldText).toContainText('Тестовый')

    console.log('[EditorTest] 🎉 Тест форматирования прошел успешно!')
  })

  test('тест курсивного форматирования', async ({ page }) => {
    console.log('[EditorTest] 🎯 Начинаем тест курсивного форматирования...')

    await page.goto('/edit')
    await page.waitForLoadState('networkidle')

    const editorSelector = '[data-field-type="body"] [contenteditable="true"], [contenteditable="true"]'
    await page.waitForSelector(editorSelector, { timeout: 15000 })

    const editor = page.locator(editorSelector).first()
    await editor.click()
    await editor.fill('Курсивный текст для тестирования')

    // Выделяем слово "Курсивный"
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')

    // Применяем курсивное форматирование
    await page.keyboard.press('Control+i')

    console.log('[EditorTest] 📐 Применено курсивное форматирование (Ctrl+I)')

    await page.waitForTimeout(2000)

    // Проверяем что появился тег <em> или <i>
    const italicText = page.locator('em, i').first()
    await expect(italicText).toBeVisible({ timeout: 5000 })
    await expect(italicText).toContainText('Курсивный')

    console.log('[EditorTest] ✅ Курсивное форматирование применено успешно!')
  })

  test('тест последовательного форматирования', async ({ page }) => {
    console.log('[EditorTest] 🎯 Тест последовательного форматирования...')

    await page.goto('/edit')
    await page.waitForLoadState('networkidle')

    const editorSelector = '[data-field-type="body"] [contenteditable="true"], [contenteditable="true"]'
    await page.waitForSelector(editorSelector, { timeout: 15000 })

    const editor = page.locator(editorSelector).first()
    await editor.click()
    await editor.fill('Первый текст. Второй текст. Третий текст.')

    // Форматируем первое слово жирным
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')
    await page.keyboard.press('Control+b')

    console.log('[EditorTest] 💪 Первое слово сделано жирным')

    await page.waitForTimeout(1000)

    // Переходим ко второму слову и делаем его курсивным
    await page.keyboard.press('Control+f') // Поиск
    await page.keyboard.type('Второй')
    await page.keyboard.press('Escape') // Закрываем поиск

    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')
    await page.keyboard.press('Control+i')

    console.log('[EditorTest] 📐 Второе слово сделано курсивным')

    await page.waitForTimeout(2000)

    // Проверяем что оба форматирования применились
    const boldText = page.locator('strong, b').first()
    const italicText = page.locator('em, i').first()

    await expect(boldText).toBeVisible()
    await expect(boldText).toContainText('Первый')
    await expect(italicText).toBeVisible()
    await expect(italicText).toContainText('Второй')

    console.log('[EditorTest] 🎉 Последовательное форматирование работает!')
  })
})
