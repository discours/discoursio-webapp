import clsx from 'clsx'
import { For } from 'solid-js'
import { useLocalize } from '~/context/localize'

import styles from './../Styles/SearchModal.module.scss'

export const SearchNav = (props: { view: string; setView: (view: string) => void }) => {
  const { t } = useLocalize()
  const SEARCH_VIEWS = ['all', 'articles', 'topics', 'authors']

  return (
    <div class="wide-container">
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
                {viewKey === 'all'
                  ? t('All')
                  : viewKey === 'articles'
                    ? t('Articles')
                    : viewKey === 'topics'
                      ? t('Topics')
                      : viewKey === 'authors'
                        ? t('Authors')
                        : viewKey}
              </span>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
