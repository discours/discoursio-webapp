// utils/hydration-comparator.ts
export const compareServerClientDOM = () => {
  if (typeof window === 'undefined') return // Добавляем функцию в window для тестов
  ;(window as any).compareServerClientDOM = compareServerClientDOM

  const compareDOM = () => {
    const serverContainer = document.querySelector('[data-server-rendered="true"]')

    if (!serverContainer) {
      console.warn('🔍 Hydration Debug: Не найден серверный DOM-контейнер [data-server-rendered="true"]')
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

    // Проверяем наличие потенциально проблемных элементов
    const loadingElements = serverContainer.querySelectorAll(
      '[class*="loading"], [class*="spinner"], [class*="skeleton"]'
    )
    if (loadingElements.length > 0) {
      console.warn('⚠️ Найдены элементы загрузки в серверном контейнере:', loadingElements.length)
    }

    // Проверяем наличие пустых элементов которые могли бы быть заполнены на клиенте
    const emptyLists = serverContainer.querySelectorAll('ul:empty, ol:empty')
    if (emptyLists.length > 0) {
      console.warn('⚠️ Найдены пустые списки в серверном контейнере:', emptyLists.length)
    }

    console.groupEnd()
  }

  // Запускаем после полной гидрации
  setTimeout(compareDOM, 200)
}

// Экспортируем для глобального доступа
if (typeof window !== 'undefined') {
  ;(window as any).compareServerClientDOM = compareServerClientDOM
}
