import { A } from '@solidjs/router'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import styles from './JoinCommunity.module.scss'

export interface JoinCommunityProps {
  title?: string
  description?: string
  collapsible?: boolean
}

export const JoinCommunity = (props: JoinCommunityProps) => {
  const { t } = useLocalize()
  const { session } = useSession()

  // Не показываем если пользователь уже авторизован
  if (session()?.token) return null

  return (
    <AsideSection
      collapsible={props.collapsible} 
      buttonVariant="primary"
      buttonSize="M"
      icon="users"
      class={styles.joinSection}
    >
      <div class={styles.joinCard}>
        {/* Фоновое изображение с людьми */}
        <div class={styles.joinBackground}>
          <div class={styles.peopleIllustration}>
            {/* CSS изображение группы людей */}
            <div class={styles.person1}></div>
            <div class={styles.person2}></div>
            <div class={styles.person3}></div>
            <div class={styles.person4}></div>
            <div class={styles.person5}></div>
          </div>
        </div>

        <div class={styles.joinContent}>
          <p class={styles.joinDescription}>
            {props.description ||
              t(
                'Connect and discuss which articles will come out in the journal, edit, perform as an expert or become an author'
              )}
          </p>

          <A href="/auth/signup" class={styles.joinButton}>
            {t('Sign up')}
          </A>
        </div>
      </div>
    </AsideSection>
  )
}
