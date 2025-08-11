import { expect, test } from '@playwright/test'

test.describe('Browser Installation Check', () => {
  test('@smoke should be able to launch browser and navigate', async ({ page }) => {
    // Simple test to verify browser is working
    await page.goto('data:text/html,<h1>Hello World</h1>')
    await expect(page.locator('h1')).toHaveText('Hello World')
  })

  test('should have proper user agent', async ({ page }) => {
    await page.goto(
      'data:text/html,<div id="ua"></div><script>document.getElementById("ua").textContent = navigator.userAgent</script>'
    )
    const userAgent = await page.locator('#ua').textContent()
    expect(userAgent).toBeTruthy()
    console.log('User Agent:', userAgent)
  })
})
