import { Editor } from '@tiptap/core'
import clsx from 'clsx'
import { JSX } from 'solid-js'
import { Popover } from '~/components/_shared/Popover'
import { capitalize } from '~/utils/capitalize'

import styles from './ToolbarControl.module.scss'

import { useLocalize } from '~/context/localize'

export interface ControlProps {
  editor: Editor | undefined
  caption?: string
  key?: string
  onChange: () => void
  isActive?: () => boolean | undefined
  children: JSX.Element
}

export const ToolbarControl = (props: ControlProps): JSX.Element => {
  const { t } = useLocalize()
  const handleClick = (ev?: MouseEvent) => {
    ev?.preventDefault()
    ev?.stopPropagation()
    props.onChange?.()
  }
  const isActive =
    props.isActive || props.key ? () => props.editor?.isActive?.(props.key || '') : () => false
  return (
    <Popover content={props.caption || t(capitalize(props.key || ''))}>
      {(triggerRef: (el: HTMLElement) => void) => (
        <button
          ref={triggerRef}
          type="button"
          class={clsx(styles.actionButton, { [styles.active]: isActive() })}
          onClick={handleClick}
        >
          {props.children}
        </button>
      )}
    </Popover>
  )
}

export default ToolbarControl
