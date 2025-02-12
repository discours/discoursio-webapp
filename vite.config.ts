// biome-ignore lint/correctness/noNodejsModules: build
import { existsSync } from 'node:fs'
// biome-ignore lint/correctness/noNodejsModules: build
import { resolve } from 'node:path'
// biome-ignore lint/correctness/noNodejsModules: build
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { CSSOptions, defineConfig } from 'vite'
import { PolyfillOptions, nodePolyfills } from 'vite-plugin-node-polyfills'
import sassDts from 'vite-plugin-sass-dts'

// Загружаем .env файл с выводом информации о статусе
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  console.log('[vite.config] Loading .env file from:', envPath)
  config({ path: envPath })
} else {
  console.warn('[vite.config] No .env file found')
}

export const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI
console.log(`[vite.config] ${isDev ? 'dev' : 'prod'} mode`)

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
      '~': fileURLToPath(new URL('./src', import.meta.url)),
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
        sourcemapExcludeSources: true
      }
    }
  },
  ssr: {
    noExternal: ['@urql/core', '@solidjs/meta', '@solidjs/router'],
    target: 'node',
    optimizeDeps: {
      include: ['@urql/core']
    }
  },
  optimizeDeps: {
    include: ['buffer']
  }
})
