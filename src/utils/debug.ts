/**
 * Система отладки для диагностики клиентских ошибок
 */

export interface DebugSessionInfo {
  hasSession: boolean
  hasAuthor: boolean
  hasToken: boolean
  authorSlug?: string
  sessionLoaded: boolean
  timestamp: string
}

export interface DebugComponentInfo {
  componentName: string
  props?: Record<string, unknown>
  state?: Record<string, unknown>
  error?: Error
  timestamp: string
}

/**
 * Собирает отладочную информацию о сессии
 */
export const getSessionDebugInfo = (session: any): DebugSessionInfo => {
  return {
    hasSession: Boolean(session),
    hasAuthor: Boolean(session?.author),
    hasToken: Boolean(session?.token),
    authorSlug: session?.author?.slug,
    sessionLoaded: Boolean(session),
    timestamp: new Date().toISOString()
  }
}

/**
 * Логирует подробную информацию об ошибке
 */
export const logDetailedError = (
  error: Error | unknown,
  context: string,
  additionalInfo?: Record<string, unknown>
) => {
  console.group(`🔴 [Debug Error] ${context}`)
  
  console.error('Error details:', error)
  
  if (error instanceof Error) {
    console.error('Stack trace:', error.stack)
    console.error('Error message:', error.message)
    console.error('Error name:', error.name)
  }
  
  if (additionalInfo) {
    console.table(additionalInfo)
  }
  
  // Информация о браузере и окружении
  console.log('Browser info:', {
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    isDev: process.env.NODE_ENV === 'development'
  })
  
  console.groupEnd()
}

/**
 * Создает отладочную обертку для компонента
 */
export const createComponentDebugger = (componentName: string) => {
  return {
    logProps: (props: Record<string, unknown>) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${componentName}] Props:`, props)
      }
    },
    
    logState: (state: Record<string, unknown>) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${componentName}] State:`, state)
      }
    },
    
    logError: (error: Error | unknown, context?: string) => {
      logDetailedError(error, `${componentName}${context ? ` - ${context}` : ''}`)
    },
    
    logRender: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${componentName}] Rendered at ${new Date().toISOString()}`)
      }
    }
  }
}

/**
 * Проверяет состояние null-безопасности для объектов
 */
export const checkNullSafety = (obj: any, path: string): boolean => {
  const keys = path.split('.')
  let current = obj
  
  for (const key of keys) {
    if (current == null || current[key] == null) {
      console.warn(`[Null Safety Check] ${path} is null/undefined at key: ${key}`)
      return false
    }
    current = current[key]
  }
  
  return true
}

/**
 * Безопасное извлечение значения с логированием
 */
export const safeGet = <T>(obj: any, path: string, defaultValue?: T): T | undefined => {
  const keys = path.split('.')
  let current = obj
  
  for (let i = 0; i < keys.length; i++) {
    if (current == null || current[keys[i]] == null) {
      console.warn(`[Safe Get] Path ${path} is null/undefined at step ${i + 1}: ${keys[i]}`)
      return defaultValue
    }
    current = current[keys[i]]
  }
  
  return current as T
}

/**
 * Мониторинг времени выполнения функций
 */
export const withPerformanceMonitoring = <T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T => {
  return ((...args: Parameters<T>) => {
    const start = performance.now()
    try {
      const result = fn(...args)
      const end = performance.now()
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${label} executed in ${(end - start).toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const end = performance.now()
      logDetailedError(error, `Performance Monitor - ${label}`, {
        executionTime: `${(end - start).toFixed(2)}ms`,
        arguments: args
      })
      throw error
    }
  }) as T
} 