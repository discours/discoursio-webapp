import { expect, test } from '@playwright/test'

test.describe('Solid Async Migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', {
      timeout: 10000,
      waitUntil: 'networkidle'
    })
  })

  test('should render home page', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('h1')).toContainText('Discours')
  })

  test('should render topic page', async ({ page }) => {
    await page.goto('http://localhost:3000/topics', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const topicsList = page.locator('.topics-list')
    await expect(topicsList).toBeVisible({ timeout: 15000 })

    const firstTopic = topicsList.locator('.topic-item').first()
    await expect(firstTopic).toBeVisible()
    await firstTopic.click()

    await expect(page.locator('article')).toBeVisible({ timeout: 15000 })
  })

  test('should render search results', async ({ page }) => {
    await page.goto('http://localhost:3000/search', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('test')
    await page.waitForTimeout(1000)

    const results = page.locator('.search-item')
    await expect(results).toBeVisible({ timeout: 15000 })
  })
})
