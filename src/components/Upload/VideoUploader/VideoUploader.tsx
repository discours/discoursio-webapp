import { createDropzone } from '@solid-primitives/upload'
import { clsx } from 'clsx'
import { createSignal, For, Show } from 'solid-js'
import { toast } from 'solid-sonner'

import { VideoPlayer } from '~/components/_shared/VideoPlayer'
import { useLocalize } from '~/context/localize'
import { MediaItem } from '~/graphql/generated/graphql'
import { composeMediaItems } from '~/lib/composeMediaItems'
import { validateUrl } from '~/utils/validate'

import styles from './VideoUploader.module.scss'

type Props = {
  video: MediaItem[]
  onVideoAdd: (value: MediaItem[]) => void
  onVideoDelete: (mediaItemIndex: number) => void
}

export const VideoUploader = (props: Props) => {
  const { t } = useLocalize()
  const [dragActive, setDragActive] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [incorrectUrl, setIncorrectUrl] = createSignal<boolean>(false)
  const [urlInput, setUrlInput] = createSignal<HTMLInputElement | undefined>()

  const { setRef: dropzoneRef, files: droppedFiles } = createDropzone({
    onDrop: () => {
      setDragActive(false)
      if (droppedFiles().length > 1) {
        setError(t('Many files, choose only one'))
      } else if (droppedFiles()[0].file.type.startsWith('video/')) {
        toast.error(
          t(
            'This functionality is currently not available, we would like to work on this issue. Use the download link.'
          )
        )
      } else {
        setError(t('Video format not supported'))
      }
    }
  })
  const handleDrag = (event: DragEvent) => {
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true)
      setError()
    } else if (event.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleUrlInput = (value: string) => {
    setError()
    setIncorrectUrl(false)

    if (validateUrl(value)) {
      const url = urlInput()?.value.trim()
      if (url) {
        props.onVideoAdd(composeMediaItems([{ url }]))
        if (urlInput()) {
          urlInput()!.value = ''
        }
      }
    } else {
      setIncorrectUrl(true)
    }
  }

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleUrlInput(urlInput()?.value || '')
    }
  }

  return (
    <Show
      when={props.video.length === 0}
      fallback={
        <For each={props.video}>
          {(mi, index) => <VideoPlayer onVideoDelete={() => props.onVideoDelete(index())} videoUrl={mi?.url || ''} />}
        </For>
      }
    >
      <div class={styles.VideoUploader}>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onClick={() =>
            toast.error(
              t(
                'This functionality is currently not available, we would like to work on this issue. Use the download link.'
              ),
              {
                icon: 'error'
              }
            )
          }
          ref={dropzoneRef}
          class={clsx(styles.dropArea, { [styles.active]: dragActive() })}
        >
          <div class={styles.text}>{t('Upload video')}</div>
        </div>
        <Show when={error()}>
          <div class={styles.error}>{error()}</div>
        </Show>
        <div class={styles.inputHolder}>
          <input
            class={clsx(styles.urlInput, { [styles.hasError]: incorrectUrl() })}
            ref={setUrlInput}
            type="text"
            placeholder={t('Insert video link')}
            onChange={(event) => handleUrlInput(event.currentTarget.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <Show when={incorrectUrl()}>
          <div class={styles.error}>{t('It does not look like url')}</div>
        </Show>
      </div>
    </Show>
  )
}
