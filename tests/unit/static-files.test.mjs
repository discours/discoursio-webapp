import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import { resolvePublicFile } from '../../scripts/static-files.mjs'

const publicDir = join(process.cwd(), '.output', 'public')

describe('resolvePublicFile', () => {
  it('resolves the root to the public index', () => {
    assert.equal(resolvePublicFile(publicDir, '/'), join(publicDir, 'index.html'))
  })

  it('resolves assets inside the public directory', () => {
    assert.equal(resolvePublicFile(publicDir, '/assets/app.js?v=1'), join(publicDir, 'assets', 'app.js'))
  })

  it('rejects plain and encoded directory traversal', () => {
    assert.equal(resolvePublicFile(publicDir, '/../server/index.mjs'), null)
    assert.equal(resolvePublicFile(publicDir, '/%2e%2e/server/index.mjs'), null)
    assert.equal(resolvePublicFile(publicDir, '/..%5cserver/index.mjs'), null)
  })

  it('rejects malformed URL encoding', () => {
    assert.equal(resolvePublicFile(publicDir, '/%E0%A4%A'), null)
  })
})
