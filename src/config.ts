export const cdnUrl = import.meta.env.PUBLIC_CDN_URL || ''
console.log('[public cdn url]: ', cdnUrl)
export const coreApiUrl = import.meta.env.PUBLIC_CORE_API || 'https://v3.dscrs.site/graphql'
export const inboxApiUrl = import.meta.env.PUBLIC_INBOX_API || 'https://inbox.dscrs.site'
export const sseUrl = import.meta.env.PUBLIC_REALTIME_EVENTS || 'https://connect.dscrs.site'
export const gaIdentity = import.meta.env.PUBLIC_GA_IDENTITY || 'G-LQ4B87H8C2'
export const baseUrl =
  (import.meta.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${import.meta.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (import.meta.env.VERCEL_URL ? `https://${import.meta.env.VERCEL_URL}` : null) ||
  import.meta.env.PUBLIC_BASE_URL ||
  'https://testing3.dscrs.site'

// devmode only
export const reportDsn = import.meta.env.PUBLIC_GLITCHTIP_DSN
