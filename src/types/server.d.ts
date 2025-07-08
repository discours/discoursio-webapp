
// Типы из '~/graphql/schema/chat.gen'
import type { Chat } from '~/graphql/schema/chat.gen';
// Типы из '~/graphql/generated/graphql'
import type { Author, SearchResult, Shout, Topic } from '~/graphql/generated/graphql';
import { LayoutType } from './nav';

// Все возможные свойства, которые могут быть переданы с сервера
export type PageProps = {
  article?: Shout;
  expoShouts?: Shout[];
  authorShouts?: Shout[];
  topicShouts?: Shout[];
  homeShouts?: Shout[];
  author?: Author;
  allAuthors?: Author[];
  topWritingAuthors?: Author[];
  topFollowedAuthors?: Author[];
  topic?: Topic;
  allTopics?: Topic[];
  searchQuery?: string;
  layouts?: LayoutType[];
  searchResults?: SearchResult[];
  chats?: Chat[];
  seo: {
    title: string;
  };
};
