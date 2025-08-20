import { clsx } from 'clsx'
import { createEffect, createSignal, onMount } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'

import styles from './InlineForm.module.scss'

type Props = {
  onClose: () => void
  onBlur?: (event: FocusEvent) => void
  onClear?: () => void
  onSubmit: (value: string) => void
  validate?: (value: string) => string | Promise<string>
  initialValue?: string
  showInput?: boolean
  placeholder: string
  onFocus?: (event: FocusEvent) => void
}

export const InlineForm = (props: Props) => {
  const { t } = useLocalize()
  const [formValue, setFormValue] = createSignal(props.initialValue || '')
  const [formValueError, setFormValueError] = createSignal<string | undefined>()
  const [inputRef, setInputRef] = createSignal<HTMLInputElement | undefined>()
  const handleFormInput = (e: { currentTarget: HTMLInputElement; target: HTMLInputElement }) => {
    const value = (e.currentTarget || e.target).value
    setFormValueError()
    setFormValue(value)
  }

  createEffect(() => {
    setFormValue(props.initialValue || '')
  })

  const handleSaveButtonClick = async () => {
    if (props.validate) {
      const errorMessage = await props.validate(formValue())
      if (errorMessage) {
        setFormValueError(errorMessage)
        return
      }
    }

    props.onSubmit(formValue())
    props.onClose()
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    setFormValueError('')

    if (e.key === 'Enter') {
      e.preventDefault()
      await handleSaveButtonClick()
    }

    if (e.key === 'Escape' && props.onClear) {
      props.onClear()
    }
  }

  const handleClear = () => {
    props.initialValue && props.onClear?.()
    props.onClose()
  }

  onMount(() => inputRef()?.focus())

  return (
    <div class={styles.InlineForm}>
      <div class={styles.form}>
        <input
          ref={setInputRef}
          type="text"
          value={formValue()}
          placeholder={props.placeholder}
          onKeyDown={handleKeyDown}
          onInput={handleFormInput}
          onFocus={props.onFocus}
        />
        <Popover content={t('Add link')}>
          {(triggerRef: (el: HTMLElement) => void) => (
            <button ref={triggerRef} type="button" onClick={handleSaveButtonClick} disabled={Boolean(formValueError())}>
              <Icon name="status-done" />
            </button>
          )}
        </Popover>
        <Popover content={props.initialValue ? t('Remove link') : t('Cancel')}>
          {(triggerRef: (el: HTMLElement) => void) => (
            <button ref={triggerRef} type="button" onClick={handleClear}>
              {props.initialValue ? <Icon name="editor-unlink" /> : <Icon name="status-cancel" />}
            </button>
          )}
        </Popover>
      </div>

      <div class={clsx(styles.linkError, { [styles.visible]: Boolean(formValueError()) })}>{formValueError()}</div>
    </div>
  )
}
