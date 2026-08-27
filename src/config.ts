export const cdnUrl = import.meta.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'
export const coreApiUrl = import.meta.env.PUBLIC_CORE_API || 'https://v3.dscrs.site/graphql'
export const inboxApiUrl = import.meta.env.PUBLIC_INBOX_API || 'https://inbox.discours.io'
export const sseUrl = import.meta.env.PUBLIC_REALTIME_EVENTS || 'https://connect.discours.io'
export const gaIdentity = import.meta.env.PUBLIC_GA_IDENTITY || 'G-LQ4B87H8C2'
export const baseUrl =
  (import.meta.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${import.meta.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (import.meta.env.VERCEL_URL ? `https://${import.meta.env.VERCEL_URL}` : null) ||
  import.meta.env.PUBLIC_BASE_URL ||
  'https://testing.discours.io'

// devmode only
export const reportDsn = import.meta.env.PUBLIC_GLITCHTIP_DSN
