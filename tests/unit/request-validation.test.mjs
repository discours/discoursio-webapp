import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RequestValidationError,
  validateFeedback,
  validateNewsletter
} from '../../api/lib/request-validation.js'

test('normalizes valid newsletter email', () => {
  assert.deepEqual(validateNewsletter({ email: ' Editor@Example.org ' }), { email: 'editor@example.org' })
})

test('rejects malformed newsletter input', () => {
  assert.throws(() => validateNewsletter('{broken'), RequestValidationError)
  assert.throws(() => validateNewsletter({ email: 'not-an-email' }), RequestValidationError)
})

test('accepts and trims bounded feedback', () => {
  assert.deepEqual(validateFeedback({ contact: ' editor ', subject: ' Hello ', message: ' Text ' }), {
    contact: 'editor',
    subject: 'Hello',
    message: 'Text'
  })
})

test('rejects header injection and oversized feedback', () => {
  assert.throws(
    () => validateFeedback({ contact: 'editor', subject: 'Hello\nBcc: recipient', message: 'Text' }),
    RequestValidationError
  )
  assert.throws(
    () => validateFeedback({ contact: 'editor', subject: 'Hello', message: 'x'.repeat(10_001) }),
    RequestValidationError
  )
})
