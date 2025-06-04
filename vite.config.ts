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

// Conditional polyfills - disable for Edge runtime files and @vercel/og
const conditionalNodePolyfills = () => {
  return {
    name: 'conditional-node-polyfills',
    resolveId(id: string, importer?: string) {
      // Complete exclusion: Skip ALL polyfills for anything related to @vercel/og, OG routes, or WASM
      const shouldSkipPolyfills = (
        // Skip if the ID itself is related to @vercel/og or WASM
        id.includes('@vercel/og') ||
        id.includes('.wasm') ||
        id.includes('path-browserify') ||
        id.includes('stream-browserify') ||
        // Skip if the importer is related to @vercel/og, OG routes, or WASM
        (importer && (
          importer.includes('/api/og/') ||
          importer.includes('@vercel/og') ||
          importer.includes('.wasm') ||
          importer.includes('index.edge.js')
        ))
      )
      
      if (shouldSkipPolyfills) {
        return null
      }
      
      // For all other cases, apply normal polyfills
      const basePlugin = nodePolyfills(polyfillOptions)
      return basePlugin.resolveId?.(id, importer)
    },
    load(id: string) {
      // Skip polyfill loading for @vercel/og related modules
      const shouldSkipPolyfills = (
        id.includes('@vercel/og') ||
        id.includes('.wasm') ||
        id.includes('path-browserify') ||
        id.includes('stream-browserify')
      )
      
      if (shouldSkipPolyfills) {
        return null
      }
      
      // For all other cases, apply normal polyfills
      const basePlugin = nodePolyfills(polyfillOptions)
      return basePlugin.load?.(id)
    }
  }
}

// Determine if we're running on Vercel (Edge) or local (Node.js SSR)
const isVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  assetsInclude: ['**/*.wasm'], // Include WASM files as assets
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@': resolve('./public'),
      '/icons': resolve('./public/icons'),
      '/fonts': resolve('./public/fonts'),
      // Only force Edge runtime version of @vercel/og on Vercel
      ...(isVercel ? { '@vercel/og': resolve('./node_modules/@vercel/og/dist/index.edge.js') } : {})
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
  plugins: [
    conditionalNodePolyfills(), 
    sassDts(),
    // Force Edge runtime version of @vercel/og
    {
      name: 'force-vercel-og-edge',
      resolveId(id, importer) {
        // Force Edge version of @vercel/og in all environments
        if (id === '@vercel/og') {
          return '@vercel/og/dist/index.edge.js'
        }
        return null
      }
    },
    // Handle WASM modules for @vercel/og in Edge runtime
    {
      name: 'edge-wasm-handler',
      resolveId(id) {
        // Handle WASM module imports for @vercel/og
        if (id.includes('@vercel/og/dist/') && id.includes('.wasm?module')) {
          return id // Keep the ID for custom handling
        }
        return null
      },
      load(id) {
        // For WASM modules, provide the actual WASM buffer
        if (id.includes('@vercel/og/dist/') && id.includes('.wasm?module')) {
          const wasmFileName = id.split('/').pop()?.replace('?module', '') || ''
          
          // Return a module that loads the WASM file as buffer
          return `
            import { readFileSync } from 'fs';
            import { resolve } from 'path';
            
            // Load WASM file as buffer for WebAssembly.instantiate()
            const wasmPath = resolve('./node_modules/@vercel/og/dist/${wasmFileName}');
            const wasmBuffer = readFileSync(wasmPath);
            
            export default wasmBuffer;
          `
        }
        return null
      }
    }
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