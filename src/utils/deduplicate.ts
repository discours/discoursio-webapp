import type { Shout } from '~/graphql/schema/core.gen'

/**
 * Дедупликация массива публикаций на основе ID
 * @param shouts - массив публикаций для дедупликации
 * @returns массив уникальных публикаций
 */
export const deduplicateShouts = (shouts: Shout[]): Shout[] => {
  const seen = new Set<number>()
  const uniqueShouts: Shout[] = []

  for (const shout of shouts) {
    if (shout?.id && !seen.has(shout.id)) {
      seen.add(shout.id)
      uniqueShouts.push(shout)
    }
  }

  return uniqueShouts
}

/**
 * Фильтрует публикации, исключая уже использованные ID
 * @param shouts - массив публикаций для фильтрации
 * @param usedIds - Set с уже использованными ID публикаций
 * @returns отфильтрованный массив публикаций
 */
export const filterUsedShouts = (shouts: Shout[], usedIds: Set<number>): Shout[] => {
  return shouts.filter((shout) => shout?.id && !usedIds.has(shout.id))
}

/**
 * Создает Set из ID публикаций
 * @param shouts - массив публикаций
 * @returns Set с ID публикаций
 */
export const createUsedShoutsSet = (shouts: Shout[]): Set<number> => {
  return new Set(shouts.filter((s) => s?.id).map((s) => s.id!))
}

/**
 * Контекст дедупликации для отслеживания использованных публикаций в ленте
 */
export class FeedDeduplicationContext {
  private usedIds = new Set<number>()

  /**
   * Добавляет публикации в контекст как использованные
   * @param shouts - публикации для добавления в контекст
   */
  addUsedShouts(shouts: Shout[]): void {
    shouts.forEach((shout) => {
      if (shout?.id) {
        this.usedIds.add(shout.id)
      }
    })
  }

  /**
   * Фильтрует публикации, исключая уже использованные
   * @param shouts - публикации для фильтрации
   * @returns отфильтрованные публикации
   */
  filterUnused(shouts: Shout[]): Shout[] {
    return shouts.filter((shout) => shout?.id && !this.usedIds.has(shout.id))
  }

  /**
   * Фильтрует публикации и добавляет их в контекст как использованные
   * @param shouts - публикации для фильтрации и добавления
   * @returns отфильтрованные публикации
   */
  filterAndAdd(shouts: Shout[]): Shout[] {
    const filtered = this.filterUnused(shouts)
    this.addUsedShouts(filtered)
    return filtered
  }

  /**
   * Очищает контекст дедупликации
   */
  clear(): void {
    this.usedIds.clear()
  }

  /**
   * Возвращает количество использованных публикаций
   */
  get usedCount(): number {
    return this.usedIds.size
  }
}
