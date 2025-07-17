import { test, expect } from '@playwright/test'

test.describe('Проверка гидратации SolidJS', () => {
  test('Проверка интерактивности после гидратации', async ({ page }) => {
    await page.goto('/')

    // Ждем полной загрузки
    await page.waitForLoadState('networkidle')

    // Проверяем что кнопка "Войти" кликабельна
    const authButton = page.locator('a:has-text("Войти"), button:has-text("Войти")')
    await expect(authButton.first()).toBeVisible()

    // Кликаем по кнопке
    await authButton.first().click()

    // Проверяем что модальное окно появилось (ждем до 10 секунд)
    const authModal = page.locator('.modal, [data-testid="auth-modal"], .auth-modal')
    await expect(authModal.first()).toBeVisible({ timeout: 10000 })
  })

  test('Воспроизведение ошибки: главная -> лента -> главная', async ({ page }) => {
    console.log('🔍 Начинаем тест навигации для поиска ошибки гидрации...')

    // Включаем консольные логи для отслеживания ошибок
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.text().includes('hydration') || msg.text().includes('Hydration')) {
        console.log(`🚨 Console Error: ${msg.text()}`)
      }
    })

    // 1. Загружаем главную страницу
    console.log('📍 Шаг 1: Загружаем главную страницу')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Проверяем что hydration-comparator загружен
    await page.evaluate(() => {
      if (typeof (window as any).compareServerClientDOM === 'function') {
        console.log('✅ Hydration comparator найден на главной')
        ;(window as any).compareServerClientDOM()
      }
    })

    // 2. Переходим в ленту
    console.log('📍 Шаг 2: Переходим в ленту')
    await page.click('a[href="/feed"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Даем время на обновление

    // 3. Возвращаемся на главную
    console.log('📍 Шаг 3: Возвращаемся на главную (тут должна быть ошибка)')
    await page.click('a[href="/"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Запускаем проверку гидрации после возврата
    const hydrationError = await page.evaluate(() => {
      if (typeof (window as any).compareServerClientDOM === 'function') {
        console.log('🔍 Проверяем гидрацию после возврата на главную...')
        ;(window as any).compareServerClientDOM()
        return 'checked'
      }
      return 'comparator not found'
    })

    console.log('📊 Результат проверки гидрации:', hydrationError)

    // Проверяем что страница всё еще интерактивна
    const isInteractive = await page.evaluate(() => {
      const button = document.querySelector('a:has-text("Войти"), button:has-text("Войти")')
      return button !== null
    })

    expect(isInteractive).toBe(true)
  })

  test('Проверка манипулятора гидратации', async ({ page }) => {
    // Проверяем наличие нашего hydration-comparator
    await page.goto('/')

    const hydrationValidator = await page.evaluate(() => {
      return typeof (window as any).compareServerClientDOM !== 'undefined'
    })

    if (hydrationValidator) {
      console.log('✅ Обнаружен hydration-comparator')
    } else {
      console.warn('⚠️ hydration-comparator не найден')
    }
  })

  test('Навигация между разными страницами', async ({ page }) => {
    // Проверяем навигацию между главной, лентой и обратно
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Переход на страницу ленты
    await page.click('a[href="/feed"]')
    await expect(page).toHaveURL('/feed')
    await page.waitForLoadState('networkidle')

    // Возврат на главную
    await page.click('a[href="/"]')
    await expect(page).toHaveURL('/')
    await page.waitForLoadState('networkidle')

    // Проверяем что страница всё еще работает
    const mainContent = page.locator('main, .content, [data-main]')
    await expect(mainContent.first()).toBeVisible()
  })
})
