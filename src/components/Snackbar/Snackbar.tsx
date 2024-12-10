import { clsx } from 'clsx'
import { Show } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import { Transition } from 'solid-transition-group'

import { useSnackbar } from '~/context/ui'
import { Icon } from '../_shared/Icon'

import styles from './Snackbar.module.scss'

export const Snackbar = () => {
  const { snackbarMessage } = useSnackbar()

  return (
    <div
      class={clsx(styles.snackbar, {
        [styles.error]: snackbarMessage()?.type === 'error',
        [styles.success]: snackbarMessage()?.type === 'success'
      })}
    >
      <NoHydration>
        <Transition
          enterClass={styles.enter}
          exitToClass={styles.exitTo}
          onExit={(_el, done) => setTimeout(() => done(), 300)}
        >
          <Show when={snackbarMessage()?.body}>
            <div class={styles.content}>
              <Show when={snackbarMessage()?.type === 'success'}>
                <Icon name="check-success" class={styles.icon} />
              </Show>
              {snackbarMessage()?.body || ''}
            </div>
          </Show>
        </Transition>
      </NoHydration>
    </div>
  )
}
