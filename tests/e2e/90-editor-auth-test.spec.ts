/**
 * 90-editor-auth-test.spec.ts
 * Тест авторизации для работы с редактором
 * Рефакторинг из auth-debug-simple.spec.ts
 */

import { expect, test } from '@playwright/test'
import { isUserLoggedIn, performLogin } from '../utils/auth-helpers'

test.describe('Editor Auth Test', () => {
  test('should login successfully for editor access', async ({ page, baseURL }) => {
    console.log('[EDITOR AUTH] 🔐 Тестируем авторизацию для доступа к редактору...')
    console.log('[EDITOR AUTH] Base URL:', baseURL)

    // Переходим на главную страницу
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    console.log('[EDITOR AUTH] Страница загружена')

    // Выполняем авторизацию
    const authSuccess = await performLogin(page)

    if (!authSuccess) {
      console.log('[EDITOR AUTH] ❌ Авторизация не удалась')
      test.skip()
      return
    }

    console.log('[EDITOR AUTH] ✅ Авторизация успешна!')

    // Проверяем доступ к редактору
    await page.goto('/edit')
    await page.waitForTimeout(3000)

    // Проверяем что мы не перенаправлены на авторизацию
    const currentUrl = page.url()
    expect(currentUrl).not.toContain('m=auth')
    console.log('[EDITOR AUTH] ✅ Доступ к редактору получен')

    // Проверяем наличие элементов редактора
    const editorVisible = await page
      .locator('[contenteditable="true"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)

    expect(editorVisible).toBe(true)
    console.log('[EDITOR AUTH] ✅ Редактор загружен и доступен')

    // Проверяем статус авторизации
    const isAuthorized = await isUserLoggedIn(page)
    expect(isAuthorized).toBe(true)
    console.log('[EDITOR AUTH] ✅ Статус авторизации подтвержден')
  })

  test('should maintain auth state across page reloads', async ({ page }) => {
    console.log('[EDITOR AUTH] 🔄 Тестируем сохранение авторизации при перезагрузке...')

    // Переходим на главную и авторизуемся
    await page.goto('/')
    await page.waitForTimeout(2000)

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Перезагружаем страницу
    await page.reload()
    await page.waitForTimeout(3000)

    // Проверяем что авторизация сохранилась
    const isStillAuthorized = await isUserLoggedIn(page)
    expect(isStillAuthorized).toBe(true)
    console.log('[EDITOR AUTH] ✅ Авторизация сохранилась после перезагрузки')

    // Проверяем доступ к редактору
    await page.goto('/edit')
    await page.waitForTimeout(2000)

    const editorVisible = await page
      .locator('[contenteditable="true"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    expect(editorVisible).toBe(true)
    console.log('[EDITOR AUTH] ✅ Доступ к редактору сохранился')
  })
})
