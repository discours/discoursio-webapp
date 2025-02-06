import { Component, JSX } from 'solid-js'
import { Popover } from '~/components/_shared/Popover/Popover'
import { useLocalize } from '~/context/localize'
import { URL_REGEX, selectedTextToLink } from '../lib/embed'
import { SimpleInsert } from './SimpleInsert'

/**
 * Form component for inserting links with URL validation
 *
 * Features:
 * - URL validation
 * - Link text preview
 * - Selection preservation
 * - Keyboard shortcuts
 *
 * @example
 * ```tsx
 * <SimpleInsertLinkForm
 *   onSubmit={(url) => insertLink(url)}
 *   initialText="Selected text"
 *   restoreSelection={() => editor.restoreSelection()}
 * >
 *   {(setRef) => <button ref={setRef}>Add Link</button>}
 * </SimpleInsertLinkForm>
 * ```
 */
interface InsertLinkFormProps {
  /** Additional CSS class */
  class?: string
  /** Called when form closed */
  onClose?: () => void
  /** Called when valid URL submitted */
  onSubmit?: (url: string) => void
  /** Called when link removed */
  onRemove?: () => void
  /** Text to use as link text */
  initialText?: string
  /** Current selection to restore */
  selection?: Range | null
  /** Function to restore selection before inserting */
  restoreSelection?: () => void
  /** Function to execute editor commands */
  execCommand?: (command: string, value?: string) => void
  /** Render prop for anchor element */
  children: (setAnchorEl: (el: HTMLElement | null) => void) => JSX.Element
}

export const SimpleInsertLinkForm: Component<InsertLinkFormProps> = (props) => {
  const { t } = useLocalize()

  const validateUrl = (url: string): string => {
    if (!url.trim()) return t('Please enter URL')
    if (!URL_REGEX.test(url)) return t('Please enter valid URL')
    return ''
  }

  const handleSubmit = (url: string) => {
    const normalized = url.trim()
    if (!validateUrl(normalized)) {
      if (props.restoreSelection?.()) {
        const link = selectedTextToLink(normalized, props.initialText || '')
        props.execCommand?.('insertHTML', link)
        props.onSubmit?.(normalized)
      }
      props.onClose?.()
    }
  }

  return (
    <Popover
      content={
        <SimpleInsert
          class={props.class}
          placeholder={t('Enter URL')}
          onSubmit={handleSubmit}
          validate={validateUrl}
          icon="arrow-right"
          autofocus
          initialText={props.initialText}
        />
      }
    >
      {props.children}
    </Popover>
  )
}
