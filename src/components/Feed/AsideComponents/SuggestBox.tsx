import { For } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import styles from './SuggestBox.module.scss'

export interface IdeaVariant {
  title: string
  icon: string
  color?: string
}

export interface SuggestBoxProps {
  title?: string
  links?: IdeaVariant[]
  collapsible?: boolean
}

const defaultLinks: IdeaVariant[] = [
  {
    title: 'Know how to make community better',
    icon: 'circule',
    color: '#3b82f6'
  },
  {
    title: 'Something to discuss or suggest',
    icon: 'comment',
    color: '#8b5cf6'
  },
  {
    title: 'Want to suggest a topic to write about',
    icon: 'theatre',
    color: '#ef4444'
  },
  {
    title: 'Want to collaborate with an open editorial team',
    icon: 'givelove',
    color: '#059669'
  }
]

export const SuggestBox = (props: SuggestBoxProps) => {
  const { t } = useLocalize()
  const { showModal } = useUI()

  const links = () => props.links || defaultLinks

  const handleFeedbackClick = () => {
    showModal('feedback')
  }

  return (
    <AsideSection
      title={t(props.title || 'Have an idea?')}
      collapsible={props.collapsible}
      class={styles.socialSection}
    >
      <div class={styles.socialContent}>
        <div class={styles.linksList}>
          <For each={links()}>
            {(link) => (
              <>
                <span class={styles.linkTitle}>{t(link.title)}</span>
                <Icon name={link.icon} class={styles.socialIcon} />
              </>
            )}
          </For>
        </div>

        <div class={styles.contactAction}>
          <Button variant="primary" size="M" value={t('Write to us')} onClick={handleFeedbackClick} />
        </div>
      </div>
    </AsideSection>
  )
}
