// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import path, { resolve } from 'node:path'
import { config } from 'dotenv'
import { CSSOptions, LogLevel, LoggerOptions, createLogger, defineConfig } from 'vite'
import { PolyfillOptions, nodePolyfills } from 'vite-plugin-node-polyfills'
import sassDts from 'vite-plugin-sass-dts'

// Загружаем .env файл с выводом информации о статусе
const envPath = path.resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[vite.config] Loading .env file from:', envPath)
  config({ path: envPath })
} else {
  console.warn('[vite.config] No .env file found')
}

export const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI
console.log(`[vite.config] ${isDev ? 'dev' : 'prod'} mode`)

const EDITOR_REGEX = /\/(solid-tiptap|@tiptap\/|prosemirror-|y-prosemirror|yjs)/
const GRAPHQL_REGEX = /\/(urql|graphql|@urql\/core)/
const SOLID_REGEX = /\/(solid-js|@solidjs\/|solid-popper|solid-transition-group|solid-tiptap)/
const I18NEXT_REGEX = /\/(i18next|i18next-http-backend|i18next-icu|intl-messageformat)/
const UI_REGEX = /\/(tippy\.js|swiper|cropperjs|@solid-primitives)/

const polyfillOptions = {
  include: ['path', 'stream', 'util'],
  exclude: ['http'],
  globals: { Buffer: true },
  overrides: { fs: 'memfs' },
  protocolImports: true
} as PolyfillOptions

// Базовая конфигурация логгера
const customLogger = createLogger(
  'info' as LogLevel,
  {
    warn: (message: string, options: LoggerOptions) => {
      // Игнорируем определенные предупреждения
      if (
        message.includes('legacy JS API') ||
        message.includes('mixed-decls') ||
        message.startsWith('Future global-builtin')
      ) {
        return
      }
      console.warn(message, options)
    }
  } as LoggerOptions
)

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
        silenceDeprecations: ['mixed-decls'], // 'legacy-js-api'],
        additionalData: (content: string) => `@use '~/styles/global' as *;\n${content}`,
        includePaths: ['./public', './src/styles', './node_modules']
      }
    } as CSSOptions['preprocessorOptions']
  },
  customLogger,
  plugins: [nodePolyfills(polyfillOptions), sassDts()],
  build: {
    target: 'esnext',
    sourcemap: isDev,
    minify: 'terser',
    chunkSizeWarningLimit: 777,
    terserOptions: {
      compress: {
        drop_console: !isDev
      }
    },
    rollupOptions: {
      output: {
        sourcemapExcludeSources: true,
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            if (id.match(EDITOR_REGEX)) return 'vendor.editor'
            if (id.match(GRAPHQL_REGEX)) return 'vendor.graphql'
            if (id.match(SOLID_REGEX)) return 'vendor.solid'
            if (id.match(I18NEXT_REGEX)) return 'vendor.i18n'
            if (id.match(UI_REGEX)) return 'vendor.ui'
            return 'vendor.shared'
          }

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
    include: ['solid-tiptap', 'buffer']
  }
})
