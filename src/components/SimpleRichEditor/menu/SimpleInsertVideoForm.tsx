import { Component } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { VIMEO_REGEX, YOUTUBE_REGEX, patchVideo } from '../lib/embed'
import { SimpleInsert } from './SimpleInsert'

interface VideoFormProps {
  onSubmit: (url: string) => void
  onCancel: () => void
  restoreSelection?: () => boolean
  execCommand?: (command: string, value?: string) => void
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
    <SimpleInsert
      placeholder={t('YouTube or Vimeo URL')}
      onSubmit={handleSubmit}
      validate={validateVideoUrl}
      icon="video"
      autofocus
    />
  )
}
