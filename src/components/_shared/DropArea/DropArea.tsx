import { createDropzone, createFileUploader, UploadFile } from '@solid-primitives/upload'
import { clsx } from 'clsx'
import { createSignal, JSX, Show } from 'solid-js'

import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { handleFileUpload } from '~/lib/handleFileUpload'
import { validateUploads } from '~/lib/validateUploads'

import styles from './DropArea.module.scss'

type FileType = 'image' | 'file' | 'audio'

interface Props {
  class?: string
  placeholder: string
  isMultiply: boolean
  fileType: FileType
  // biome-ignore lint/suspicious/noExplicitAny: json response
  onUpload?: (value: any[]) => void
  description?: string | JSX.Element
  isSquare?: boolean
}

export const DropArea = (props: Props) => {
  const { t } = useLocalize()
  const [dragActive, setDragActive] = createSignal(false)
  const [dropAreaError, setDropAreaError] = createSignal<string | undefined>()
  const [loading, setLoading] = createSignal(false)
  const { session } = useSession()

  /**
   * Handle the file upload process
   * @param files - Array of files to upload
   */
  const runUpload = async (files: UploadFile[]) => {
    try {
      setLoading(true)
      const tkn = session()?.token as string
      tkn &&
        Promise.all(files.map((file) => handleFileUpload(file, tkn)))
          .then(props.onUpload)
          .catch(console.error)
      setLoading(false)
    } catch (error) {
      setLoading(false)
      setDropAreaError(t('Upload error'))
      console.error('[runUpload]', error)
    }
  }

  /**
   * Initialize the file upload process
   * @param selectedFiles - Array of selected files
   */
  const initUpload = async (selectedFiles: UploadFile[]) => {
    if (!props.isMultiply && selectedFiles.length > 1) {
      setDropAreaError(t('Many files, choose only one'))
      return
    }
    const isValid = validateUploads(props.fileType, selectedFiles)
    if (isValid) {
      await runUpload(selectedFiles)
    } else {
      setDropAreaError(t('Invalid file type'))
    }
  }

  const { selectFiles } = createFileUploader({
    multiple: true,
    accept: `${props.fileType}/*`
  })

  const { setRef: dropzoneRef, files: droppedFiles } = createDropzone({
    onDrop: async () => {
      setDragActive(false)
      await initUpload(droppedFiles())
    }
  })

  /**
   * Handle drag events
   * @param event - The drag event
   */
  const handleDrag = (event: DragEvent) => {
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true)
    } else if (event.type === 'dragleave') {
      setDragActive(false)
    }
  }

  /**
   * Handle click on drop field to select files
   */
  const handleDropFieldClick = async () => {
    selectFiles((selectedFiles) => {
      initUpload(selectedFiles)
    })
  }

  return (
    <div class={clsx(styles.DropArea, props.class, props.isSquare && styles.square)}>
      <div
        class={clsx(styles.field, { [styles.active]: dragActive() })}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        ref={dropzoneRef}
        onClick={handleDropFieldClick}
      >
        <div class={styles.text}>{loading() ? t('Loading') : props.placeholder}</div>
        <Show when={!loading() && props.isSquare && props.description}>
          <div class={styles.description}>{props.description}</div>
        </Show>
      </div>
      <Show when={dropAreaError()}>
        <div class={styles.error}>{dropAreaError()}</div>
      </Show>
      <Show when={!dropAreaError() && props.description && !props.isSquare}>
        <div class={styles.description}>{props.description}</div>
      </Show>
    </div>
  )
}
