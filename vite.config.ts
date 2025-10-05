import { resolve } from 'node:path'
import { CSSOptions, defineConfig, LightningCSSOptions } from 'vite'
import { nodePolyfills, PolyfillOptions } from 'vite-plugin-node-polyfills'

const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI

const polyfillOptions = {
  include: ['path', 'stream', 'util', 'buffer'],
  exclude: ['http'],
  globals: { Buffer: true },
  overrides: { fs: 'memfs' },
  protocolImports: true
} as PolyfillOptions

export default defineConfig({
  server: {
    hmr: {
      timeout: 120000, // Увеличиваем HMR таймаут
      overlay: true // Показываем overlay с ошибками
    },
    watch: {
      // Следим за изменениями в SCSS файлах явно
      usePolling: false,
      interval: 100
    }
  },
  resolve: {
    alias: {
      '~': resolve('./src'),
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
      },
      cssModules: {
        // В dev режиме упрощаем имена классов для лучшего HMR
        generateScopedName: isDev ? '[name]__[local]' : '[name]__[local]___[hash:base64:5]'
      }
    } as LightningCSSOptions,
    modules: {
      // В dev режиме упрощаем имена классов для лучшего HMR
      generateScopedName: isDev ? '[name]__[local]' : '[name]__[local]___[hash:base64:5]'
    },
    devSourcemap: isDev, // Source maps для стилей в dev режиме
    preprocessorOptions: {
      scss: {
        // Используем modern-compiler API везде для избежания deprecation warnings
        api: 'modern-compiler',
        quietDeps: true,
        silenceDeprecations: ['mixed-decls', 'legacy-js-api', 'import', 'global-builtin', 'color-4-api'],
        logger: {
          warn: () => {} // Полностью отключаем warnings от Sass
        },
        additionalData: (content: string) => `@use '~/styles/global' as *;\n${content}`,
        includePaths: ['./public', './src/styles', './node_modules']
      }
    } as CSSOptions['preprocessorOptions']
  },
  plugins: [nodePolyfills(polyfillOptions)],
  publicDir: 'public',
  // Расширяем список разрешенных типов файлов
  assetsInclude: [
    '**/*.svg',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.woff',
    '**/*.woff2',
    '**/icons/**/*',
    '**/public/**/*'
  ],
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
    // Отключение предупреждений о неразрешенных статических ресурсах
    assetsInlineLimit: 0,
    rollupOptions: {
      external: ['bufferutil', 'utf-8-validate'],
      output: {
        // Копирование статических файлов без предупреждений
        assetFileNames: (assetInfo) => {
          // Сохраняем оригинальную структуру путей
          return assetInfo.name || ''
        },
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
