import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For } from 'solid-js'

import { useLocalize } from '~/context/localize'
import { LayoutType } from '~/types/common'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'

import { DraftInput, useDrafts } from '~/context/drafts'
import styles from './LayoutSelector.module.scss'
import { Draft } from '~/graphql/schema/core.gen'

export const LayoutSelector = () => {
  const { t } = useLocalize()
  const { createDraft } = useDrafts()
  const navigate = useNavigate()

  const handleCreate = async (layout: LayoutType) => {
    console.debug('[routes : edit/new] handling create click...')
    const result = await createDraft({ layout } as DraftInput)
    console.log('[routes : edit/new] result', result)
    if (result?.draft) {
      navigate(`/edit/${result.draft.id}`, { replace: true }) // drafts list here
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
