import { useSearchParams } from '@solidjs/router'
import { createEffect, createMemo, JSX, on, Show } from 'solid-js'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'

type Props = {
  children: JSX.Element
  disabled?: boolean
}

export const AuthGuard = (props: Props) => {
  const { session } = useSession()
  const author = createMemo<number>(() => session()?.author?.id || 0)
  const [, changeSearchParams] = useSearchParams()
  const { hideModal } = useUI()

  createEffect(
    on(
      [() => props.disabled, author],
      ([disabled, a]) => {
        if (disabled) return
        if (a) {
          console.debug('[AuthGuard] profile is loaded')
          hideModal()
          return
        }
        // Нет авторизации — открываем модалку логина через параметры запроса
        changeSearchParams(
          {
            source: 'authguard',
            m: 'auth',
            mode: 'login'
          },
          { replace: true }
        )
      },
      { defer: true }
    )
  )

  return <Show when={author() || props.disabled}>{props.children}</Show>
}
