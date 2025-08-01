import { expect, Locator, Page } from '@playwright/test'
import { baseUrl, waitForPageLoad } from './common'

/**
 * Базовая страница с общими элементами
 */
export class BasePage {
  readonly page: Page
  readonly header: Locator
  readonly footer: Locator
  readonly mainContent: Locator
  readonly loginButton: Locator
  readonly userAvatar: Locator

  constructor(page: Page) {
    this.page = page
    this.header = page.locator('header')
    this.footer = page.locator('footer')
    this.mainContent = page.locator('main')
    this.loginButton = page.getByRole('button', { name: 'Войти' })
    this.userAvatar = page.locator('.userpic, [data-testid="user-avatar"]')
  }

  async goto(path = ''): Promise<void> {
    await this.page.goto(`${baseUrl}${path}`)
    await waitForPageLoad(this.page)
  }

  async checkBasicLayout(): Promise<void> {
    await expect(this.header).toBeVisible()
    await expect(this.mainContent).toBeVisible()
    await expect(this.footer).toBeVisible()
  }

  async isLoggedIn(): Promise<boolean> {
    const loginVisible = await this.loginButton.isVisible()
    const avatarVisible = await this.userAvatar.isVisible()
    return !loginVisible && avatarVisible
  }
}

/**
 * Модальное окно авторизации
 */
export class AuthModal {
  readonly page: Page
  readonly modal: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly nameInput: Locator
  readonly loginButton: Locator
  readonly registerButton: Locator
  readonly submitButton: Locator
  readonly switchToRegister: Locator
  readonly switchToLogin: Locator
  readonly forgotPassword: Locator
  readonly validationErrors: Locator

  constructor(page: Page) {
    this.page = page
    this.modal = page.locator('.modal, .auth-modal')
    this.emailInput = page.getByPlaceholder('Почта')
    this.passwordInput = page.getByPlaceholder('Пароль')
    this.nameInput = page.locator('input[name="fullName"]')
    this.loginButton = page.getByRole('button', { name: 'Войти' })
    this.registerButton = page.getByRole('button', { name: 'Присоединиться' })
    this.submitButton = page.locator('button[type="submit"]:has-text("Войти")').first()
    this.switchToRegister = page.getByText('У меня еще нет аккаунта')
    this.switchToLogin = page.getByText('У меня есть аккаунт')
    this.forgotPassword = page.getByText('Забыли пароль?')
    this.validationErrors = page.locator('.validationError')
  }

  async openLoginForm(): Promise<void> {
    // Проверяем если модальное окно уже открыто через URL
    const currentUrl = this.page.url()
    const isAuthModalOpen = currentUrl.includes('m=auth') || currentUrl.includes('mode=login')
    console.log('[AuthModal] Модальное окно уже открыто через URL:', isAuthModalOpen)
    
    if (!isAuthModalOpen) {
      // Диагностика: проверяем что кнопка найдена
      const loginButton = this.page.locator('a:has-text("Войти"), .loginbtn a, [class*="userControlItem"] a').first()
      const buttonVisible = await loginButton.isVisible()
      const buttonText = await loginButton.textContent()
      console.log('[AuthModal] Кнопка входа найдена:', buttonVisible, 'текст:', buttonText)
      
      // Используем force click для обхода backdrop
      await loginButton.click({ force: true, timeout: 10000 })
      console.log('[AuthModal] Клик выполнен')
      
      // Ждем изменения URL
      await this.page.waitForURL('**/?m=auth**', { timeout: 10000 })
      console.log('[AuthModal] URL изменился на:', this.page.url())
    }
    
    // Ждем появления формы входа с увеличенным таймаутом
    try {
      await expect(this.emailInput).toBeVisible({ timeout: 15000 })
      console.log('[AuthModal] Форма входа найдена')
    } catch (error) {
      console.log('[AuthModal] Форма входа не найдена, проверяем альтернативные селекторы')
      
      // Проверяем альтернативные селекторы
      const emailInputs = await this.page.locator('input[type="email"], input[name="email"], input[placeholder*="почта"], input[placeholder*="email"]').count()
      const passwordInputs = await this.page.locator('input[type="password"], input[name="password"]').count()
      console.log('[AuthModal] Найдено email полей:', emailInputs, 'password полей:', passwordInputs)
      
      // Если есть email поля, используем их
      if (emailInputs > 0) {
        console.log('[AuthModal] Используем найденные email поля')
        // Используем найденные поля напрямую
        const foundEmailInput = this.page.locator('input[type="email"], input[name="email"], input[placeholder*="почта"], input[placeholder*="email"]').first()
        const foundPasswordInput = this.page.locator('input[type="password"], input[name="password"]').first()
        await expect(foundEmailInput).toBeVisible({ timeout: 5000 })
        
        // Обновляем методы для использования найденных полей
        this.fillLoginForm = async (email: string, password: string) => {
          await foundEmailInput.fill(email)
          await foundPasswordInput.fill(password)
        }
      } else {
        throw error
      }
    }
  }

  async openRegisterForm(): Promise<void> {
    await this.openLoginForm()
    
    // Переключаемся на форму регистрации
    await this.switchToRegister.click()
    await expect(this.nameInput).toBeVisible({ timeout: 10000 })
  }

  async fillLoginForm(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
  }

  async fillRegisterForm(name: string, email: string, password: string): Promise<void> {
    await this.nameInput.fill(name)
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
  }

  async submitForm(): Promise<void> {
    // Диагностика: проверяем какие кнопки есть на странице
    const submitButtons = await this.page.locator('button[type="submit"]').count()
    const loginButtons = await this.page.locator('button:has-text("Войти")').count()
    const allButtons = await this.page.locator('button').count()
    
    console.log('[AuthModal] Найдено кнопок:', {
      submitButtons,
      loginButtons,
      allButtons
    })
    
    // Выводим текст всех кнопок для диагностики
    const buttonTexts = await this.page.locator('button').allTextContents()
    console.log('[AuthModal] Тексты кнопок:', buttonTexts)
    
    // Пробуем разные селекторы
    const buttonSelectors = [
      'button[type="submit"]:has-text("Войти")',
      'button:has-text("Войти")',
      'button[type="submit"]',
      '[data-testid="login-button"]',
      '[data-testid="submit-button"]'
    ]
    
    for (const selector of buttonSelectors) {
      const count = await this.page.locator(selector).count()
      if (count > 0) {
        console.log(`[AuthModal] Найдена кнопка по селектору: ${selector}`)
        await this.page.locator(selector).first().click()
        return
      }
    }
    
    // Если ничего не найдено, используем оригинальный селектор
    await this.submitButton.click()
  }

  async expectValidationErrors(expectedCount: number): Promise<void> {
    await expect(this.validationErrors).toHaveCount(expectedCount)
  }

  async expectValidationError(message: string): Promise<void> {
    await expect(this.validationErrors).toContainText(message)
  }
}

/**
 * Навигационное меню
 */
export class Navigation {
  readonly page: Page
  readonly homeLink: Locator
  readonly feedLink: Locator
  readonly authorsLink: Locator
  readonly topicsLink: Locator
  readonly searchButton: Locator
  readonly profileMenu: Locator

  constructor(page: Page) {
    this.page = page
    this.homeLink = page.getByRole('link', { name: 'Главная' })
    this.feedLink = page.getByRole('link', { name: 'Лента' })
    this.authorsLink = page.getByRole('link', { name: 'авторы' })
    this.topicsLink = page.getByRole('link', { name: 'темы' })
    this.searchButton = page.getByRole('button', { name: 'Поиск' })
    this.profileMenu = page.locator('.userControlItemUserpic button')
  }

  async navigateToHome(): Promise<void> {
    await this.homeLink.click()
    await waitForPageLoad(this.page)
  }

  async navigateToFeed(): Promise<void> {
    await this.feedLink.click()
    await waitForPageLoad(this.page)
  }

  async navigateToAuthors(): Promise<void> {
    await this.authorsLink.click()
    await waitForPageLoad(this.page)
  }

  async navigateToTopics(): Promise<void> {
    await this.topicsLink.click()
    await waitForPageLoad(this.page)
  }

  async openSearch(): Promise<void> {
    await this.searchButton.click()
    await expect(this.page.locator('input[type="search"]')).toBeVisible()
  }

  async openProfileMenu(): Promise<void> {
    await this.profileMenu.click()
    await this.page.waitForTimeout(500)
  }
}

/**
 * Страница настроек
 */
export class SettingsPage extends BasePage {
  readonly profileTab: Locator
  readonly privacyTab: Locator
  readonly notificationsTab: Locator
  readonly saveButton: Locator
  readonly nameField: Locator
  readonly bioField: Locator

  constructor(page: Page) {
    super(page)
    this.profileTab = page.getByRole('tab', { name: 'Профиль' })
    this.privacyTab = page.getByRole('tab', { name: 'Приватность' })
    this.notificationsTab = page.getByRole('tab', { name: 'Уведомления' })
    this.saveButton = page.getByRole('button', { name: 'Сохранить' })
    this.nameField = page.locator('input[name="name"]')
    this.bioField = page.locator('textarea[name="bio"]')
  }

  async gotoSettings(): Promise<void> {
    await this.goto('/settings')
  }

  async switchToTab(tab: 'profile' | 'privacy' | 'notifications'): Promise<void> {
    const tabMap = {
      profile: this.profileTab,
      privacy: this.privacyTab,
      notifications: this.notificationsTab
    }

    const targetTab = tabMap[tab]
    if (await targetTab.isVisible()) {
      await targetTab.click()
      await this.page.waitForTimeout(1000)
    }
  }

  async updateProfile(name?: string, bio?: string): Promise<void> {
    if (name && (await this.nameField.isVisible())) {
      await this.nameField.fill(name)
    }

    if (bio && (await this.bioField.isVisible())) {
      await this.bioField.fill(bio)
    }

    if (await this.saveButton.isVisible()) {
      await this.saveButton.click()
    }
  }
}

/**
 * Страница редактирования
 */
export class EditPage extends BasePage {
  readonly titleField: Locator
  readonly contentEditor: Locator
  readonly publishButton: Locator
  readonly saveButton: Locator
  readonly typeSelector: Locator

  constructor(page: Page) {
    super(page)
    this.titleField = page.locator('input[placeholder*="заголовок"], input[type="text"]').first()
    this.contentEditor = page.locator('[contenteditable="true"], textarea').last()
    this.publishButton = page.getByRole('button', { name: 'Опубликовать' })
    this.saveButton = page.getByRole('button', { name: 'Сохранить' })
    this.typeSelector = page.locator('.type-selector')
  }

  async gotoNewPost(): Promise<void> {
    await this.goto('/edit/new')
  }

  async selectPostType(type: 'статья' | 'литература' | 'изображения' | 'музыка' | 'видео'): Promise<void> {
    const typeButton = this.page.getByRole('button', { name: type }).first()
    if (await typeButton.isVisible()) {
      await typeButton.click()
      await waitForPageLoad(this.page)
    }
  }

  async fillContent(title: string, content: string): Promise<void> {
    if (await this.titleField.isVisible()) {
      await this.titleField.fill(title)
    }

    if (await this.contentEditor.isVisible()) {
      await this.contentEditor.click()
      await this.page.keyboard.type(content)
    }
  }

  async publish(): Promise<void> {
    if (await this.publishButton.isVisible()) {
      await this.publishButton.click()
    }
  }

  async save(): Promise<void> {
    if (await this.saveButton.isVisible()) {
      await this.saveButton.click()
    }
  }
}

/**
 * Поисковая модальная страница
 */
export class SearchModal {
  readonly page: Page
  readonly modal: Locator
  readonly searchInput: Locator
  readonly results: Locator
  readonly closeButton: Locator

  constructor(page: Page) {
    this.page = page
    this.modal = page.locator('.search-modal, .modal')
    this.searchInput = page.locator('input[type="search"]')
    this.results = page.locator('.search-results, .search-item')
    this.closeButton = page.locator('.modal-close, [aria-label="Close"]')
  }

  async open(): Promise<void> {
    await this.page.getByRole('button', { name: 'Поиск' }).click()
    await expect(this.searchInput).toBeVisible()
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(1000)
  }

  async expectResults(minCount = 1): Promise<void> {
    await expect(this.results).toHaveCount(await this.results.count(), { timeout: 5000 })
    const count = await this.results.count()
    expect(count).toBeGreaterThanOrEqual(minCount)
  }

  async close(): Promise<void> {
    if (await this.closeButton.isVisible()) {
      await this.closeButton.click()
    } else {
      await this.page.keyboard.press('Escape')
    }
  }
}

/**
 * Page Object для управления темами
 */
export class TopicPage {
  readonly page: Page
  readonly topicsLink: Locator
  readonly societyTopicLink: Locator
  readonly followButton: Locator
  readonly unfollowButton: Locator

  constructor(page: Page) {
    this.page = page
    this.topicsLink = page.locator('a[href*="/topic"], a[href*="/topics"], nav a:has-text("темы"), nav a:has-text("Темы"), [data-testid="topics-link"]').first()
    this.societyTopicLink = page.locator('a:has-text("Общество"), a[href*="society"], a[href*="общество"], [data-topic="society"]').first()
    this.followButton = page.locator('button:has-text("Подписаться"), button:has-text("Follow"), [data-action="follow"]').first()
    this.unfollowButton = page.locator('button:has-text("Отписаться"), button:has-text("Unfollow"), [data-action="unfollow"]').first()
  }

  async navigateToTopics(): Promise<void> {
    // Проверяем и закрываем модальное окно если оно открыто
    const modal = this.page.locator('[role="dialog"], .modal, .c7Xfaq_backdrop')
    if (await modal.isVisible()) {
      await this.page.keyboard.press('Escape')
      await this.page.waitForTimeout(500)
    }
    await this.topicsLink.click()
  }

  async followSocietyTopic(): Promise<void> {
    await this.societyTopicLink.click()
    await this.followButton.click()
  }

  async unfollowSocietyTopic(): Promise<void> {
    await this.societyTopicLink.click()
    await this.unfollowButton.click()
  }

  async verifyFollowState(isFollowing: boolean): Promise<void> {
    const expectedButton = isFollowing ? this.unfollowButton : this.followButton
    await expect(expectedButton).toBeVisible()
  }
}

/**
 * Page Object для управления черновиками и публикациями
 */
export class DraftPage {
  readonly page: Page
  readonly profileButton: Locator
  readonly draftsLink: Locator
  readonly createPublicationLink: Locator
  readonly titleInput: Locator
  readonly contentInput: Locator
  readonly descriptionInput: Locator
  readonly saveButton: Locator
  readonly publishButton: Locator

  constructor(page: Page) {
    this.page = page
    this.profileButton = page
      .locator('.userpic, [data-testid="user-avatar"], button:has([src*="avatar"]), button[data-user-menu], .profile-button, [aria-label*="профиль"], [aria-label*="profile"]')
      .first()
    this.draftsLink = page.locator('a:has-text("Черновики"), a:has-text("Drafts"), [href*="drafts"], [data-testid="drafts-link"]').first()
    this.createPublicationLink = page
      .locator('a:has-text("Создать публикацию"), a:has-text("Create"), [href*="edit/new"], [data-testid="create-publication"]')
      .first()
    this.titleInput = page.getByLabel('Заголовок')
    this.contentInput = page.getByLabel('Текст')
    this.descriptionInput = page.getByLabel('Описание')
    this.saveButton = page.getByRole('button', { name: 'Сохранить' })
    this.publishButton = page.getByRole('button', { name: 'Опубликовать' })
  }

  async openDrafts(): Promise<void> {
    await this.profileButton.click()
    await this.draftsLink.click()
  }

  async createNewPublication(): Promise<void> {
    await this.createPublicationLink.click()
  }

  async selectPublicationType(
    type: 'статья' | 'литература' | 'изображения' | 'музыка' | 'видео'
  ): Promise<void> {
    const typeSelectors = {
      статья: 'статья',
      литература: /^литература$/,
      изображения: 'изображения',
      музыка: 'музыка',
      видео: 'видео'
    }

    await this.page.locator('li').filter({ hasText: typeSelectors[type] }).locator('img').click()
  }

  async fillBasicForm(title: string, content?: string): Promise<void> {
    await this.titleInput.fill(title)
    if (content) {
      await this.contentInput.fill(content)
    }
  }

  async fillGalleryForm(title: string, description: string, imagePath?: string): Promise<void> {
    await this.titleInput.fill(title)
    await this.descriptionInput.fill(description)
    if (imagePath) {
      await this.page.setInputFiles('input[type="file"]', imagePath)
    }
  }

  async fillAudioForm(trackName: string, artist: string, audioPath?: string): Promise<void> {
    await this.page.getByLabel('Название трека').fill(trackName)
    await this.page.getByLabel('Исполнитель').fill(artist)
    if (audioPath) {
      await this.page.setInputFiles('input[type="file"]', audioPath)
    }
  }

  async fillVideoForm(title: string, description: string, videoUrl?: string): Promise<void> {
    await this.page.getByLabel('Название видео').fill(title)
    await this.descriptionInput.fill(description)
    if (videoUrl) {
      await this.page.getByLabel('Ссылка на видео').fill(videoUrl)
    }
  }

  async saveDraft(): Promise<void> {
    await this.saveButton.click()
  }

  async publishDraft(): Promise<void> {
    await this.publishButton.click()
  }

  async verifyDraftSaved(): Promise<void> {
    await expect(this.page.getByText('Черновик сохранен')).toBeVisible()
  }

  async verifyPublished(title: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/[a-zA-Z0-9-]+/)
    await expect(this.page.getByText(title)).toBeVisible()
  }

  async verifyEditorReady(): Promise<void> {
    await expect(this.page.locator('[data-ready="true"]')).toBeVisible()
  }

  async verifyPageTitle(title: string): Promise<void> {
    await expect(this.page).toHaveTitle(title)
  }

  async verifyHeading(heading: string): Promise<void> {
    // Пробуем разные варианты поиска заголовка
    const headingSelectors = [
      this.page.getByRole('heading', { name: heading, exact: false }),
      this.page.locator(`h1:has-text("${heading}")`),
      this.page.locator(`h2:has-text("${heading}")`),
      this.page.locator(`h3:has-text("${heading}")`),
      this.page.locator(`[data-testid="page-title"]:has-text("${heading}")`),
      this.page.locator(`.page-title:has-text("${heading}")`)
    ]

    for (const selector of headingSelectors) {
      try {
        await expect(selector).toBeVisible({ timeout: 5000 })
        return // Если нашли, выходим
      } catch {
        continue // Пробуем следующий селектор
      }
    }

    // Если ничего не нашли, выводим ошибку
    throw new Error(`Заголовок "${heading}" не найден на странице`)
  }

  async verifyEditUrl(): Promise<void> {
    await expect(this.page).toHaveURL(/\/edit\/[a-zA-Z0-9-]+/)
  }
}

/**
 * Page Object для проверки страниц сайта
 */
export class SitePage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async navigateToPage(path: string): Promise<void> {
    await this.page.goto(path)
  }

  async verifyPageTitle(expectedTitle: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(expectedTitle)
  }

  async verifyPageLoaded(): Promise<void> {
    await expect(this.page).toHaveTitle(/Дискурс/)
  }
}
