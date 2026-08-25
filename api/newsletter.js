import FormData from 'form-data'
import Mailgun from 'mailgun.js'
import { RequestValidationError, validateNewsletter } from './lib/request-validation.js'

const jsonHeaders = { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' }

function mailgunClient() {
  if (!process.env.MAILGUN_API_KEY) throw new Error('MAIL_PROVIDER_NOT_CONFIGURED')
  return new Mailgun(FormData).client({ username: 'discoursio', key: process.env.MAILGUN_API_KEY })
}

async function subscribe(body) {
  const { email } = validateNewsletter(body)
  await mailgunClient().lists.members.createMember('newsletter@discours.io', {
    address: email,
    subscribed: true,
    upsert: 'yes'
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await subscribe(req.body)
    return res.status(200).json({ success: true, message: 'Email was added to the newsletter' })
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(422).json({ error: error.message })
    if (error instanceof Error && error.message === 'MAIL_PROVIDER_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Newsletter service is not configured' })
    }
    console.error('[newsletter] Mail provider request failed')
    return res.status(502).json({ error: 'Newsletter service is temporarily unavailable' })
  }
}

export const netlifyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: jsonHeaders, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: '{"error":"Method not allowed"}' }
  }

  try {
    await subscribe(event.body)
    return { statusCode: 200, headers: jsonHeaders, body: '{"success":true}' }
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return { statusCode: 422, headers: jsonHeaders, body: JSON.stringify({ error: error.message }) }
    }
    if (error instanceof Error && error.message === 'MAIL_PROVIDER_NOT_CONFIGURED') {
      return { statusCode: 503, headers: jsonHeaders, body: '{"error":"Newsletter service is not configured"}' }
    }
    console.error('[newsletter] Mail provider request failed')
    return {
      statusCode: 502,
      headers: jsonHeaders,
      body: '{"error":"Newsletter service is temporarily unavailable"}'
    }
  }
}
