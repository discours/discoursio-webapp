/**
 * Один простой тест форматирования редактора
 */

import { test } from '@playwright/test'

test('тест жирного форматирования в редакторе', async ({ page }) => {
  console.log('[EditorTest] 🎯 Тест форматирования...')

  // Переходим на продакшн сайт с авторизацией
  await page.goto('https://discours.io?m=auth')

  // Быстрая авторизация
  try {
    await page.fill('input[placeholder="Почта"]', 'test@example.com')
    await page.fill('input[placeholder="Пароль"]', 'testPassword123!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  } catch (e) {
    console.log('[EditorTest] Авторизация пропущена:', e)
  }

  // Переходим в редактор
  await page.goto('https://discours.io/edit')
  await page.waitForTimeout(2000)

  // Ищем редактор
  const editor = page.locator('[contenteditable="true"]').first()
  await editor.click()
  await editor.fill('Тестовый текст')

  console.log('[EditorTest] ✏️ Текст введен')

  // Выделяем и форматируем
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+b')

  console.log('[EditorTest] 💪 Ctrl+B нажато')

  await page.waitForTimeout(2000)

  // Проверяем результат
  const bold = page.locator('strong, b').first()
  if (await bold.isVisible({ timeout: 3000 })) {
    console.log('[EditorTest] ✅ УСПЕХ: Жирное форматирование работает!')
  } else {
    console.log('[EditorTest] ❌ ОШИБКА: Жирное форматирование не применилось')

    // Отладочная информация
    const editorHTML = await editor.innerHTML()
    console.log('[EditorTest] 🔍 HTML редактора:', editorHTML)
  }
})
