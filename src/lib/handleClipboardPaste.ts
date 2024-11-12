import { Editor } from '@tiptap/core'
import { allowedImageTypes, handleFileUpload } from './handleFileUpload'

export const handleClipboardPaste = async (editor?: Editor, token = '') => {
  try {
    const clipboardItems = await navigator.clipboard.read()
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

    const result = await handleFileUpload(uplFile, token, 'image')

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
