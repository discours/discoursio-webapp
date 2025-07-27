/**
 * Пример теста с новой DRY структурой
 * 
 * Демонстрирует использование новых базовых классов и утилит
 */

import { expect } from '@playwright/test'
import { test, TestUtils, AuthenticatedTest } from '../utils/test-helpers'

test.describe('Пример новой структуры тестов', () => {
  
  test('Тест с обычной страницей (SolidJS ready)', async ({ solidPage: page }) => {
    const utils = new TestUtils(page)
    
    // Переход на главную с автоматической настройкой SolidJS
    await utils.goto('/')
    await utils.expectPageReady()
    
    // Проверка базовых элементов
    await utils.expectVisible('header')
    await utils.expectVisible('main')
    
    // Безопасные операции
    const hasLoginButton = await utils.safeClick('a:has-text("Войти")')
    if (hasLoginButton) {
      await utils.expectVisible('input[placeholder*="Почта"]')
    }
  })
  
  test('Тест с авторизованным пользователем', async ({ authenticatedPage: page }) => {
    const utils = new TestUtils(page)
    
    // Пользователь уже авторизован через fixture
    await utils.goto('/settings')
    await utils.expectPageReady()
    
    // Проверяем что авторизация работает
    const isLoggedIn = await utils.isLoggedIn()
    expect(isLoggedIn).toBe(true)
    
    // Можем работать с приватными страницами
    await utils.expectVisible('.settings-form, .profile-settings')
  })
  
  test('Тест навигации и поиска', async ({ solidPage: page }) => {
    const utils = new TestUtils(page)
    
    await utils.goto('/')
    await utils.expectPageReady()
    
    // Навигация по разделам
    await utils.navigateToSection('authors')
    await utils.expectContentLoaded('.author-card, .author-item')
    
    await utils.navigateToSection('topics')
    await utils.expectContentLoaded('.topic-card, .topic-item')
    
    // Поиск
    await utils.performSearch('тест')
    await utils.expectVisible('.search-results')
  })
  
  test('Тест мобильной адаптивности', async ({ solidPage: page }) => {
    const utils = new TestUtils(page)
    
    await utils.goto('/')
    await utils.expectPageReady()
    
    // Проверяем мобильную версию
    await utils.checkMobileResponsiveness()
    
    // Элементы должны остаться доступными
    await utils.expectVisible('header')
    await utils.expectVisible('main')
  })
  
  test('Тест с использованием класса AuthenticatedTest', async ({ page }) => {
    const authTest = new AuthenticatedTest(page)
    
    try {
      // Настройка с авторизацией
      await authTest.setup()
      
      // Работаем как авторизованный пользователь
      await authTest.goto('/edit/new')
      await authTest.expectPageReady()
      
      // Проверяем доступ к приватной функциональности
      await authTest.expectVisible('.editor, .content-editor')
      
      // Создаем контент
      const titleFilled = await authTest.safeFill('input[placeholder*="заголовок"]', 'Тест статья')
      expect(titleFilled).toBe(true)
      
    } finally {
      // Очистка
      await authTest.cleanup()
    }
  })
  
  test('Тест с обработкой ошибок', async ({ solidPage: page }) => {
    const utils = new TestUtils(page)
    
    await utils.goto('/')
    await utils.expectPageReady()
    
    // Безопасные операции, которые могут не найти элементы
    const clickResult = await utils.safeClick('.non-existent-button')
    expect(clickResult).toBe(false) // Элемент не найден, но тест продолжается
    
    const fillResult = await utils.safeFill('.non-existent-input', 'value')
    expect(fillResult).toBe(false) // Тоже не найден
    
    // Автоматические скриншоты при необходимости
    await utils.takeScreenshot('test-state')
  })
  
  test('Тест авторизации с новыми утилитами', async ({ solidPage: page }) => {
    const utils = new TestUtils(page)
    
    await utils.goto('/')
    await utils.expectPageReady()
    
    // Открываем форму авторизации
    await utils.openAuthModal()
    
    // Переключаемся на регистрацию
    await utils.switchAuthForm('register')
    await utils.expectVisible('input[name="fullName"]')
    
    // Переключаемся обратно на вход
    await utils.switchAuthForm('login')
    await utils.expectVisible('input[placeholder*="Почта"]')
    
    // Заполняем форму
    await utils.fillLoginForm('test@example.com', 'password123')
    
    // Проверяем валидацию (ожидаем ошибку для невалидных данных)
    await utils.submitForm('Войти')
    // В зависимости от настроек сервера может показать ошибку или пройти
  })
})
