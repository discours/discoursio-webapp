import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import type { PopupProps } from '~/components/_shared/Popup'
import { Popup } from '~/components/_shared/Popup'
import { SoonChip } from '~/components/_shared/SoonChip'
import { useLocalize } from '~/context/localize'

import styles from './FeedArticlePopup.module.scss'

type Props = {
  canEdit: boolean
  onInviteClick: () => void
  onShareClick: () => void
} & Omit<PopupProps, 'children'>

export const FeedArticlePopup = (props: Props) => {
  const { t } = useLocalize()
  const [hidePopup, setHidePopup] = createSignal(false)
  return (
    <>
      <Popup
        {...props}
        //TODO: fix hide logic
        closePopup={hidePopup()}
        horizontalAnchor={'right'}
        variant="tiny"
        popupCssClass={styles.feedArticlePopup}
      >
        <ul class={clsx('nodash', styles.actionList)}>
          <li>
            <button
              class={styles.action}
              onClick={() => {
                props.onShareClick()
                setHidePopup(true)
              }}
            >
              <Icon name="share-outline" class={styles.icon} />
              <div class={styles.title}>{t('Share')}</div>
            </button>
          </li>
          <Show when={!props.canEdit}>
            <li>
              <button
                class={styles.action}
                onClick={() => {
                  alert('Help to edit')
                  setHidePopup(true)
                }}
              >
                <Icon name="pencil-outline" class={styles.icon} />
                <div class={styles.title}>{t('Help to edit')}</div>
              </button>
            </li>
          </Show>
          <li>
            <button
              class={styles.action}
              onClick={() => {
                props.onInviteClick()
                setHidePopup(false)
              }}
            >
              <Icon name="expert" class={styles.icon} />
              <div class={styles.title}>{t('Invite experts')}</div>
            </button>
          </li>
          <Show when={!props.canEdit}>
            <li>
              <button class={clsx(styles.action, styles.soon)}>
                <Icon name="bell-white" class={styles.icon} />
                <div class={styles.title}>{t('Subscribe to comments')}</div>
                <SoonChip />
              </button>
            </li>
          </Show>
          <li>
            <button class={clsx(styles.action, styles.soon)}>
              <Icon name="bookmark" class={styles.icon} />
              <div class={styles.title}>{t('Add to bookmarks')}</div>
              <SoonChip />
            </button>
          </li>
          {/*<Show when={!props.canEdit}>*/}
          {/*  <li>*/}
          {/*    <button*/}
          {/*      class={styles.action}*/}
          {/*      */}
          {/*      onClick={() => {*/}
          {/*        alert('Complain')*/}
          {/*      }}*/}
          {/*    >*/}
          {/*      {t('Complain')}*/}
          {/*    </button>*/}
          {/*  </li>*/}
          {/*</Show>*/}
          {/*<li>*/}
          {/*  <button*/}
          {/*    class={styles.action}*/}
          {/*    */}
          {/*    onClick={() => {*/}
          {/*      alert('Get notifications')*/}
          {/*    }}*/}
          {/*  >*/}
          {/*    {t('Get notifications')}*/}
          {/*  </button>*/}
          {/*</li>*/}
        </ul>
      </Popup>
    </>
  )
}
