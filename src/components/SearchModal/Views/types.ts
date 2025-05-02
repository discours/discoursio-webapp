import type { Author, Shout } from '~/graphql/schema/core.gen'

export interface SearchBaseProps {
  searchValue: string;
  isLoading: boolean;
  hasMore: boolean;
  setSentinelEl: (el: HTMLDivElement) => void;
  sentinelStyle: { [key: string]: string };
}

export interface SearchShoutsProps extends SearchBaseProps {
  shoutsList: Shout[];
}

export interface SearchAuthorsProps extends SearchBaseProps {
  authorsList: Author[];
}

export interface SearchAllProps extends SearchShoutsProps, SearchAuthorsProps {}