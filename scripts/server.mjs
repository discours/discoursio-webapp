import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listener } from '../.output/server/index.mjs'
import { checkSSL } from './https.mjs'
import { resolvePublicFile } from './static-files.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'
const publicDir = join(rootDir, '.output', 'public')

// MIME types для статических файлов
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf'
}

// Обработчик запросов со статикой
function requestHandler(req, res) {
  const filePath = resolvePublicFile(publicDir, req.url)

  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad Request')
    return
  }
  
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath)
    const mimeType = mimeTypes[ext] || 'application/octet-stream'
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
    })
    
    createReadStream(filePath).pipe(res)
    return
  }
  
  // Иначе передаем в Nitro handler
  listener(req, res)
}

// Проверяем наличие SSL сертификатов через checkSSL
// В dev и debug режимах пытаемся использовать HTTPS
const sslConfig = checkSSL(process.env.LOCAL_HTTPS === 'true')

let server
if (sslConfig) {
  const options = {
    key: readFileSync(sslConfig.key),
    cert: readFileSync(sslConfig.cert)
  }
  server = createHttpsServer(options, requestHandler)
  console.log(`Server: https://${host}:${port} 🔒`)
} else {
  server = createHttpServer(requestHandler)
  console.log(`Server: http://${host}:${port}`)
}

server.listen(port, host)

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...')
  server.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...')
  server.close(() => process.exit(0))
})
