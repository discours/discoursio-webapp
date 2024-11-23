// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import path from 'node:path'
import dotenv from 'dotenv'
import { CSSOptions, LogLevel, LoggerOptions, createLogger, defineConfig } from 'vite'
import { PolyfillOptions, nodePolyfills } from 'vite-plugin-node-polyfills'
import sassDts from 'vite-plugin-sass-dts'

// Загружаем .env файл с выводом информации о статусе
const envPath = path.resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[vite.config] Loading .env file from:', envPath)
  dotenv.config({ path: envPath })
} else {
  console.warn('[vite.config] No .env file found')
}

export const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI
console.log(`[vite.config] ${process.env.NODE_ENV} mode`)

const customLogger = createLogger(
  'debug' as LogLevel,
  {
    warn: (message: string, options: LoggerOptions) => {
      console.debug(message)
      if (message.startsWith('Future global-builtin')) {
        return // Игнорируем это конкретное предупреждение
      }
      console.warn(message, options)
    }
  } as LoggerOptions
)

const polyfillOptions = {
  include: ['path', 'stream', 'util'],
  exclude: ['http'],
  globals: { Buffer: true },
  overrides: { fs: 'memfs' },
  protocolImports: true
} as PolyfillOptions

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
  plugins: [nodePolyfills(polyfillOptions), sassDts()],
  build: {
    target: 'esnext',
    sourcemap: true,
    minify: 'terser', // explicit terser usage
    terserOptions: {
      compress: {
        drop_console: true // removes console logs in production
      }
    },
    rollupOptions: {
      plugins: [], // visualizer()]
      output: {
        manualChunks: {
          icons: ['./src/components/_shared/Icon/Icon.tsx'],
          session: ['./src/context/session.tsx'],
          localize: ['./src/context/localize.tsx'],
          editor: ['./src/context/editor.tsx'],
          connect: ['./src/context/connect.tsx']
        }
      }
    },
    commonjsOptions: {
      ignore: ['punycode']
    }
  },
  define: {
    'process.env': JSON.stringify({
      NODE_ENV: process.env.NODE_ENV,
      // Добавляем только те переменные, которые начинаются с PUBLIC_
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('PUBLIC_')))
    }),
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['solid-tiptap', 'buffer'],
    exclude: ['punycode']
  }
})
