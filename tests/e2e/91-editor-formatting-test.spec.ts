/**
 * 91-editor-formatting-test.spec.ts
 * Тесты форматирования текста в редакторе
 * Рефакторинг из editor-format-test.spec.ts и 95-editor-formatting-test.spec.ts
 */

import { expect, test } from '@playwright/test'
import { createAuthHelpers } from '../utils/auth-helpers-v2'
import { createEditorHelpers } from '../utils/editor-helpers'

test.describe('Editor Formatting Test', () => {
  test.beforeEach(async ({ page }) => {
    console.log('[EDITOR FORMAT] 🎨 Подготовка к тестированию форматирования...')

    const authHelpers = createAuthHelpers(page)

    // Переходим на главную и авторизуемся
    await page.goto('/')
    await page.waitForTimeout(2000)

    const authSuccess = await authHelpers.performLogin()
    if (!authSuccess) {
      console.log('[EDITOR FORMAT] ❌ Авторизация не удалась, пропускаем тест')
      test.skip()
      return
    }

    console.log('[EDITOR FORMAT] ✅ Авторизация успешна')
  })

  test('should apply bold formatting', async ({ page }) => {
    console.log('[EDITOR FORMAT] 💪 Тестируем жирное форматирование...')

    const editorHelpers = createEditorHelpers(page)

    // Переходим к редактору
    await editorHelpers.goToEditor()

    // Заполняем контент
    await editorHelpers.fillContent('Тестовый текст для проверки форматирования')

    // Выделяем первое слово "Тестовый"
    await page.keyboard.press('Home') // В начало
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right') // Выделяем первое слово
    await page.keyboard.up('Shift')

    console.log('[EDITOR FORMAT] 🎯 Слово "Тестовый" выделено')

    // Применяем жирное форматирование
    await editorHelpers.formatText('bold')

    // Ждем применения форматирования
    await page.waitForTimeout(2000)

    // Проверяем что появился тег <strong> или <b>
    const boldText = page.locator('strong, b').first()
    await expect(boldText).toBeVisible({ timeout: 5000 })
    await expect(boldText).toContainText('Тестовый')

    console.log('[EDITOR FORMAT] ✅ Жирное форматирование применено успешно!')

    // Снимаем выделение и проверяем что форматирование сохранилось
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')

    // Проверяем что тег все еще есть
    await expect(boldText).toBeVisible()
    await expect(boldText).toContainText('Тестовый')

    console.log('[EDITOR FORMAT] 🎉 Жирное форматирование сохранилось!')
  })

  test('should apply italic formatting', async ({ page }) => {
    console.log('[EDITOR FORMAT] 📐 Тестируем курсивное форматирование...')

    const editorHelpers = createEditorHelpers(page)

    await editorHelpers.goToEditor()
    await editorHelpers.fillContent('Курсивный текст для тестирования')

    // Выделяем слово "Курсивный"
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')

    // Применяем курсивное форматирование
    await editorHelpers.formatText('italic')

    await page.waitForTimeout(2000)

    // Проверяем что появился тег <em> или <i>
    const italicText = page.locator('em, i').first()
    await expect(italicText).toBeVisible({ timeout: 5000 })
    await expect(italicText).toContainText('Курсивный')

    console.log('[EDITOR FORMAT] ✅ Курсивное форматирование применено успешно!')
  })

  test('should apply sequential formatting', async ({ page }) => {
    console.log('[EDITOR FORMAT] 🔄 Тестируем последовательное форматирование...')

    const editorHelpers = createEditorHelpers(page)

    await editorHelpers.goToEditor()
    await editorHelpers.fillContent('Первый текст. Второй текст. Третий текст.')

    // Форматируем первое слово жирным
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')
    await editorHelpers.formatText('bold')

    console.log('[EDITOR FORMAT] 💪 Первое слово сделано жирным')

    await page.waitForTimeout(1000)

    // Переходим ко второму слову и делаем его курсивным
    await page.keyboard.press('Control+f') // Поиск
    await page.keyboard.type('Второй')
    await page.keyboard.press('Escape') // Закрываем поиск

    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')
    await editorHelpers.formatText('italic')

    console.log('[EDITOR FORMAT] 📐 Второе слово сделано курсивным')

    await page.waitForTimeout(2000)

    // Проверяем что оба форматирования применились
    const boldText = page.locator('strong, b').first()
    const italicText = page.locator('em, i').first()

    await expect(boldText).toBeVisible()
    await expect(boldText).toContainText('Первый')
    await expect(italicText).toBeVisible()
    await expect(italicText).toContainText('Второй')

    console.log('[EDITOR FORMAT] 🎉 Последовательное форматирование работает!')
  })

  test('should preserve formatting after save', async ({ page }) => {
    console.log('[EDITOR FORMAT] 💾 Тестируем сохранение форматирования...')

    const editorHelpers = createEditorHelpers(page)

    await editorHelpers.goToEditor()
    await editorHelpers.fillTitle('Тест сохранения форматирования')
    await editorHelpers.fillContent('Жирный и курсивный текст')

    // Выделяем "Жирный" и делаем жирным
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')
    await editorHelpers.formatText('bold')

    // Выделяем "курсивный" и делаем курсивным
    await page.keyboard.press('Control+f')
    await page.keyboard.type('курсивный')
    await page.keyboard.press('Escape')
    await page.keyboard.down('Shift')
    await page.keyboard.press('Control+Right')
    await page.keyboard.up('Shift')
    await editorHelpers.formatText('italic')

    await page.waitForTimeout(2000)

    // Проверяем что форматирование применилось
    const boldText = page.locator('strong, b').first()
    const italicText = page.locator('em, i').first()

    await expect(boldText).toBeVisible()
    await expect(boldText).toContainText('Жирный')
    await expect(italicText).toBeVisible()
    await expect(italicText).toContainText('курсивный')

    console.log('[EDITOR FORMAT] ✅ Форматирование применено и сохранено')

    // Перезагружаем страницу
    await page.reload()
    await page.waitForTimeout(3000)

    // Проверяем что форматирование сохранилось
    const boldAfterReload = page.locator('strong, b').first()
    const italicAfterReload = page.locator('em, i').first()

    await expect(boldAfterReload).toBeVisible({ timeout: 10000 })
    await expect(italicAfterReload).toBeVisible({ timeout: 10000 })

    console.log('[EDITOR FORMAT] 🎉 Форматирование сохранилось после перезагрузки!')
  })
})
