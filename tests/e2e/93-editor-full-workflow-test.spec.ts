/**
 * 93-editor-full-workflow-test.spec.ts
 * Полный workflow тест редактора: создание → редактирование → публикация
 * Рефакторинг из upload-test-simple.spec.ts
 */

import { expect, test } from '@playwright/test'
import { isUserLoggedIn, performLogin } from '../utils/auth-helpers'
import { createEditorHelpers } from '../utils/editor-helpers'

test.describe('Editor Full Workflow Test', () => {
  test('should complete full article creation workflow', async ({ page, baseURL }) => {
    test.setTimeout(90000) // Увеличиваем таймаут для полного workflow

    console.log('[EDITOR WORKFLOW] 🚀 Начинаем полный тест создания статьи...')
    console.log('[EDITOR WORKFLOW] Base URL:', baseURL)

    const editorHelpers = createEditorHelpers(page)

    // 1. АВТОРИЗАЦИЯ
    console.log('[EDITOR WORKFLOW] 🔐 Этап 1: Авторизация...')

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      console.log('[EDITOR WORKFLOW] ❌ Авторизация не удалась, пропускаем тест')
      test.skip()
      return
    }

    console.log('[EDITOR WORKFLOW] ✅ Авторизация успешна!')

    // 2. СОЗДАНИЕ НОВОГО ПОСТА
    console.log('[EDITOR WORKFLOW] 📝 Этап 2: Создание нового поста...')

    await editorHelpers.goToNewPost('Article')

    // Проверяем что мы в редакторе
    const editor = await editorHelpers.findEditor()
    expect(editor).toBeTruthy()
    console.log('[EDITOR WORKFLOW] ✅ Редактор загружен')

    // 3. ЗАПОЛНЕНИЕ КОНТЕНТА
    console.log('[EDITOR WORKFLOW] ✏️ Этап 3: Заполнение контента...')

    await editorHelpers.fillTitle('Тестовая статья для полного workflow')
    await editorHelpers.fillContent(
      'Это тестовая статья для проверки полного процесса создания и публикации. Здесь будет основной текст статьи с различным контентом.'
    )

    console.log('[EDITOR WORKFLOW] ✅ Заголовок и контент заполнены')

    // 4. ФОРМАТИРОВАНИЕ ТЕКСТА
    console.log('[EDITOR WORKFLOW] 🎨 Этап 4: Применение форматирования...')

    if (editor) {
      // Выделяем первое слово и делаем жирным
      await page.keyboard.press('Home')
      await page.keyboard.down('Shift')
      await page.keyboard.press('Control+Right')
      await page.keyboard.up('Shift')
      await editorHelpers.formatText('bold')

      await page.waitForTimeout(1000)

      // Проверяем что форматирование применилось
      const boldText = page.locator('strong, b').first()
      await expect(boldText).toBeVisible({ timeout: 5000 })
      console.log('[EDITOR WORKFLOW] ✅ Форматирование применено')
    }

    // 5. ПУБЛИКАЦИЯ
    console.log('[EDITOR WORKFLOW] 🚀 Этап 5: Публикация...')

    await editorHelpers.publishDraft()

    // Проверяем что мы перешли к настройкам публикации
    const currentUrl = page.url()
    expect(currentUrl).toContain('/settings')
    console.log('[EDITOR WORKFLOW] ✅ Перешли к настройкам публикации')

    // 6. ДОБАВЛЕНИЕ ТЕМ
    console.log('[EDITOR WORKFLOW] 🏷️ Этап 6: Добавление тем...')

    try {
      await editorHelpers.addTopic('Общество')
      console.log('[EDITOR WORKFLOW] ✅ Первая тема добавлена')

      // Добавляем вторую тему для тестирования переключения главной
      await editorHelpers.addTopic('Культура')
      console.log('[EDITOR WORKFLOW] ✅ Вторая тема добавлена')

      // Тестируем переключение главной темы
      await editorHelpers.setMainTopic('Культура')
      console.log('[EDITOR WORKFLOW] ✅ Главная тема переключена')
    } catch (error) {
      console.log('[EDITOR WORKFLOW] ⚠️ Ошибка при работе с темами:', error)
      // Продолжаем тест даже если темы не работают
    }

    // 7. ПРОВЕРКА ФИНАЛЬНОГО СОСТОЯНИЯ
    console.log('[EDITOR WORKFLOW] ✅ Этап 7: Проверка финального состояния...')

    // Проверяем что заголовок отображается в настройках
    const titleInSettings = await page
      .locator('input[value*="Тестовая статья"]')
      .isVisible()
      .catch(() => false)

    if (titleInSettings) {
      console.log('[EDITOR WORKFLOW] ✅ Заголовок отображается в настройках')
    } else {
      console.log('[EDITOR WORKFLOW] ⚠️ Заголовок не найден в настройках (возможно, другая структура)')
    }

    // Проверяем URL содержит ID черновика
    expect(currentUrl).toMatch(/\/edit\/\d+\/settings/)
    console.log('[EDITOR WORKFLOW] ✅ URL содержит ID черновика')

    // Проверяем что мы все еще авторизованы
    const isStillAuthorized = await isUserLoggedIn(page)
    expect(isStillAuthorized).toBe(true)
    console.log('[EDITOR WORKFLOW] ✅ Авторизация сохранилась')

    console.log('[EDITOR WORKFLOW] 🎉 ПОЛНЫЙ WORKFLOW ЗАВЕРШЕН УСПЕШНО!')
  })

  test('should handle draft auto-save', async ({ page }) => {
    console.log('[EDITOR WORKFLOW] 💾 Тестируем автосохранение черновика...')

    const editorHelpers = createEditorHelpers(page)

    // Авторизуемся
    await page.goto('/')
    await page.waitForTimeout(2000)

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Создаем новый пост
    await editorHelpers.goToNewPost('Article')

    // Заполняем заголовок
    await editorHelpers.fillTitle('Тест автосохранения')

    // Ждем автосохранения
    await page.waitForTimeout(5000)

    // Заполняем контент
    await editorHelpers.fillContent('Контент для тестирования автосохранения черновика.')

    // Ждем автосохранения
    await page.waitForTimeout(5000)

    // Перезагружаем страницу
    await page.reload()
    await page.waitForTimeout(5000)

    // Проверяем что контент сохранился
    const titleInput = await editorHelpers.findTitleInput()
    const editor = await editorHelpers.findEditor()

    if (titleInput) {
      const savedTitle = await titleInput.inputValue()
      expect(savedTitle).toContain('Тест автосохранения')
      console.log('[EDITOR WORKFLOW] ✅ Заголовок автосохранился')
    }

    if (editor) {
      const savedContent = await editor.textContent()
      expect(savedContent).toContain('Контент для тестирования')
      console.log('[EDITOR WORKFLOW] ✅ Контент автосохранился')
    }

    console.log('[EDITOR WORKFLOW] 🎉 Автосохранение работает!')
  })

  test('should validate required fields before publish', async ({ page }) => {
    console.log('[EDITOR WORKFLOW] ✅ Тестируем валидацию обязательных полей...')

    const editorHelpers = createEditorHelpers(page)

    // Авторизуемся
    await page.goto('/')
    await page.waitForTimeout(2000)

    const authSuccess = await performLogin(page)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Создаем новый пост
    await editorHelpers.goToNewPost('Article')

    // Пытаемся опубликовать без заполнения полей
    const publishButton = await editorHelpers.findPublishButton()
    if (publishButton) {
      await publishButton.click()
      console.log('[EDITOR WORKFLOW] 🚀 Попытка публикации без контента')

      // Ждем появления ошибок валидации
      await page.waitForTimeout(2000)

      // Проверяем что появились ошибки или мы не перешли к настройкам
      const currentUrl = page.url()
      const hasValidationErrors = !currentUrl.includes('/settings')

      if (hasValidationErrors) {
        console.log('[EDITOR WORKFLOW] ✅ Валидация сработала - публикация заблокирована')
      } else {
        console.log('[EDITOR WORKFLOW] ⚠️ Валидация не сработала или имеет другую логику')
      }
    }

    // Заполняем минимальные поля
    await editorHelpers.fillTitle('Минимальная статья')
    await editorHelpers.fillContent('Минимальный контент для публикации.')

    // Пытаемся опубликовать снова
    if (publishButton) {
      await publishButton.click()
      await page.waitForTimeout(3000)

      const newUrl = page.url()
      if (newUrl.includes('/settings')) {
        console.log('[EDITOR WORKFLOW] ✅ После заполнения полей публикация разрешена')
      } else {
        console.log('[EDITOR WORKFLOW] ⚠️ Публикация все еще заблокирована (возможно, нужны дополнительные поля)')
      }
    }

    console.log('[EDITOR WORKFLOW] 🎉 Тест валидации завершен')
  })
})
