import clsx from 'clsx'
import { For } from 'solid-js'
import { useLocalize } from '~/context/localize'

import { capitalize } from '~/utils/capitalize'
import styles from './SearchModal.module.scss'

export const SearchNav = (props: { view: string; setView: (view: string) => void }) => {
  const { t } = useLocalize()
  const SEARCH_VIEWS = ['all', 'posts', 'topics', 'authors']

  return (
    <div class={clsx('wide-container')}>
      <ul class={clsx('view-switcher')}>
        <For each={SEARCH_VIEWS}>
          {(viewKey) => (
            <li class={clsx({ 'view-switcher__item--selected': props.view === viewKey })}>
              <span
                class={clsx(
                  styles.searchNavButton,
                  props.view === viewKey && styles.searchNavButtonSelected
                )}
                onClick={() => props.setView(viewKey)}
              >
                {t(capitalize(viewKey))}
              </span>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
