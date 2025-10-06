/**
 * @module lib/timing
 * @description Утилиты для управления таймингами и асинхронными операциями (DRY consolidation)
 * Консолидирует паттерны setTimeout из всего редактора
 */

/**
 * Стандартные задержки для различных операций
 */
export const TIMING = {
  /** Задержка для стабилизации DOM (0ms - следующий тик) */
  DOM_STABILIZATION: 0,
  /** Задержка для обновления состояния тулбара */
  TOOLBAR_UPDATE: 5,
  /** Задержка для анимаций */
  ANIMATION: 50,
  /** Задержка для восстановления выделения */
  SELECTION_RESTORE: 0,
  /** Задержка для обработки потери фокуса */
  BLUR_TIMEOUT: 150
} as const

/**
 * Выполняет callback после стабилизации DOM
 * Используется когда нужно дождаться обновления DOM после изменений
 *
 * @param callback - Функция для выполнения
 * @returns Идентификатор таймера для возможной отмены
 *
 * @example
 * ```ts
 * afterDOMUpdate(() => {
 *   const element = document.querySelector('.new-element')
 *   element?.focus()
 * })
 * ```
 */
export const afterDOMUpdate = (callback: () => void): number => {
  return window.setTimeout(callback, TIMING.DOM_STABILIZATION)
}

/**
 * Выполняет async callback после стабилизации DOM
 * Версия для асинхронных операций
 *
 * @param callback - Async функция для выполнения
 * @returns Promise, который резолвится после выполнения callback
 *
 * @example
 * ```ts
 * await afterDOMUpdateAsync(async () => {
 *   const { processPreviewTags } = await import('./previewRenderer')
 *   await processPreviewTags(editor)
 * })
 * ```
 */
export const afterDOMUpdateAsync = async (callback: () => Promise<void>): Promise<void> => {
  return new Promise((resolve) => {
    window.setTimeout(async () => {
      await callback()
      resolve()
    }, TIMING.DOM_STABILIZATION)
  })
}

/**
 * Выполняет callback после обновления состояния тулбара
 * Используется для корректного отображения активных кнопок форматирования
 *
 * @param callback - Функция для выполнения
 * @returns Идентификатор таймера для возможной отмены
 *
 * @example
 * ```ts
 * afterToolbarUpdate(() => {
 *   trackSelectionAndCursor()
 * })
 * ```
 */
export const afterToolbarUpdate = (callback: () => void): number => {
  return window.setTimeout(callback, TIMING.TOOLBAR_UPDATE)
}

/**
 * Выполняет callback с задержкой для анимации
 * Используется для плавных переходов и анимаций UI
 *
 * @param callback - Функция для выполнения
 * @returns Идентификатор таймера для возможной отмены
 *
 * @example
 * ```ts
 * afterAnimation(() => {
 *   setIsAppearing(true)
 * })
 * ```
 */
export const afterAnimation = (callback: () => void): number => {
  return window.setTimeout(callback, TIMING.ANIMATION)
}

/**
 * Восстанавливает выделение после операции
 * Обертка для восстановления selection с правильным таймингом
 *
 * @param restoreCallback - Функция восстановления выделения
 * @returns Идентификатор таймера для возможной отмены
 *
 * @example
 * ```ts
 * const savedRange = selection.getRangeAt(0).cloneRange()
 * restoreSelectionAfter(() => {
 *   const newSelection = window.getSelection()
 *   if (newSelection) {
 *     newSelection.removeAllRanges()
 *     newSelection.addRange(savedRange)
 *   }
 * })
 * ```
 */
export const restoreSelectionAfter = (restoreCallback: () => void): number => {
  return window.setTimeout(restoreCallback, TIMING.SELECTION_RESTORE)
}

/**
 * Создает debounced версию функции
 * Полезно для обработчиков ввода и других частых событий
 *
 * @param callback - Функция для debounce
 * @param delay - Задержка в миллисекундах
 * @returns Debounced функция
 *
 * @example
 * ```ts
 * const debouncedSave = debounce(() => {
 *   saveDraft()
 * }, 500)
 * ```
 */
export const debounce = <T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number | undefined

  return (...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(() => {
      callback(...args)
    }, delay)
  }
}

/**
 * Создает throttled версию функции
 * Ограничивает частоту вызовов функции
 *
 * @param callback - Функция для throttle
 * @param limit - Минимальный интервал между вызовами в миллисекундах
 * @returns Throttled функция
 *
 * @example
 * ```ts
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition()
 * }, 100)
 * ```
 */
export const throttle = <T extends (...args: unknown[]) => void>(
  callback: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      callback(...args)
      inThrottle = true
      window.setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Выполняет серию операций последовательно с задержками
 * Полезно для сложных DOM манипуляций требующих нескольких обновлений
 *
 * @param operations - Массив операций с задержками
 * @returns Promise, который резолвится после выполнения всех операций
 *
 * @example
 * ```ts
 * await sequentialOperations([
 *   { callback: () => insertElement(), delay: 0 },
 *   { callback: () => updateToolbar(), delay: 5 },
 *   { callback: () => focusEditor(), delay: 0 }
 * ])
 * ```
 */
export const sequentialOperations = async (
  operations: Array<{ callback: () => void | Promise<void>; delay: number }>
): Promise<void> => {
  for (const { callback, delay } of operations) {
    await new Promise<void>((resolve) => {
      window.setTimeout(async () => {
        await callback()
        resolve()
      }, delay)
    })
  }
}

/**
 * Ожидает выполнения условия с таймаутом
 * Полезно для ожидания появления элементов в DOM
 *
 * @param condition - Функция проверки условия
 * @param timeout - Максимальное время ожидания в миллисекундах
 * @param interval - Интервал проверки в миллисекундах
 * @returns Promise<boolean> - true если условие выполнено, false если таймаут
 *
 * @example
 * ```ts
 * const elementAppeared = await waitForCondition(
 *   () => document.querySelector('.new-element') !== null,
 *   1000,
 *   50
 * )
 * ```
 */
export const waitForCondition = async (condition: () => boolean, timeout = 1000, interval = 50): Promise<boolean> => {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const checkCondition = () => {
      if (condition()) {
        resolve(true)
        return
      }

      if (Date.now() - startTime >= timeout) {
        resolve(false)
        return
      }

      window.setTimeout(checkCondition, interval)
    }

    checkCondition()
  })
}

/**
 * Отменяет таймер если он существует
 * Безопасная обертка для clearTimeout
 *
 * @param timerId - Идентификатор таймера
 *
 * @example
 * ```ts
 * const timer = afterDOMUpdate(() => doSomething())
 * // ... позже
 * cancelTimer(timer)
 * ```
 */
export const cancelTimer = (timerId: number | undefined): void => {
  if (timerId !== undefined) {
    window.clearTimeout(timerId)
  }
}
