import { Maybe } from 'graphql/jsutils/Maybe'
import { FilterFunction } from '~/types/nav'

type WithNameOrTitle = { name?: string } | { title?: string }
type WithCreatedAt = { created_at?: number }
type WithPublishedAt = { published_at?: number }
type WithStat = { stat?: { [key: string]: Maybe<number> } | undefined | null }
type WithScore = { score: number }

export const byFirstChar = <T extends WithNameOrTitle>(a: T, b: T) => {
  const aValue = 'name' in a ? a.name : (a as { title?: string }).title || ''
  const bValue = 'name' in b ? b.name : (b as { title?: string }).title || ''

  return aValue?.localeCompare(bValue || '')
}
export const byCreated = <T extends WithCreatedAt>(a: T, b: T) => {
  return (a?.created_at || 0) - (b?.created_at || 0)
}

export const byPublished = <T extends WithPublishedAt>(a: T, b: T) => {
  return (a?.published_at || 0) - (b?.published_at || 0)
}

export const byLength = <T>(a: T[], b: T[]) => {
  const x = a.length
  const y = b.length

  if (x > y) return -1
  if (x < y) return 1
  return 0
}

export const byStat = (metric: string) => {
  if (metric === 'name' || metric === 'title') return byFirstChar
  return <T extends WithStat>(a: T, b: T) => {
    const aStat = a.stat?.[metric] ?? 0
    const bStat = b.stat?.[metric] ?? 0
    return aStat - bStat
  }
}

export const byTopicStatDesc = <T extends WithStat>(metric: string) => {
  return (a: T, b: T) => {
    const x = a.stat?.[metric] || 0
    const y = b.stat?.[metric] || 0
    if (x > y) return -1
    if (x < y) return 1
    return 0
  }
}

export const byScore = <T extends WithScore>(a: T, b: T) => {
  const x = a?.score || 0
  const y = b?.score || 0
  if (x > y) return -1
  if (x < y) return 1
  return 0
}

/**
 * Фильтрует список элементов с помощью функции фильтрации
 * @template T - Тип элемента списка
 * @param {T[]} list - Список элементов для фильтрации
 * @param {FilterFunction<T>} [filteringHandler] - Функция для фильтрации
 * @returns {T[]} - Отфильтрованный список
 */
export function getFilteredItems<T>(list: T[], filteringHandler?: FilterFunction<T>): T[] {
  if (filteringHandler) {
    return list.filter((item) => filteringHandler(item))
  }
  return list
}
