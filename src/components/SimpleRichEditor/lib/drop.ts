import { createSignal } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useSnackbar } from '~/context/ui'

/**
 * Hook for handling file drops and uploads in editor
 *
 * Features:
 * - File drop handling
 * - Selection preservation
 * - Upload progress feedback
 * - Error handling
 * - File type validation
 *
 * @example
 * ```tsx
 * const { handleDropFiles, restoreSelection } = useDropFiles()
 *
 * return (
 *   <div onDrop={(e) => handleDropFiles(e.dataTransfer.files)}>
 *     {content}
 *   </div>
 * )
 * ```
 */
export const useDropFiles = () => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const [selection, setSelection] = createSignal<Range | null>(null)

  /**
   * Save current selection before upload
   */
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      setSelection(sel.getRangeAt(0))
    }
  }

  /**
   * Restore saved selection after upload
   */
  const restoreSelection = () => {
    const sel = selection()
    if (sel) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(sel)
      return true
    }
    return false
  }

  /**
   * Handle dropped/selected files
   */
  const handleDropFiles = async (ev: DragEvent) => {
    saveSelection()

    const files = ev.dataTransfer?.files
    if (!files) return

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      showSnackbar({
        body: t('Only image files are allowed'),
        type: 'error'
      })
      return
    }

    if (imageFiles.length > 100) {
      showSnackbar({
        body: t('Maximum 100 files allowed'),
        type: 'error'
      })
      return
    }

    const oversizedFiles = imageFiles.filter((file) => file.size > 5 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      showSnackbar({
        body: t('Some files exceed 5MB limit'),
        type: 'error'
      })
      return
    }

    try {
      showSnackbar({ body: t('Uploading images...') })

      // Здесь должна быть логика загрузки файлов
      // Например:
      // await uploadImages(imageFiles)

      showSnackbar({ body: t('Images uploaded successfully') })
    } catch (error) {
      console.error('Upload error:', error)
      showSnackbar({
        body: t('Failed to upload images'),
        type: 'error'
      })
    }
  }

  return {
    handleDropFiles,
    saveSelection,
    restoreSelection
  }
}
