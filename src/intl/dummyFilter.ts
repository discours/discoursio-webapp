import type { Author, Topic } from '~/graphql/generated/graphql'
import { translit } from './translit'

const prepareQuery = (searchQuery: string, lang: string) => {
  const q = searchQuery.toLowerCase()
  if (q.length === 0) return ''
  return lang === 'ru' ? translit(q) : q
}

const stringMatches = (str: string, q: string, lang: string) => {
  const preparedStr = lang === 'ru' ? translit(str.toLowerCase()) : str.toLowerCase()
  return preparedStr.split(' ').some((word) => word.startsWith(q))
}

export const dummyFilter = <T extends Topic | Author>(
  data: T[],
  searchQuery: string,
  lang: 'ru' | 'en'
): T[] => {
  const q = prepareQuery(searchQuery, lang)

  if (q.length === 0) {
    return data
  }

  return data.filter((item) => {
    const slugMatches = item.slug?.split('-').some((w) => w.startsWith(q))
    if (slugMatches) return true

    if ('title' in item) {
      return stringMatches(item?.title || '', q, lang)
    }

    if ('name' in item) {
      return stringMatches(item?.name || '', q, lang) || (item.bio && stringMatches(item.bio, q, lang))
    }

    // If it does not match any of the 'slug', 'title', 'name' , 'bio' fields
    // current element should not be included in the filtered array
    return false
  })
}
