// prebuild.mjs
// Creates necessary directories and placeholder manifest.json for Vinxi build
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')

const dir = path.join(rootDir, '.vinxi', 'build', 'server-fns', '_server')
const manifestPath = path.join(dir, 'manifest.json')

try {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(manifestPath, '{}')
  console.log('✓ Created placeholder manifest.json for Vinxi build')
} catch (err) {
  console.error('❌ Failed to create placeholder manifest.json:', err.message)
  process.exit(1)
}

