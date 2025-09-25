import FormData from 'form-data'
import Mailgun from 'mailgun.js'

const mailgun = new Mailgun(FormData)
const mg = mailgun.client({ username: 'discoursio', key: process.env.MAILGUN_API_KEY })

// Vercel handler
export default async (req, res) => {
  const { email } = req.body

  try {
    const response = await mg.lists.members.createMember('newsletter@discours.io', {
      address: email,
      subscribed: true,
      upsert: 'yes'
    })

    return res.status(200).json({
      success: true,
      message: 'Email was added to newsletter list',
      response: JSON.stringify(response)
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    })
  }
}

// Netlify handler - простой адаптер
export const netlifyHandler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{"error":"Method not allowed"}' }

  try {
    const { email } = JSON.parse(event.body)
    await mg.lists.members.createMember('newsletter@discours.io', { address: email, subscribed: true, upsert: 'yes' })
    return { statusCode: 200, headers, body: '{"success":true,"message":"Email added"}' }
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: error.message }) }
  }
}
