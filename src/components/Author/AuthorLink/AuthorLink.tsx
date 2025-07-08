import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createMemo, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Author } from '~/graphql/generated/graphql'
import { isCyrillic } from '~/intl/translate'
import { translit } from '~/intl/translit'
import { capitalize } from '~/utils/capitalize'
import { Userpic } from '../Userpic'
import styles from './AuthorLink.module.scss'

type Props = {
  author: Author
  size?: 'XS' | 'M' | 'L'
  class?: string
  isFloorImportant?: boolean
}

export const AuthorLink = (props: Props) => {
  const { lang } = useLocalize()
  const name = createMemo(() => {
    return lang() === 'en' && isCyrillic(props.author?.name || '')
      ? translit(capitalize(props.author?.name || ''))
      : props.author?.name || ''
  })
  return (
    <Show when={props.author}>
      <div
        class={clsx(styles.AuthorLink, props.class, styles[(props.size ?? 'M') as keyof Props['size']], {
          [styles.authorLinkFloorImportant]: props.isFloorImportant
        })}
      >
        <A class={styles.link} href={`/@${props.author?.slug}`}>
          <Userpic size={props.size ?? 'M'} name={name() || ''} userpic={props.author.pic || ''} />
          <div class={styles.name}>{name()}</div>
        </A>
      </div>
    </Show>
  )
}
