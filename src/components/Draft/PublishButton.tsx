import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Author, DraftInput, Maybe, Topic } from '~/graphql/generated/graphql'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'
import styles from '../HeaderNav/Header.module.scss'

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
    if (!draft || !draft.id) {
      console.warn('[PublishButton] No current draft or draft ID is missing')
      return
    }

    console.log('[PublishButton] Инициирована публикация черновика:', {
      draftId: draft.id,
      title: draft.title,
      hasBody: !!draft.body,
      hasLead: !!draft.lead,
      topicsCount: draft.topics?.length || 0
    })

    // Подробное логирование состояния тем
    if (!draft.topics || !Array.isArray(draft.topics)) {
      console.warn(
        '[PublishButton] Отсутствуют темы (topics) в черновике или они не являются массивом:',
        draft.topics
      )
    } else if (draft.topics.length === 0) {
      console.warn(
        '[PublishButton] В черновике отсутствуют темы, что может привести к ошибке при публикации'
      )
    } else {
      console.log(
        '[PublishButton] Темы черновика:',
        draft.topics.map((topic) =>
          topic ? { id: topic.id, title: topic.title, slug: topic.slug } : 'null'
        )
      )
    }

    // Проверка заголовка
    if (!draft.title || draft.title.trim() === '') {
      console.warn(
        '[PublishButton] Черновик не имеет заголовка, что может привести к проблемам при публикации'
      )
    } else {
      console.log('[PublishButton] Заголовок черновика:', draft.title)
    }

    // Проверка body и lead
    console.log('[PublishButton] Содержимое черновика:', {
      bodyLength: draft.body?.length || 0,
      leadLength: draft.lead?.length || 0
    })
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
      main_topic_id: draft.topics?.[0]?.id || 0,
      author_ids: (draft.authors || []).map?.((author?: Maybe<Author>) => author?.id || 0) || [],
      topic_ids:
        (draft.topics || [])
          .map?.((topic?: Maybe<Topic>) => {
            if (!topic || !topic.id) {
              console.warn('[PublishButton] Найдена некорректная тема в массиве:', topic)
              return 0
            }
            return topic.id
          })
          .filter((id) => id > 0) || []
    }

    // Проверяем, что у нас есть хотя бы одна тема
    if (!updatedDraft.topic_ids || !updatedDraft.topic_ids.length) {
      console.warn('[PublishButton] После фильтрации не найдено валидных тем, что может привести к ошибке')
      // Пытаемся найти main_topic_id в качестве резервного варианта
      if (updatedDraft.main_topic_id && updatedDraft.main_topic_id > 0) {
        console.log('[PublishButton] Используем main_topic_id в качестве резервного варианта для тем')
        updatedDraft.topic_ids = [updatedDraft.main_topic_id]
      }
    }

    console.log('[PublishButton] Отправка черновика на сервер перед переходом к публикации:', {
      draftId: updatedDraft.id,
      title: updatedDraft.title,
      topicIds: updatedDraft.topic_ids,
      mainTopicId: updatedDraft.main_topic_id
    })

    // Принудительно сохраняем черновик перед публикацией
    updateDraft(updatedDraft)
      .then((result) => {
        if (result?.data?.update_draft?.error) {
          console.error(
            '[PublishButton] Ошибка обновления черновика на сервере:',
            result.data.update_draft.error
          )

          // Создаем более информативное сообщение для пользователя
          let errorMessage = `Ошибка сохранения: ${result.data.update_draft.error}`

          // Пытаемся определить тип ошибки и дать более конкретные рекомендации
          if (result.data.update_draft.error.includes('topic')) {
            errorMessage += '. Убедитесь, что выбрана хотя бы одна тема.'
          }
          if (result.error) {
            console.warn(
              `[PublishButton] Не удалось показать уведомление об ошибке: ${result.error} ${errorMessage}`
            )
          }

          // Даже в случае ошибки пробуем перейти к публикации
          navigate(`/edit/${draft.id}/settings`)
          return
        }

        console.log('[PublishButton] Черновик успешно сохранен на сервере:', {
          draftId: draft.id,
          hasError: !!result?.data?.update_draft?.error,
          updatedDraft: result?.data?.update_draft?.draft ? 'получен' : 'отсутствует'
        })

        // После успешного сохранения переходим к настройкам публикации
        navigate(`/edit/${draft.id}/settings`)
      })
      .catch((error: Error) => {
        console.error('[PublishButton] Ошибка обновления черновика перед публикацией:', error)

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
