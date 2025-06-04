export const cdnUrl = import.meta.env.PUBLIC_CDN_URL || 'https://files.dscrs.site'
export const coreApiUrl = import.meta.env.PUBLIC_CORE_API || 'https://coretest.discours.io/graphql'
export const authApiUrl = import.meta.env.PUBLIC_AUTH_API || import.meta.env.PUBLIC_CORE_API
export const sseUrl = import.meta.env.PUBLIC_REALTIME_EVENTS || 'https://connect.discours.io'
export const gaIdentity = import.meta.env.PUBLIC_GA_IDENTITY || 'G-LQ4B87H8C2'

// devmode only
export const reportDsn = import.meta.env.PUBLIC_GLITCHTIP_DSN
