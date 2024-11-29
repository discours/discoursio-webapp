// biome-ignore lint/correctness/noNodejsModules: build
import fs from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import path from 'node:path'
// biome-ignore lint/correctness/noNodejsModules: build
import { fileURLToPath } from 'node:url'
import { SolidStartInlineConfig, defineConfig } from '@solidjs/start/config'
import viteConfig, { isDev } from './vite.config'

const isVercel = Boolean(process.env.VERCEL)
const isNetlify = Boolean(process.env.NETLIFY)
const isBun = Boolean(process.env.BUN)
const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS)

const preset = isNetlify ? 'netlify' : isVercel ? 'vercel_edge' : isBun ? 'bun' : 'node'
console.info(`[app.config] solid-start preset {> ${preset} <}`)

// certs for local development
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const keyPath = path.join(__dirname, 'key.pem')
const certPath = path.join(__dirname, 'cert.pem')

// Функция для проверки SSL
function checkSSL(): { key: string; cert: string } | undefined {
  // Пропускаем для всех случаев кроме локальной разработки
  if (!isDev || isCI || isVercel || isNetlify || process.argv.includes('build')) {
    return undefined
  }

  try {
    // Только проверяем существующие сертификаты
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
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
    timing: true
  },
  ssr: true,
  server: {
    preset,
    port: 3000,
    https: checkSSL(),
    streaming: false
  },
  devOverlay: isDev,
  vite: viteConfig
} as SolidStartInlineConfig)
