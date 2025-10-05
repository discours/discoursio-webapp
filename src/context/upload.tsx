import { UploadFile } from '@solid-primitives/upload'
import { createContext, JSX, useContext } from 'solid-js'
import { cdnUrl } from '~/config'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { validateUploads } from '~/lib/validateUploads'
import { FileTypeToUpload, UploadedFile } from '~/types/upload'

// Константы для Quoter
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const UPLOAD_TIMEOUT = 300000

export interface UploadContextType {
  uploadFile: (file: UploadFile, onProgress?: (progress: number) => void) => Promise<UploadedFile>
  uploadFiles: (files: UploadFile[], onProgress?: (progress: number) => void) => Promise<UploadedFile[]>
  uploadImage: (file: File, onProgress?: (progress: number) => void) => Promise<string>
}

export const UploadContext = createContext<UploadContextType>()

export const useUpload = () => {
  const context = useContext(UploadContext)
  if (!context) throw new Error('useUpload must be used within UploadProvider')
  return context
}

// Утилиты
export const filesToUploadFiles = (files: File[]): UploadFile[] =>
  files.map((file) => ({ name: file.name, size: file.size, source: file.name, file }))

const getFileType = (fileName: string): FileTypeToUpload => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(ext || '')) return 'image'
  if (['mp4', 'avi', 'mov', 'webm'].includes(ext || '')) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'aif', 'aac', 'm4a'].includes(ext || '')) return 'audio'
  return 'doc'
}

export const UploadProvider = (props: { children: JSX.Element }) => {
  const { session, refreshToken } = useSession()
  const { t } = useLocalize()

  const token = () => session()?.token

  const upload = async (formData: FormData, onProgress?: (progress: number) => void, retryWithRefresh = true): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            onProgress(progress)
          }
        })
      }

      xhr.addEventListener('load', async () => {
        console.log('[Upload] Response received:', {
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
          responseLength: xhr.responseText.length,
          contentType: xhr.getResponseHeader('Content-Type')
        })

        if (xhr.status >= 200 && xhr.status < 300) {
          const filename = xhr.responseText.trim()
          if (!filename) {
            console.error('[Upload] Empty response from server')
            return reject(new Error(t('Empty response from server')))
          }
          console.log('[Upload] Success:', filename)
          resolve(filename)
        } else if (xhr.status === 401 && retryWithRefresh) {
          // Токен истёк - обновляем и повторяем попытку
          console.log('[Upload] 401 Unauthorized - refreshing token and retrying')
          refreshToken().then((refreshSuccess) => {
            if (refreshSuccess) {
              console.log('[Upload] Token refreshed successfully, retrying upload')
              // Повторяем загрузку с новым токеном (БЕЗ повторного retry)
              upload(formData, onProgress, false).then(resolve).catch(reject)
            } else {
              console.error('[Upload] Token refresh failed')
              reject(new Error(t('Session expired. Please sign in again.')))
            }
          }).catch((refreshError) => {
            console.error('[Upload] Error refreshing token:', refreshError)
            reject(new Error(t('Session expired. Please sign in again.')))
          })
        } else {
          console.error('[Upload] Error:', xhr.status, xhr.responseText)
          const errorText = xhr.responseText || 'Unknown error'
          const statusErrors: Record<number, string> = {
            401: errorText.includes('Quota exceeded')
              ? t('Quota exceeded. Delete old files or upgrade your quota.')
              : t('Session expired. Please sign in again.'),
            413: t('File is too large. Maximum: 500 MB.'),
            415: t('Unsupported file format.'),
            429: t('Too many requests. Please wait and try again.'),
            500: t('Internal server error. Try again later.'),
            502: t('Service temporarily unavailable.'),
            503: t('Service overloaded. Try again later.')
          }
          reject(new Error(statusErrors[xhr.status] || t('Upload error: {{status}}', { status: xhr.status })))
        }
      })

      xhr.addEventListener('error', () => reject(new Error(t('Internal server error. Try again later.'))))
      xhr.addEventListener('timeout', () => reject(new Error(t('Upload error: {{status}}', { status: 408 }))))

      xhr.open('POST', cdnUrl)
      xhr.timeout = UPLOAD_TIMEOUT

      // Set headers
      const currentToken = token()
      console.log('[Upload] Token available:', !!currentToken, 'cdnUrl:', cdnUrl)

      const headers: Record<string, string> = { Accept: 'application/json' }
      if (currentToken) {
        const bearerToken = currentToken.startsWith('Bearer ') ? currentToken : `Bearer ${currentToken}`
        headers.Authorization = bearerToken
        console.log(`[Upload] Authorization header set: ${bearerToken.substring(0, 20)}...`)
      } else {
        console.error('[Upload] NO TOKEN AVAILABLE!')
      }

      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })

      xhr.send(formData)
    })
  }

  const uploadFile = async (file: UploadFile, onProgress?: (progress: number) => void): Promise<UploadedFile> => {
    // Проверяем наличие токена ДО начала загрузки
    const currentToken = token()
    if (!currentToken) {
      console.error('[uploadFile] No authentication token available')
      throw new Error(t('Session expired. Please sign in again.'))
    }

    const fileType = getFileType(file.name)

    if (!validateUploads(fileType, [file])) throw new Error(t('Invalid file type'))
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = Math.round(file.size / (1024 * 1024))
      throw new Error(
        t('File "{{fileName}}" is too large ({{sizeMB}} MB). Maximum: 500 MB.', {
          fileName: file.name,
          sizeMB
        })
      )
    }
    if (file.size === 0) throw new Error(t('File "{{fileName}}" is empty.', { fileName: file.name }))

    const formData = new FormData()
    formData.append('file', file.file, file.name)

    const filename = await upload(formData, onProgress)
    const url = `${cdnUrl}/${filename}`

    return { url, originalFilename: filename }
  }

  const uploadFiles = async (files: UploadFile[], onProgress?: (progress: number) => void): Promise<UploadedFile[]> => {
    const results: UploadedFile[] = []
    for (const file of files) {
      results.push(await uploadFile(file, onProgress))
    }
    return results
  }

  const uploadImage = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    const uploadFileObj = { name: file.name, size: file.size, source: file.name, file }
    const result = await uploadFile(uploadFileObj, onProgress)
    return result.url
  }

  return (
    <UploadContext.Provider value={{ uploadFile, uploadFiles, uploadImage }}>{props.children}</UploadContext.Provider>
  )
}
