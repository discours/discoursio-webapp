/**
 * Черный список зарезервированных роутов
 * Эти пути нельзя использовать как slug публикаций/авторов
 */

// Роуты из реальной кодовой базы src/routes/
export const APP_ROUTES = [
  // Статические страницы (static)
  'connect',
  'debate',
  'dogma',
  'guide',
  'manifest',
  'partners',
  'principles',
  'support',
  'terms',
  'thanks',

  // Основные разделы
  'articles', // articles/[topic]/[slug]
  'author', // author/[slug]/[...mode]
  'authors', // authors.tsx
  'edit', // edit/[id]/* + edit/new
  'expo', // expo/[...layout]
  'feed', // feed/[...mode]
  'inbox', // inbox/(chats) + inbox/[chat]
  'search', // search/(search)
  'settings', // settings/*
  'topic', // topic/[slug]/[...mode]
  'topics', // topics.tsx
  'oauth', // oauth.ts (наш новый роут)

  // Вложенные роуты из settings/
  'security', // settings/security.tsx
  'subs', // settings/subs.tsx

  // Вложенные роуты из edit/
  'new', // edit/new.tsx
  'drafts', // edit/(drafts).tsx
  'draft', // edit/[id]/(draft).tsx
  'local', // edit/[id]/local.tsx
  'preview', // edit/[id]/preview.tsx
  'suggest' // edit/[id]/suggest.tsx
] as const

// API роуты (из папки api/)
export const API_ROUTES = [
  'api', // общий префикс для API
  'feedback', // api/feedback.js
  'newsletter', // api/newsletter.js
  'og', // api/og.js
  'graphql' // основной GraphQL endpoint
] as const

// Статические файлы и служебные (из public/)
export const STATIC_ROUTES = [
  // Служебные файлы
  'robots', // robots.txt
  'sw', // sw.js (service worker)
  'offline', // offline.html
  'clear-sw', // clear-sw.html

  // Медиа файлы
  'favicon', // favicon.ico, favicon.png
  'logo', // logo.png, logo.svg, logo_sign.png
  'error', // error.svg
  'fonts', // папка fonts/
  'icons', // папка icons/

  // Расширения файлов (для безопасности)
  'css',
  'js',
  'json',
  'xml',
  'txt',
  'ico',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'otf'
] as const

// Системные и служебные (минимальный набор)
export const SYSTEM_ROUTES = [
  // Специальные символы
  '_',
  '__',
  '.',
  '..',

  // Системные значения
  'null',
  'undefined',
  'true',
  'false',

  // Числовые
  '0',
  '1',
  '404',
  '500'
] as const

// Объединенный черный список
export const RESERVED_ROUTES = [...APP_ROUTES, ...API_ROUTES, ...STATIC_ROUTES, ...SYSTEM_ROUTES] as const

// Типы для TypeScript
export type AppRoute = (typeof APP_ROUTES)[number]
export type ApiRoute = (typeof API_ROUTES)[number]
export type StaticRoute = (typeof STATIC_ROUTES)[number]
export type SystemRoute = (typeof SYSTEM_ROUTES)[number]
export type ReservedRoute = (typeof RESERVED_ROUTES)[number]

/**
 * Проверяет, является ли slug зарезервированным
 */
export function isReservedRoute(slug: string): boolean {
  return RESERVED_ROUTES.includes(slug.toLowerCase() as ReservedRoute)
}
