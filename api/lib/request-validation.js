export class RequestValidationError extends Error {}

export function parseBody(body) {
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      throw new RequestValidationError('Request body must be valid JSON')
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestValidationError('Request body must be a JSON object')
  }

  return body
}

function requiredText(body, field, maxLength) {
  const value = body[field]
  if (typeof value !== 'string') throw new RequestValidationError(`${field} is required`)

  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw new RequestValidationError(`${field} must contain 1-${maxLength} characters`)
  }

  return normalized
}

export function validateEmail(value) {
  if (typeof value !== 'string') throw new RequestValidationError('email is required')

  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestValidationError('email must be valid')
  }

  return email
}

export function validateFeedback(body) {
  const input = parseBody(body)
  const subject = requiredText(input, 'subject', 160)
  if (/\r|\n/.test(subject)) throw new RequestValidationError('subject must be a single line')

  return {
    contact: requiredText(input, 'contact', 320),
    subject,
    message: requiredText(input, 'message', 10_000)
  }
}

export function validateNewsletter(body) {
  return { email: validateEmail(parseBody(body).email) }
}
