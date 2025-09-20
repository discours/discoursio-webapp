#!/usr/bin/env node

/**
 * Скрипт для запуска E2E тестов загрузки файлов в редактор
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🧪 Запуск E2E тестов загрузки файлов...')

// Запускаем Playwright тесты
const playwrightProcess = spawn(
  'npx',
  ['playwright', 'test', 'tests/e2e/editor-upload-test.spec.ts', '--config=playwright.config.ts', '--reporter=list'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
  }
)

playwrightProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Тесты загрузки завершены успешно')
  } else {
    console.log(`❌ Тесты завершились с кодом: ${code}`)
    process.exit(code)
  }
})

playwrightProcess.on('error', (error) => {
  console.error('❌ Ошибка запуска тестов:', error)
  process.exit(1)
})
