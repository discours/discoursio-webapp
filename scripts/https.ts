import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const keyPath = join(__dirname, 'key.pem')
const certPath = join(__dirname, 'cert.pem')

// Автоматическая установка mkcert и генерация сертификатов
export function setupHTTPS(isDev: boolean, isCI: boolean, isVercel: boolean, isNetlify: boolean): void {
  // Пропускаем для всех случаев кроме локальной разработки
  if (!isDev || isCI || isVercel || isNetlify || process.argv.includes('build')) {
    return
  }

  // Если сертификаты уже есть, ничего не делаем
  if (existsSync(keyPath) && existsSync(certPath)) {
    return
  }

  console.log('[app.config] 🔐 HTTPS certificates not found, setting up...')

  try {
    // Проверяем установлен ли mkcert
    let mkcertInstalled = false
    try {
      execSync('mkcert -version', { stdio: 'ignore' })
      mkcertInstalled = true
    } catch {
      mkcertInstalled = false
    }

    if (!mkcertInstalled) {
      const platform = process.platform

      if (platform === 'win32') {
        // Windows - только инструкция
        console.log('╔═══════════════════════════════════════════════════════════╗')
        console.log('║  🪟 Windows: Install mkcert manually                      ║')
        console.log('╠═══════════════════════════════════════════════════════════╣')
        console.log('║  1. Install Chocolatey: https://chocolatey.org/install    ║')
        console.log('║  2. Run as Administrator:                                 ║')
        console.log('║     choco install mkcert -y                               ║')
        console.log('║  3. Restart this dev server                               ║')
        console.log('╚═══════════════════════════════════════════════════════════╝')
        return
      }

      console.log('[app.config] 📦 Installing mkcert...')
      if (platform === 'darwin') {
        execSync('brew install mkcert && brew install nss', { stdio: 'inherit' })
      } else if (platform === 'linux') {
        execSync('sudo apt-get update && sudo apt-get install -y libnss3-tools', { stdio: 'inherit' })
        execSync('curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"', { cwd: '/tmp', stdio: 'inherit' })
        execSync('chmod +x /tmp/mkcert-v*-linux-amd64', { stdio: 'inherit' })
        execSync('sudo mv /tmp/mkcert-v*-linux-amd64 /usr/local/bin/mkcert', { stdio: 'inherit' })
      }
    }

    // Устанавливаем локальный CA
    console.log('[app.config] 🔧 Installing local CA...')
    execSync('mkcert -install', { stdio: 'inherit' })

    // Генерируем сертификаты
    console.log('[app.config] 🔑 Generating certificates...')
    execSync('mkcert localhost 127.0.0.1 ::1', { cwd: __dirname, stdio: 'inherit' })
    execSync('mv localhost+2-key.pem key.pem', { cwd: __dirname, stdio: 'inherit' })
    execSync('mv localhost+2.pem cert.pem', { cwd: __dirname, stdio: 'inherit' })

    console.log('[app.config] ✅ HTTPS setup complete!')
  } catch (_error) {
    console.log('[app.config] ⚠️  HTTPS setup failed, continuing with HTTP')
    if (process.platform === 'win32') {
      console.log('[app.config] 💡 Windows tip: Run as Administrator and install mkcert')
    }
  }
}

// Функция для проверки SSL
export function checkSSL(
  isDev: boolean = false,
  isCI: boolean = false,
  isVercel: boolean = false,
  isNetlify: boolean = false
): { key: string; cert: string } | undefined {
  // Пропускаем для всех случаев кроме локальной разработки
  if (!isDev || isCI || isVercel || isNetlify || process.argv.includes('build')) {
    return undefined
  }

  // Автоматически настраиваем HTTPS при первом запуске
  setupHTTPS(isDev, isCI, isVercel, isNetlify)

  try {
    // Проверяем существующие сертификаты
    if (existsSync(keyPath) && existsSync(certPath)) {
      console.log('[app.config] 🔒 Using HTTPS certificates for development')
      return {
        key: keyPath,
        cert: certPath
      }
    }
  } catch {
    // Игнорируем любые ошибки
  }
  console.log('[app.config] 🌐 HTTPS certificates not found, using HTTP')
  return undefined
}
