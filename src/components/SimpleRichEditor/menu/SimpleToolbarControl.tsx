import clsx from 'clsx'
import { Component, JSX } from 'solid-js'

import styles from './SimpleToolbarControl.module.scss'

interface ToolbarControlProps {
  key?: string
  isActive?: boolean
  onChange?: () => void
  caption?: string
  children: JSX.Element
}

export const SimpleToolbarControl: Component<ToolbarControlProps> = (props) => {
  return (
    <button
      class={clsx(styles.control, {
        [styles.active]: props.isActive
      })}
      onClick={props.onChange}
      title={props.caption}
      type="button"
    >
      {props.children}
    </button>
  )
}
