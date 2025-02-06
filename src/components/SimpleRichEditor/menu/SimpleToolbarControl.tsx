import clsx from 'clsx'
import { Component, JSX } from 'solid-js'

import styles from './SimpleToolbarControl.module.scss'

/**
 * Reusable toolbar button component with active state and tooltip
 *
 * Features:
 * - Active state styling
 * - Tooltip with caption
 * - Click handling
 * - Keyboard focus support
 *
 * @example
 * ```tsx
 * <SimpleToolbarControl
 *   key="bold"
 *   isActive={format.bold}
 *   onChange={() => toggleBold()}
 *   caption="Bold (⌘B)"
 * >
 *   <Icon name="editor-bold" />
 * </SimpleToolbarControl>
 * ```
 */
interface ToolbarControlProps {
  /** Unique key for control */
  key: string
  /** Whether control is in active state */
  isActive?: boolean
  /** Called when control clicked */
  onChange: () => void
  /** Tooltip text (can include keyboard shortcut) */
  caption?: string
  /** Control content (usually an icon) */
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
