export const cdnUrl = import.meta.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'
export const coreApiUrl = import.meta.env.PUBLIC_CORE_API || 'https://coretest.discours.io/graphql'
export const authApiUrl = import.meta.env.PUBLIC_AUTH_API || import.meta.env.PUBLIC_CORE_API
export const sseUrl = import.meta.env.PUBLIC_REALTIME_EVENTS || 'https://connect.discours.io'
export const gaIdentity = import.meta.env.PUBLIC_GA_IDENTITY || 'G-LQ4B87H8C2'
export const baseUrl =
  (import.meta.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${import.meta.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null) ||
  (import.meta.env.VERCEL_URL ? `https://${import.meta.env.VERCEL_URL}` : null) ||
  import.meta.env.PUBLIC_BASE_URL ||
  'https://testing3.discours.io'

// devmode only
export const reportDsn = import.meta.env.PUBLIC_GLITCHTIP_DSN
