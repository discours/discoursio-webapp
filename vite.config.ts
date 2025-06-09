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
  include: ['path', 'stream', 'util', 'buffer'],
  exclude: ['http'],
  globals: { Buffer: true },
  overrides: { fs: 'memfs' },
  protocolImports: true
} as PolyfillOptions

export default defineConfig({
  assetsInclude: ['**/*.wasm'], // Include WASM files as assets
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@': resolve('./public')
    }
  },
  envPrefix: 'PUBLIC_',
  css: {
    // Включаем Lightning CSS transformer после исправления ::global
    transformer: 'lightningcss',
    lightningcss: {
      // Целевые браузеры для максимальной совместимости
      targets: {
        chrome: 95,
        firefox: 90,
        safari: 14,
        edge: 95
      },
      // Включаем только поддерживаемые draft CSS features
      drafts: {
        customMedia: true
      }
    },
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },
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
    cssMinify: 'lightningcss',
    chunkSizeWarningLimit: 777,
    terserOptions: {
      compress: {
        drop_console: !isDev
      }
    },
    rollupOptions: {
      external: ['bufferutil', 'utf-8-validate'],
      output: {
        sourcemapExcludeSources: true,
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('swiper')) {
              return 'swiper'
            }

            if (id.includes('typograf')) {
              return 'typograf'
            }

            if (id.includes('i18next')) {
              return 'i18next'
            }

            if (id.includes('graphql')) {
              return 'graphql'
            }

            if (id.includes('@solidjs/start')) {
              return 'solid-start'
            }

            if (id.includes('solid')) {
              return 'solid'
            }
          }
        }
      }
    }
  },
  ssr: {
    external: ['@vercel/og'],
    noExternal: ['@urql/core', '@solidjs/meta', '@solidjs/router'],
    target: 'node',
    optimizeDeps: {
      include: ['@urql/core']
    }
  },
  optimizeDeps: {
    include: ['@urql/core', 'buffer']
  }
})
