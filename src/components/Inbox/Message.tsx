import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import type { ChatMember, Message as MessageType } from '~/graphql/schema/chat.gen'
import { Icon } from '../_shared/Icon'

import DialogAvatar from './DialogAvatar'
import styles from './Message.module.scss'
import { MessageActionsPopup } from './MessageActionsPopup'
import QuotedMessage from './QuotedMessage'

type Props = {
  content: MessageType
  ownId: number
  members: ChatMember[]
  replyClick?: () => void
  replyBody?: string
  replyAuthor?: string
}

export const Message = (props: Props) => {
  const { formatTime } = useLocalize()
  const isOwn = props.ownId === Number(props.content.created_by)
  const user = props.members?.find((m) => m.id === Number(props.content.created_by))
  const [isPopupVisible, setIsPopupVisible] = createSignal<boolean>(false)

  return (
    <div class={clsx(styles.Message, isOwn && styles.own)}>
      <Show when={!isOwn && user?.name}>
        <div class={styles.author}>
          <DialogAvatar size="small" name={user?.name || ''} url={user?.pic || ''} />
          <div class={styles.name}>{user?.name}</div>
        </div>
      </Show>
      <div class={clsx(styles.body, { [styles.popupVisible]: isPopupVisible() })}>
        <div class={styles.text}>
          <div class={styles.actions}>
            <div onClick={props.replyClick}>
              <Icon name="chat-reply" class={styles.reply} />
            </div>
            <MessageActionsPopup
              onVisibilityChange={(isVisible) => setIsPopupVisible(isVisible)}
              trigger={<Icon name="menu" />}
            />
          </div>
          <Show when={props.replyBody}>
            <QuotedMessage body={props.replyBody || ''} variant="inline" isOwn={isOwn} />
          </Show>
          <div innerHTML={props.content.body} />
        </div>
      </div>
      <div class={styles.time}>{formatTime(new Date(props.content.created_at * 1000))}</div>
    </div>
  )
}
