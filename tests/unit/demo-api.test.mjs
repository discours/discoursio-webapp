import assert from 'node:assert/strict'
import test from 'node:test'
import { demoData } from '../../scripts/demo-api.mjs'

test('demo API provides deterministic empty public collections', () => {
  const data = demoData()
  assert.deepEqual(data.get_topics_all, [])
  assert.deepEqual(data.load_shouts_by, [])
  assert.equal(data.getSession.token, null)
  assert.equal(data.getSession.author, null)
})
