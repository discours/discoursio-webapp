import { createSocialShare, FACEBOOK, TELEGRAM, TWITTER, VK } from '@solid-primitives/share'
import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'
import { toast } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { Icon } from '../Icon'
import { Popover } from '../Popover'
import popupStyles from '../Popup/Popup.module.scss'
import styles from './ShareLinks.module.scss'

type Props = {
  title: string
  description: string
  shareUrl: string
  imageUrl?: string
  class?: string
  variant: 'inModal' | 'inPopup'
  onShareClick?: () => void
}

export const ShareLinks = (props: Props) => {
  const { t } = useLocalize()
  const [isLinkCopied, setIsLinkCopied] = createSignal(false)

  const [share] = createSocialShare(() => ({
    title: props.title,
    url: props.shareUrl,
    description: props.description
  }))

  const handleShare = (network: string | undefined) => {
    share(network)
    if (props.variant === 'inModal') {
      props.onShareClick?.()
    }
  }
  const copyLink = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(props.shareUrl)
    }
    if (props.variant === 'inModal') {
      setIsLinkCopied(true)
      setTimeout(() => {
        setIsLinkCopied(false)
        props.onShareClick?.()
      }, 3000)
    } else {
      toast.success(t('Link copied'))
    }
  }

  return (
    <div class={clsx(styles.ShareLinks, props.class, { [styles.inModal]: props.variant === 'inModal' })}>
      <ul class="nodash">
        <li>
          <button class={clsx(styles.shareControl, popupStyles.action)} onClick={() => handleShare(FACEBOOK)}>
            <Icon name="facebook-white" class={clsx(styles.icon, popupStyles.icon)} />
            Facebook
          </button>
        </li>
        <li>
          <button class={clsx(styles.shareControl, popupStyles.action)} onClick={() => handleShare(TWITTER)}>
            <Icon name="twitter-white" class={clsx(styles.icon, popupStyles.icon)} />
            Twitter
          </button>
        </li>
        <li>
          <button class={clsx(styles.shareControl, popupStyles.action)} onClick={() => handleShare(TELEGRAM)}>
            <Icon name="telegram-white" class={clsx(styles.icon, popupStyles.icon)} />
            Telegram
          </button>
        </li>
        <li>
          <button class={clsx(styles.shareControl, popupStyles.action)} onClick={() => handleShare(VK)}>
            <Icon name="vk-white" class={clsx(styles.icon, popupStyles.icon)} />
            VK
          </button>
        </li>
        <li>
          <Show
            when={props.variant === 'inModal'}
            fallback={
              <button class={clsx(styles.shareControl, popupStyles.action)} onClick={copyLink}>
                <Icon name="link-white" class={clsx(styles.icon, popupStyles.icon)} />
                {t('Copy link')}
              </button>
            }
          >
            <form class={clsx('pretty-form__item', styles.linkInput)}>
              <label for="link">
                <input type="text" name="link" readonly value={props.shareUrl} />
                {t('Copy link')}
              </label>

              <Popover content={t('Copy link')}>
                {(triggerRef: (el: HTMLElement) => void) => (
                  <div class={styles.copyButton} onClick={copyLink} ref={triggerRef}>
                    <Icon name="copy" class={clsx(styles.icon, popupStyles.icon)} />
                  </div>
                )}
              </Popover>

              <Show when={isLinkCopied()}>
                <div class={styles.isCopied}>{t('Link copied to clipboard')}</div>
              </Show>
            </form>
          </Show>
        </li>
      </ul>
    </div>
  )
}
