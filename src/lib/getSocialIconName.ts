/**
 * Определяет имя иконки социальной сети по URL
 * Используется для автоматического отображения нужной иконки для ссылок в профиле автора
 */
export function getSocialIconName(url: string): string {
  if (!url) return 'user-link-default'

  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('facebook.com/')) return 'user-link-facebook'
  if (lowerUrl.includes('twitter.com/') || lowerUrl.includes('x.com/')) return 'user-link-twitter'
  if (lowerUrl.includes('telegram.com/') || lowerUrl.includes('t.me/')) return 'user-link-telegram'
  if (lowerUrl.includes('vk.cc/') || lowerUrl.includes('vk.com/')) return 'user-link-vk'
  if (lowerUrl.includes('tumblr.com/')) return 'user-link-tumblr'
  if (lowerUrl.includes('instagram.com/')) return 'user-link-instagram'
  if (lowerUrl.includes('behance.net/')) return 'user-link-behance'
  if (lowerUrl.includes('dribbble.com/')) return 'user-link-dribbble'
  if (lowerUrl.includes('github.com/')) return 'user-link-github'
  if (lowerUrl.includes('linkedin.com/')) return 'user-link-linkedin'
  if (lowerUrl.includes('medium.com/')) return 'user-link-medium'
  if (lowerUrl.includes('ok.ru/')) return 'user-link-ok'
  if (lowerUrl.includes('pinterest.com/')) return 'user-link-pinterest'
  if (lowerUrl.includes('reddit.com/')) return 'user-link-reddit'
  if (lowerUrl.includes('tiktok.com/')) return 'user-link-tiktok'
  if (lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/')) return 'user-link-youtube'
  if (lowerUrl.includes('dzen.ru/')) return 'user-link-dzen'

  return 'user-link-default'
}
