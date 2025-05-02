import type { Author, Shout } from '~/graphql/schema/core.gen'

export interface SearchBaseProps {
  searchValue: string
  isLoading: boolean
  hasMore: boolean
}

export interface InfiniteScrollProps extends SearchBaseProps {
  setSentinelEl: (el: HTMLDivElement) => void
  sentinelStyle: { [key: string]: string }
}

export interface SearchShoutsProps extends InfiniteScrollProps {
  shoutsList: Shout[]
}

export interface SearchAuthorsProps extends InfiniteScrollProps {
  authorsList: Author[]
}

export interface SearchAllProps {
  searchValue: string
  isLoading: boolean
  hasMore: boolean
  shoutsList: Shout[]
  authorsList: Author[]
}
