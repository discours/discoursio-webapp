import { clsx } from 'clsx'
import { createMemo, Show } from 'solid-js'
import { getCdnUrl } from '~/lib/imageCache'

import './DialogCard.module.scss'

import styles from './DialogAvatar.module.scss'

type Props = {
  name: string
  url?: string
  online?: boolean
  size?: 'small'
  bordered?: boolean
  class?: string
}

const colors = [
  '#001219',
  '#005f73',
  '#0a9396',
  '#94d2bd',
  '#ee9b00',
  '#ca6702',
  '#ae2012',
  '#9b2226',
  '#668cff',
  '#c34cfe',
  '#e699ff',
  '#6633ff'
]

const getById = (letter: string) =>
  colors[Math.abs(Number(BigInt(((letter || '').toLowerCase()?.codePointAt(0) || 97) - 97) % BigInt(colors.length)))]

const DialogAvatar = (props: Props) => {
  const nameFirstLetter = createMemo(() => props.name.slice(0, 1))
  const randomBg = createMemo(() => {
    return getById(nameFirstLetter())
  })

  return (
    <div
      class={clsx(styles.DialogAvatar, props.class, {
        [styles.online]: props.online,
        [styles.bordered]: props.bordered,
        [styles.small]: props.size === 'small'
      })}
      style={{ 'background-color': `${randomBg()}` }}
    >
      <Show when={Boolean(props.url)} fallback={<div class={styles.letter}>{nameFirstLetter()}</div>}>
        <div
          class={styles.imageHolder}
          style={{
            'background-image': `url(${getCdnUrl(props.url || '', 100)})`
          }}
        />
      </Show>
    </div>
  )
}

export default DialogAvatar
