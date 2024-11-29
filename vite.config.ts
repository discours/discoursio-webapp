// biome-ignore lint/correctness/noNodejsModules: build
import { execSync } from 'node:child_process'
// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { CSSOptions, LogLevel, LoggerOptions, createLogger, defineConfig } from 'vite'
import type { ServerOptions } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import sassDts from 'vite-plugin-sass-dts'

// Загружаем .env
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[vite.config] Loading .env file from:', envPath)
  config({ path: envPath })
} else {
  console.warn('[vite.config] No .env file found')
}

const I18NEXT_REGEX = /(i18next|messageformat|time-ago)/i
const UI_REGEX = /(cropperjs|swiper|tippy|popper)/i
const GRAPHQL_REGEX = /(@urql|graphql|wonka)/i
const SOLID_REGEX = /(solid-js|@solidjs)/i
const EDITOR_REGEX = /(prosemirror|tiptap|yjs)/i

export const isDev = process.env.NODE_ENV !== 'production'

// Базовая конфигурация логгера
const customLogger = createLogger(
  'info' as LogLevel,
  {
    warn: (message: string, options: LoggerOptions) => {
      if (message.startsWith('Future global-builtin')) return
      console.warn(message, options)
    }
  } as LoggerOptions
)

function generateSSLCertificate(): ServerOptions['https'] {
  // Генерируем сертификат только для локальной разработки
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.CI && !process.env.GITHUB_ACTIONS && !process.env.VERCEL

  if (!isLocalDev) {
    return undefined
  }

  try {
    // Используем существующие сертификаты если есть
    if (existsSync('./key.pem') && existsSync('./cert.pem')) {
      return {
        key: './key.pem',
        cert: './cert.pem'
      }
    }

    // Тихая проверка наличия mkcert
    try {
      execSync('which mkcert', { stdio: 'ignore' })
    } catch {
      return undefined
    }
    
    // Генерация сертификатов
    execSync('mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1', {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    return {
      key: './key.pem',
      cert: './cert.pem'
    }
  } catch (error) {
    if (error instanceof Error) {
      console.debug('SSL setup skipped:', error.message)
    }
    return undefined
  }
}

// В конфигурации сервера добавим условие для определения порта
const serverConfig: ServerOptions = {
  https: generateSSLCertificate(),
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  host: true
}

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve('./src'),
      '@': resolve('./public'),
      '/icons': resolve('./public/icons'),
      '/fonts': resolve('./public/fonts')
    }
  },
  envPrefix: 'PUBLIC_',
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        quietDeps: true,
        silenceDeprecations: ['mixed-decls', 'legacy-js-api'], // 'global-builtin'],
        additionalData: (content: string) => `@use '~/styles/global' as *;\n${content}`,
        includePaths: ['./public', './src/styles', './node_modules']
      }
    } as CSSOptions['preprocessorOptions']
  },
  customLogger,
  plugins: [nodePolyfills(), sassDts()],
  build: {
    target: 'esnext',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true }
    },
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Основные вендоры
          if (id.includes('node_modules')) {
            // Редактор
            if (id.match(EDITOR_REGEX)) {
              return 'vendor.editor'
            }
            // GraphQL стек
            if (id.match(GRAPHQL_REGEX)) {
              return 'vendor.graphql'
            }
            // Solid.js
            if (id.match(SOLID_REGEX)) {
              return 'vendor.solid'
            }
            // i18n
            if (id.match(I18NEXT_REGEX)) {
              return 'vendor.i18n'
            }
            // UI компоненты
            if (id.match(UI_REGEX)) {
              return 'vendor.ui'
            }
            // Остальные вендоры
            return 'vendor.shared'
          }

          // Группировка приложения
          if (id.includes('/src/')) {
            if (id.includes('/components/Views/')) return 'app.pages'
            if (id.includes('/components/Editor/')) return 'app.editor'
            if (id.includes('/components/Article/')) return 'app.article'
            if (id.includes('/components/_shared/')) return 'app.shared'
            return 'app.core'
          }

          return null
        }
      }
    }
  },

  optimizeDeps: {
    include: ['solid-js', 'solid-js/web', '@urql/core', 'solid-tiptap']
  },
  server: serverConfig
})
