import { EditorFieldType } from '../SimpleRichEditor'

/**
 * Интерфейс для сохраняемой версии контента
 */
export interface ContentVersion {
  content: string
  timestamp: number
  source: 'server' | 'local'
}

/**
 * Очищает строку от JSON-обертки и извлекает чистый контент
 * @param content Строка с контентом, возможно в JSON формате
 * @returns Очищенный контент без JSON-обертки
 */
export const cleanupJsonContent = (
  content: string | null | undefined | Record<string, unknown>
): string => {
  if (content === null || content === undefined) return ''

  // Если это не строка, пробуем преобразовать
  if (typeof content !== 'string') {
    // Если это объект с полем content, сразу извлекаем его
    if (content && typeof content === 'object' && 'content' in content) {
      const contentField = content.content
      return cleanupJsonContent(contentField as string | null | undefined)
    }

    // Пробуем преобразовать в строку
    try {
      const jsonString = JSON.stringify(content)
      return cleanupJsonContent(jsonString)
    } catch (_e) {
      try {
        const strContent = String(content)
        return cleanupJsonContent(strContent)
      } catch (_e2) {
        return ''
      }
    }
  }

  // Убедимся, что работаем со строкой
  const contentStr = String(content)

  // Проверяем, не начинается ли строка с фрагмента HTML
  // Если это очевидно HTML, возвращаем как есть
  if (contentStr.trim().startsWith('<') && contentStr.trim().endsWith('>')) {
    return contentStr
  }

  try {
    // Проверяем, похоже ли это на JSON строку
    if (
      (contentStr.trim().startsWith('{') && contentStr.trim().endsWith('}')) ||
      (contentStr.trim().startsWith('[') && contentStr.trim().endsWith(']'))
    ) {
      // Пытаемся распарсить как JSON
      const parsed = JSON.parse(contentStr)

      // Проверяем, есть ли поле content в объекте
      if (parsed && typeof parsed === 'object') {
        if ('content' in parsed) {
          // Рекурсивно проверяем содержимое контента, так как оно тоже может быть JSON
          return cleanupJsonContent(parsed.content)
        }

        // Проверяем, может быть это массив с первым элементом, содержащим content
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          typeof parsed[0] === 'object' &&
          'content' in parsed[0]
        ) {
          return cleanupJsonContent(parsed[0].content)
        }
      }
    }
  } catch (_parseError) {
    // В случае ошибки парсинга JSON, логируем и возвращаем как есть
    console.debug('[SimpleRichEditor] Content is not valid JSON, using as is')
  }

  return contentStr
}

/**
 * Получает объект версии из локального хранилища
 * @param key Ключ для хранилища
 * @returns Объект версии контента или null если не найден
 */
export const getVersionFromStorage = (key: string): ContentVersion | null => {
  if (!key) return null

  const item = localStorage.getItem(key)
  if (!item) return null

  try {
    return JSON.parse(item) as ContentVersion
  } catch (_e) {
    // Для обратной совместимости: если в хранилище просто строка, конвертируем в формат версии
    return {
      content: item,
      timestamp: Date.now() - 86400000, // Ставим вчерашнюю дату для старых записей
      source: 'local'
    }
  }
}

/**
 * Сохраняет версию контента в локальное хранилище
 * @param key Ключ для хранилища
 * @param content Контент для сохранения
 * @param source Источник контента ('server' | 'local')
 */
export const saveVersionToStorage = (
  key: string,
  content: string | Record<string, unknown> | null | undefined,
  source: 'server' | 'local'
): void => {
  if (!key) return

  // Убедимся, что контент - строка
  const contentStr = typeof content === 'string' ? content : String(content || '')

  // Если контент пустой, удаляем из хранилища
  if (!contentStr.trim()) {
    localStorage.removeItem(key)
    return
  }

  const version: ContentVersion = {
    content: contentStr,
    timestamp: Date.now(),
    source
  }

  localStorage.setItem(key, JSON.stringify(version))
}

/**
 * Удаляет локальную версию контента из хранилища
 * @param storagePrefix Префикс ключа хранилища (например, editorId или editorId:fieldType)
 */
export const removeLocalVersion = (storagePrefix: string): void => {
  if (!storagePrefix) return

  // Удаляем локальную версию
  localStorage.removeItem(storagePrefix)

  // Удаляем сохраненные ключи для этого редактора
  const localKey = `${storagePrefix}`
  localStorage.removeItem(localKey)
}

/**
 * Формирует ключ хранилища на основе ID редактора и типа поля
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @returns Ключ для хранилища
 */
export const getStorageKey = (editorId?: string, fieldType?: EditorFieldType): string => {
  if (!editorId) return ''
  return fieldType ? `${editorId}:${fieldType}` : editorId
}

/**
 * Формирует ключ для серверной версии
 * @param storageKey Базовый ключ хранилища
 * @returns Ключ для серверной версии
 */
export const getServerVersionKey = (storageKey: string): string => {
  return `${storageKey}:server`
}

/**
 * Создает серверную версию контента
 * @param content Контент для сохранения
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @returns Объект версии контента
 */
export const createServerVersion = (
  content: string,
  editorId?: string,
  fieldType?: EditorFieldType
): ContentVersion | null => {
  if (!content) return null

  // Очищаем контент от возможных JSON-структур перед использованием
  const cleanContent = cleanupJsonContent(content)

  const serverVersion = {
    content: cleanContent,
    timestamp: Date.now(),
    source: 'server' as const
  }

  // Сохраняем серверную версию, если указан editorId
  if (editorId) {
    const storageKey = getStorageKey(editorId, fieldType)
    const serverVersionKey = getServerVersionKey(storageKey)
    saveVersionToStorage(serverVersionKey, cleanContent, 'server')
  }

  return serverVersion
}

/**
 * Загружает версии контента для редактора
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @param incomingContent Входящий контент (с сервера)
 * @returns Объект с версиями контента и настройками отображения
 */
export const loadVersions = (
  editorId?: string,
  fieldType?: EditorFieldType,
  incomingContent?: string
): {
  contentToUse: string
  serverVersion: ContentVersion | null
  localVersion: ContentVersion | null
  showLocalVersionWarning: boolean
} => {
  // Формируем ключи хранилища
  const storageKey = getStorageKey(editorId, fieldType)
  const baseKey = editorId || ''

  // Получаем версии контента
  let serverVersion: ContentVersion | null = null
  let localVersion: ContentVersion | null = null

  // Серверная версия из входящего контента
  if (incomingContent !== undefined) {
    serverVersion = createServerVersion(incomingContent, editorId, fieldType)
  }

  // Проверяем локальную версию с учетом типа поля
  if (editorId) {
    localVersion = getVersionFromStorage(storageKey)

    // Если нет версии с типом поля, проверяем базовую версию
    if (!localVersion) {
      localVersion = getVersionFromStorage(baseKey)
    }

    // Очищаем контент локальной версии от JSON-строк
    if (localVersion) {
      localVersion.content = cleanupJsonContent(localVersion.content)
    }
  }

  // Определяем, какую версию использовать
  // Приоритеты: 1. Сначала локальная (если она новее серверной) 2. Серверная 3. Пустая
  let contentToUse = ''
  let showLocalVersionWarning = false

  if (localVersion && serverVersion) {
    // Если есть обе версии, проверяем, какая новее
    if (localVersion.timestamp > serverVersion.timestamp) {
      // Локальная новее, но показываем серверную с уведомлением
      contentToUse = serverVersion.content
      showLocalVersionWarning = true
      console.log(
        `[SimpleRichEditor] Local version available from ${new Date(localVersion.timestamp).toLocaleString()}`
      )
    } else {
      // Серверная новее
      contentToUse = serverVersion.content
    }
  } else if (serverVersion) {
    // Только серверная
    contentToUse = serverVersion.content
  } else if (localVersion) {
    // Только локальная
    contentToUse = localVersion.content
    console.log(
      `[SimpleRichEditor] Using local version from ${new Date(localVersion.timestamp).toLocaleString()}`
    )
  }

  return {
    contentToUse,
    serverVersion,
    localVersion,
    showLocalVersionWarning
  }
}

/**
 * Сохраняет контент в локальное хранилище
 * @param editorId ID редактора
 * @param fieldType Тип поля
 * @param content Контент для сохранения
 * @param isEmpty Флаг пустого контента
 */
export const saveContent = (
  editorId?: string,
  fieldType?: EditorFieldType,
  content?: string,
  isEmpty = false
): void => {
  if (!editorId || !content) return

  // Формируем ключи хранилища
  const storageKey = getStorageKey(editorId, fieldType)

  if (isEmpty) {
    // Если содержимое пустое, удаляем из хранилища
    removeLocalVersion(storageKey)

    // Удаляем и из базового ключа, если используется fieldType
    if (fieldType) {
      removeLocalVersion(editorId)
    }
  } else {
    // Сохраняем как локальную версию
    saveVersionToStorage(storageKey, content, 'local')

    // Также сохраняем в базовый ключ для совместимости, если используется fieldType
    if (fieldType && storageKey !== editorId) {
      saveVersionToStorage(editorId, content, 'local')
    }
  }
}

/**
 * Очищает локальную версию контента
 * @param editorId ID редактора
 * @param fieldType Тип поля
 */
export const clearLocalVersion = (editorId?: string, fieldType?: EditorFieldType): void => {
  if (!editorId) return

  const storageKey = getStorageKey(editorId, fieldType)

  // Удаляем локальную версию из хранилища
  removeLocalVersion(storageKey)

  console.log(`[SimpleRichEditor] Cleared local version for ${storageKey}`)
}

/**
 * Загружает локальную версию контента
 * @param localVersion Локальная версия
 * @returns Очищенный контент
 */
export const loadLocalVersionContent = (localVersion: ContentVersion | null): string => {
  if (!localVersion) return ''

  // Очищаем контент от JSON-строк перед использованием
  return cleanupJsonContent(localVersion.content)
}
