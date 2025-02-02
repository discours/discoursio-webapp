// biome-ignore lint/correctness/noNodejsModules: тесты
import https from 'node:https'
import { type Page, expect, test } from '@playwright/test'

/* Global starting test config */

const TEST_LOGIN = process.env.TEST_LOGIN
const TEST_PASSWORD = process.env.TEST_PASSWORD
let page: Page

function httpsGet(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          rejectUnauthorized: false // Ignore SSL certificate errors
        },
        (res) => {
          if (res.statusCode === 200) {
            resolve()
          } else {
            reject(new Error(`Request failed with status code ${res.statusCode}`))
          }
        }
      )
      .on('error', (error) => {
        reject(error)
      })
  })
}
async function waitForServer(url: string, timeout = 150000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await httpsGet(url)
      return true
    } catch (error) {
      // Ignore errors and try again
      console.log(`Error fetching ${url}: ${error}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Server at ${url} did not start within ${timeout} ms`)
}
test.beforeAll(async ({ browser }) => {
  console.log('Waiting for the server to start...')
  await new Promise((resolve) => setTimeout(resolve, 5000))
  const baseURL = process.env.BASE_URL || 'https://localhost:3000'
  console.log('Base URL:', baseURL)
  await waitForServer(baseURL)
  page = await browser.newPage()
  test.setTimeout(150000)
  await page.goto(baseURL)
  // biome-ignore lint/performance/useTopLevelRegex: <explanation>
  await expect(page).toHaveTitle(/Дискурс/)
  console.log('Localhost server started successfully!')
  await page.close()
})
test.afterAll(async () => {
  await page.close()
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
    await expect(page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
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
