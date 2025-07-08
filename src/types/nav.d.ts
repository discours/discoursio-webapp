/**
 * Модуль типов навигации и фильтрации контента
 * @module nav
 * @description Содержит типы, используемые для навигации по приложению, фильтрации и сортировки контента
 */

/**
 * Параметры поиска корневого уровня
 * @interface RootSearchParams
 */
export type RootSearchParams = {
  m: string; // modal - модальное окно
  lang: string; // язык интерфейса
  token: string; // токен авторизации
};

/**
 * Типы медиа-контента для выставок
 * @type ExpoLayoutType
 */
export type ExpoLayoutType = 'audio' | 'video' | 'image' | 'literature';

/**
 * Типы макетов для публикаций (статьи и медиа-контент)
 * @type LayoutType
 */
export type LayoutType = 'article' | ExpoLayoutType;

/**
 * Фильтры для подписок пользователя
 * @type FollowsFilter
 */
export type FollowsFilter = 'all' | 'authors' | 'topics' | 'communities';

/**
 * Функция сортировки для любого типа данных
 * @template T
 * @type SortFunction
 */
export type SortFunction<T> = (a: T, b: T) => number

/**
 * Функция фильтрации для любого типа данных
 * @template T
 * @type FilterFunction
 */
export type FilterFunction<T> = (a: T) => boolean

import { InputMaybe, ReactionSort } from '~/graphql/generated/graphql'

/**
 * Фильтр для избранных публикаций
 * @type FeaturedFilter
 */
export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

/**
 * Режимы отображения ленты публикаций
 * @type FeedMode
 */
export type FeedMode =
  // Основные режимы
  | 'hot'      // Горячие (популярные)
  | 'top'      // Лучшие
  | 'recent'   // Недавние
  | 'search'   // Поиск
  | 'comments' // Комментарии
  | 'about'    // О нас
  // Персональные режимы
  | 'followed'   // Подписки
  | 'discussed'  // Обсуждаемые
  | 'coauthored' // В соавторстве

/**
 * Доступные режимы ленты для UI
 * @const FEED_MODES
 */
export const FEED_MODES: FeedMode[] = ['recent', 'hot', 'top', 'search', 'comments']

/**
 * Типы персональной ленты пользователя
 * @type MyFeedKind
 */
export type MyFeedKind = 'followed' | 'coauthored' | 'discussed' | undefined

/**
 * Параметры фильтрации ленты публикаций
 * @interface FeedFilters
 */
export interface FeedFilters {
  after?: number               // Unix timestamp в секундах
  featured?: boolean           // отобранные публикации
  layouts?: InputMaybe<string>[] // форматы публикаций
}

/**
 * Параметры фильтрации комментариев
 * @interface CommentsFilters
 */
export interface CommentsFilters {
  after?: number     // Unix timestamp в секундах
  sort?: ReactionSort // enum для UI
}

/**
 * Состояние фильтров с временной меткой последнего обновления
 * @interface FilterState
 */
export interface FilterState {
  filters: FeedFilters | CommentsFilters
  timestamp: number // Когда последний раз обновлялись фильтры
}
