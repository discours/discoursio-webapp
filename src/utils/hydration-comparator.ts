// utils/hydration-comparator.ts

/**
 * Безопасная проверка валидности DOM узла
 */
const isValidDOMNode = (node: Node | null): node is Node => {
  if (!node) return false

  try {
    // Проверяем что узел существует в DOM
    return node.nodeType !== undefined && node.parentNode !== undefined && document.contains(node)
  } catch {
    return false
  }
}

/**
 * Безопасная проверка родительского узла
 */
const hasValidParent = (node: Node): boolean => {
  try {
    const parent = node.parentNode
    return parent !== null && isValidDOMNode(parent) && document.contains(parent)
  } catch {
    return false
  }
}

/**
 * Проверка проблемных элементов которые могут вызывать ошибки гидрации
 */
const detectHydrationIssues = (container: Element): string[] => {
  const issues: string[] = []

  try {
    // Проверяем наличие потенциально проблемных элементов
    const loadingElements = container.querySelectorAll(
      '[class*="loading"], [class*="spinner"], [class*="skeleton"]'
    )
    if (loadingElements.length > 0) {
      issues.push(`Найдены элементы загрузки: ${loadingElements.length}`)
    }

    // Проверяем наличие пустых элементов которые могли бы быть заполнены на клиенте
    const emptyLists = container.querySelectorAll('ul:empty, ol:empty')
    if (emptyLists.length > 0) {
      issues.push(`Найдены пустые списки: ${emptyLists.length}`)
    }

    // Проверяем наличие элементов с нестабильными атрибутами
    const elementsWithHydrationIds = container.querySelectorAll('[data-hk]')
    if (elementsWithHydrationIds.length === 0) {
      issues.push('Отсутствуют hydration ID (data-hk атрибуты)')
    }

    // Проверяем наличие элементов вне DOM дерева
    const orphanedNodes = Array.from(container.querySelectorAll('*')).filter((el) => !document.contains(el))
    if (orphanedNodes.length > 0) {
      issues.push(`Найдены узлы вне DOM: ${orphanedNodes.length}`)
    }

    // Проверяем наличие дублирующихся ID
    const allIds = Array.from(container.querySelectorAll('[id]')).map((el) => el.id)
    const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      issues.push(`Дублирующиеся ID: ${duplicateIds.join(', ')}`)
    }
  } catch (error) {
    issues.push(`Ошибка при проверке DOM: ${error}`)
  }

  return issues
}

export const compareServerClientDOM = () => {
  if (typeof window === 'undefined') return // Добавляем функцию в window для тестов
  ;(window as unknown as { compareServerClientDOM: typeof compareServerClientDOM }).compareServerClientDOM =
    compareServerClientDOM

  const compareDOM = () => {
    const serverContainer = document.querySelector('[data-server-rendered="true"]')

    if (!serverContainer) {
      console.warn('🔍 Hydration Debug: Не найден серверный DOM-контейнер [data-server-rendered="true"]')
      return
    }

    // Проверяем валидность серверного контейнера
    if (!isValidDOMNode(serverContainer) || !hasValidParent(serverContainer)) {
      console.error('🔍 Hydration Debug: Серверный контейнер не валиден или не в DOM')
      return
    }

    // Простая проверка гидрации - убеждаемся что контейнер не пустой
    if (serverContainer.children.length === 0) {
      console.warn('🔍 Hydration Debug: Серверный контейнер пуст - возможна проблема с SSR')
      return
    }

    console.group('🔍 Hydration Debug')
    console.log('✅ Серверный контейнер найден и содержит контент')
    console.log('📊 Дочерних элементов:', serverContainer.children.length)
    console.log('🏷️  Первый элемент:', serverContainer.firstElementChild?.tagName)

    // Расширенная диагностика проблем
    const issues = detectHydrationIssues(serverContainer)
    if (issues.length > 0) {
      console.group('⚠️ Обнаружены потенциальные проблемы гидрации:')
      issues.forEach((issue) => console.warn(`- ${issue}`))
      console.groupEnd()
    } else {
      console.log('✅ Критических проблем гидрации не обнаружено')
    }

    // Дополнительные проверки безопасности DOM
    try {
      // Проверяем что все дочерние элементы валидны
      const invalidChildren = Array.from(serverContainer.children).filter((child) => !isValidDOMNode(child))

      if (invalidChildren.length > 0) {
        console.warn('🔍 Hydration Debug: Найдены невалидные дочерние элементы:', invalidChildren.length)
      }

      // Проверяем стабильность DOM структуры
      const structureSnapshot = {
        childrenCount: serverContainer.children.length,
        firstChildTag: serverContainer.firstElementChild?.tagName,
        lastChildTag: serverContainer.lastElementChild?.tagName,
        timestamp: Date.now()
      }

      console.log('📐 Снимок структуры DOM:', structureSnapshot)
    } catch (domError) {
      console.error('🔍 Hydration Debug: Ошибка при проверке DOM структуры:', domError)
    }

    console.groupEnd()
  }

  // Запускаем после полной гидрации с дополнительными проверками
  const runComparison = () => {
    try {
      compareDOM()
    } catch (error) {
      console.error('🔍 Hydration Debug: Критическая ошибка при сравнении DOM:', error)
    }
  }

  // Используем requestAnimationFrame для безопасного выполнения
  requestAnimationFrame(() => {
    setTimeout(runComparison, 200)
  })
}

// Экспортируем для глобального доступа
if (typeof window !== 'undefined') {
  ;(window as unknown as { compareServerClientDOM: typeof compareServerClientDOM }).compareServerClientDOM =
    compareServerClientDOM
}
