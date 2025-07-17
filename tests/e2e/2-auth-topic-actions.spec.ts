import { type Page, test } from '@playwright/test'
import { performLogin, TEST_USERS } from '../utils/auth-helpers'
import { TopicPage } from '../utils/page-objects'
import { cleanupTestEnvironment, initializeTestEnvironment } from '../utils/test-helpers'

/**
 * Тестирование действий с темами для авторизованных пользователей
 * Подписка и отписка от тем
 */

// Объявляем глобальную переменную page как nullable
let page: Page | null = null

test.beforeAll(async ({ browser }) => {
  page = await initializeTestEnvironment(browser, 'topic actions')
  test.setTimeout(150000)

  // Закрываем страницу инициализации, чтобы не было конфликтов
  if (page) {
    await page.close()
    page = null
  }
})

test.afterAll(async () => {
  await cleanupTestEnvironment(page, 'topic actions')
})

/**
 * Авторизация перед каждым тестом
 */
test.beforeEach(async ({ page }) => {
  await performLogin(page, TEST_USERS.VALID)
})

test.describe('Действия с темами', () => {
  test('Подписка на тему', async ({ page }) => {
    const topicPage = new TopicPage(page)

    await topicPage.navigateToTopics()
    await topicPage.followSocietyTopic()
    await topicPage.verifyFollowState(true) // Должна быть кнопка "Отписаться"
  })

  test('Отписка от темы', async ({ page }) => {
    const topicPage = new TopicPage(page)

    await topicPage.navigateToTopics()
    await topicPage.unfollowSocietyTopic()
    await topicPage.verifyFollowState(false) // Должна быть кнопка "Подписаться"
  })
})
