import { clsx } from 'clsx'
import { createMemo, Show } from 'solid-js'

import { ConditionalWrapper } from '~/components/_shared/ConditionalWrapper'
import { Image } from '~/components/_shared/Image'
import { Loading } from '~/components/_shared/Loading'
import { cdnUrl } from '~/config'

import styles from './Userpic.module.scss'

type Props = {
  name: string
  userpic: string
  class?: string
  slug?: string
  onClick?: () => void
  loading?: boolean
  hasLink?: boolean
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL' // 20 | 28 | 32 | 40 | 168
}

export const Userpic = (props: Props) => {
  const letters = () => {
    if (!props.name) return
    const names = props.name ? props.name.split(' ') : []
    return `${names[0][0] ? names[0][0] : ''}.${names.length > 1 ? `${names[1][0]}.` : ''}`
  }

  const avatarSize = createMemo(() => {
    switch (props.size) {
      case 'XS': {
        return 40
      }
      case 'S': {
        return 56
      }
      case 'L': {
        return 80
      }
      case 'XL': {
        return 336
      }
      default: {
        return 64
      }
    }
  })

  // NOTE: Определяем тип аватарки
  // OAuth аватарки (с внешних сервисов) - обычный <img>
  // Локальные CDN аватарки - <Image> компонент с оптимизацией
  const isExternalAvatar = createMemo(() => {
    if (!props.userpic) return false
    // OAuth аватарки и legacy assets.discours.io
    return !props.userpic.startsWith(cdnUrl) && !props.userpic.startsWith('/')
  })

  return (
    <div
      class={clsx(styles.Userpic, props.class, styles[props.size ?? 'M'], {
        cursorPointer: props.onClick
      })}
      onClick={props.onClick}
    >
      <Show when={!props.loading} fallback={<Loading size="small" />}>
        <ConditionalWrapper
          condition={Boolean(props.hasLink)}
          wrapper={(children) => <a href={`/@${props.slug}`}>{children}</a>}
        >
          <Show keyed={true} when={props.userpic} fallback={<div class={styles.letters}>{letters()}</div>}>
            <Show
              when={isExternalAvatar()}
              fallback={<Image src={props.userpic} width={avatarSize()} height={avatarSize()} alt={props.name} />}
            >
              {/* NOTE: Внешние OAuth аватарки - без обработки getCdnUrl */}
              <img
                src={props.userpic}
                width={avatarSize()}
                height={avatarSize()}
                alt={props.name}
                style={{ 'border-radius': '50%', 'object-fit': 'cover' }}
              />
            </Show>
          </Show>
        </ConditionalWrapper>
      </Show>
    </div>
  )
}
