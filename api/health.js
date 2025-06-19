export default function handler(_req, res) {
  const timestamp = new Date().toISOString()
  const environment = process.env.NODE_ENV || 'unknown'
  const isVercel = !!process.env.VERCEL

  console.log(`[Health] Health check called at ${timestamp}`)

  res.status(200).json({
    status: 'ok',
    timestamp,
    environment,
    platform: isVercel ? 'vercel' : 'other',
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  })
}
