import { clsx } from 'clsx'
import { onMount, Show } from 'solid-js'

import { Icon } from '../Icon'

import styles from './SocialNetworkInput.module.scss'

type Props = {
  class?: string
  network?: string
  link?: string
  isExist: boolean
  handleInput: (value: string) => void
  handleDelete?: () => void
  slug?: string
  autofocus?: boolean
}

export const SocialNetworkInput = (props: Props) => {
  let inputRef: HTMLInputElement | null
  onMount(() => {
    if (props.autofocus) {
      inputRef?.focus()
    }
  })
  return (
    <div class={clsx(styles.SocialNetworkInput, props.class)}>
      <div class={styles.icon}>
        <Icon name={props.network ? `social-${props.network}` : 'user-link-default'} />
      </div>
      <input
        ref={(el) => (inputRef = el)}
        class={styles.input}
        type="text"
        value={props.isExist ? props.link : ''}
        onInput={(event) => props.handleInput(event.currentTarget.value)}
        placeholder={props.autofocus ? '' : `${props.link}${props.slug}`}
      />
      <Show when={props.isExist}>
        <button type="button" onClick={props.handleDelete}>
          <Icon name="remove" class={styles.remove} />
        </button>
      </Show>
    </div>
  )
}
