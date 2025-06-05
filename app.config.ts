// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import { dirname, join } from 'node:path'
// biome-ignore lint/correctness/noNodejsModules: build
import { fileURLToPath } from 'node:url'
import { SolidStartInlineConfig, defineConfig } from '@solidjs/start/config'
import viteConfig, { isDev } from './vite.config'

const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS)

const isVercel = Boolean(process.env.VERCEL)
const isNetlify = Boolean(process.env.NETLIFY)
const preset = isNetlify ? 'netlify' : isVercel ? 'vercel' : 'node'
console.info(`[app.config] solid-start preset {> ${preset} <}`)

// certs for local development
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const keyPath = join(__dirname, 'key.pem')
const certPath = join(__dirname, 'cert.pem')

// Функция для проверки SSL
function checkSSL(): { key: string; cert: string } | undefined {
  // Пропускаем для всех случаев кроме локальной разработки
  if (!isDev || isCI || isVercel || isNetlify || process.argv.includes('build')) {
    return undefined
  }

  try {
    // Только проверяем существующие сертификаты
    if (existsSync(keyPath) && existsSync(certPath)) {
      return {
        key: keyPath,
        cert: certPath
      }
    }
  } catch {
    // Игнорируем любые ошибки
  }
  return undefined
}

export default defineConfig({
  nitro: {
    timing: true,
    compatibilityDate: '2024-11-29',
    // Configure WASM handling for @vercel/og
    experimental: {
      wasm: true
    },
    // Force Edge runtime for OG image generation routes
    routeRules: {
      '/api/og': {
        prerender: false,
        runtime: 'edge'
      },
      '/api/og/**': {
        prerender: false,
        runtime: 'edge' // Key fix: Force Edge runtime for OG routes
      }
    },
    rollupConfig: {
      output: {
        inlineDynamicImports: false
      }
    }
  },
  ssr: true,
  server: {
    preset,
    port: 3000,
    https: checkSSL()
  },
  devOverlay: isDev,
  vite: viteConfig,
  edge: isVercel,
  experimental: {
    streaming: false,
    islands: false,
    hydration: true,
    router: {
      ssr: true
    }
  }
} as SolidStartInlineConfig)
