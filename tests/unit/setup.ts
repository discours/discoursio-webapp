/**
 * Настройка окружения для юниттестов
 *
 * Конфигурирует solid-testing-library и добавляет необходимые матчеры
 */

import { beforeAll, vi } from 'vitest'

// Убираем импорт solid-testing-library из глобального setup
// каждый тест должен импортировать cleanup сам

// Настройка JSDOM окружения для тестов
beforeAll(() => {
  // [предположение] Подготавливаем DOM окружение
  Object.defineProperty(window, 'location', {
    value: {
        origin: 'https://localhost:3001',
  href: 'https://localhost:3001',
  protocol: 'https:',
  host: 'localhost:3001',
  hostname: 'localhost',
  port: '3001',
      pathname: '/',
      search: '',
      hash: ''
    },
    writable: true
  })

  // Мок для matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  // Мок для ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  // Мок для IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  // Мок для crypto (для OAuth state generation)
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: vi.fn(() => 'test-uuid-123'),
      getRandomValues: vi.fn()
    }
  })

  // Мок для fetch
  global.fetch = vi.fn()

  // Мок для URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'mock-url')
  global.URL.revokeObjectURL = vi.fn()
})
