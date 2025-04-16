import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For } from 'solid-js'

import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { LayoutType } from '~/types/nav'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'

import styles from './LayoutSelector.module.scss'

export const LayoutSelector = () => {
  const { t } = useLocalize()
  const { createDraft, loadDrafts } = useDrafts()
  const navigate = useNavigate()

  const handleCreate = async (layout: LayoutType) => {
    try {
      console.debug('[routes : edit/new] handling create click...')
      const result = await createDraft({ layout })
      console.log('[routes : edit/new] result', result)

      if (result?.data?.create_draft?.draft) {
        // Даем время серверу на сохранение черновика
        console.log('[routes : edit/new] waiting before loading drafts...')
        await new Promise((resolve) => setTimeout(resolve, 1000))

        console.log('[routes : edit/new] loading drafts...')
        await loadDrafts()

        console.log('[routes : edit/new] navigating to /edit...')
        await navigate(`/edit/${result.data.create_draft.draft.id}`, { replace: true })
      } else {
        console.warn('[routes : edit/new] failed to create draft:', result)
      }
    } catch (error) {
      console.error('[routes : edit/new] error:', error)
    }
  }

  return (
    <article class={clsx('wide-container', 'container--static-page', styles.Create)}>
      <h1>{t('Choose a post type')}</h1>
      <ul class={clsx('nodash', styles.list)}>
        <For each={['Article', 'Literature', 'Image', 'Audio', 'Video']}>
          {(layout: string) => (
            <li onClick={() => handleCreate(layout.toLowerCase() as LayoutType)}>
              <div class={styles.link}>
                <Icon name={`create-${layout.toLowerCase()}`} class={styles.icon} />
                <div>{t(layout)}</div>
              </div>
            </li>
          )}
        </For>
      </ul>
      <Button value={t('Back')} onClick={() => window?.history.back()} />
    </article>
  )
}
