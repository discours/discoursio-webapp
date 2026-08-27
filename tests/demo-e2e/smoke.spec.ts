import { expect, test } from '@playwright/test'

test('renders the public application shell with local fixture data', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
})
