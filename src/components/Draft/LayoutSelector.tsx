import { clsx } from 'clsx'
import { For } from 'solid-js'

import { useLocalize } from '~/context/localize'
import { LayoutType } from '~/types/common'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'

import { DraftInput, useDrafts } from '~/context/drafts'
import styles from './LayoutSelector.module.scss'

export const LayoutSelector = () => {
  const { t } = useLocalize()
  const { createDraft } = useDrafts()

  const handleCreate = (layout: LayoutType) => {
    console.debug('[routes : edit/new] handling create click...')
    createDraft({ layout } as DraftInput)
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
