import { A } from '@solidjs/router'
import { For } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useLocalize } from '~/context/localize'
import styles from './KnowledgeBase.module.scss'

export interface KnowledgeBaseItem {
  title: string
  href: string
  icon?: string
  isExternal?: boolean
}

export interface KnowledgeBaseProps {
  title?: string
  items?: KnowledgeBaseItem[]
  collapsible?: boolean
}

const defaultItems: KnowledgeBaseItem[] = [
  {
    title: 'How Discours works',
    href: '/guide',
    icon: 'editor-tooltip'
  },
  {
    title: 'How to write a good article',
    href: '/how-to-write-a-good-article',
    icon: 'edit'
  },
  {
    title: 'Rules of constructive discussions',
    href: '/rules',
    icon: 'shield'
  },
  {
    title: 'Community principles',
    href: '/principles',
    icon: 'like'
  },
  {
    title: 'Privacy Policy',
    href: '/privacy',
    icon: 'settings'
  }
]

export const KnowledgeBase = (props: KnowledgeBaseProps) => {
  const { t } = useLocalize()

  const items = () => props.items || defaultItems

  return (
    <AsideSection
      title={t(props.title || 'Knowledge base')}
      collapsible={props.collapsible}
      class={styles.knowledgeSection}
    >
      <div class={styles.knowledgeList}>
        <For each={items()}>
          {(item) => (
            <div class={styles.knowledgeItem}>
              <A
                href={item.href}
                class={styles.knowledgeLink}
                target={item.isExternal ? '_blank' : undefined}
                rel={item.isExternal ? 'noopener noreferrer' : undefined}
              >
                {item.icon && <Icon name={item.icon} class={styles.knowledgeIcon} />}
                <span class={styles.knowledgeTitle}>{t(item.title)}</span>
                {item.isExternal && <Icon name="external-link" class={styles.externalIcon} />}
              </A>
            </div>
          )}
        </For>
      </div>
    </AsideSection>
  )
}
