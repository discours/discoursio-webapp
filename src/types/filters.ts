import { InputMaybe, ReactionSort } from '~/graphql/schema/core.gen'

export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'
export type FeedMode =
  // Основные режимы
  | 'hot'
  | 'top'
  | 'recent'
  | 'search'
  | 'comments'
  | 'about'
  // Персональные режимы
  | 'followed'
  | 'discussed'
  | 'coauthored'
export const FEED_MODES: FeedMode[] = ['recent', 'hot', 'top', 'search', 'comments']
export type MyFeedKind = 'followed' | 'coauthored' | 'discussed' | undefined

export interface FeedFilters {
  after?: number // Unix timestamp в секундах
  featured?: boolean // отобранные публикации
  layouts?: InputMaybe<string>[] // форматы публикаций
}

export interface CommentsFilters {
  after?: number // Unix timestamp в секундах
  sort?: ReactionSort // enum для UI
}

export interface FilterState {
  filters: FeedFilters | CommentsFilters
  timestamp: number // Когда последний раз обновлялись фильтры
}
