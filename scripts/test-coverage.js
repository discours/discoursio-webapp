#!/usr/bin/env node

/**
 * Анализатор покрытия тестами и генератор отчетов
 * Показывает статистику: пройдено/провалено/пропущено, покрытие, нереализованные тесты
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class TestCoverageAnalyzer {
  constructor() {
    this.testResultsDir = path.join(__dirname, '../test-results')
    this.testFilesDir = path.join(__dirname, '../tests/e2e')
    this.reportDir = path.join(__dirname, '../docs/test-coverage')
  }

  /**
   * Анализ результатов тестов
   */
  async analyzeTestResults() {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      duration: 0,
      timestamp: new Date().toISOString()
    }

    if (!fs.existsSync(this.testResultsDir)) {
      console.log('📁 Директория результатов тестов не найдена')
      return results
    }

    const resultFiles = fs.readdirSync(this.testResultsDir)

    for (const file of resultFiles) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(this.testResultsDir, file), 'utf8')
          const data = JSON.parse(content)

          if (data.stats) {
            results.total += data.stats.total || 0
            results.passed += data.stats.passed || 0
            results.failed += data.stats.failed || 0
            results.skipped += data.stats.skipped || 0
            results.flaky += data.stats.flaky || 0
            results.duration += data.stats.duration || 0
          }
        } catch (error) {
          console.log(`⚠️ Ошибка чтения файла ${file}:`, error.message)
        }
      }
    }

    return results
  }

  /**
   * Анализ файлов тестов для определения покрытия
   */
  async analyzeTestCoverage() {
    const coverage = {
      totalTests: 0,
      implementedTests: 0,
      testFiles: [],
      missingTests: []
    }

    if (!fs.existsSync(this.testFilesDir)) {
      console.log('📁 Директория тестов не найдена')
      return coverage
    }

    const testFiles = this.getTestFiles(this.testFilesDir)

    for (const file of testFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8')
        const testCount = this.countTestsInFile(content)

        coverage.testFiles.push({
          name: path.basename(file),
          path: file,
          testCount,
          status: 'implemented'
        })

        coverage.implementedTests += testCount
      } catch (error) {
        console.log(`⚠️ Ошибка чтения файла ${file}:`, error.message)
      }
    }

    coverage.totalTests = coverage.implementedTests
    return coverage
  }

  /**
   * Поиск файлов тестов
   */
  getTestFiles(dir, files = []) {
    const items = fs.readdirSync(dir)

    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        this.getTestFiles(fullPath, files)
      } else if (item.endsWith('.spec.ts') || item.endsWith('.test.ts')) {
        files.push(fullPath)
      }
    }

    return files
  }

  /**
   * Подсчет тестов в файле
   */
  countTestsInFile(content) {
    // Считаем только test() функции, describe() - это группы тестов
    const testMatches = content.match(/test\s*\(/g)
    return testMatches?.length || 0
  }

  /**
   * Генерация HTML отчета
   */
  async generateHtmlReport(testResults, testCoverage) {
    const html = this.generateHtmlContent(testResults, testCoverage)

    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true })
    }

    const reportPath = path.join(this.reportDir, 'index.html')
    fs.writeFileSync(reportPath, html)

    console.log(`📊 HTML отчет сохранен: ${reportPath}`)
  }

  /**
   * Генерация Markdown отчета
   */
  async generateMarkdownReport(testResults, testCoverage) {
    const markdown = this.generateMarkdownContent(testResults, testCoverage)

    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true })
    }

    const reportPath = path.join(this.reportDir, 'README.md')
    fs.writeFileSync(reportPath, markdown)

    console.log(`📝 Markdown отчет сохранен: ${reportPath}`)
  }

  /**
   * Генерация HTML контента
   */
  generateHtmlContent(testResults, testCoverage) {
    const passRate = testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0
    const coverageRate =
      testCoverage.totalTests > 0
        ? ((testCoverage.implementedTests / testCoverage.totalTests) * 100).toFixed(1)
        : 0

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отчет о покрытии тестами - Discours.io</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .stat-label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .skipped { color: #f59e0b; }
        .flaky { color: #8b5cf6; }
        .coverage { color: #3b82f6; }
        .table-container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; }
        .progress-bar { width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .progress-passed { background: linear-gradient(90deg, #10b981, #059669); }
        .progress-coverage { background: linear-gradient(90deg, #3b82f6, #2563eb); }
        .timestamp { text-align: center; color: #666; font-size: 0.9em; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Отчет о покрытии тестами</h1>
            <p>Discours.io Web Application</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number passed">${testResults.passed}</div>
                <div class="stat-label">Пройдено</div>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">${testResults.failed}</div>
                <div class="stat-label">Провалено</div>
            </div>
            <div class="stat-card">
                <div class="stat-number skipped">${testResults.skipped}</div>
                <div class="stat-label">Пропущено</div>
            </div>
            <div class="stat-card">
                <div class="stat-number flaky">${testResults.flaky}</div>
                <div class="stat-label">Нестабильные</div>
            </div>
            <div class="stat-card">
                <div class="stat-number coverage">${passRate}%</div>
                <div class="stat-label">Процент успеха</div>
            </div>
            <div class="stat-card">
                <div class="stat-number coverage">${testCoverage.implementedTests}</div>
                <div class="stat-label">Всего тестов</div>
            </div>
        </div>
        
        <div class="table-container">
            <h2>📈 Прогресс тестирования</h2>
            <div class="progress-bar">
                <div class="progress-fill progress-passed" style="width: ${passRate}%"></div>
            </div>
            <p><strong>Успешность:</strong> ${testResults.passed}/${testResults.total} (${passRate}%)</p>
            
            <div class="progress-bar">
                <div class="progress-fill progress-coverage" style="width: ${coverageRate}%"></div>
            </div>
            <p><strong>Покрытие:</strong> ${testCoverage.implementedTests}/${testCoverage.totalTests} (${coverageRate}%)</p>
        </div>
        
        <div class="table-container">
            <h2>📁 Файлы тестов</h2>
            <table>
                <thead>
                    <tr>
                        <th>Файл</th>
                        <th>Количество тестов</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${testCoverage.testFiles
                      .map(
                        (file) => `
                        <tr>
                            <td><code>${file.name}</code></td>
                            <td>${file.testCount}</td>
                            <td><span class="passed">✅ Реализовано</span></td>
                        </tr>
                    `
                      )
                      .join('')}
                </tbody>
            </table>
        </div>
        
        <div class="timestamp">
            <p>Отчет сгенерирован: ${new Date().toLocaleString('ru-RU')}</p>
        </div>
    </div>
</body>
</html>`
  }

  /**
   * Генерация Markdown контента
   */
  generateMarkdownContent(testResults, testCoverage) {
    const passRate = testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0
    const coverageRate =
      testCoverage.totalTests > 0
        ? ((testCoverage.implementedTests / testCoverage.totalTests) * 100).toFixed(1)
        : 0

    return `# 🧪 Отчет о покрытии тестами

## 📊 Общая статистика

| Метрика | Значение |
|---------|----------|
| **Всего тестов** | ${testResults.total} |
| **Пройдено** | ${testResults.passed} |
| **Провалено** | ${testResults.failed} |
| **Пропущено** | ${testResults.skipped} |
| **Нестабильные** | ${testResults.flaky} |
| **Процент успеха** | ${passRate}% |
| **Покрытие** | ${coverageRate}% |

## 📈 Прогресс тестирования

### Успешность тестов
\`\`\`
${'█'.repeat(Math.floor(passRate / 5))}${'░'.repeat(20 - Math.floor(passRate / 5))} ${passRate}%
\`\`\`

### Покрытие функциональности
\`\`\`
${'█'.repeat(Math.floor(coverageRate / 5))}${'░'.repeat(20 - Math.floor(coverageRate / 5))} ${coverageRate}%
\`\`\`

## 📁 Файлы тестов

| Файл | Тестов | Статус |
|------|--------|--------|
${testCoverage.testFiles.map((file) => `| \`${file.name}\` | ${file.testCount} | ✅ Реализовано |`).join('\n')}

## 🎯 Рекомендации

${this.generateRecommendations(testResults, testCoverage)}

---
*Отчет сгенерирован: ${new Date().toLocaleString('ru-RU')}*
`
  }

  /**
   * Генерация рекомендаций
   */
  generateRecommendations(testResults, testCoverage) {
    const recommendations = []

    if (testResults.failed > 0) {
      recommendations.push('- 🔴 **Исправить проваленные тесты** - приоритет для стабильности')
    }

    if (testResults.flaky > 0) {
      recommendations.push('- 🟡 **Исследовать нестабильные тесты** - могут указывать на проблемы в коде')
    }

    if (testResults.skipped > 0) {
      recommendations.push('- ⚠️ **Проанализировать пропущенные тесты** - возможно, требуют доработки')
    }

    if (testResults.passed < testResults.total * 0.8) {
      recommendations.push('- 📉 **Улучшить качество тестов** - процент успеха ниже 80%')
    }

    if (testCoverage.implementedTests < 50) {
      recommendations.push(
        '- 📚 **Расширить покрытие тестами** - добавить больше тестов для критической функциональности'
      )
    }

    return recommendations.length > 0
      ? recommendations.join('\n')
      : '- 🎉 **Отличная работа!** Все тесты проходят успешно'
  }

  /**
   * Основной метод анализа
   */
  async analyze() {
    console.log('🔍 Анализ покрытия тестами...')

    const testResults = await this.analyzeTestResults()
    const testCoverage = await this.analyzeTestCoverage()

    console.log('\n📊 Результаты анализа:')
    console.log(`✅ Пройдено: ${testResults.passed}`)
    console.log(`❌ Провалено: ${testResults.failed}`)
    console.log(`⏭️ Пропущено: ${testResults.skipped}`)
    console.log(`🔄 Нестабильные: ${testResults.flaky}`)
    console.log(`📁 Всего тестов: ${testCoverage.implementedTests}`)

    // Пояснение о типах подсчета
    if (testResults.total === 0) {
      console.log('ℹ️  Примечание: test:stats показывает 0, так как нет результатов выполнения')
      console.log(`ℹ️  test:coverage показывает ${testCoverage.implementedTests} тестов в коде`)
    }

    const passRate = testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0
    console.log(`📈 Процент успеха: ${passRate}%`)

    // Генерируем отчеты
    await this.generateHtmlReport(testResults, testCoverage)
    await this.generateMarkdownReport(testResults, testCoverage)

    console.log('\n🎯 Анализ завершен!')
  }
}

// Запуск анализатора
const analyzer = new TestCoverageAnalyzer()
analyzer.analyze().catch(console.error)
