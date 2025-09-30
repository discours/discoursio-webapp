import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, SolidStartInlineConfig } from '@solidjs/start/config'
import { config } from 'dotenv'

const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS)

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
const isNetlify = Boolean(process.env.NETLIFY)
const preset = isNetlify ? 'netlify' : isVercel ? 'vercel' : 'node'
console.info(`[app.config] solid-start preset {> ${preset} <} (VERCEL: ${isVercel})`)

// Загружаем .env файл с выводом информации о статусе
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[app.config] Loading .env file from:', envPath)
  config({ path: envPath })
} else {
  console.warn('[app.config] No .env file found')
}

import viteConfig, { isDev } from './vite.config'

console.log(`[app.config] vite ${isDev ? 'dev' : 'prod'} mode`)
console.log('[app.config] connected to api: ', process.env.PUBLIC_CORE_API || 'https://v3.dscrs.site/graphql')

// certs for local development
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const keyPath = join(__dirname, 'key.pem')
const certPath = join(__dirname, 'cert.pem')

// Автоматическая установка mkcert и генерация сертификатов
function setupHTTPS(): void {
  // Пропускаем для всех случаев кроме локальной разработки
  if (!isDev || isCI || isVercel || isNetlify || process.argv.includes('build')) {
    return
  }

  // Если сертификаты уже есть, ничего не делаем
  if (existsSync(keyPath) && existsSync(certPath)) {
    return
  }

  console.log('[app.config] 🔐 HTTPS certificates not found, setting up...')

  try {
    // Проверяем установлен ли mkcert
    let mkcertInstalled = false
    try {
      execSync('mkcert -version', { stdio: 'ignore' })
      mkcertInstalled = true
    } catch {
      mkcertInstalled = false
    }

    if (!mkcertInstalled) {
      const platform = process.platform

      if (platform === 'win32') {
        // Windows - только инструкция
        console.log('╔═══════════════════════════════════════════════════════════╗')
        console.log('║  🪟 Windows: Install mkcert manually                      ║')
        console.log('╠═══════════════════════════════════════════════════════════╣')
        console.log('║  1. Install Chocolatey: https://chocolatey.org/install    ║')
        console.log('║  2. Run as Administrator:                                 ║')
        console.log('║     choco install mkcert -y                               ║')
        console.log('║  3. Restart this dev server                               ║')
        console.log('╚═══════════════════════════════════════════════════════════╝')
        return
      }

      console.log('[app.config] 📦 Installing mkcert...')
      if (platform === 'darwin') {
        execSync('brew install mkcert && brew install nss', { stdio: 'inherit' })
      } else if (platform === 'linux') {
        execSync('sudo apt-get update && sudo apt-get install -y libnss3-tools', { stdio: 'inherit' })
        execSync('curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"', { cwd: '/tmp', stdio: 'inherit' })
        execSync('chmod +x /tmp/mkcert-v*-linux-amd64', { stdio: 'inherit' })
        execSync('sudo mv /tmp/mkcert-v*-linux-amd64 /usr/local/bin/mkcert', { stdio: 'inherit' })
      }
    }

    // Устанавливаем локальный CA
    console.log('[app.config] 🔧 Installing local CA...')
    execSync('mkcert -install', { stdio: 'inherit' })

    // Генерируем сертификаты
    console.log('[app.config] 🔑 Generating certificates...')
    execSync('mkcert localhost 127.0.0.1 ::1', { cwd: __dirname, stdio: 'inherit' })
    execSync('mv localhost+2-key.pem key.pem', { cwd: __dirname, stdio: 'inherit' })
    execSync('mv localhost+2.pem cert.pem', { cwd: __dirname, stdio: 'inherit' })

    console.log('[app.config] ✅ HTTPS setup complete!')
  } catch (_error) {
    console.log('[app.config] ⚠️  HTTPS setup failed, continuing with HTTP')
    if (process.platform === 'win32') {
      console.log('[app.config] 💡 Windows tip: Run as Administrator and install mkcert')
    }
  }
}

// Функция для проверки SSL
function checkSSL(): { key: string; cert: string } | undefined {
  // Пропускаем для всех случаев кроме локальной разработки
  if (!isDev || isCI || isVercel || isNetlify || process.argv.includes('build')) {
    return undefined
  }

  // Автоматически настраиваем HTTPS при первом запуске
  setupHTTPS()

  try {
    // Проверяем существующие сертификаты
    if (existsSync(keyPath) && existsSync(certPath)) {
      console.log('[app.config] 🔒 Using HTTPS certificates for development')
      return {
        key: keyPath,
        cert: certPath
      }
    }
  } catch {
    // Игнорируем любые ошибки
  }
  console.log('[app.config] 🌐 HTTPS certificates not found, using HTTP')
  return undefined
}

export default defineConfig({
  nitro: {
    timing: true,
    compatibilityDate: '2024-11-29',
    // Настройки для правильной работы с Vercel
    rollupConfig: {
      external: ['@vercel/og']
    },
    // Исправление для CI: принудительная генерация manifest.json
    ...(isCI && {
      experimental: {
        wasm: false
      },
      storage: {
        fs: {
          driver: 'fs',
          base: './.vinxi'
        }
      }
    })
  },
  // Edge runtime ТОЛЬКО для OG routes
  routeRules: {
    '/api/og/**': {
      prerender: false,
      runtime: 'edge', // Edge только для OG routes с WASM поддержкой
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    }
  },
  rollupConfig: {
    output: {
      inlineDynamicImports: false
    }
  },
  // Исправление для CI: обеспечиваем создание всех необходимых директорий
  ...(isCI && {
    routers: [
      {
        name: 'public',
        type: 'static',
        dir: './public',
        base: '/'
      },
      {
        name: 'server-fns',
        type: 'http',
        handler: './src/entry-server.tsx',
        target: 'server',
        base: '/_server'
      }
    ]
  }),
  ssr: true,
  server: {
    preset,
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    https: checkSSL(),
    ...(isDev && {
      host: '0.0.0.0', // Слушаем на всех интерфейсах
      strictPort: false, // Разрешаем выбор другого порта
      logLevel: 'info' // Подробные логи
    })
  },
  devOverlay: isDev,
  vite: viteConfig,
  experimental: {
    // Минимальные экспериментальные настройки для стабильности
    streaming: false,
    islands: false,
    hydration: true,
    router: {
      ssr: true
    }
  }
} as SolidStartInlineConfig)
