import { UploadFile } from '@solid-primitives/upload'
import { cdnUrl } from '../config'

// Move clipboard paste handler to a separate file
export { handleClipboardPaste } from './handleClipboardPaste'
export type FileType = 'audio' | 'video' | 'image' | 'file'

export const allowedImageTypes = new Set([
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'image/webp',
  'image/x-icon'
])

export const handleFileUpload = async (
  uploadFile: UploadFile | UploadFile[],
  token: string,
  type: FileType = 'image'
) => {
  const formData = new FormData()
  const files = Array.isArray(uploadFile) ? uploadFile : [uploadFile]

  // Validate image types if needed
  if (type === 'image') {
    const invalidImage = files.some((file) => !allowedImageTypes.has(file.file.type))
    if (invalidImage) {
      throw new Error('Invalid image type')
    }
  }

  files.forEach((file) => {
    formData.append(type, file.file, file.name)
  })

  const response = await fetch(cdnUrl, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: token } : {}
  })

  if (type === 'image') {
    const location = response.headers.get('Location')
    const url = `${cdnUrl}/unsafe/production${location?.slice(0, location.lastIndexOf('/'))}`
    const originalFilename = location?.slice(location.lastIndexOf('/') + 1)

    // Check image availability
    await new Promise<void>((resolve, reject) => {
      let retryCount = 0
      const checkUploadedImage = () => {
        const uploadedImage = new Image()
        uploadedImage.addEventListener('load', () => resolve())
        uploadedImage.addEventListener('error', () => {
          retryCount++
          if (retryCount >= 3) return reject()
          setTimeout(() => checkUploadedImage(), 1000)
        })
        uploadedImage.src = url
      }
      checkUploadedImage()
    })

    return { url, originalFilename }
  }

  return response.json()
}
