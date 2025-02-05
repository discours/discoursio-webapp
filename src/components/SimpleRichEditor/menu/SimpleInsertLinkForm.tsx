import { Component } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { URL_REGEX, selectedTextToLink } from '../lib/embed'
import { SimpleInsert } from './SimpleInsert'

interface InsertLinkFormProps {
  class?: string
  onClose?: () => void
  onSubmit?: (url: string) => void
  onRemove?: () => void
  onClick?: (e: MouseEvent) => void
  initialText?: string
  selection?: Range | null
  restoreSelection?: () => boolean
  execCommand?: (command: string, value?: string) => void
}

export const SimpleInsertLinkForm: Component<InsertLinkFormProps> = (props) => {
  const { t } = useLocalize()

  const validateUrl = (url: string): string => {
    if (!url.trim()) return t('URL cannot be empty')
    if (!URL_REGEX.test(url)) return t('Invalid URL')
    return ''
  }

  const handleSubmit = (url: string) => {
    if (!url) {
      props.onClose?.()
      return
    }

    const normalized = url.startsWith('http') ? url : `https://${url}`

    if (props.restoreSelection?.()) {
      const link = selectedTextToLink(normalized, props.initialText || '')
      props.execCommand?.('insertHTML', link)
      props.onSubmit?.(normalized)
    }

    props.onClose?.()
  }

  return (
    <SimpleInsert
      class={props.class}
      placeholder={t('Enter URL')}
      onSubmit={handleSubmit}
      validate={validateUrl}
      icon="arrow-right"
      autofocus
      initialText={props.initialText}
    />
  )
}
