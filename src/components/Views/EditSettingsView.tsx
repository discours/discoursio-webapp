import { clsx } from 'clsx'
import deepEqual from 'fast-deep-equal'
import { Show, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { debounce } from 'throttle-debounce'
import { Panel } from '~/components/Sidebar/Sidebar'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { ShoutForm, useEditorContext } from '~/context/editor'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import getMyShoutQuery from '~/graphql/query/core/article-my'
import type { MediaItem, Shout, Topic } from '~/graphql/schema/core.gen'
import { isDesktop } from '~/lib/mediaQuery'
import { clone } from '~/utils/clone'
import { AutoSaveNotice } from '../AutoSaveNotice'
import { PublishSettings } from '../Draft/PublishSettings'
import { Modal } from '../_shared/Modal'
import { TableOfContents } from '../_shared/TableOfContents'

import styles from '~/styles/views/EditView.module.scss'

type Props = {
  shout: Shout
}

export const MAX_HEADER_LIMIT = 100
export const EMPTY_TOPIC: Topic = {
  id: -1,
  slug: ''
}

const AUTO_SAVE_DELAY = 3000

const handleScrollTopButtonClick = (ev: MouseEvent | TouchEvent) => {
  ev.preventDefault()
  window?.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

export const EditSettingsView = (props: Props) => {
  const { t } = useLocalize()
  const [isScrolled, setIsScrolled] = createSignal(false)
  const { client } = useSession()
  const { form, setForm, saveDraft, editing } = useEditorContext()
  const [shoutTopics, setShoutTopics] = createSignal<Topic[]>([])
  const [draft, setDraft] = createSignal()
  const [prevForm, setPrevForm] = createStore<ShoutForm>(clone(form))
  const [saving, setSaving] = createSignal(false)

  createEffect(
    on(
      () => props.shout,
      (shout) => {
        if (shout) {
          // console.debug(`[EditView] shout is loaded: ${shout}`)
          setShoutTopics((shout.topics as Topic[]) || [])
          const stored = localStorage.getItem(`shout-${shout.id}`)
          if (stored) {
            // console.info(`[EditView] got stored shout: ${stored}`)
            setDraft(JSON.parse(stored))
          } else {
            if (!shout.slug) {
              console.warn(`[EditView] shout has no slug! ${shout}`)
            }
            const draftForm = {
              slug: shout.slug || '',
              shoutId: shout.id || 0,
              title: shout.title || '',
              lead: shout.lead || '',
              description: shout.description || '',
              subtitle: shout.subtitle || '',
              selectedTopics: (shoutTopics() || []) as Topic[],
              mainTopic: shoutTopics()[0] || '',
              body: shout.body || '',
              coverImageUrl: shout.cover || '',
              media: (shout.media || []) as MediaItem[],
              layout: shout.layout
            }
            setForm((_) => draftForm)
            console.debug('draft from props data: ', draftForm)
          }
        }
      },
      { defer: true }
    )
  )

  createEffect(
    on(
      draft,
      (d) => {
        if (d) {
          const draftForm = Object.keys(d).length !== 0 ? d : { shoutId: props.shout.id }
          setForm(draftForm)
          console.debug('got draft from localstorage')
        }
      },
      { defer: true }
    )
  )

  createEffect(
    on(
      () => props.shout?.id,
      async (shoutId) => {
        if (shoutId) {
          const resp = await client()?.query(getMyShoutQuery, { shout_id: shoutId })
          const result = resp?.data?.get_my_shout
          if (result) {
            // console.debug('[EditView] getMyShout result: ', result)
            const { shout: loadedShout, error } = result
            setDraft(loadedShout)
            // console.debug('[EditView] loadedShout:', loadedShout)
            error && console.log(error)
          }
        }
      },
      { defer: true }
    )
  )

  onMount(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    onCleanup(() => {
      window.removeEventListener('scroll', handleScroll)
    })

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!deepEqual(prevForm, form)) {
        event.returnValue = t(
          'There are unsaved changes in your publishing settings. Are you sure you want to leave the page without saving?'
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    onCleanup(() => window.removeEventListener('beforeunload', handleBeforeUnload))
  })
  const [hasChanges, setHasChanges] = createSignal(false)
  const autoSave = async () => {
    console.log('autoSave called')
    if (hasChanges()) {
      const data = { ...form, body: editing()?.getHTML() || '' }
      console.debug('saving draft', data)
      setSaving(true)
      localStorage.setItem(`shout-${data.shoutId}`, JSON.stringify(data))
      await saveDraft(data)
      setPrevForm(clone(data))
      setSaving(false)
      setHasChanges(false)
    }
  }

  const debouncedAutoSave = debounce(AUTO_SAVE_DELAY, autoSave)

  onMount(() => {
    onCleanup(() => {
      debouncedAutoSave.cancel()
    })
  })

  return (
    <>
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

            <AutoSaveNotice active={saving()} />

            <div class={styles.wrapperTableOfContents}>
              <Show when={isDesktop() && form.body}>
                <TableOfContents variant="editor" parentSelector="#editorBody" body={form.body} />
              </Show>
            </div>
          </div>
        </form>
      </div>
      <PublishSettings shoutId={props.shout.id} form={form} />
      <Show when={props.shout}>
        <Panel shoutId={props.shout.id} />
      </Show>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>
    </>
  )
}

export default EditSettingsView
