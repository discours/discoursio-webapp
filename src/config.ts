export const cdnDomain = 'files.dscrs.site'
export const thumborDomain = 'images.discours.io'
export const cdnUrl = import.meta.env.PUBLIC_CDN_URL || `https://${cdnDomain}`
export const thumborUrl = import.meta.env.PUBLIC_THUMBOR_URL || `https://${thumborDomain}`
export const coreApiUrl = import.meta.env.PUBLIC_CORE_API || 'https://core.discours.io'
export const chatApiUrl = import.meta.env.PUBLIC_CHAT_API || 'https://inbox.discours.io'
export const authApiUrl = import.meta.env.PUBLIC_AUTH_API || 'https://auth.discours.io/graphql'
export const sseUrl = import.meta.env.PUBLIC_REALTIME_EVENTS || 'https://connect.discours.io'
export const gaIdentity = import.meta.env.PUBLIC_GA_IDENTITY || 'G-LQ4B87H8C2'
export const authorizerClientId =
  import.meta.env.PUBLIC_AUTHORIZER_CLIENT_ID || 'b9038a34-ca59-41ae-a105-c7fbea603e24'
export const authorizerRedirectUrl =
  import.meta.env.PUBLIC_AUTHORIZER_REDIRECT_URL || 'https://testing.discours.io'

// devmode only
export const reportDsn = import.meta.env.PUBLIC_GLITCHTIP_DSN
