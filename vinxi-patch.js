// vinxi-patch.js
// Windows-only workaround for Vinxi manifest.json issue
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Only run on Windows
if (os.platform() !== 'win32') {
  console.log('⏭️  Skipping vinxi-patch (not Windows)')
  process.exit(0)
}

const manifestPath = path.join(__dirname, '.vinxi/build/server-fns/_server/manifest.js')
const jsonPath = path.join(__dirname, '.vinxi/build/server-fns/_server/manifest.json')

if (fs.existsSync(manifestPath) && !fs.existsSync(jsonPath)) {
  try {
    fs.copyFileSync(manifestPath, jsonPath)
    console.log('✓ Created manifest.json from manifest.js (Windows patch)')
  } catch (err) {
    console.error('❌ Failed to create manifest.json:', err.message)
    process.exit(1)
  }
} else if (fs.existsSync(jsonPath)) {
  console.log('✓ manifest.json already exists')
} else if (!fs.existsSync(manifestPath)) {
  console.warn('⚠️  manifest.js not found, build may have failed')
}
