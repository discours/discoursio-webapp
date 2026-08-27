import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const keyPath = join(scriptsDir, 'key.pem')
const certPath = join(scriptsDir, 'cert.pem')

/**
 * Return existing local certificate paths without installing software,
 * modifying the trust store, or generating files as a side effect.
 */
export function checkSSL(enabled = false) {
  if (!enabled) return undefined

  if (existsSync(keyPath) && existsSync(certPath)) {
    console.info('[https] Using existing local development certificates')
    return { key: keyPath, cert: certPath }
  }

  console.info('[https] No local certificates found; using HTTP. Run `npm run setup:https` if needed.')
  return undefined
}
