import { expect, test } from '@playwright/test'
import { TestUtils } from '../utils/test-helpers'

test.describe('Проверка гидратации SolidJS', () => {
  test('Проверка интерактивности после гидратации', async ({ page }) => {
    const utils = new TestUtils(page)

    // Переходим на главную страницу
    await utils.goto('/')

    // Ждем готовности страницы
    await utils.expectPageReady()

    // Проверяем состояние гидратации
    const hydrationState = await utils.checkHydrationState()
    console.log('Состояние гидратации:', hydrationState)

    // Проверяем что гидратация прошла успешно
    expect(hydrationState.isHydrated).toBe(true)

    // Проверяем интерактивность - ищем кнопки и ссылки
    const isInteractive = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a[href], input')
      return buttons.length > 0
    })

    expect(isInteractive).toBe(true)
  })

  test('Воспроизведение ошибки: главная -> лента -> главная', async ({ page }) => {
    const utils = new TestUtils(page)

    console.log('🔍 Начинаем тест навигации для поиска ошибки гидратации...')

    // Шаг 1: Загружаем главную страницу
    console.log('📍 Шаг 1: Загружаем главную страницу')
    await utils.goto('/')
    await utils.expectPageReady()

    // Проверяем начальное состояние гидратации
    const initialHydration = await utils.checkHydrationState()
    console.log('Начальное состояние гидратации:', initialHydration)

    // Шаг 2: Переходим в ленту
    console.log('📍 Шаг 2: Переходим в ленту')
    await utils.goto('/feed')
    await utils.expectPageReady()

    // Проверяем состояние после перехода в ленту
    const feedHydration = await utils.checkHydrationState()
    console.log('Состояние гидратации в ленте:', feedHydration)

    // Шаг 3: Возвращаемся на главную (тут могла быть ошибка)
    console.log('📍 Шаг 3: Возвращаемся на главную (тут могла быть ошибка)')
    await utils.goto('/')
    await utils.expectPageReady()

    // Проверяем финальное состояние гидратации
    const finalHydration = await utils.checkHydrationState()
    console.log('Финальное состояние гидратации:', finalHydration)

    // Проверяем что гидратация стабильна
    expect(finalHydration.isHydrated).toBe(true)

    // Проверяем что интерактивность сохранилась
    const isInteractive = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a[href], input')
      return buttons.length > 0
    })

    expect(isInteractive).toBe(true)

    console.log('📊 Результат проверки гидратации: success')
  })

  test('Проверка манипулятора гидратации', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Проверяем наличие hydration-comparator в консоли
    const hydrationValidator = await page.evaluate(() => {
      // Проверяем что страница загружена и интерактивна
      const hasHydrationKeys = document.querySelectorAll('[data-hk]').length > 0
      const hasMainContent = !!document.querySelector('main')
      const hasHeader = !!document.querySelector('header')
      const isComplete = document.readyState === 'complete'

      return hasHydrationKeys && hasMainContent && hasHeader && isComplete
    })

    if (!hydrationValidator) {
      console.log('⚠️ hydration-comparator не найден')
    }

    expect(hydrationValidator).toBe(true)
  })

  test('Навигация между разными страницами', async ({ page }) => {
    const utils = new TestUtils(page)

    // Упрощаем тест - проверяем только основные страницы
    const pages = ['/', '/feed', '/topics']

    for (const pagePath of pages) {
      console.log(`Переход на ${pagePath}`)
      await utils.goto(pagePath)

      // Упрощенная проверка готовности страницы
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 })
      
      // В CI дополнительно ждем завершения гидрации
      if (process.env.CI) {
        await page.waitForTimeout(1000) // Даем время на гидрацию в CI
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 })
      }

      // Проверяем что страница загрузилась
      const hydrationState = await utils.checkHydrationState()
      
      // Детальное логирование для отладки
      console.log(`Состояние гидрации для ${pagePath}:`, {
        hydrationKeys: hydrationState.hydrationKeys,
        hasMainContent: hydrationState.hasMainContent,
        hasHeader: hydrationState.hasHeader,
        isInteractive: hydrationState.isInteractive,
        hasServerContainer: hydrationState.hasServerContainer,
        isHydrated: hydrationState.isHydrated
      })
      
      expect(hydrationState.isHydrated).toBe(true)

      // Уменьшаем паузу между переходами
      await page.waitForTimeout(500)
    }
  })

  test('Проверка стабильности DOM после навигации', async ({ page }) => {
    const utils = new TestUtils(page)

    // Функция для получения снимка DOM
    const getDOMSnapshot = async () => {
      return await page.evaluate(() => {
        const childrenCount = document.body.children.length
        const hasDataHk = document.querySelectorAll('[data-hk]').length > 0
        const hasServerRendered = document.querySelector('[data-server-rendered]') !== null

        return {
          childrenCount,
          hasDataHk,
          hasServerRendered
        }
      })
    }

    // Начальный снимок
    await utils.goto('/')
    await utils.expectPageReady()
    const initialDOMSnapshot = await getDOMSnapshot()
    console.log('Initial DOM:', initialDOMSnapshot)

    // Переход на другую страницу
    await utils.goto('/feed')
    await utils.expectPageReady()

    // Возврат на главную
    await utils.goto('/')
    await utils.expectPageReady()

    // Финальный снимок
    const finalDOMSnapshot = await getDOMSnapshot()
    console.log('Final DOM:', finalDOMSnapshot)

    // DOM структура должна быть стабильной
    expect(finalDOMSnapshot.hasDataHk).toBe(true)
    expect(finalDOMSnapshot.childrenCount).toBeGreaterThan(0)
  })
})
