import { useSearchParams } from '@solidjs/router'
import { Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import styles from './AuthModalHeader.module.scss'

type Props = {
  modalType: 'login' | 'register'
}

export const AuthModalHeader = (props: Props) => {
  const { t } = useLocalize()
  const [searchParams] = useSearchParams<{ source: string }>()

  const generateModalTextsFromSource = (modalType: 'login' | 'register'): { title: string; description: string } => {
    const title = modalType === 'login' ? 'Welcome to Discours' : 'Sign up'

    switch (searchParams?.source) {
      case 'create': {
        return {
          title: t(`${title} to publish articles`),
          description: ''
        }
      }
      case 'bookmark': {
        return {
          title: t(`${title} to add to your bookmarks`),
          description: t('In bookmarks, you can save favorite discussions and materials that you want to return to')
        }
      }
      case 'discussions': {
        return {
          title: t(`${title} to participate in discussions`),
          description: t(
            "You ll be able to participate in discussions, rate others' comments and learn about new responses"
          )
        }
      }
      case 'follow': {
        return {
          title: t(`${title} to subscribe`),
          description: t('This way you ll be able to subscribe to authors, interesting topics and customize your feed')
        }
      }
      case 'subscribe': {
        return {
          title: t(`${title} to subscribe to new publications`),
          description: t('This way you ll be able to subscribe to authors, interesting topics and customize your feed')
        }
      }
      case 'vote': {
        return {
          title: t(`${title} to vote`),
          description: t(
            'This way we ll realize that you re a real person and ll take your vote into account. And you ll see how others voted'
          )
        }
      }
      default: {
        return {
          title: t(title),
          description: ''
        }
      }
    }
  }

  const { title, description } = generateModalTextsFromSource(props.modalType)

  return (
    <>
      <h4 class={styles.authFormHeader}>{title}</h4>
      <Show when={description}>
        <p class={styles.authFormDescription} innerHTML={description} />
      </Show>
    </>
  )
}
