import { Component, JSX } from 'solid-js'
import { Popover } from '~/components/_shared/Popover/Popover'
import { useLocalize } from '~/context/localize'
import { VIMEO_REGEX, YOUTUBE_REGEX, patchVideo } from '../lib/embed'
import { SimpleInsert } from './SimpleInsert'

/**
 * Form component for embedding videos from YouTube/Vimeo
 *
 * Features:
 * - URL validation for YouTube/Vimeo
 * - Preview before embedding
 * - Responsive embed code generation
 *
 * @example
 * ```tsx
 * <SimpleInsertVideoForm
 *   onSubmit={(url) => embedVideo(url)}
 *   onCancel={() => closeForm()}
 * >
 *   {(setRef) => <button ref={setRef}>Add Video</button>}
 * </SimpleInsertVideoForm>
 * ```
 */
interface VideoFormProps {
  /** Called when valid video URL submitted */
  onSubmit: (url: string) => void
  /** Called when form cancelled */
  onCancel: () => void
  /** Function to restore selection before inserting */
  restoreSelection?: () => boolean
  /** Function to execute editor commands */
  execCommand?: (command: string, value?: string) => void
  /** Render prop for anchor element */
  children: (setAnchorEl: (el: HTMLElement | null) => void) => JSX.Element
}

export const SimpleInsertVideoForm: Component<VideoFormProps> = (props) => {
  const { t } = useLocalize()

  const validateVideoUrl = (url: string): string => {
    if (!url.trim()) return t('Please enter URL')
    if (!(YOUTUBE_REGEX.test(url) || VIMEO_REGEX.test(url))) {
      return t('Please enter valid YouTube or Vimeo URL')
    }
    return ''
  }

  const handleSubmit = (url: string) => {
    if (props.restoreSelection?.()) {
      const videoHtml = patchVideo(url)
      props.execCommand?.('insertHTML', videoHtml)
      props.onSubmit(url)
    }
    props.onCancel()
  }

  return (
    <Popover
      content={
        <SimpleInsert
          placeholder={t('YouTube or Vimeo URL')}
          onSubmit={handleSubmit}
          validate={validateVideoUrl}
          icon="video"
          autofocus
        />
      }
    >
      {props.children}
    </Popover>
  )
}
