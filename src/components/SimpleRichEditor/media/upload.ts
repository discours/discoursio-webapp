/**
 * @module media/upload
 * @description Обработка загрузки файлов и drag & drop с интеграцией реальной системы загрузки
 */

import { createSignal } from 'solid-js'
import { toast } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { useUpload } from '~/context/upload'
import { UploadResult } from './types'

/**
 * Максимальные ограничения для загрузки
 */
export const UPLOAD_LIMITS = {
  MAX_FILES: 100,
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'],
  ALLOWED_AUDIO_TYPES: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac']
} as const

/**
 * Валидирует файлы перед загрузкой
 * @param files Список файлов
 * @param allowedTypes Разрешенные типы файлов
 * @returns Результат валидации
 */
export const validateFiles = (files: File[], allowedTypes: readonly string[]): { valid: File[]; errors: string[] } => {
  const valid: File[] = []
  const errors: string[] = []

  if (files.length === 0) {
    errors.push('No files selected')
    return { valid, errors }
  }

  if (files.length > UPLOAD_LIMITS.MAX_FILES) {
    errors.push(`Maximum ${UPLOAD_LIMITS.MAX_FILES} files allowed`)
    return { valid, errors }
  }

  for (const file of files) {
    // Проверка типа файла
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} not allowed`)
      continue
    }

    // Проверка размера файла
    if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE) {
      errors.push(`File ${file.name} exceeds ${UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
      continue
    }

    valid.push(file)
  }

  return { valid, errors }
}

/**
 * Hook для обработки drag & drop файлов в редакторе с реальной загрузкой
 * @returns Функции для работы с файлами
 */
export const useDropFiles = () => {
  const { t } = useLocalize()
  const { uploadImage } = useUpload()
  const [selection, setSelection] = createSignal<Range | null>(null)

  // Сохранение/восстановление выделения
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
   * Обработчик перетаскивания файлов с реальной загрузкой
   * @param ev Событие drag
   */
  const handleDropFiles = async (ev: DragEvent) => {
    saveSelection()

    const files = ev.dataTransfer?.files
    if (!files) return

    const fileArray = Array.from(files)

    // Валидация изображений
    const { valid: validImages, errors } = validateFiles(fileArray, UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES)

    if (errors.length > 0) {
      for (const error of errors) {
        toast.error(t(error))
      }
      return
    }

    if (validImages.length === 0) {
      toast.error(t('Only image files are allowed'))
      return
    }

    try {
      console.log('[useDropFiles] Processing dropped images:', validImages.length)

      // Показываем уведомление о начале загрузки
      const uploadingToast = toast.loading(t('Uploading images...'))

      // Загружаем файлы через реальную систему загрузки
      const uploadResults: UploadResult[] = []

      for (const file of validImages) {
        try {
          console.log(`[useDropFiles] Uploading file: ${file.name}`)

          // Используем реальную систему загрузки
          const url = await uploadImage(file, (progress) => {
            console.log(`[useDropFiles] Upload progress for ${file.name}: ${progress}%`)
          })

          uploadResults.push({
            success: true,
            url,
            data: { name: file.name, size: file.size, type: file.type }
          })

          console.log(`[useDropFiles] Successfully uploaded: ${file.name} -> ${url}`)
        } catch (error) {
          console.error(`[useDropFiles] Failed to upload ${file.name}:`, error)
          uploadResults.push({
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
            data: { name: file.name }
          })
        }
      }

      // Закрываем toast загрузки
      toast.dismiss(uploadingToast)

      // Вставляем успешно загруженные изображения в редактор
      const successfulUploads = uploadResults.filter((result) => result.success && result.url)

      if (successfulUploads.length > 0) {
        // Восстанавливаем выделение перед вставкой
        restoreSelection()

        // Получаем редактор из DOM (нужно передать через контекст)
        const editor = document.querySelector('[contenteditable="true"]') as HTMLElement

        if (editor) {
          // Вставляем каждое изображение
          const { insertImage } = await import('./insertion')
          for (const result of successfulUploads) {
            if (result.url) {
              // biome-ignore lint/suspicious/noExplicitAny: ok
              const fileName = (result.data as any)?.name || 'Uploaded image'
              insertImage(result.url, editor, fileName)
            }
          }
        }

        toast.success(t('{{count}} images uploaded successfully', { count: successfulUploads.length }))
      }

      // Показываем ошибки для неудачных загрузок
      const failedUploads = uploadResults.filter((result) => !result.success)
      if (failedUploads.length > 0) {
        for (const failed of failedUploads) {
          toast.error(
            t('Failed to upload {{name}}: {{error}}', {
              // biome-ignore lint/suspicious/noExplicitAny: ok
              name: (failed.data as any)?.name || 'file',
              error: failed.error || 'Unknown error'
            })
          )
        }
      }
    } catch (error) {
      console.error('[useDropFiles] Upload error:', error)
      toast.error(t('Failed to upload images'))
    }
  }

  return {
    handleDropFiles,
    saveSelection,
    restoreSelection,
    validateFiles: (files: File[], types: readonly string[]) => validateFiles(files, types)
  }
}

/**
 * Загружает файлы на сервер через реальную систему загрузки
 * @param files Файлы для загрузки
 * @returns Результаты загрузки
 */
export const uploadFiles = async (files: File[]): Promise<UploadResult[]> => {
  const { uploadImage } = useUpload()
  const results: UploadResult[] = []

  for (const file of files) {
    try {
      const url = await uploadImage(file)
      results.push({
        success: true,
        url,
        data: { name: file.name, size: file.size, type: file.type }
      })
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        data: { name: file.name }
      })
    }
  }

  return results
}

/**
 * Обрабатывает загрузку изображений
 * @param files Файлы изображений
 * @returns Результаты загрузки
 */
export const uploadImages = async (files: File[]): Promise<UploadResult[]> => {
  const { valid, errors } = validateFiles(files, UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES)

  if (errors.length > 0) {
    return errors.map((error) => ({ success: false, error }))
  }

  return uploadFiles(valid)
}

/**
 * Обрабатывает загрузку аудио файлов
 * @param files Аудио файлы
 * @returns Результаты загрузки
 */
export const uploadAudio = async (files: File[]): Promise<UploadResult[]> => {
  const { valid, errors } = validateFiles(files, UPLOAD_LIMITS.ALLOWED_AUDIO_TYPES)

  if (errors.length > 0) {
    return errors.map((error) => ({ success: false, error }))
  }

  return uploadFiles(valid)
}
