// 🔄 Константы для поиска
export const SEARCH_DEFAULTS = {
  MIN_LENGTH: 2,
  DEBOUNCE_MS: 300,
  PAGE_SIZE: 50
} as const

// 🔄 Утилиты для валидации поиска
export const isValidSearchQuery = (query: string, minLength = SEARCH_DEFAULTS.MIN_LENGTH): boolean => {
  return query.trim().length >= minLength
}

// 🔄 Создание стандартных параметров поиска
export const createSearchOptions = (offset = 0, limit = SEARCH_DEFAULTS.PAGE_SIZE) => ({
  offset,
  limit
})
