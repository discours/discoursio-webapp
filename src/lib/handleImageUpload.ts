import { UploadFile } from '@solid-primitives/upload'
import { Editor } from '@tiptap/core'
import { cdnUrl } from '../config'

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

export const handleImageUpload = async (uploadFile: UploadFile, token: string) => {
  const formData = new FormData()
  formData.append('media', uploadFile.file, uploadFile.name)
  const response = await fetch(`${cdnUrl}/image`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: token } : {}
  })

  const location = response.headers.get('Location')

  const url = `${cdnUrl}/unsafe/production${location?.slice(0, location.lastIndexOf('/'))}`
  const originalFilename = location?.slice(location.lastIndexOf('/') + 1)

  // check that image is available
  await new Promise<void>((resolve, reject) => {
    let retryCount = 0
    const checkUploadedImage = () => {
      const uploadedImage = new Image()
      uploadedImage.addEventListener('load', () => resolve())
      uploadedImage.addEventListener('error', () => {
        retryCount++
        if (retryCount >= 3) {
          return reject()
        }
        setTimeout(() => checkUploadedImage(), 1000)
      })
      uploadedImage.src = url
    }
    checkUploadedImage()
  })

  return {
    originalFilename,
    url
  }
}

export const handleClipboardPaste = async (editor?: Editor, token = '') => {
  try {
    const clipboardItems: ClipboardItems = await navigator.clipboard.read()

    if (clipboardItems.length === 0) return
    const [clipboardItem] = clipboardItems
    const { types } = clipboardItem
    const imageType = types.find((type) => allowedImageTypes.has(type))

    if (!imageType) return
    const blob = await clipboardItem.getType(imageType)
    const extension = imageType.split('/')[1]
    const file = new File([blob], `clipboardImage.${extension}`)

    const uplFile = {
      source: blob.toString(),
      name: file.name,
      size: file.size,
      file
    }

    const result = await handleImageUpload(uplFile, token)

    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'figure',
        attrs: { 'data-type': 'image' },
        content: [
          {
            type: 'image',
            attrs: { src: result.url }
          },
          {
            type: 'figcaption',
            content: [{ type: 'text', text: result.originalFilename }]
          }
        ]
      })
      .run()
  } catch (error) {
    console.error('[Paste Image Error]:', error)
  }
}
