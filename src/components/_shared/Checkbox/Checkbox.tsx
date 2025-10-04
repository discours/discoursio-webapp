import { clsx } from 'clsx'
import { Icon } from '../Icon'
import styles from './Checkbox.module.scss'

type CheckboxProps = {
  id: string
  name?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  class?: string
  variant?: 'default' | 'notifications'
  label?: string
}

/**
 * Кастомный чекбокс с иконками
 * Варианты: 'default' (checkbox-big) или 'notifications' (checkbox-notifications)
 */
export const Checkbox = (props: CheckboxProps) => {
  const iconName = () => (props.variant === 'notifications' ? 'checkbox-notifications' : 'checkbox-big')

  return (
    <div class={clsx(styles.Checkbox, props.class)}>
      <input
        type="checkbox"
        id={props.id}
        name={props.name || props.id}
        checked={props.checked}
        onChange={(e) => props.onChange?.(e.target.checked)}
        class={styles.input}
      />
      <label for={props.id} class={styles.label}>
        <Icon name={iconName()} isActive={props.checked} activeSuffix="checked" class={styles.icon} />
        {props.label && <span class={styles.labelText}>{props.label}</span>}
      </label>
    </div>
  )
}
