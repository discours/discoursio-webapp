import { createDropzone } from '@solid-primitives/upload'
import { clsx } from 'clsx'
import { For, Show, createSignal } from 'solid-js'

import { VideoPlayer } from '~/components/_shared/VideoPlayer'
import { useLocalize } from '~/context/localize'
import { useSnackbar } from '~/context/ui'
import { MediaItem } from '~/graphql/schema/core.gen'
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
  const { showSnackbar } = useSnackbar()
  let urlInput: HTMLInputElement | undefined

  const { setRef: dropzoneRef, files: droppedFiles } = createDropzone({
    onDrop: async () => {
      setDragActive(false)
      if (droppedFiles().length > 1) {
        setError(t('Many files, choose only one'))
      } else if (droppedFiles()[0].file.type.startsWith('video/')) {
        await showSnackbar({
          body: t(
            'This functionality is currently not available, we would like to work on this issue. Use the download link.'
          )
        })
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
    if (validateUrl(value)) {
      props.onVideoAdd(composeMediaItems([{ url: value }]))
    } else {
      setIncorrectUrl(true)
    }
  }

  return (
    <Show
      when={props.video.length === 0}
      fallback={
        <For each={props.video}>
          {(mi, index) => (
            <VideoPlayer onVideoDelete={() => props.onVideoDelete(index())} videoUrl={mi?.url || ''} />
          )}
        </For>
      }
    >
      <div class={styles.VideoUploader}>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onClick={() =>
            showSnackbar({
              body: t(
                'This functionality is currently not available, we would like to work on this issue. Use the download link.'
              )
            })
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
            ref={(el) => (urlInput = el)}
            type="text"
            placeholder={t('Insert video link')}
            onChange={(event) => handleUrlInput(event.currentTarget.value)}
          />
        </div>
        <Show when={incorrectUrl()}>
          <div class={styles.error}>{t('It does not look like url')}</div>
        </Show>
      </div>
    </Show>
  )
}
