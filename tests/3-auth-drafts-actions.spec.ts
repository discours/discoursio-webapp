import { type Page, expect, test } from '@playwright/test'
import { checkServerWithoutStarting } from './utils/test-helpers'

/* Global starting test config */

const TEST_LOGIN = process.env.TEST_LOGIN
const TEST_PASSWORD = process.env.TEST_PASSWORD
const EXPECT_EDIT_URL = /\/edit\/[a-zA-Z0-9-]+/
let page: Page | null = null

test.beforeAll(async ({ browser }) => {
  console.log('Инициализация тестов действий с черновиками...')

  // Создаем страницу для тестов
  page = await browser.newPage()
  test.setTimeout(150000)

  // Проверяем доступность сервера без его запуска
  await checkServerWithoutStarting(page)

  // Проверяем, что страница загрузилась корректно
  // biome-ignore lint/performance/useTopLevelRegex: <explanation>
  await expect(page).toHaveTitle(/Дискурс/)
  console.log('Тесты действий с черновиками инициализированы успешно!')
  if (page) {
    await page.close()
    page = null // Устанавливаем null после закрытия
  }
})

test.afterAll(async () => {
  // Проверяем, что page существует перед закрытием
  if (page) {
    await page.close()
  }
})

/* TESTS section */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  test.setTimeout(80000)
  await page.getByRole('link', { name: 'Войти' }).click()
  await page.getByPlaceholder('Почта').click()
  if (TEST_LOGIN) {
    await page.getByPlaceholder('Почта').fill(TEST_LOGIN)
    await page.getByPlaceholder('Пароль').click()
    if (TEST_PASSWORD) {
      await page.getByPlaceholder('Пароль').fill(TEST_PASSWORD)
    }
  }
  await page.getByRole('button', { name: 'Войти' }).click()
})

test.describe('Создание новых материалов', () => {
  test('Открытие /edit/new', async ({ page }) => {
    await page.goto('/edit/new')
    await expect(page).toHaveTitle('Дискурс :: Выберите тип публикации')
    await expect(page.getByRole('heading', { name: 'Выберите тип публикации' })).toBeVisible()
  })

  test('Создание статьи', async ({ page }) => {
    await page.goto('/edit/new')
    await page.locator('li').filter({ hasText: 'статья' }).locator('img').click()
    // biome-ignore lint/performance/useTopLevelRegex: тесты
    await expect(page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
    await expect(page.getByRole('heading', { name: 'Новая статья' })).toBeVisible()
  })

  test('Литература', async ({ page }) => {
    await page.getByRole('button', { name: 'Т.Р' }).click()
    await page.getByRole('link', { name: 'Черновики' }).click()
    await page.getByRole('link', { name: 'Создать публикацию' }).click()
    await page
      .locator('li')
      // biome-ignore lint/performance/useTopLevelRegex: тесты
      .filter({ hasText: /^литература$/ })
      .locator('img')
      .click()
    // biome-ignore lint/performance/useTopLevelRegex: тесты
    await expect(page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
    await expect(page.getByRole('heading', { name: 'Новая литература' })).toBeVisible()
  })

  test('Галерея', async ({ page }) => {
    await page.getByRole('button', { name: 'Т.Р' }).click()
    await page.getByRole('link', { name: 'Черновики' }).click()
    await page.getByRole('link', { name: 'Создать публикацию' }).click()
    await page.locator('li').filter({ hasText: 'изображения' }).locator('img').click()
    // biome-ignore lint/performance/useTopLevelRegex: тесты
    await expect(page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
    await expect(page.getByRole('heading', { name: 'Новые изображения' })).toBeVisible()

    // Заполнение формы
    await page.getByLabel('Заголовок').fill('Тестовая галерея')
    await page.getByLabel('Описание').fill('Это тестовая галерея изображений')

    // Загрузка изображения (предполагается, что есть кнопка для загрузки)
    await page.setInputFiles('input[type="file"]', 'path/to/test/image.jpg')

    // Сохранение
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Проверка создания
    await expect(page.getByText('Черновик сохранен')).toBeVisible()
  })

  test('Audio', async ({ page }) => {
    await page.getByRole('button', { name: 'Т.Р.' }).click()
    await page.getByRole('link', { name: 'Черновики' }).click()
    await page.getByRole('link', { name: 'Создать публикацию' }).click()
    await page.locator('li').filter({ hasText: 'музыка' }).locator('img').click()
    // biome-ignore lint/performance/useTopLevelRegex: тесты
    await expect(page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
    await expect(page.getByRole('heading', { name: 'Новая музыка' })).toBeVisible()

    // Заполнение формы
    await page.getByLabel('Название трека').fill('Тестовый трек')
    await page.getByLabel('Исполнитель').fill('Тестовый исполнитель')

    // Загрузка аудио файла (предполагается, что есть кнопка для загрузки)
    await page.setInputFiles('input[type="file"]', 'path/to/test/audio.mp3')

    // Сохранение
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Проверка создания
    await expect(page.getByText('Черновик сохранен')).toBeVisible()
  })

  test('Video', async ({ page }) => {
    await page.getByRole('button', { name: 'Т.Р' }).click()
    await page.getByRole('link', { name: 'Черновики' }).click()
    await page.getByRole('link', { name: 'Создать публикацию' }).click()
    await page.locator('li').filter({ hasText: 'видео' }).locator('img').click()
    // biome-ignore lint/performance/useTopLevelRegex: тесты
    await expect(page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
    await expect(page.getByRole('heading', { name: 'Новое видео' })).toBeVisible()

    // Заполнение формы
    await page.getByLabel('Название видео').fill('Тестовое видео')
    await page.getByLabel('Описание').fill('Это тестовое видео')

    // Вставка ссылки на видео (предполагается, что есть поле для ввода ссылки)
    await page.getByLabel('Ссылка на видео').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // Сохранение
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Проверка создания
    await expect(page.getByText('Черновик сохранен')).toBeVisible()
  })

  test('Editor initialization', async ({ page }) => {
    await page.goto('/edit/new')

    // Проверяем что страница загрузилась
    await expect(page).toHaveTitle('Дискурс :: Выберите тип публикации')

    // Ждем готовности редактора
    await expect(page.locator('[data-ready="true"]')).toBeVisible()

    // Проверяем что клик работает с первого раза
    await page.locator('li').filter({ hasText: 'статья' }).locator('img').click()
    await expect(page).toHaveURL(EXPECT_EDIT_URL)
  })
})

test('Публикация темы', async ({ page }) => {
  await page.getByRole('button', { name: 'Т.Р.' }).click()
  await page.getByRole('link', { name: 'Черновики' }).click()
  await page.getByRole('link', { name: 'Создать публикацию' }).click()
  await page.locator('li').filter({ hasText: 'статья' }).locator('img').click()

  // Заполнение формы
  await page.getByLabel('Заголовок').fill('Тестовая тема')
  await page.getByLabel('Текст').fill('Это тестовая тема для проверки публикации')

  // Публикация
  await page.getByRole('button', { name: 'Опубликовать' }).click()

  // Проверка публикации
  // biome-ignore lint/performance/useTopLevelRegex: тесты
  await expect(page).toHaveURL(/\/[a-zA-Z0-9-]+/)
  await expect(page.getByText('Тестовая тема')).toBeVisible()
})
