import type { Author, Shout, Topic } from '~/graphql/generated/graphql'

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

export interface SearchTopicsProps extends InfiniteScrollProps {
  topicsList: Topic[]
}

export interface SearchAllProps {
  searchValue: string
  isLoading: boolean
  hasMore: boolean
  shoutsList: Shout[]
  authorsList: Author[]
  topicsList: Topic[]
}
