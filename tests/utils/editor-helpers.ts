/**
 * Общие хелперы для работы с редактором в E2E тестах
 */

import type { Locator, Page } from '@playwright/test'

export interface EditorHelpers {
  // Селекторы
  getEditorSelectors(): string[]
  getTitleSelectors(): string[]
  getPublishSelectors(): string[]

  // Навигация
  goToEditor(): Promise<void>
  goToNewPost(type?: 'Article' | 'Image' | 'Audio' | 'Video'): Promise<void>

  // Поиск элементов
  findEditor(): Promise<Locator | null>
  findTitleInput(): Promise<Locator | null>
  findPublishButton(): Promise<Locator | null>

  // Действия с редактором
  fillTitle(title: string): Promise<void>
  fillContent(content: string): Promise<void>
  formatText(format: 'bold' | 'italic' | 'underline'): Promise<void>

  // Загрузка файлов
  uploadFile(filePath: string): Promise<void>
  dragAndDropFile(fileName: string, content: Buffer, mimeType: string): Promise<void>

  // Публикация
  publishDraft(): Promise<void>
  addTopic(topicName: string): Promise<void>
  setMainTopic(topicName: string): Promise<void>
}

export class EditorTestHelpers implements EditorHelpers {
  constructor(private page: Page) {}

  getEditorSelectors(): string[] {
    return [
      '[contenteditable="true"]',
      '[data-field-type="body"] [contenteditable="true"]',
      '.editor',
      '.rich-editor',
      '.simple-rich-editor',
      'textarea',
      '[data-testid="editor"]',
      '.ProseMirror',
      '.tiptap'
    ]
  }

  getTitleSelectors(): string[] {
    return [
      'textarea[placeholder="Заголовок"]',
      'textarea[placeholder="Header"]',
      '.titleInput',
      '.title-input',
      'textarea[class*="titleInput"]',
      'textarea[class*="title"]',
      '.draft-title',
      'h1[contenteditable="true"]',
      'textarea'
    ]
  }

  getPublishSelectors(): string[] {
    return [
      'button:has-text("Опубликовать")',
      'button:has-text("Publish")',
      'button:has-text("Сохранить")',
      '.publish-button',
      '.save-button'
    ]
  }

  async goToEditor(): Promise<void> {
    await this.page.goto('/edit')
    await this.page.waitForTimeout(3000)
  }

  async goToNewPost(type: 'Article' | 'Image' | 'Audio' | 'Video' = 'Article'): Promise<void> {
    console.log(`[EditorHelpers] Переходим к созданию ${type}...`)

    await this.page.goto('/edit/new')
    await this.page.waitForTimeout(3000)

    // Выбираем тип публикации
    const typeMap = {
      Article: 'Статья',
      Image: 'Изображение',
      Audio: 'Аудио',
      Video: 'Видео'
    }

    const typeOption = this.page.locator('li').filter({ hasText: typeMap[type] }).first()
    const typeVisible = await typeOption.isVisible().catch(() => false)

    if (typeVisible) {
      await typeOption.click()
      console.log(`[EditorHelpers] ✅ Выбран тип "${typeMap[type]}"`)
      await this.page.waitForTimeout(5000)
    } else {
      throw new Error(`Тип публикации "${typeMap[type]}" не найден`)
    }
  }

  async findEditor(): Promise<Locator | null> {
    const selectors = this.getEditorSelectors()

    for (const selector of selectors) {
      const element = this.page.locator(selector).first()
      const isVisible = await element.isVisible().catch(() => false)

      if (isVisible) {
        console.log(`[EditorHelpers] ✅ Редактор найден: ${selector}`)
        return element
      }
    }

    console.log('[EditorHelpers] ❌ Редактор не найден')
    return null
  }

  async findTitleInput(): Promise<Locator | null> {
    const selectors = this.getTitleSelectors()

    for (const selector of selectors) {
      const element = this.page.locator(selector).first()
      const isVisible = await element.isVisible().catch(() => false)

      if (isVisible) {
        console.log(`[EditorHelpers] ✅ Поле заголовка найдено: ${selector}`)
        return element
      }
    }

    console.log('[EditorHelpers] ❌ Поле заголовка не найдено')
    return null
  }

  async findPublishButton(): Promise<Locator | null> {
    const selectors = this.getPublishSelectors()

    for (const selector of selectors) {
      const element = this.page.locator(selector).first()
      const isVisible = await element.isVisible().catch(() => false)

      if (isVisible) {
        console.log(`[EditorHelpers] ✅ Кнопка публикации найдена: ${selector}`)
        return element
      }
    }

    console.log('[EditorHelpers] ❌ Кнопка публикации не найдена')
    return null
  }

  async fillTitle(title: string): Promise<void> {
    const titleInput = await this.findTitleInput()
    if (!titleInput) {
      throw new Error('Поле заголовка не найдено')
    }

    await titleInput.click()
    await titleInput.fill(title)
    console.log(`[EditorHelpers] ✅ Заголовок введен: "${title}"`)
  }

  async fillContent(content: string): Promise<void> {
    const editor = await this.findEditor()
    if (!editor) {
      throw new Error('Редактор не найден')
    }

    await editor.click()
    await editor.fill(content)
    console.log(`[EditorHelpers] ✅ Контент введен: "${content.substring(0, 50)}..."`)
  }

  async formatText(format: 'bold' | 'italic' | 'underline'): Promise<void> {
    const shortcuts = {
      bold: 'Control+b',
      italic: 'Control+i',
      underline: 'Control+u'
    }

    await this.page.keyboard.press(shortcuts[format])
    console.log(`[EditorHelpers] ✅ Применено форматирование: ${format}`)
  }

  async uploadFile(filePath: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(filePath)
    console.log(`[EditorHelpers] ✅ Файл загружен: ${filePath}`)
  }

  async dragAndDropFile(fileName: string, content: Buffer, mimeType: string): Promise<void> {
    const editor = await this.findEditor()
    if (!editor) {
      throw new Error('Редактор не найден для drag & drop')
    }

    // Создаем DataTransfer с файлом
    const dataTransfer = await this.page.evaluateHandle(
      ({ content, fileName, mimeType }) => {
        const dt = new DataTransfer()
        const file = new File([new Uint8Array(content)], fileName, { type: mimeType })
        dt.items.add(file)
        return dt
      },
      { content: Array.from(content), fileName, mimeType }
    )

    // Симулируем drag & drop
    await editor.dispatchEvent('drop', { dataTransfer })
    console.log(`[EditorHelpers] ✅ Drag & drop выполнен: ${fileName}`)
  }

  async publishDraft(): Promise<void> {
    const publishButton = await this.findPublishButton()
    if (!publishButton) {
      throw new Error('Кнопка публикации не найдена')
    }

    await publishButton.click()
    console.log('[EditorHelpers] ✅ Кликнули на кнопку публикации')

    // Ждем перехода к настройкам
    await this.page.waitForTimeout(3000)
  }

  async addTopic(topicName: string): Promise<void> {
    console.log(`[EditorHelpers] 🏷️ Добавляем тему: "${topicName}"`)

    // Ищем поле поиска тем
    const searchSelectors = [
      'input[placeholder*="Search topics"]',
      'input[placeholder*="Поиск тем"]',
      '.searchInput',
      '.topic-search',
      'input[class*="search"]'
    ]

    let searchInput = null
    for (const selector of searchSelectors) {
      const element = this.page.locator(selector).first()
      const isVisible = await element.isVisible().catch(() => false)

      if (isVisible) {
        searchInput = element
        console.log(`[EditorHelpers] ✅ Поле поиска тем найдено: ${selector}`)
        break
      }
    }

    if (!searchInput) {
      throw new Error('Поле поиска тем не найдено')
    }

    // Вводим название темы
    await searchInput.fill(topicName)
    await this.page.waitForTimeout(1000)

    // Выбираем первую найденную тему
    const topicPills = await this.page.locator('[class*="topicPill"]').all()
    if (topicPills.length > 0) {
      const firstPill = topicPills[0]
      const isVisible = await firstPill.isVisible().catch(() => false)

      if (isVisible) {
        await firstPill.click()
        console.log(`[EditorHelpers] ✅ Тема "${topicName}" добавлена`)
        await this.page.waitForTimeout(1000)
      }
    } else {
      throw new Error(`Тема "${topicName}" не найдена в результатах поиска`)
    }
  }

  async setMainTopic(topicName: string): Promise<void> {
    console.log(`[EditorHelpers] 🔄 Устанавливаем главную тему: "${topicName}"`)

    // Ищем выбранные темы
    const selectedTopics = await this.page.locator('.selectedTopic, [class*="selectedTopic"]').all()

    for (const topic of selectedTopics) {
      const text = await topic.textContent().catch(() => '')
      if (text?.includes(topicName)) {
        await topic.click()
        console.log(`[EditorHelpers] ✅ Тема "${topicName}" установлена как главная`)
        await this.page.waitForTimeout(1000)
        return
      }
    }

    throw new Error(`Выбранная тема "${topicName}" не найдена для установки как главная`)
  }
}

// Фабричная функция для создания хелперов
export function createEditorHelpers(page: Page): EditorHelpers {
  return new EditorTestHelpers(page)
}
