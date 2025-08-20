import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js'
import toast from 'solid-toast'
import { debounce } from 'throttle-debounce'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/generated/graphql'

import styles from './TopicPillsCloud.module.scss'

/**
 * Компонент отображения тем в виде кликабельного облака тегов
 *
 * @param props.draftId - ID черновика для прямого обновления через контекст
 * @returns JSX компонент облака тегов
 *
 * @example
 * ```tsx
 * <TopicPillsCloud
 *   draftId={draftId} // ID черновика для прямого обновления через контекст
 * />
 * ```
 */
type TopicPillsCloudProps = {
  draftId: number // ID черновика для прямого обновления через контекст
}

export const TopicPillsCloud = (props: TopicPillsCloudProps) => {
  const { t } = useLocalize()
  const { sortedTopics, isLoading: topicsLoading } = useTopics()
  const { currentDraft, updateDraftField } = useDrafts()
  const [searchTerm, setSearchTerm] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [availableTopics, setAvailableTopics] = createSignal<Topic[]>([])
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set())

  // Мемоизируем выбранные темы из черновика
  const localSelectedTopics = createMemo(() => {
    const draft = currentDraft()
    if (!draft || draft.id !== props.draftId) return []

    return Array.isArray(draft.topics) ? draft.topics.filter((t): t is Topic => t !== null && t !== undefined) : []
  })

  // Мемоизируем главную тему из черновика
  const mainTopic = createMemo(() => {
    const draft = currentDraft()
    if (!draft || draft.id !== props.draftId) return null

    // Используем первую тему в массиве как главную
    if (Array.isArray(draft.topics) && draft.topics.length > 0) {
      return draft.topics[0] || null
    }
    return null
  })

  // Обновляем selectedIds при изменении тем в черновике
  createEffect(() => {
    const topics = localSelectedTopics()
    const topicIds = topics.map((topic: Topic) => Number(topic.id))
    setSelectedIds(new Set(topicIds))
  })

  const selectedTopicIds = createMemo(() => selectedIds())

  // При инициализации компонента проверяем наличие главной темы
  createEffect(() => {
    const topics = localSelectedTopics()
    const currentMainTopic = mainTopic()

    // Если нет тем или уже есть главная тема, которая входит в список - ничего не делаем
    if (topics.length === 0 || (currentMainTopic && topics.some((t) => Number(t.id) === Number(currentMainTopic.id)))) {
      return
    }

    // Если есть темы, но нет главной - устанавливаем первую как главную
    if (topics.length > 0 && (!currentMainTopic || !topics.some((t) => Number(t.id) === Number(currentMainTopic.id)))) {
      console.log('[TopicPillsCloud] Устанавливаем первую тему как главную:', topics[0].id)

      // Отправляем обновление на сервер через дебаунс
      debouncedTopicChange(topics)
    }
  })

  // Загружаем темы при монтировании
  createEffect(
    on([sortedTopics], ([allTopics]) => {
      if (!allTopics || !Array.isArray(allTopics) || allTopics.length === 0) {
        setIsLoading(topicsLoading())
        return
      }

      // Используем все доступные темы (как в AllTopicsView на вкладке title)
      console.log('[TopicPillsCloud] Загружено тем:', allTopics.length)
      setAvailableTopics(allTopics)
      setIsLoading(false)
    })
  )

  // Создаем дебаунсированные обработчики
  const debouncedTopicChange = debounce(10, (topics: Topic[]) => {
    try {
      const topicIds = topics.map((t) => Number(t.id))
      console.log('[TopicPillsCloud] Отправляем обновление topic_ids на сервер:', topicIds)
      updateDraftField(props.draftId, 'topic_ids', topicIds, false)
    } catch (error) {
      console.error('[TopicPillsCloud] Ошибка при обновлении тем:', error)
      toast.error(t('Error updating topics'))
    }
  })

  const handleMainTopicClick = (topic: Topic, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Блокируем действие на уже выбранной главной теме
    if (isMainTopic(topic)) return

    // Получаем текущие темы и перемещаем выбранную тему на первое место
    const draft = currentDraft()
    if (!draft) return

    const topics = localSelectedTopics()
    const topicIndex = topics.findIndex((t) => Number(t.id) === Number(topic.id))

    if (topicIndex === -1) return // Тема не найдена в списке

    // Создаем новый массив с выбранной темой на первом месте
    const newTopics = [topics[topicIndex], ...topics.slice(0, topicIndex), ...topics.slice(topicIndex + 1)]

    // Мгновенно обновляем UI
    if (draft) {
      draft.topics = newTopics
    }

    // Отправляем обновление на сервер через debouncedTopicChange
    debouncedTopicChange(newTopics)
    toast.success(t('Main topic changed'), { duration: 1500 })
  }

  const handleToggleTopic = (topic: Topic, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Проверяем валидность темы
    if (!topic) {
      console.error('[TopicPillsCloud] Попытка переключить пустую тему')
      return
    }

    if (!topic.id && topic.id !== 0) {
      console.error('[TopicPillsCloud] Попытка переключить тему без ID:', topic)
      return
    }

    // Преобразуем ID в число для корректного сравнения
    const topicId = Number(topic.id)
    if (Number.isNaN(topicId)) {
      console.error('[TopicPillsCloud] ID темы не является числом:', topic.id)
      return
    }

    // Теперь тема валидна, можно переключать
    const currentSelected = localSelectedTopics()
    const isSelected = currentSelected.some((t) => Number(t.id) === topicId)

    let newSelectedTopics: Topic[]
    if (isSelected) {
      newSelectedTopics = currentSelected.filter((t) => Number(t.id) !== topicId)
    } else {
      newSelectedTopics = [...currentSelected, topic]
    }

    // Мгновенно обновляем UI через контекст черновика
    const draft = currentDraft()
    if (draft) {
      draft.topics = newSelectedTopics
    }

    // Обновляем локальное состояние для selectedIds
    setSelectedIds(new Set(newSelectedTopics.map((t) => Number(t.id))))

    // Отправляем обновление на сервер через дебаунс
    debouncedTopicChange(newSelectedTopics)

    // Проверка на необходимость обновления главной темы
    if (newSelectedTopics.length === 1 && !isSelected) {
      // Если это первая тема, она автоматически становится главной
      console.log('[TopicPillsCloud] Добавлена первая тема:', topicId)
    } else if (isSelected && isMainTopic(topic) && newSelectedTopics.length > 0) {
      // Если удаляем главную тему, первый элемент из оставшихся становится главным
      console.log('[TopicPillsCloud] Выбираем новую главную тему после удаления текущей')
    }
  }

  const handleSearch = (event: InputEvent) => {
    const value = (event.currentTarget as HTMLInputElement).value
    setSearchTerm(value)
  }

  /**
   * Возвращает отфильтрованный список тем для отображения
   * Фильтрует темы по поисковому запросу и исключает уже выбранные
   */
  const filteredTopics = createMemo(() => {
    const search = searchTerm().toLowerCase().trim()
    const selectedIds = selectedTopicIds()

    // Используем все доступные темы
    const allTopics = availableTopics()

    // Проверяем, что у нас есть темы для отображения
    if (!Array.isArray(allTopics) || allTopics.length === 0) {
      return []
    }

    // Фильтруем темы по поисковому запросу и исключаем уже выбранные
    return allTopics.filter((topic: Topic) => {
      // Пропускаем темы без названия
      if (!topic?.title) return false

      // Проверяем, что тема ещё не выбрана
      if (selectedIds.has(Number(topic.id))) return false

      // Если есть поисковый запрос, проверяем соответствие
      return !search || topic.title.toLowerCase().includes(search)
    })
  })

  const isMainTopic = (topic: Topic) => {
    // Проверяем, является ли тема первой в массиве тем
    const topics = localSelectedTopics()
    return topics.length > 0 && Number(topics[0]?.id) === Number(topic.id)
  }

  return (
    <div class={styles.TopicPillsCloud}>
      {/* Единый блок для поля ввода и выбранных тем */}
      <div class={styles.searchAndTopicsContainer}>
        <div class={styles.searchInputWithTagsContainer}>
          {/* Поле ввода с таблетками внутри */}
          <div class={styles.inputContainer}>
            <input
              type="text"
              placeholder={t('Search topics')}
              class={styles.searchInput}
              value={searchTerm()}
              onInput={handleSearch}
            />

            {/* Выбранные темы внутри поля ввода справа */}
            <div class={styles.selectedTopicsInline}>
              <Show
                when={localSelectedTopics().length > 0}
                fallback={<div style="color: #888; font-size: 12px; padding: 5px;">{t('No topics selected')}</div>}
              >
                <For each={localSelectedTopics()}>
                  {(topic) => {
                    const isMain = isMainTopic(topic)
                    return (
                      <div
                        class={clsx(styles.selectedTopic, {
                          [styles.mainTopic]: isMain
                        })}
                        onClick={(e) => handleMainTopicClick(topic, e)}
                        title={isMain ? t('Main topic') : t('Click to set as main topic')}
                      >
                        <span class={styles.topicTitle}>{topic.title || `Тема ${topic.id}`}</span>
                        <span
                          class={styles.removeTopicBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleTopic(topic, e)
                          }}
                          title={t('Remove topic')}
                        >
                          ×
                        </span>
                      </div>
                    )
                  }}
                </For>
              </Show>
            </div>
          </div>
        </div>
        <hr />
        <div class={styles.topicCloud}>
          <Show
            when={!isLoading() && filteredTopics().length > 0}
            fallback={
              <div class={styles.emptyState}>
                {isLoading()
                  ? t('Loading topics...')
                  : searchTerm()
                    ? `${t('No topics found matching:')} ${searchTerm()}`
                    : t('No more topics available.')}
              </div>
            }
          >
            <For each={filteredTopics()}>
              {(topic) => {
                const isSelected = selectedTopicIds().has(Number(topic.id))
                return (
                  <div
                    class={clsx(styles.topicPill, {
                      [styles.disabled]: isSelected
                    })}
                    onClick={(e) => handleToggleTopic(topic, e)}
                    title={t('Add topic')}
                  >
                    {topic.title}
                  </div>
                )
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
