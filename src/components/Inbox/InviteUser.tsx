import type { Author } from '~/graphql/generated/graphql'

import { Icon } from '../_shared/Icon'

import DialogAvatar from './DialogAvatar'

import styles from './InviteUser.module.scss'

type DialogProps = {
  author: Author
  selected: boolean
  onClick: () => void
}

const InviteUser = (props: DialogProps) => {
  return (
    <div class={styles.InviteUser} onClick={props.onClick}>
      <DialogAvatar name={props.author.name || ''} url={props.author.pic || ''} />
      <div class={styles.name}>{props.author.name}</div>
      <div class={styles.action}>{props.selected ? <Icon name="cross" /> : <Icon name="plus" />}</div>
    </div>
  )
}

export default InviteUser
