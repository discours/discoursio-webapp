import { expect, test } from '@playwright/test'

test('renders the public application shell with local fixture data', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  const navigation = page.getByRole('navigation', { name: 'Основная навигация', exact: true })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Перейти на главную страницу Discours' })).toBeVisible()
  await expect(navigation.locator('#main-navigation a[href="/"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
})

test('opens the editorial guide from the public navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('button[aria-controls="main-navigation"]')).toBeEnabled()
  await page.locator('#main-navigation a[href="/guide"]').click()

  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { level: 1, name: 'How Discours works', exact: true })).toBeVisible()
  await expect(page.locator('#articleBody #how-it-works')).toBeVisible()
  await expect(page.locator('#main-navigation a[href="/guide"]')).toHaveAttribute('aria-current', 'page')
})

test('opens and closes the mobile menu after hydration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let releaseScripts: () => void = () => {}
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve
  })
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await scriptsReady
    await route.continue()
  })

  const menu = page.getByRole('button', { name: 'Открыть меню', exact: true })
  try {
    // Hold scripts until we have checked the server-rendered control.
    await page.goto('/', { waitUntil: 'commit' })
    await expect(menu).toBeVisible()
    await expect(menu).toBeDisabled()
  } finally {
    releaseScripts()
  }

  // Playwright must wait for the real control to become usable, not a timer.
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await menu.click()

  const closeMenu = page.getByRole('button', { name: 'Закрыть меню', exact: true })
  await expect(closeMenu).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#main-navigation a[href="/guide"]')).toBeVisible()
  await closeMenu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#main-navigation a[href="/guide"]')).toBeHidden()
})
