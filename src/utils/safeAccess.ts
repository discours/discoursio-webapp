/**
 * Безопасный доступ к свойству cover объекта
 * Предотвращает ошибки "Cannot read properties of undefined"
 */
export function safeCover<T extends { cover?: string | null }>(
  obj: T | null | undefined,
  fallback = ''
): string {
  return obj?.cover || fallback
}

/**
 * Универсальная функция для безопасного доступа к любому свойству
 */
export function safeAccess<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback?: T[K]
): T[K] | undefined {
  return obj?.[key] ? obj[key] : fallback
}

/**
 * Проверяет существование объекта и его свойства
 */
export function hasProperty<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): obj is T & Record<K, NonNullable<T[K]>> {
  return Boolean(obj?.[key])
}
