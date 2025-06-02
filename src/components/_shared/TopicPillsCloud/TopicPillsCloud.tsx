import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import toast from 'solid-toast'
import { debounce } from 'throttle-debounce'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/schema/core.gen'
import { getRandomItemsFromArray } from '~/utils/random'

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
  const { sortedTopics, topicsByShouts, isLoading: topicsLoading } = useTopics()
  const { currentDraft, updateDraftField } = useDrafts()
  const [searchTerm, setSearchTerm] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [popularTopics, setPopularTopics] = createSignal<Topic[]>([])
  const [additionalTopics, setAdditionalTopics] = createSignal<Topic[]>([])
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set())

  // Мемоизируем выбранные темы из черновика
  const localSelectedTopics = createMemo(() => {
    const draft = currentDraft()
    if (!draft || draft.id !== props.draftId) return []

    return Array.isArray(draft.topics)
      ? draft.topics.filter((t): t is Topic => t !== null && t !== undefined)
      : []
  })

  // Мемоизируем главную тему из черновика
  const mainTopic = createMemo(() => {
    const draft = currentDraft()
    if (!draft || draft.id !== props.draftId) return null

    return draft.mainTopic || null
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
    if (
      topics.length === 0 ||
      (currentMainTopic && topics.some((t) => Number(t.id) === Number(currentMainTopic.id)))
    ) {
      return
    }

    // Если есть темы, но нет главной - устанавливаем первую как главную
    if (
      topics.length > 0 &&
      (!currentMainTopic || !topics.some((t) => Number(t.id) === Number(currentMainTopic.id)))
    ) {
      const newMainTopicId = String(topics[0].id)

      // Проверяем, что значение действительно изменилось
      if (Number(currentMainTopic?.id) !== Number(newMainTopicId)) {
        console.log('[TopicPillsCloud] Устанавливаем первую тему как главную:', newMainTopicId)

        // Мгновенно обновляем UI
        const draft = currentDraft()
        if (draft) {
          draft.mainTopic = topics[0]
        }

        // Отправляем обновление на сервер через дебаунс
        debouncedMainTopicChange(newMainTopicId)
      }
    }
  })

  // Загружаем популярные и дополнительные темы при монтировании
  createEffect(
    on([sortedTopics, topicsByShouts], ([allTopics, shoutTopics]) => {
      if (!allTopics || !Array.isArray(allTopics) || allTopics.length === 0) {
        setIsLoading(topicsLoading())
        return
      }

      // Проверяем структуру shoutTopics
      if (shoutTopics && typeof shoutTopics === 'object' && !Array.isArray(shoutTopics)) {
        // Если это хеш, преобразуем его в массив тем
        const topicsArray = Object.values(shoutTopics)
          .flat()
          .filter((topic): topic is Topic => Boolean(topic && typeof topic === 'object' && 'id' in topic))

        if (topicsArray.length > 0) {
          console.log('[TopicPillsCloud] Использую темы из хеша shoutTopics:', topicsArray.length)
          // Берем 20 самых популярных тем
          const popular = topicsArray.slice(0, 20)
          setPopularTopics(popular)

          // Сохраняем оставшиеся темы для случая, когда все популярные будут выбраны
          const remainingTopics = allTopics.filter((topic) => !popular.some((p) => p.id === topic.id))
          // Берем случайные 30 тем из оставшихся
          const random = getRandomItemsFromArray(remainingTopics, 30)
          setAdditionalTopics(random)
        }
      } else {
        // Иначе используем все доступные темы
        console.log('[TopicPillsCloud] Использую все доступные темы:', allTopics.length)
        // Сортируем по количеству публикаций
        const sortedByPublications = [...allTopics].sort((a, b) => {
          const aShouts = a?.stat?.shouts || 0
          const bShouts = b?.stat?.shouts || 0
          return bShouts - aShouts
        })

        // Берем 20 самых популярных тем
        const popular = sortedByPublications.slice(0, 20)
        setPopularTopics(popular)

        // Остальные сохраняем как дополнительные
        const remaining = sortedByPublications.slice(20)
        // Берем случайные 30 тем из оставшихся
        const random = getRandomItemsFromArray(remaining, 30)
        setAdditionalTopics(random)
      }

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

  const debouncedMainTopicChange = debounce(10, (topicId: string) => {
    try {
      console.log('[TopicPillsCloud] Отправляем обновление main_topic_id на сервер:', topicId)
      updateDraftField(props.draftId, 'main_topic_id', topicId, false)
    } catch (error) {
      console.error('[TopicPillsCloud] Ошибка при обновлении главной темы:', error)
      toast.error(t('Error updating main topic'))
    }
  })

  const handleMainTopicClick = (topic: Topic, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Блокируем действие на уже выбранной главной теме
    if (isMainTopic(topic)) return

    // Мгновенно обновляем UI через контекст
    const draft = currentDraft()
    if (draft) {
      draft.mainTopic = topic
    }

    // Отправляем обновление на сервер через дебаунс
    debouncedMainTopicChange(String(topic.id))
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
    if (isNaN(topicId)) {
      console.error('[TopicPillsCloud] ID темы не является числом:', topic.id)
      return
    }

    // Теперь тема валидна, можно переключать
    const currentSelected = localSelectedTopics()
    const isSelected = currentSelected.some(t => Number(t.id) === topicId)

    let newSelectedTopics: Topic[]
    if (isSelected) {
      newSelectedTopics = currentSelected.filter(t => Number(t.id) !== topicId)
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
      // Если это первая тема, делаем её главной
      console.log('[TopicPillsCloud] Автоматическая установка главной темы:', topicId)
      if (draft) {
        draft.mainTopic = topic
      }
      debouncedMainTopicChange(String(topicId))
    } else if (
      isSelected &&
      mainTopic() &&
      Number(mainTopic()!.id) === topicId &&
      newSelectedTopics.length > 0
    ) {
      // Если удалили главную тему, но есть другие - назначаем первую из оставшихся главной
      const newMainTopicId = Number(newSelectedTopics[0].id)
      console.log('[TopicPillsCloud] Смена главной темы после удаления:', newMainTopicId)
      if (draft) {
        draft.mainTopic = newSelectedTopics[0]
      }
      debouncedMainTopicChange(String(newMainTopicId))
    }
  }

  const handleSearch = (event: InputEvent) => {
    const value = (event.currentTarget as HTMLInputElement).value
    setSearchTerm(value)
  }

  /**
   * Возвращает отфильтрованный список тем для отображения
   * Если все популярные темы выбраны, добавляет случайные темы из дополнительного списка
   */
  const filteredTopics = createMemo(() => {
    const search = searchTerm().toLowerCase().trim()
    const selectedIds = selectedTopicIds()

    // Определяем основной список тем для фильтрации
    let topicsToFilter: Topic[] = []

    if (search) {
      // При поиске используем все доступные темы
      topicsToFilter = sortedTopics()
    } else {
      // В обычном режиме показываем популярные темы
      topicsToFilter = popularTopics()

      // Проверяем, все ли популярные темы уже выбраны
      const allPopularSelected = popularTopics().every((topic) => selectedIds.has(Number(topic.id)))

      // Если все популярные темы выбраны, добавляем случайные темы из дополнительного списка
      if (allPopularSelected && popularTopics().length > 0) {
        console.log('[TopicPillsCloud] Все популярные темы уже выбраны, добавляем дополнительные темы')

        // Добавляем дополнительные темы в список для отображения
        const additional = additionalTopics().filter((topic) => !selectedIds.has(Number(topic.id)))

        if (additional.length > 0) {
          topicsToFilter = additional
        } else {
          // Если и в дополнительном списке не осталось тем, попробуем взять случайные из всех оставшихся
          console.log('[TopicPillsCloud] В дополнительном списке не осталось тем, ищем случайные из всех')

          const allAvailableTopics = sortedTopics().filter((topic) => !selectedIds.has(Number(topic.id)))

          if (allAvailableTopics.length > 0) {
            // Берем случайные 20 тем из всех доступных
            const randomTopics = getRandomItemsFromArray(allAvailableTopics, 20)
            topicsToFilter = randomTopics
          }
        }
      }
    }

    // Проверяем, что у нас есть темы для отображения
    if (!Array.isArray(topicsToFilter) || topicsToFilter.length === 0) {
      return []
    }

    // Фильтруем темы, исключая уже выбранные
    return topicsToFilter.filter((topic: Topic) => {
      // Пропускаем темы без названия
      if (!topic?.title) return false

      // Проверяем, что тема ещё не выбрана
      if (selectedIds.has(Number(topic.id))) return false

      // Если есть поисковый запрос, проверяем соответствие
      return !search || topic.title.toLowerCase().includes(search)
    })
  })

  const isMainTopic = (topic: Topic) => {
    const currentMainTopic = mainTopic()
    if (!currentMainTopic || !topic) return false

    // Явно приводим к числовому типу для корректного сравнения
    const mainTopicId = Number(currentMainTopic.id)
    const topicId = Number(topic.id)

    return mainTopicId === topicId
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
                fallback={
                  <div style="color: #888; font-size: 12px; padding: 5px;">{t('No topics selected')}</div>
                }
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
