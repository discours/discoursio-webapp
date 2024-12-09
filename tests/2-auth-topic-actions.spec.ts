// biome-ignore lint/correctness/noNodejsModules: <explanation>
import https from 'node:https'
import { type Page, expect, test } from '@playwright/test'

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
  await page.getByRole('link', { name: 'Войти' }).click()
  console.log('Localhost server started successfully!')
  await page.close()
})
test.afterAll(async () => {
  await page.close()
})

/* TESTS section */
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  /* test.setTimeout(80000); */
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

test.describe('Topic Actions', () => {
  test('Follow topic', async ({ page }) => {
    await page.getByRole('link', { name: 'темы', exact: true }).click()
    await page
      .getByRole('link', {
        name: 'Общество Статьи о политике, экономике и обществе, об актуальных событиях, людях, мнениях. Тексты про историю и современность, про то, что происходит в России и мире'
      })
      .click()
    await page.getByRole('button', { name: 'Подписаться на тему' }).click()
    await expect(page.getByRole('button', { name: 'Отписаться от темы' })).toBeVisible()
  })
  test('Unfollow topic', async ({ page }) => {
    await page.getByRole('link', { name: 'темы', exact: true }).click()
    await page
      .getByRole('link', {
        name: 'Общество Статьи о политике, экономике и обществе, об актуальных событиях, людях, мнениях. Тексты про историю и современность, про то, что происходит в России и мире'
      })
      .click()
    await page.getByRole('button', { name: 'Отписаться от темы' }).click()
    await expect(page.getByRole('button', { name: 'Подписаться на тему' })).toBeVisible()
  })
})
