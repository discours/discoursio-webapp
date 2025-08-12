#!/usr/bin/env node

/**
 * Быстрый просмотр статистики тестов
 * Выводит таблицу с результатами в консоль
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class TestStatsViewer {
  constructor() {
    this.testResultsDir = path.join(__dirname, '../test-results')
    this.testFilesDir = path.join(__dirname, '../tests/e2e')
  }

  /**
   * Получение статистики тестов
   */
  async getTestStats() {
    const stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      duration: 0
    }

    if (!fs.existsSync(this.testResultsDir)) {
      return stats
    }

    const resultFiles = fs.readdirSync(this.testResultsDir)

    for (const file of resultFiles) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(this.testResultsDir, file), 'utf8')
          const data = JSON.parse(content)

          if (data.stats) {
            stats.total += data.stats.total || 0
            stats.passed += data.stats.passed || 0
            stats.failed += data.stats.failed || 0
            stats.skipped += data.stats.skipped || 0
            stats.flaky += data.stats.flaky || 0
            stats.duration += data.stats.duration || 0
          }
        } catch (error) {
          // Игнорируем ошибки чтения
        }
      }
    }

    return stats
  }

  /**
   * Подсчет файлов тестов
   */
  countTestFiles() {
    if (!fs.existsSync(this.testFilesDir)) {
      return 0
    }

    let count = 0
    const countFiles = (dir) => {
      const items = fs.readdirSync(dir)

      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          countFiles(fullPath)
        } else if (item.endsWith('.spec.ts') || item.endsWith('.test.ts')) {
          count++
        }
      }
    }

    countFiles(this.testFilesDir)
    return count
  }

  /**
   * Вывод таблицы статистики
   */
  displayStats(stats, testFileCount) {
    const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0

    console.log('\n🧪 СТАТИСТИКА ТЕСТОВ')
    console.log('═══════════════════════════════════════════════════════════════')

    // Основная статистика
    console.log(`📊 Всего тестов:     ${stats.total.toString().padStart(8)}`)
    console.log(`✅ Пройдено:         ${stats.passed.toString().padStart(8)}`)
    console.log(`❌ Провалено:        ${stats.failed.toString().padStart(8)}`)
    console.log(`⏭️ Пропущено:        ${stats.skipped.toString().padStart(8)}`)
    console.log(`🔄 Нестабильные:     ${stats.flaky.toString().padStart(8)}`)
    console.log(`📁 Файлов тестов:    ${testFileCount.toString().padStart(8)}`)

    console.log('═══════════════════════════════════════════════════════════════')

    // Процент успеха
    console.log(`📈 Процент успеха:   ${passRate.toString().padStart(8)}%`)

    // Прогресс-бар
    const barLength = 30
    const filledLength = Math.floor((passRate / 100) * barLength)
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
    console.log(`📊 Прогресс:         [${bar}]`)

    // Рекомендации
    console.log('\n🎯 РЕКОМЕНДАЦИИ:')
    if (stats.failed > 0) {
      console.log(`   🔴 Исправить ${stats.failed} проваленных тестов`)
    }
    if (stats.flaky > 0) {
      console.log(`   🟡 Исследовать ${stats.flaky} нестабильных тестов`)
    }
    if (passRate < 80) {
      console.log('   📉 Улучшить качество тестов (ниже 80%)')
    }
    if (passRate >= 90) {
      console.log('   🎉 Отличная работа! Тесты стабильны')
    }

    console.log('\n💡 Для детального отчета: npm run test:coverage')
  }

  /**
   * Основной метод
   */
  async showStats() {
    const stats = await this.getTestStats()
    const testFileCount = this.countTestFiles()

    this.displayStats(stats, testFileCount)
  }
}

// Запуск
const viewer = new TestStatsViewer()
viewer.showStats().catch(console.error)
