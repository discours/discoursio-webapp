// biome-ignore lint/correctness/noNodejsModules: <explanation>
import https from 'node:https'
import { type Page, expect, test } from '@playwright/test'

/* Global starting test config */

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
async function waitForServer(url: string, timeout = 300000, retries = 3) {
  const start = Date.now()
  let attemptCount = 0

  while (attemptCount < retries) {
    try {
      while (Date.now() - start < timeout) {
        try {
          await httpsGet(url)
          return true
        } catch (error) {
          if ((error as { code: string }).code === 'ECONNREFUSED') {
            console.log(`Server not ready, retrying... (Attempt ${attemptCount + 1}/${retries})`)
            await new Promise((resolve) => setTimeout(resolve, 2000))
            continue
          }
          throw error
        }
      }
    } catch (error) {
      console.error(`Attempt ${attemptCount + 1} failed:`, error)
      attemptCount++
      if (attemptCount === retries) {
        throw new Error(`Server at ${url} did not start after ${retries} attempts`)
      }
      await new Promise((resolve) => setTimeout(resolve, 2 ** attemptCount * 1000))
    }
  }
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
})
test.afterAll(async () => {
  await page.close()
})

/* TESTS section */

const pagesTitles = {
  '/': /Дискурс/,
  '/feed': /Дискурс :: Лента/,
  '/support': /Поддержите Дискурс/,
  '/author': /Дискурс :: Все авторы/,
  '/topic': /Дискурс :: Темы и сюжеты/
}
test.describe('Pages open', () => {
  Object.keys(pagesTitles).forEach((res: string) => {
    test(`Open Page ${res}`, async ({ page }) => {
      await page.goto(`${res}`)
      const title = pagesTitles[res as keyof typeof pagesTitles] || '00000000000'
      await expect(page).toHaveTitle(title)
    })
  })
})
