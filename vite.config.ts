// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import path from 'node:path'
import dotenv from 'dotenv'
import { CSSOptions, LogLevel, LoggerOptions, createLogger, defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import sassDts from 'vite-plugin-sass-dts'

// Загружаем .env
const envPath = path.resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[vite.config] Loading .env file from:', envPath)
  dotenv.config({ path: envPath })
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

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve('./src'),
      '@': path.resolve('./public'),
      '/icons': path.resolve('./public/icons'),
      '/fonts': path.resolve('./public/fonts')
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
    include: ['solid-js', 'solid-js/web', '@solidjs/router', '@urql/core', 'solid-tiptap']
  }
})
