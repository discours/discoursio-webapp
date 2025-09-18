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
 * const { handleDropFiles } = useDropFiles()
 *
 * return (
 *   <div onDrop={handleDropFiles}>
 *     {content}
 *   </div>
 * )
 * ```
 */
export const useDropFiles = () => {
  const { t } = useLocalize()
  const [selection, setSelection] = createSignal<Range | null>(null)

  // Используем локальные функции для сохранения/восстановления выделения
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      setSelection(sel.getRangeAt(0))
    }
  }

  const restoreSelection = () => {
    const sel = selection()
    if (sel) {
      const windowSelection = window.getSelection()
      windowSelection?.removeAllRanges()
      windowSelection?.addRange(sel)
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
      console.log('[useDropFiles] Processing dropped images:', imageFiles.length)

      // Показываем уведомление о начале загрузки
      toast.loading(t('Uploading images...'))

      // TODO: Интеграция с реальной системой загрузки
      // В будущем здесь будет вызов API загрузки:
      // const uploadResults = await uploadImages(imageFiles)

      // Пока что просто эмулируем успешную загрузку
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast.success(t('Images uploaded successfully'))
    } catch (error) {
      console.error('[useDropFiles] Upload error:', error)
      toast.error(t('Failed to upload images'))
    }
  }

  return {
    handleDropFiles,
    saveSelection,
    restoreSelection
  }
}
