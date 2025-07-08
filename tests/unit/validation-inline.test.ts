import { describe, expect, it } from 'vitest'

// Встроенные функции валидации для тестирования
const emailPattern = /^[\w%+.-]+@[\d.a-z-]+\.[a-z]{2,}$/i

const validateEmail = (email: string) => {
  if (!email) return false
  return emailPattern.test(email)
}

const validateUrl = (value: string) => {
  return value.includes('.') && !value.includes(' ')
}

describe('Валидация email', () => {
  it('должна принимать валидные email адреса', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('user.name@domain.org')).toBe(true)
    expect(validateEmail('valid+email@test.co.uk')).toBe(true)
  })

  it('должна отклонять невалидные email адреса', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('invalid@')).toBe(false)
    expect(validateEmail('@invalid.com')).toBe(false)
    expect(validateEmail('invalid.com')).toBe(false)
  })
})

describe('Валидация URL', () => {
  it('должна принимать валидные URL', () => {
    expect(validateUrl('example.com')).toBe(true)
    expect(validateUrl('subdomain.example.com')).toBe(true)
    expect(validateUrl('test.org')).toBe(true)
  })

  it('должна отклонять невалидные URL', () => {
    expect(validateUrl('invalid url')).toBe(false)
    expect(validateUrl('nodotshere')).toBe(false)
  })
})
