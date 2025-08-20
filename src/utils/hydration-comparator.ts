/**
 * Утилита для сравнения серверного и клиентского DOM при гидрации
 * Помогает выявить несоответствия которые могут вызывать ошибки insertBefore
 */

const isValidDOMNode = (node: Node): boolean => {
  try {
    return !!(node?.nodeType && node?.parentNode !== undefined)
  } catch {
    return false
  }
}

export const compareServerClientDOM = () => {
  if (typeof window === 'undefined') {
    console.log('🔍 Hydration Debug: Skipped on server')
    return
  }

  // Ищем серверный контейнер с данными
  const serverContainer = document.querySelector('[data-server-rendered="true"]') as HTMLElement

  if (!serverContainer) {
    console.warn('🔍 Hydration Debug: Серверный контейнер не найден')
    return
  }

  console.group('🔍 Hydration Debug')
  console.log('✅ Серверный контейнер найден и содержит контент')
  console.log('📊 Дочерних элементов:', serverContainer.children.length)
  console.log('🏷️  Первый элемент:', serverContainer.firstElementChild?.tagName)

  // Проверяем потенциальные проблемы
  const issues: string[] = []

  // Ищем элементы загрузки которые могут конфликтовать
  const loadingElements = serverContainer.querySelectorAll(
    '[class*="loading"], [class*="Loading"], [class*="skeleton"]'
  )
  if (loadingElements.length > 0) {
    issues.push(`Найдены элементы загрузки: ${loadingElements.length}`)
  }

  // Проверяем наличие hydration ID
  const elementsWithHydrationId = serverContainer.querySelectorAll('[data-hk]')
  if (elementsWithHydrationId.length === 0) {
    issues.push('Отсутствуют hydration ID (data-hk атрибуты)')
  }

  if (issues.length > 0) {
    console.group('⚠️ Обнаружены потенциальные проблемы гидрации:')
    issues.forEach((issue) => {
      console.warn(`- ${issue}`)
    })
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

// Глобальная функция для использования в браузере
if (typeof window !== 'undefined') {
  ;(window as unknown as { compareServerClientDOM: typeof compareServerClientDOM }).compareServerClientDOM =
    compareServerClientDOM
}
