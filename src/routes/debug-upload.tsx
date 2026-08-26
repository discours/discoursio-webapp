import { createSignal } from 'solid-js'
import { cdnUrl } from '~/config'
import { useSession } from '~/context/session'
import { useUpload } from '~/context/upload'

export default function DebugUpload() {
  const { uploadImage } = useUpload()
  const { session } = useSession()
  const [status, setStatus] = createSignal<string>('Ready')
  const [progress, setProgress] = createSignal(0)
  const [result, setResult] = createSignal<string>('')

  const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    setStatus(`Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`)

    // Проверяем сессию
    const currentSession = session()
    console.log('[DEBUG] Session:', {
      hasToken: !!currentSession?.token
    })

    if (!currentSession?.token) {
      setStatus('ERROR: No auth token!')
      return
    }

    try {
      setStatus('Uploading...')
      const url = await uploadImage(file, (p) => {
        setProgress(p)
        setStatus(`Uploading... ${p}%`)
      })

      setStatus(`SUCCESS! URL: ${url}`)
      setResult(url)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      setStatus(`ERROR: ${errorMsg}`)
      console.error('[DEBUG] Upload error:', error)
    }
  }

  return (
    <div style={{ padding: '20px', 'font-family': 'monospace' }}>
      <h1>🔍 Upload Debug Page</h1>

      <div style={{ 'margin-bottom': '20px' }}>
        <strong>CDN URL:</strong> {cdnUrl}
        <br />
        <strong>Auth Token:</strong> {session()?.token ? '✅ Present' : '❌ Missing'}
        <br />
        <strong>Author:</strong> {session()?.author?.name || 'Not logged in'}
      </div>

      <div style={{ 'margin-bottom': '20px' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ padding: '10px', border: '2px solid #ccc' }}
        />
      </div>

      <div style={{ 'margin-bottom': '20px' }}>
        <strong>Status:</strong> {status()}
        <br />
        <strong>Progress:</strong> {progress()}%
      </div>

      {result() && (
        <div style={{ 'margin-top': '20px' }}>
          <strong>Result Image:</strong>
          <br />
          <img src={result()} alt="Uploaded" style={{ 'max-width': '500px', border: '1px solid #ccc' }} />
        </div>
      )}
    </div>
  )
}
