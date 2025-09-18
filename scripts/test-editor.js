#!/usr/bin/env node

/**
 * @file Скрипт для быстрого запуска тестов редактора
 * @description Запускает тесты редактора с детальным логированием
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    log(`🚀 Запускаем: ${command} ${args.join(' ')}`, 'cyan')

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

async function main() {
  const args = process.argv.slice(2)

  log('🧪 === ТЕСТИРОВАНИЕ RICH EDITOR ===', 'bright')
  log('', 'reset')

  // Определяем какой тест запускать
  let testPattern = '**/9*-*editor*.spec.ts'
  const configFile = 'playwright-editor.config.ts'

  if (args.includes('--debug')) {
    testPattern = '**/91-editor-debug*.spec.ts'
    log('🔍 Режим отладки: запускаем только отладочные тесты', 'yellow')
  } else if (args.includes('--all')) {
    testPattern = '**/90-rich-editor*.spec.ts'
    log('📋 Полное тестирование: запускаем все тесты редактора', 'blue')
  } else {
    log('🎯 Стандартный режим: запускаем основные тесты', 'green')
  }

  // Дополнительные флаги
  const playwrightArgs = [
    'test',
    '--config',
    configFile,
    '--grep',
    testPattern.replace('**/', '').replace('.spec.ts', '')
  ]

  if (args.includes('--headed')) {
    playwrightArgs.push('--headed')
    log('👁️  Режим с интерфейсом браузера', 'magenta')
  }

  if (args.includes('--debug-pw')) {
    playwrightArgs.push('--debug')
    log('🐛 Режим отладки Playwright', 'red')
  }

  if (args.includes('--ui')) {
    playwrightArgs.push('--ui')
    log('🖥️  Режим UI Playwright', 'cyan')
  }

  try {
    log('', 'reset')
    log('📝 Доступные команды:', 'bright')
    log('  npm run test:editor           - Основные тесты', 'reset')
    log('  npm run test:editor --debug   - Отладочные тесты', 'reset')
    log('  npm run test:editor --headed  - С интерфейсом браузера', 'reset')
    log('  npm run test:editor --ui      - UI режим Playwright', 'reset')
    log('', 'reset')

    await runCommand('npx', ['playwright', ...playwrightArgs])

    log('', 'reset')
    log('✅ Тесты завершены успешно!', 'green')
    log('📊 Отчет доступен в: playwright-report-editor/', 'cyan')
  } catch (error) {
    log('', 'reset')
    log('❌ Ошибка при выполнении тестов:', 'red')
    log(error.message, 'red')
    log('', 'reset')
    log('💡 Попробуйте:', 'yellow')
    log('  - Проверить что сервер запущен (npm run dev)', 'reset')
    log('  - Запустить с --headed для визуальной отладки', 'reset')
    log('  - Проверить логи в консоли браузера', 'reset')

    process.exit(1)
  }
}

// Обработка прерывания
process.on('SIGINT', () => {
  log('', 'reset')
  log('⏹️  Тестирование прервано пользователем', 'yellow')
  process.exit(0)
})

main().catch((error) => {
  log('💥 Критическая ошибка:', 'red')
  console.error(error)
  process.exit(1)
})
