import FormData from 'form-data'
import Mailgun from 'mailgun.js'

const mailgun = new Mailgun(FormData)
const mg = mailgun.client({ username: 'discoursio', key: process.env.MAILGUN_API_KEY })

// Vercel handler
export default async function handler(req, res) {
  const { contact, subject, message } = req.body

  const text = `${contact}\n\n${message}`

  const data = {
    from: 'Discours Feedback Robot <robot@discours.io>',
    to: 'welcome@discours.io',
    subject,
    text
  }

  try {
    const response = await mg.messages.create('discours.io', data)
    console.log('Email sent successfully!', response)
    res.status(200).json({ result: 'great success' })
  } catch (error) {
    console.log('Error:', error)
    res.status(400).json(error)
  }
}

// Netlify handler - простой адаптер
export const netlifyHandler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{"error":"Method not allowed"}' }

  try {
    const { contact, subject, message } = JSON.parse(event.body)
    await mg.messages.create('discours.io', {
      from: 'Discours Feedback Robot <robot@discours.io>',
      to: 'welcome@discours.io',
      subject,
      text: `${contact}\n\n${message}`
    })
    return { statusCode: 200, headers, body: '{"result":"success"}' }
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) }
  }
}
