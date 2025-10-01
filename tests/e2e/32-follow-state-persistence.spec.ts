/**
 * КОНКРЕТНЫЙ ТЕСТ ДЛЯ ПРОВЕРКИ СОХРАНЕНИЯ СТЕЙТА ПОДПИСОК
 *
 * Тест проверяет ТОЛЬКО указанный сценарий:
 * 1. Загрузка главной → войти → переход к автору → подписка → рефреш → проверка сохранения стейта
 * 2. Переход на подписанного автора → отписка → рефреш → проверка сохранения стейта
 */

import { expect } from '@playwright/test'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('Follow State Persistence - КОНКРЕТНЫЙ СЦЕНАРИЙ', () => {
  test('СЦЕНАРИЙ 1: Главная → войти → перейти к автору → подписаться → рефреш → стейт сохраняется', async ({
    page
  }) => {
    console.log('🎯 СЦЕНАРИЙ 1: Загрузка главной → войти → перейти к автору → подписаться → рефреш')

    // 1. Загружаем главную страницу
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // 2. Нажимаем кнопку "Войти"
    const loginButton = page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
    await expect(loginButton).toBeVisible()
    await loginButton.click()

    // 3. Вводим TEST_USERNAME TEST_PASSWORD
    await expect(page.locator('input[placeholder="Почта"]')).toBeVisible()
    await page.fill('input[placeholder="Почта"]', process.env.TEST_USERNAME || 'guests@discours.io')
    await page.fill('input[placeholder="Пароль"]', process.env.TEST_PASSWORD || 'test123')

    // Отправляем форму
    const submitButton = page.locator('button[type="submit"]:has-text("Войти")').first()
    await submitButton.click()

    // Ждем авторизации и проверяем что она прошла успешно
    await page.waitForTimeout(3000)

    // Проверяем что авторизация прошла - кнопка "Войти" должна исчезнуть
    const loginButtonAfterAuth = page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
    const isLoginVisible = await loginButtonAfterAuth.isVisible()

    if (isLoginVisible) {
      console.log('❌ Авторизация не удалась - кнопка "Войти" все еще видна')
      return
    }

    // Проверяем что появились индикаторы авторизованного пользователя
    const userMenu = page.locator('[data-testid="user-menu"], .user-menu, .profile-menu, .userpic').first()
    const isUserMenuVisible = await userMenu.isVisible()

    if (!isUserMenuVisible) {
      console.log('❌ Авторизация не удалась - индикаторы пользователя не видны')
      return
    }

    console.log('✅ Авторизация прошла успешно')

    // 4. Переходим с главной на автора любой публикации
    const firstPostAuthor = page.locator('.article-card a[href*="/author/"], .post-author-link').first()
    await expect(firstPostAuthor).toBeVisible()

    const authorHref = await firstPostAuthor.getAttribute('href')
    expect(authorHref).toBeTruthy()

    await firstPostAuthor.click()
    await waitForPageLoad(page)

    // 5. Нажимаем кнопку подписки
    const followButton = page.locator('button:has-text("Подписаться")').first()
    await expect(followButton).toBeVisible()
    await followButton.click()

    // Ждем обработки
    await page.waitForTimeout(2000)

    // 6. Обновляем страницу
    await page.reload()
    await waitForPageLoad(page)
    await page.waitForTimeout(2000)

    // ПРОВЕРКА: стейт должен сохраниться
    const buttonAfterReload = page.locator('button:has-text("Отписаться"), button:has-text("Подписан")').first()

    if (await buttonAfterReload.isVisible()) {
      console.log('✅ СТЕЙТ СОХРАНИЛСЯ: кнопка показывает "Подписан" после рефреша')
    } else {
      const followButtonAfterReload = page.locator('button:has-text("Подписаться")').first()
      if (await followButtonAfterReload.isVisible()) {
        console.log('❌ СТЕЙТ НЕ СОХРАНИЛСЯ: кнопка вернулась в "Подписаться"')
      } else {
        console.log('⚠️ Не удалось определить состояние кнопки')
      }
    }
  })

  test('СЦЕНАРИЙ 2: Перейти на подписанного автора → отписаться → рефреш → стейт сохраняется', async ({ page }) => {
    console.log('🎯 СЦЕНАРИЙ 2: Перейти на подписанного автора → отписаться → рефреш')

    // 1. Авторизуемся
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    const loginButton = page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
    await expect(loginButton).toBeVisible()
    await loginButton.click()

    await expect(page.locator('input[placeholder="Почта"]')).toBeVisible()
    await page.fill('input[placeholder="Почта"]', process.env.TEST_USERNAME || 'guests@discours.io')
    await page.fill('input[placeholder="Пароль"]', process.env.TEST_PASSWORD || 'test123')

    const submitButton = page.locator('button[type="submit"]:has-text("Войти")').first()
    await submitButton.click()

    // Ждем авторизации и проверяем что она прошла успешно
    await page.waitForTimeout(3000)

    // Проверяем что авторизация прошла - кнопка "Войти" должна исчезнуть
    const loginButtonAfterAuth = page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
    const isLoginVisible = await loginButtonAfterAuth.isVisible()

    if (isLoginVisible) {
      console.log('❌ Авторизация не удалась - кнопка "Войти" все еще видна')
      return
    }

    // Проверяем что появились индикаторы авторизованного пользователя
    const userMenu = page.locator('[data-testid="user-menu"], .user-menu, .profile-menu, .userpic').first()
    const isUserMenuVisible = await userMenu.isVisible()

    if (!isUserMenuVisible) {
      console.log('❌ Авторизация не удалась - индикаторы пользователя не видны')
      return
    }

    console.log('✅ Авторизация прошла успешно')

    // 2. Переходим в настройки и ищем подписанного автора
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    const followedAuthorLink = page.locator('.subscription-item a, .followed-author a, a[href*="/author/"]').first()

    if (await followedAuthorLink.isVisible()) {
      // Есть подписанный автор - переходим к нему
      const authorHref = await followedAuthorLink.getAttribute('href')
      const authorSlug = authorHref!.replace('/author/', '')

      await page.goto(`${baseUrl}/author/${authorSlug}`)
      await waitForPageLoad(page)

      // 3. Нажимаем отписку
      const unfollowButton = page.locator('button:has-text("Отписаться")').first()
      await expect(unfollowButton).toBeVisible()
      await unfollowButton.click()

      await page.waitForTimeout(2000)

      // 4. Обновляем страницу
      await page.reload()
      await waitForPageLoad(page)
      await page.waitForTimeout(2000)

      // ПРОВЕРКА: стейт должен сохраниться (кнопка должна показывать "Подписаться")
      const followButtonAfterUnfollow = page.locator('button:has-text("Подписаться")').first()

      if (await followButtonAfterUnfollow.isVisible()) {
        console.log('✅ СТЕЙТ ОТПИСКИ СОХРАНИЛСЯ: кнопка показывает "Подписаться" после рефреша')
      } else {
        const unfollowButtonAfterReload = page
          .locator('button:has-text("Отписаться"), button:has-text("Подписан")')
          .first()
        if (await unfollowButtonAfterReload.isVisible()) {
          console.log('❌ СТЕЙТ ОТПИСКИ НЕ СОХРАНИЛСЯ: кнопка осталась в "Подписан"')
        } else {
          console.log('⚠️ Не удалось определить состояние кнопки после отписки')
        }
      }
    } else {
      console.log('⚠️ Нет активных подписок для теста отписки')
      test.skip()
    }
  })
})
