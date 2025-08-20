import { clsx } from 'clsx'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { Panel } from '~/components/Sidebar/Sidebar'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import type { Topic } from '~/graphql/generated/graphql'
import { isDesktop } from '~/lib/mediaQuery'
import styles from '~/styles/views/EditView.module.scss'
import { Modal } from '../_shared/Modal'
import { TableOfContents } from '../_shared/TableOfContents'
import { PublishSettings } from '../Draft/PublishSettings'

export const MAX_HEADER_LIMIT = 100
export const EMPTY_TOPIC: Topic = { id: -1, slug: '' }

const handleScrollTopButtonClick = (ev: MouseEvent | TouchEvent) => {
  ev.preventDefault()
  window?.scrollTo({ top: 0, behavior: 'smooth' })
}

export const EditSettingsView = () => {
  const { t } = useLocalize()
  const [isScrolled, setIsScrolled] = createSignal(false)
  const { currentDraft } = useDrafts()

  const handleScroll = () => setIsScrolled(window.scrollY > 0)
  onCleanup(() => window.removeEventListener('scroll', handleScroll))
  onMount(() => window.addEventListener('scroll', handleScroll, { passive: true }))

  return (
    <Show when={currentDraft()} fallback={<Loading />}>
      <div class={styles.container}>
        <form>
          <div class="wide-container">
            <button
              class={clsx(styles.scrollTopButton, {
                [styles.visible]: isScrolled()
              })}
              onClick={handleScrollTopButtonClick}
            >
              <Icon name="up-button" class={styles.icon} />
              <span class={styles.scrollTopButtonLabel}>{t('Scroll up')}</span>
            </button>

            <div class={styles.wrapperTableOfContents}>
              <Show when={isDesktop() && currentDraft()?.body}>
                <TableOfContents variant="editor" parentSelector="#editorBody" body={currentDraft()?.body || ''} />
              </Show>
            </div>
          </div>
        </form>
      </div>
      <PublishSettings />
      <Show when={currentDraft()?.id}>
        <Panel shoutId={currentDraft()?.id} />
      </Show>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>
    </Show>
  )
}

export default EditSettingsView
