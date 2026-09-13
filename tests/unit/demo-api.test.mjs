import assert from 'node:assert/strict'
import test from 'node:test'
import { request } from 'node:http'
import { createDemoApiServer, demoData } from '../../scripts/demo-api.mjs'

test('demo API provides deterministic empty public collections', () => {
  const data = demoData()
  assert.deepEqual(data.get_topics_all, [])
  assert.deepEqual(data.load_shouts_by, [])
  assert.equal(data.getSession.token, null)
  assert.equal(data.getSession.author, null)
})

const call = (port, method, path, body = '') => new Promise((resolve, reject) => {
  const req = request({ hostname: '127.0.0.1', port, method, path, headers: { 'content-type': 'application/json' } }, (res) => {
    let data = ''
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
  })
  req.on('error', reject)
  req.end(body)
})

test('demo API exposes the documented HTTP contract', async (t) => {
  const server = createDemoApiServer().listen(0, '127.0.0.1')
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))
  const port = server.address().port

  const ok = await call(port, 'POST', '/graphql', '{ query }')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers['content-type'], 'application/json; charset=utf-8')
  assert.deepEqual(JSON.parse(ok.body).data.get_topics_all, [])

  const options = await call(port, 'OPTIONS', '/graphql')
  assert.equal(options.status, 204)
  assert.equal(options.body, '')
  assert.equal(options.headers['access-control-allow-methods'], 'POST, OPTIONS')

  for (const [method, path] of [['GET', '/graphql'], ['POST', '/unknown']]) {
    const missing = await call(port, method, path)
    assert.equal(missing.status, 404)
    assert.deepEqual(JSON.parse(missing.body), { error: 'Not found' })
  }
})
