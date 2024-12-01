import { InputMaybe, ReactionSort } from '~/graphql/schema/core.gen'

export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

export type FeedMode =
  | 'recent'
  | 'hot'
  | 'top'
  | 'followed'
  | 'discussed'
  | 'coauthored'
  | 'search'
  | 'comments'

export interface FeedFilters {
  after?: number // Unix timestamp в секундах
  featured?: boolean // Избранное
  layouts?: InputMaybe<string>[] // Типы контента
}

export interface CommentsFilters {
  after?: number // Unix timestamp в секундах
  sort?: ReactionSort // enum для UI
}

export interface FilterState {
  filters: FeedFilters | CommentsFilters
  timestamp: number // Когда последний раз обновлялись фильтры
}
