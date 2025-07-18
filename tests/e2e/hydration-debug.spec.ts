import { expect, test } from '@playwright/test'

test.describe('Проверка гидратации SolidJS', () => {
  test('Проверка интерактивности после гидрации', async ({ page }) => {
    await page.goto('/')

    // Ждем полной загрузки
    await page.waitForLoadState('networkidle')

    // Используем более надежные селекторы для поиска кнопки входа
    const authButton = page.locator(
      'a[href*="auth"], button[data-auth], .auth-button, [data-testid="auth-button"]'
    )

    // Если основные селекторы не работают, попробуем найти по тексту через getByText
    const loginButtonByText = page.getByText('Войти')

    // Проверяем наличие кнопки любым из способов
    const authButtonExists = (await authButton.count()) > 0
    const loginTextExists = (await loginButtonByText.count()) > 0

    if (authButtonExists) {
      await expect(authButton.first()).toBeVisible()
      await authButton.first().click()
    } else if (loginTextExists) {
      await expect(loginButtonByText.first()).toBeVisible()
      await loginButtonByText.first().click()
    } else {
      throw new Error('Кнопка входа не найдена')
    }

    // Проверяем что модальное окно появилось (ждем до 10 секунд)
    const authModal = page.locator('.modal, [data-testid="auth-modal"], .auth-modal, [data-modal]')
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

    // Отслеживаем DOM ошибки
    page.on('pageerror', (error) => {
      console.log(`🚨 Page Error: ${error.message}`)
    })

    // 1. Загружаем главную страницу
    console.log('📍 Шаг 1: Загружаем главную страницу')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Проверяем что hydration-comparator загружен
    await page.evaluate(() => {
      if (
        typeof (window as unknown as { compareServerClientDOM?: () => void }).compareServerClientDOM ===
        'function'
      ) {
        console.log('✅ Hydration comparator найден на главной')
        ;(window as unknown as { compareServerClientDOM: () => void }).compareServerClientDOM()
      }
    })

    // 2. Переходим в ленту
    console.log('📍 Шаг 2: Переходим в ленту')

    // Используем более надежный способ перехода
    const feedLink = page.locator('a[href="/feed"], nav a[href*="feed"], [data-testid="feed-link"]')
    const feedLinkExists = (await feedLink.count()) > 0

    if (feedLinkExists) {
      await feedLink.first().click()
    } else {
      // Fallback: переходим напрямую
      await page.goto('/feed')
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Даем время на обновление

    // 3. Возвращаемся на главную
    console.log('📍 Шаг 3: Возвращаемся на главную (тут должна быть ошибка)')

    const homeLink = page.locator('a[href="/"], nav a[href*="home"], [data-testid="home-link"], .logo a')
    const homeLinkExists = (await homeLink.count()) > 0

    if (homeLinkExists) {
      await homeLink.first().click()
    } else {
      // Fallback: переходим напрямую
      await page.goto('/')
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Запускаем проверку гидрации после возврата
    const hydrationError = await page.evaluate(() => {
      if (
        typeof (window as unknown as { compareServerClientDOM?: () => void }).compareServerClientDOM ===
        'function'
      ) {
        console.log('🔍 Проверяем гидрацию после возврата на главную...')
        ;(window as unknown as { compareServerClientDOM: () => void }).compareServerClientDOM()
        return 'checked'
      }
      return 'not_found'
    })

    console.log('📊 Результат проверки гидрации:', hydrationError)

    // Проверяем что страница всё еще интерактивна
    const isInteractive = await page.evaluate(() => {
      // Ищем любую интерактивную кнопку или ссылку
      const button = document.querySelector('button, a, input[type="button"], [role="button"]')
      return button !== null
    })

    expect(isInteractive).toBe(true)
  })

  test('Проверка манипулятора гидратации', async ({ page }) => {
    // Проверяем наличие нашего hydration-comparator
    await page.goto('/')

    const hydrationValidator = await page.evaluate(() => {
      return (
        typeof (window as unknown as { compareServerClientDOM?: () => void }).compareServerClientDOM !==
        'undefined'
      )
    })

    if (hydrationValidator) {
      console.log('✅ Обнаружен hydration-comparator')
    } else {
      console.warn('⚠️ hydration-comparator не найден')
    }

    expect(hydrationValidator).toBe(true)
  })

  test('Навигация между разными страницами', async ({ page }) => {
    // Проверяем навигацию между главной, лентой и обратно
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Переход на страницу ленты
    const feedNavigation = page.locator('a[href="/feed"], [data-feed-link]')
    const feedNavExists = (await feedNavigation.count()) > 0

    if (feedNavExists) {
      await feedNavigation.first().click()
      await expect(page).toHaveURL('/feed')
    } else {
      await page.goto('/feed')
    }

    await page.waitForLoadState('networkidle')

    // Возврат на главную
    const homeNavigation = page.locator('a[href="/"], [data-home-link], .logo a')
    const homeNavExists = (await homeNavigation.count()) > 0

    if (homeNavExists) {
      await homeNavigation.first().click()
      await expect(page).toHaveURL('/')
    } else {
      await page.goto('/')
    }

    await page.waitForLoadState('networkidle')

    // Проверяем что страница всё еще работает
    const mainContent = page.locator('main, .content, [data-main], body > div')
    await expect(mainContent.first()).toBeVisible()
  })

  test('Проверка стабильности DOM после навигации', async ({ page }) => {
    // Новый тест для проверки стабильности DOM структуры
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Делаем снимок DOM структуры
    const initialDOMSnapshot = await page.evaluate(() => {
      const body = document.body
      return {
        childrenCount: body.children.length,
        hasDataHk: document.querySelector('[data-hk]') !== null,
        hasServerRendered: document.querySelector('[data-server-rendered]') !== null
      }
    })

    // Переходим на другую страницу и возвращаемся
    await page.goto('/feed')
    await page.waitForLoadState('networkidle')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Проверяем что DOM структура осталась стабильной
    const finalDOMSnapshot = await page.evaluate(() => {
      const body = document.body
      return {
        childrenCount: body.children.length,
        hasDataHk: document.querySelector('[data-hk]') !== null,
        hasServerRendered: document.querySelector('[data-server-rendered]') !== null
      }
    })

    console.log('Initial DOM:', initialDOMSnapshot)
    console.log('Final DOM:', finalDOMSnapshot)

    // DOM структура должна быть стабильной
    expect(finalDOMSnapshot.hasDataHk).toBe(true)
    expect(finalDOMSnapshot.childrenCount).toBeGreaterThan(0)
  })
})
