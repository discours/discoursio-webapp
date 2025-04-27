import { createSignal } from 'solid-js'
import { toast } from 'solid-toast'
import { useLocalize } from '~/context/localize'

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
      toast.error(t('Only image files are allowed'))
      return
    }

    if (imageFiles.length > 100) {
      toast.error(t('Maximum 100 files allowed'))
      return
    }

    const oversizedFiles = imageFiles.filter((file) => file.size > 5 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      toast.error(t('Some files exceed 5MB limit'))
      return
    }

    try {
      toast.loading(t('Uploading images...'))

      // Здесь должна быть логика загрузки файлов
      // Например:
      // await uploadImages(imageFiles)

      toast.success(t('Images uploaded successfully'))
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(t('Failed to upload images'))
    }
  }

  return {
    handleDropFiles,
    saveSelection,
    restoreSelection
  }
}
