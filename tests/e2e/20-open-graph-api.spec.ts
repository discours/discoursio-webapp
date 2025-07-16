/**
 * Тесты для Open Graph API эндпоинта
 *
 * Проверяет работу API для генерации OG изображений
 * по адресу /api/og и его подэндпоинтов
 *
 * @see https://playwright.dev/docs/writing-tests
 */

import { expect, test } from '@playwright/test'
import { baseUrl } from '../utils/test-helpers'

test.describe('Open Graph API Tests', () => {
  test('должен генерировать базовое OG изображение', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/og`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
    expect(response.headers()['cache-control']).toContain('max-age=31536000')
    expect(response.headers()['x-og-image-width']).toBe('1200')
    expect(response.headers()['x-og-image-height']).toBe('630')
  })

  test('должен генерировать OG изображение для статьи', async ({ request }) => {
    const params = new URLSearchParams({
      title: 'Тестовая статья о культуре',
      author: 'Иван Петров',
      topic: 'Культура'
    })

    const response = await request.get(`${baseUrl}/api/og/article?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
    expect(response.headers()['x-og-image-alt']).toBe('Тестовая статья о культуре')
  })

  test('должен генерировать OG изображение для автора', async ({ request }) => {
    const params = new URLSearchParams({
      name: 'Мария Иванова',
      bio: 'Журналист и писатель',
      articlesCount: '25',
      followersCount: '150'
    })

    const response = await request.get(`${baseUrl}/api/og/author?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })

  test('должен генерировать OG изображение для темы', async ({ request }) => {
    const params = new URLSearchParams({
      title: 'Наука и технологии',
      description: 'Последние достижения в науке',
      articlesCount: '42'
    })

    const response = await request.get(`${baseUrl}/api/og/topic?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })

  test('должен обрабатывать длинные заголовки', async ({ request }) => {
    const longTitle =
      'Очень длинный заголовок статьи который должен быть обрезан в OG изображении для корректного отображения в социальных сетях'

    const params = new URLSearchParams({
      title: longTitle,
      author: 'Автор'
    })

    const response = await request.get(`${baseUrl}/api/og/article?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })

  test('должен обрабатывать специальные символы в заголовках', async ({ request }) => {
    const specialTitle = 'Статья с "кавычками" & амперсандами <теги>'

    const params = new URLSearchParams({
      title: specialTitle,
      author: 'Тестовый Автор'
    })

    const response = await request.get(`${baseUrl}/api/og/article?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })

  test('должен возвращать корректные заголовки кеширования', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/og`)

    expect(response.status()).toBe(200)

    const cacheControl = response.headers()['cache-control']
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=31536000')
    expect(cacheControl).toContain('immutable')

    const cdnCacheControl = response.headers()['cdn-cache-control']
    expect(cdnCacheControl).toContain('public')
    expect(cdnCacheControl).toContain('max-age=31536000')
  })

  test('должен обрабатывать пустые параметры', async ({ request }) => {
    const params = new URLSearchParams({
      title: '',
      author: '',
      topic: ''
    })

    const response = await request.get(`${baseUrl}/api/og/article?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })

  test('должен корректно обрабатывать кириллические символы', async ({ request }) => {
    const cyrillicTitle = 'Статья на русском языке с кириллицей'
    const cyrillicAuthor = 'Иван Петрович Сидоров'

    const params = new URLSearchParams({
      title: cyrillicTitle,
      author: cyrillicAuthor,
      topic: 'Культура и общество'
    })

    const response = await request.get(`${baseUrl}/api/og/article?${params.toString()}`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })
})
