import { expect, type Page, test } from '@playwright/test'
import { initializeTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers'
import { performLogin, TEST_USERS } from '../utils/auth-helpers'
import { DraftPage } from '../utils/page-objects'

/**
 * Тестирование действий с черновиками и публикациями
 * Создание различных типов контента
 */

let page: Page | null = null

test.beforeAll(async ({ browser }) => {
  page = await initializeTestEnvironment(browser, 'draft actions')
  test.setTimeout(150000)
  
  // Закрываем страницу инициализации
  if (page) {
    await page.close()
    page = null
  }
})

test.afterAll(async () => {
  await cleanupTestEnvironment(page, 'draft actions')
})

/**
 * Авторизация перед каждым тестом
 */
test.beforeEach(async ({ page }) => {
  await performLogin(page, TEST_USERS.VALID)
  test.setTimeout(80000)
})

test.describe('Создание новых материалов', () => {
  test('Открытие /edit/new', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await page.goto('/edit/new')
    await draftPage.verifyPageTitle('Дискурс :: Выберите тип публикации')
    await draftPage.verifyHeading('Выберите тип публикации')
  })

  test('Создание статьи', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await page.goto('/edit/new')
    await draftPage.selectPublicationType('статья')
    await draftPage.verifyEditUrl()
    await draftPage.verifyHeading('Новая статья')
  })

  test('Создание литературы', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await draftPage.openDrafts()
    await draftPage.createNewPublication()
    await draftPage.selectPublicationType('литература')
    await draftPage.verifyEditUrl()
    await draftPage.verifyHeading('Новая литература')
  })

  test('Создание галереи', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await draftPage.openDrafts()
    await draftPage.createNewPublication()
    await draftPage.selectPublicationType('изображения')
    await draftPage.verifyEditUrl()
    await draftPage.verifyHeading('Новые изображения')

    // Заполнение формы
    await draftPage.fillGalleryForm('Тестовая галерея', 'Это тестовая галерея изображений')
    
    // Сохранение
    await draftPage.saveDraft()
    await draftPage.verifyDraftSaved()
  })

  test('Создание аудио', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await draftPage.openDrafts()
    await draftPage.createNewPublication()
    await draftPage.selectPublicationType('музыка')
    await draftPage.verifyEditUrl()
    await draftPage.verifyHeading('Новая музыка')

    // Заполнение формы
    await draftPage.fillAudioForm('Тестовый трек', 'Тестовый исполнитель')
    
    // Сохранение
    await draftPage.saveDraft()
    await draftPage.verifyDraftSaved()
  })

  test('Создание видео', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await draftPage.openDrafts()
    await draftPage.createNewPublication()
    await draftPage.selectPublicationType('видео')
    await draftPage.verifyEditUrl()
    await draftPage.verifyHeading('Новое видео')

    // Заполнение формы
    await draftPage.fillVideoForm(
      'Тестовое видео', 
      'Это тестовое видео',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    )
    
    // Сохранение
    await draftPage.saveDraft()
    await draftPage.verifyDraftSaved()
  })

  test('Инициализация редактора', async ({ page }) => {
    const draftPage = new DraftPage(page)
    
    await page.goto('/edit/new')
    await draftPage.verifyPageTitle('Дискурс :: Выберите тип публикации')
    
    // Ждем готовности редактора
    await draftPage.verifyEditorReady()
    
    // Проверяем что клик работает с первого раза
    await draftPage.selectPublicationType('статья')
    await draftPage.verifyEditUrl()
  })
})

test('Публикация статьи', async ({ page }) => {
  const draftPage = new DraftPage(page)
  
  await draftPage.openDrafts()
  await draftPage.createNewPublication()
  await draftPage.selectPublicationType('статья')

  // Заполнение формы
  await draftPage.fillBasicForm('Тестовая статья', 'Это тестовая статья для проверки публикации')

  // Публикация
  await draftPage.publishDraft()
  
  // Проверка публикации
  await draftPage.verifyPublished('Тестовая статья')
})
