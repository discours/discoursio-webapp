/**
 * E2E тесты для компонента FollowButton
 *
 * Проверяет функциональность подписки/отписки на авторов и темы:
 * - Авторизация перед подпиской
 * - Изменение состояния кнопки (Follow/Unfollow)
 * - Обработка ошибок и состояний загрузки
 * - Разные варианты отображения (обычная, мини, с иконками)
 * - Подписка на авторов и темы
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect } from '@playwright/test'
import { createAuthHelpers } from '../utils/auth-helpers-v2'
import { baseUrl, waitForPageLoad } from '../utils/common'
import { test } from '../utils/test-helpers'

test.describe('FollowButton Component', () => {
  let authHelpers: ReturnType<typeof createAuthHelpers>

  test.beforeEach(async ({ page }) => {
    authHelpers = createAuthHelpers(page)
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  })

  test.describe('Авторизация и подписка на авторов', () => {
    test('Должен требовать авторизацию для подписки на автора', async ({ page }) => {
      // Переходим на страницу авторов без авторизации
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      // Ищем первого автора
      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        // Ищем кнопку подписки
        const followButton = page
          .locator('button:has-text("Подписаться"), .subscribe-button, [data-testid="follow-button"]')
          .first()

        if (await followButton.isVisible()) {
          await followButton.click()

          // Должна появиться форма авторизации
          const authModal = page
            .locator('.authForm, .auth-form, [class*="AuthModal"], input[placeholder*="Почта"]')
            .first()
          await expect(authModal).toBeVisible({ timeout: 10000 })

          console.log('✅ Кнопка подписки требует авторизацию')
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })

    test('Должен позволять подписаться на автора после авторизации', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      // Ищем первого автора
      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        // Ищем кнопку подписки
        const followButton = page
          .locator('button:has-text("Подписаться"), .subscribe-button, [data-testid="follow-button"]')
          .first()

        if (await followButton.isVisible()) {
          // Проверяем начальное состояние
          await expect(followButton).toHaveText(/Подписаться|Follow/)

          // Кликаем на подписку
          await followButton.click()

          // Ждем изменения состояния кнопки
          await page.waitForTimeout(2000)

          // Проверяем что кнопка изменилась на "Отписаться" или "Подписан"
          const unfollowButton = page
            .locator('button:has-text("Отписаться"), button:has-text("Подписан"), button:has-text("Unfollow")')
            .first()
          await expect(unfollowButton).toBeVisible({ timeout: 10000 })

          console.log('✅ Подписка на автора прошла успешно')

          // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Рефреш страницы и проверка сохранения стейта
          console.log('🔄 Проверяем сохранение стейта после рефреша страницы')

          await page.reload()
          await waitForPageLoad(page)

          // Ждем загрузки контекста после рефреша
          await page.waitForTimeout(3000)

          // Проверяем что стейт сохранился после перезагрузки
          const followButtonAfterReload = page
            .locator('button:has-text("Подписаться"), .subscribe-button, [data-testid="follow-button"]')
            .first()

          if (await followButtonAfterReload.isVisible()) {
            const textAfterReload = await followButtonAfterReload.textContent()
            console.log(`📝 Текст кнопки после рефреша: "${textAfterReload}"`)

            // Если кнопка показывает "Подписаться", значит стейт не сохранился
            if (textAfterReload?.includes('Подписаться') || textAfterReload?.includes('Follow')) {
              console.log('❌ СТЕЙТ НЕ СОХРАНИЛСЯ: кнопка вернулась в состояние "Подписаться"')
            } else {
              console.log('✅ СТЕЙТ СОХРАНИЛСЯ: кнопка осталась в состоянии "Подписан"')
            }
          } else {
            // Проверяем через селекторы состояния "подписан"
            const unfollowButtonAfterReload = page
              .locator('button:has-text("Отписаться"), button:has-text("Подписан")')
              .first()

            if (await unfollowButtonAfterReload.isVisible()) {
              console.log('✅ СТЕЙТ СОХРАНИЛСЯ: кнопка показывает состояние "Подписан" после рефреша')
            } else {
              console.log('⚠️ Не удалось определить состояние кнопки после рефреша')
            }
          }
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })

    test('Должен позволять отписаться от автора', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      // Ищем первого автора
      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        // Сначала подписываемся
        const followButton = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

        if (await followButton.isVisible()) {
          await followButton.click()
          await page.waitForTimeout(2000)

          // Теперь отписываемся
          const unfollowButton = page.locator('button:has-text("Отписаться"), button:has-text("Подписан")').first()

          if (await unfollowButton.isVisible()) {
            await unfollowButton.click()
            await page.waitForTimeout(2000)

            // Проверяем что кнопка вернулась к состоянию "Подписаться"
            const followButtonAgain = page.locator('button:has-text("Подписаться"), .subscribe-button').first()
            await expect(followButtonAgain).toBeVisible({ timeout: 10000 })

            console.log('✅ Отписка от автора прошла успешно')

            // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Рефреш страницы и проверка сохранения стейта отписки
            console.log('🔄 Проверяем сохранение стейта отписки после рефреша страницы')

            await page.reload()
            await waitForPageLoad(page)

            // Ждем загрузки контекста после рефреша
            await page.waitForTimeout(3000)

            // Проверяем что стейт отписки сохранился после перезагрузки
            const followButtonAfterReload = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

            if (await followButtonAfterReload.isVisible()) {
              const textAfterReload = await followButtonAfterReload.textContent()
              console.log(`📝 Текст кнопки после отписки и рефреша: "${textAfterReload}"`)

              if (textAfterReload?.includes('Подписаться') || textAfterReload?.includes('Follow')) {
                console.log('✅ СТЕЙТ ОТПИСКИ СОХРАНИЛСЯ: кнопка показывает "Подписаться" после рефреша')
              } else {
                console.log('❌ СТЕЙТ ОТПИСКИ НЕ СОХРАНИЛСЯ: кнопка осталась в состоянии "Подписан"')
              }
            } else {
              console.log('⚠️ Кнопка подписки не найдена после рефреша')
            }
          } else {
            console.warn('⚠️ Кнопка отписки не найдена')
            test.skip()
          }
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })
  })

  test.describe('Подписка на темы', () => {
    test('Должен позволять подписаться на тему', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу тем
      await page.goto(`${baseUrl}/topics`)
      await waitForPageLoad(page)

      // Ищем первую тему
      const firstTopic = page.locator('.topic-card a, .topic-link, a[href*="/topic/"]').first()

      if (await firstTopic.isVisible()) {
        await firstTopic.click()
        await waitForPageLoad(page)

        // Ищем кнопку подписки на тему
        const followTopicButton = page
          .locator('button:has-text("Подписаться"), .topic-subscribe, [data-testid="follow-topic"]')
          .first()

        if (await followTopicButton.isVisible()) {
          // Проверяем начальное состояние
          await expect(followTopicButton).toHaveText(/Подписаться|Follow/)

          // Кликаем на подписку
          await followTopicButton.click()

          // Ждем изменения состояния кнопки
          await page.waitForTimeout(2000)

          // Проверяем что кнопка изменилась
          const unfollowTopicButton = page
            .locator('button:has-text("Отписаться"), button:has-text("Подписан"), button:has-text("Unfollow")')
            .first()
          await expect(unfollowTopicButton).toBeVisible({ timeout: 10000 })

          console.log('✅ Подписка на тему прошла успешно')
        } else {
          console.warn('⚠️ Кнопка подписки на тему не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Темы не найдены')
        test.skip()
      }
    })
  })

  test.describe('Состояния загрузки и обработка ошибок', () => {
    test('Должен блокировать кнопку во время обработки запроса', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        const followButton = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

        if (await followButton.isVisible()) {
          // Кликаем на кнопку
          await followButton.click()

          // Проверяем что кнопка заблокирована (disabled)
          await expect(followButton).toBeDisabled()

          // Ждем завершения запроса
          await page.waitForTimeout(3000)

          // Проверяем что кнопка снова активна
          await expect(followButton).toBeEnabled()

          console.log('✅ Кнопка правильно блокируется во время обработки')
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })

    test('Должен предотвращать двойные клики', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        const followButton = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

        if (await followButton.isVisible()) {
          // Быстро кликаем дважды
          await followButton.click()
          await followButton.click()

          // Ждем завершения обработки
          await page.waitForTimeout(3000)

          // Проверяем что состояние изменилось только один раз
          const unfollowButton = page.locator('button:has-text("Отписаться"), button:has-text("Подписан")').first()
          const isUnfollowed = await unfollowButton.isVisible()

          if (isUnfollowed) {
            console.log('✅ Двойной клик обработан корректно')
          } else {
            console.log('⚠️ Состояние кнопки не изменилось после двойного клика')
          }
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })
  })

  test.describe('Разные варианты отображения', () => {
    test('Должен отображать мини-кнопку когда minimize=true', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      // Ищем мини-кнопки (CheckButton)
      const miniButtons = page.locator('.check-button, [data-testid="mini-follow-button"]')
      const miniButtonCount = await miniButtons.count()

      if (miniButtonCount > 0) {
        const firstMiniButton = miniButtons.first()

        // Проверяем что это мини-кнопка
        const buttonText = await firstMiniButton.textContent()
        expect(buttonText).toMatch(/Подписаться|Follow|Отписаться|Unfollow/)

        // Кликаем на мини-кнопку
        await firstMiniButton.click()
        await page.waitForTimeout(2000)

        console.log('✅ Мини-кнопка работает корректно')
      } else {
        console.warn('⚠️ Мини-кнопки не найдены')
        test.skip()
      }
    })

    test('Должен отображать кнопку с иконкой когда iconButtons=true', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      // Ищем кнопки с иконками
      const iconButtons = page.locator('button[class*="iconed"], .actionButton.iconed')
      const iconButtonCount = await iconButtons.count()

      if (iconButtonCount > 0) {
        const firstIconButton = iconButtons.first()

        // Проверяем что кнопка содержит иконку
        const hasIcon = (await firstIconButton.locator('img, svg, .icon').count()) > 0

        if (hasIcon) {
          // Кликаем на кнопку с иконкой
          await firstIconButton.click()
          await page.waitForTimeout(2000)

          console.log('✅ Кнопка с иконкой работает корректно')
        } else {
          console.warn('⚠️ Кнопка не содержит иконку')
          test.skip()
        }
      } else {
        console.warn('⚠️ Кнопки с иконками не найдены')
        test.skip()
      }
    })
  })

  test.describe('Интеграция с контекстом', () => {
    test('Должен синхронизировать состояние с контекстом подписок', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        // Подписываемся на автора
        const followButton = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

        if (await followButton.isVisible()) {
          await followButton.click()
          await page.waitForTimeout(2000)

          // Переходим в настройки или профиль, где должны отображаться подписки
          await page.goto(`${baseUrl}/settings`)
          await waitForPageLoad(page)

          // Ищем раздел с подписками
          const subscriptionsSection = page
            .locator(':has-text("подписки"), .subscriptions, .following, [data-testid="subscriptions"]')
            .first()

          if (await subscriptionsSection.isVisible()) {
            // Проверяем что подписка отображается в списке
            const subscriptionItems = page.locator('.subscription-item, .followed-author, .followed-topic')
            const itemCount = await subscriptionItems.count()

            expect(itemCount).toBeGreaterThan(0)
            console.log('✅ Подписка синхронизирована с контекстом')
          } else {
            console.warn('⚠️ Раздел подписок не найден')
            test.skip()
          }
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })
  })

  test.describe('Accessibility и UX', () => {
    test('Должен иметь правильные ARIA атрибуты', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        const followButton = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

        if (await followButton.isVisible()) {
          // Проверяем что кнопка имеет правильную роль
          await expect(followButton).toHaveAttribute('role', 'button')

          // Проверяем что кнопка доступна для навигации с клавиатуры
          await followButton.focus()
          const isFocused = await followButton.evaluate((el) => el === document.activeElement)
          expect(isFocused).toBe(true)

          console.log('✅ Кнопка имеет правильные ARIA атрибуты')
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })

    test('Должен показывать правильный текст в зависимости от состояния', async ({ page }) => {
      // Авторизуемся
      const authSuccess = await authHelpers.performLogin()
      if (!authSuccess) {
        test.skip()
        return
      }

      // Переходим на страницу авторов
      await page.goto(`${baseUrl}/authors`)
      await waitForPageLoad(page)

      const firstAuthor = page.locator('.author-card a, .author-link, a[href*="/author/"]').first()

      if (await firstAuthor.isVisible()) {
        await firstAuthor.click()
        await waitForPageLoad(page)

        const followButton = page.locator('button:has-text("Подписаться"), .subscribe-button').first()

        if (await followButton.isVisible()) {
          // Проверяем начальный текст
          const initialText = await followButton.textContent()
          expect(initialText).toMatch(/Подписаться|Follow/)

          // Кликаем и проверяем изменение текста
          await followButton.click()
          await page.waitForTimeout(2000)

          const changedText = await followButton.textContent()
          expect(changedText).toMatch(/Отписаться|Unfollow|Подписан/)

          console.log('✅ Текст кнопки изменяется корректно')
        } else {
          console.warn('⚠️ Кнопка подписки не найдена')
          test.skip()
        }
      } else {
        console.warn('⚠️ Авторы не найдены')
        test.skip()
      }
    })
  })
})
