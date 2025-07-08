/// <reference types="vitest" />

import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve('./src'),
      '@': resolve('./public')
    }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/unit/setup.ts'],
    globals: true,
    include: [
      // Простой тест для проверки работы vitest
      'tests/unit/simple-test.test.ts',
      // Тест валидации с встроенными функциями
      'tests/unit/validation-inline.test.ts'
    ],
    server: {
      deps: {
        external: [
          '@solidjs/start',
          '@solidjs/start/config',
          'vinxi',
          'solid-js',
          'solid-js/web',
          '@solidjs/router'
        ]
      }
    }
  },
  define: {
    'import.meta.env.SSR': false,
    'import.meta.env.DEV': true,
    'import.meta.env.PROD': false
  }
})
