import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const keyPath = join(scriptsDir, 'key.pem')
const certPath = join(scriptsDir, 'cert.pem')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed`)
  }
}

try {
  run('mkcert', ['-version'])
} catch {
  console.error('mkcert is required. Install it from https://github.com/FiloSottile/mkcert and retry.')
  process.exit(1)
}

console.info('Installing the mkcert local CA. Your operating system may request confirmation.')
run('mkcert', ['-install'])
run('mkcert', ['-key-file', keyPath, '-cert-file', certPath, 'localhost', '127.0.0.1', '::1'])
console.info('Local HTTPS certificates created in scripts/. They are ignored by Git.')
