import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, SolidStartInlineConfig } from '@solidjs/start/config'
import { config } from 'dotenv'
import { checkSSL } from './scripts/https'
import viteConfig from './vite.config'

// 1: Загружаем .env файл
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[app.config] Loading', envPath)
  config({ path: envPath })
} else {
  console.warn('[app.config] No .env file found')
}

// 2: ENVIRONMENT DETECTION
const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI
const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS)
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
const isNetlify = Boolean(process.env.NETLIFY)
isVercel && console.info('[app.config] VERCEL MODE')
isNetlify && console.info('[app.config] NETLIFY MODE')
isCI && console.info('[app.config] CI MODE')
isDev && console.log('[app.config] DEV MODE')

// 3: PRESET DETERMINATION
const preset = isNetlify ? 'netlify' : isVercel ? 'vercel' : 'node'
console.info(`[app.config] solid-start preset: ${preset}`)

// 4: API CONNECTION
console.log('[app.config] connected to api: ', process.env.PUBLIC_CORE_API || 'https://v3.dscrs.site/graphql')

// 5: CONFIG
export default defineConfig({
  nitro: {
    timing: isDev, // Включаем timing только в dev
    minify: !isDev, // Минификация только в production
    sourceMap: isDev // Source maps только в dev
  },
  // Route rules для API
  routeRules: {
    '/api/og/**': {
      prerender: false,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    },
    '/api/thumb/**': {
      prerender: false,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'public, max-age=31536000'
      }
    }
  },
  rollupConfig: {
    output: {
      inlineDynamicImports: false
    }
  },
  ssr: true,
  server: {
    preset,
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    https: checkSSL(isDev, isCI, isVercel, isNetlify),
    ...(isDev && {
      host: '0.0.0.0', // Слушаем на всех интерфейсах
      strictPort: false, // Разрешаем выбор другого порта
      logLevel: 'info' // Подробные логи
    })
  },
  devOverlay: isDev, // Error overlay только в dev
  vite: viteConfig,
  experimental: {
    // Минимальные экспериментальные настройки для стабильности
    streaming: false,
    islands: false,
    hydration: true,
    router: {
      ssr: true
    }
  },
  // Production оптимизации
  ...(!isDev && {
    solid: {
      // Отключаем dev-специфичные features в production
      generate: 'dom',
      hydratable: true,
      dev: false
    }
  })
} as SolidStartInlineConfig)
