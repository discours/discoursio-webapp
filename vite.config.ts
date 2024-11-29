// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { CSSOptions, LogLevel, LoggerOptions, createLogger, defineConfig } from 'vite'
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
        silenceDeprecations: ['mixed-decls', 'legacy-js-api'],
        additionalData: (content: string) => `@use '~/styles/global' as *;\n${content}`,
        includePaths: ['./public', './src/styles', './node_modules']
      }
    } as CSSOptions['preprocessorOptions']
  },
  customLogger,
  plugins: [nodePolyfills(), sassDts()],
  build: {
    target: 'esnext',
    sourcemap: isDev,
    minify: 'terser',
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
    include: ['solid-js', 'solid-js/web', '@urql/core', 'solid-tiptap'],
    exclude: ['i18next-icu']
  }
})
