import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createDemoApiServer } from './demo-api.mjs'

const apiPort = Number(process.env.DEMO_API_PORT || 4010)
const appPort = Number(process.env.PORT || 3000)
const apiUrl = `http://127.0.0.1:${apiPort}/graphql`
const demoApi = createDemoApiServer()

demoApi.listen(apiPort, '127.0.0.1', () => {
  console.info(`[dev:demo] Read-only API fixture: ${apiUrl}`)

  const vinxi = resolve('node_modules', 'vinxi', 'bin', 'cli.mjs')
  const app = spawn(process.execPath, [vinxi, 'dev', '--port', String(appPort)], {
    env: {
      ...process.env,
      PUBLIC_BASE_URL: `http://localhost:${appPort}`,
      PUBLIC_CORE_API: apiUrl,
      PUBLIC_INBOX_API: apiUrl,
      PUBLIC_REALTIME_EVENTS: ''
    },
    stdio: 'inherit'
  })

  const shutdown = () => {
    app.kill('SIGTERM')
    demoApi.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  app.on('exit', (code) => demoApi.close(() => process.exit(code ?? 0)))
})

demoApi.on('error', (error) => {
  console.error(`[dev:demo] Could not start the fixture API: ${error.code || 'unknown error'}`)
  process.exit(1)
})
