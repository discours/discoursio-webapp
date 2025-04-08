import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { DraftInput, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'

import { Topic } from '~/graphql/schema/core.gen'
import styles from '../HeaderNav/Header.module.scss'
import { EMPTY_TOPIC } from '../Views/EditView'

type IconedButtonProps = {
  value: string
  icon: string
  action: () => void
}

const MD_WIDTH_BREAKPOINT = 992

export const PublishButton = () => {
  const { currentDraft, updateDraft } = useDrafts()
  const [width, setWidth] = createSignal(0)
  const { t } = useLocalize()
  const navigate = useNavigate()

  createEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  // Обработчик для публикации черновика
  const handlePublishClick = () => {
    const draft = currentDraft()
    if (!draft || !draft.id) return

    // Перед публикацией синхронизируем все локальные изменения
    // TODO: CALL syncOfflineChanges(draft) FROM AWARENESS

    // Явно обновляем черновик на сервере со всеми последними изменениями
    // Это гарантирует, что title и lead будут доступны на странице настроек
    const updatedDraft: DraftInput = {
      id: draft.id,
      layout: draft.layout || 'article',
      title: draft.title || '',
      subtitle: draft.subtitle || '',
      lead: draft.lead || '',
      slug: draft.slug || '',
      body: draft.body || '',
      cover: draft.cover || '',
      // Преобразуем возможно null/undefined темы в безопасный массив тем
      topics: draft.topics ? draft.topics.filter((topic): topic is Topic => Boolean(topic)) : [],
      // Используем пустой mainTopic или первую тему, если доступна
      mainTopic: draft.topics?.[0] || EMPTY_TOPIC
    }

    // Принудительно сохраняем черновик перед публикацией
    updateDraft(updatedDraft)
      .then(() => {
        // После успешного сохранения переходим к настройкам публикации
        navigate(`/edit/${draft.id}/settings`)
      })
      .catch((error: Error) => {
        console.error('[EditView] Error updating draft before publish:', error)
        // Даже в случае ошибки пробуем перейти к публикации
        navigate(`/edit/${draft.id}/settings`)
      })
  }

  const IconedButton = (props: IconedButtonProps) => {
    return (
      <Show
        when={width() < MD_WIDTH_BREAKPOINT}
        fallback={
          <Button
            value={<span class={styles.textLabel}>{props.value}</span>}
            variant={'light'}
            onClick={props.action}
            class={styles.editorControl}
          />
        }
      >
        <Popover content={props.value}>
          {(ref) => (
            <Button
              ref={ref}
              variant={'light'}
              onClick={props.action}
              value={<Icon name={props.icon} class={styles.icon} />}
              class={styles.editorControl}
            />
          )}
        </Popover>
      </Show>
    )
  }

  return (
    <div class={clsx(styles.userControlItem, styles.userControlItemVerbose)}>
      <IconedButton value={t('Publish')} icon="publish" action={handlePublishClick} />
    </div>
  )
}
