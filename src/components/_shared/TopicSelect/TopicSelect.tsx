import { clsx } from 'clsx'
import { createEffect, createSignal, For, onMount, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/generated/graphql'
import styles from './TopicSelect.module.scss'

type TopicSelectProps = {
  topics: Topic[]
  selectedTopics: Topic[]
  onChange: (selectedTopics: Topic[]) => void
  mainTopic?: Topic
  onMainTopicChange: (mainTopic: Topic) => void
}

export const TopicSelect = (props: TopicSelectProps) => {
  const { t } = useLocalize()
  const topicsContext = useTopics()
  const [isOpen, setIsOpen] = createSignal(false)
  const [searchTerm, setSearchTerm] = createSignal('')
  const [availableTopics, setAvailableTopics] = createSignal<Topic[]>(props.topics || [])
  const [isLoading, setIsLoading] = createSignal(false)

  // При монтировании или изменении props.topics обновляем доступные темы
  createEffect(() => {
    if (props.topics && props.topics.length > 0) {
      setAvailableTopics(props.topics)
    }
  })

  // Закрываем список при клике вне компонента
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.TopicSelect') && isOpen()) {
      setIsOpen(false)
    }
  }
  createEffect(() => {
    // Загружаем темы из контекста, если они не предоставлены через props
    if ((!props.topics || props.topics.length === 0) && topicsContext) {
      void loadTopicsFromContext()
    }
  })

  // Добавляем обработчик клика при монтировании
  onMount(() => {
    document.addEventListener('click', handleClickOutside)

    // Удаляем обработчик при размонтировании
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  })

  const loadTopicsFromContext = async () => {
    try {
      setIsLoading(true)
      console.log('[TopicSelect] Requesting topics from context')
      const loadedTopics = await topicsContext.loadTopics()
      if (loadedTopics && loadedTopics.length > 0) {
        console.log('[TopicSelect] Loaded topics from context:', loadedTopics.length)
        setAvailableTopics(loadedTopics)
      } else {
        console.warn('[TopicSelect] No topics loaded from context')
        // Если данные из контекста доступны, но пусты, используем sortedTopics
        setAvailableTopics(topicsContext.sortedTopics())
      }
    } catch (error) {
      console.error('[TopicSelect] Error loading topics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDropdown = (e: MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen())
    if (!isOpen() && searchTerm()) {
      setSearchTerm('')
    }
  }

  const handleChange = (topic: Topic, e: MouseEvent) => {
    e.stopPropagation()

    const isSelected = props.selectedTopics.some((selectedTopic) => selectedTopic.slug === topic.slug)
    let newSelectedTopics: Topic[]

    if (isSelected) {
      newSelectedTopics = props.selectedTopics.filter((selectedTopic) => selectedTopic.slug !== topic.slug)
    } else {
      newSelectedTopics = [...props.selectedTopics, topic]
    }

    props.onChange(newSelectedTopics)

    // Если это первая тема, делаем её главной
    if (newSelectedTopics.length === 1 && !isSelected) {
      props.onMainTopicChange(topic)
    }

    // Очищаем поле поиска после выбора темы
    setSearchTerm('')
    // Оставляем список открытым после выбора
    setIsOpen(true)
  }

  const handleMainTopicChange = (topic: Topic, e: MouseEvent) => {
    e.stopPropagation()
    props.onMainTopicChange(topic)
  }

  const handleSearch = (event: InputEvent) => {
    const value = (event.currentTarget as HTMLInputElement).value
    setSearchTerm(value)
    if (value && !isOpen()) {
      setIsOpen(true)
    }
  }

  const filteredTopics = () => {
    const search = searchTerm().toLowerCase().trim()
    if (!search) return availableTopics()

    return availableTopics().filter((topic: Topic) => {
      if (!topic?.title) return false
      return topic.title.toLowerCase().includes(search)
    })
  }

  const isTopicSelected = (topic: Topic) => {
    return props.selectedTopics.some((selectedTopic) => selectedTopic.slug === topic.slug)
  }

  return (
    <div class="TopicSelect">
      <Show when={props.selectedTopics.length > 0}>
        <div class={styles.selectedTopics}>
          <For each={props.selectedTopics}>
            {(topic) => (
              <div
                class={clsx(styles.selectedTopic, {
                  [styles.mainTopic]: props.mainTopic?.slug === topic.slug
                })}
                onClick={(e) => handleMainTopicChange(topic, e)}
              >
                {topic.title}
                <span
                  class={styles.removeTopicBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChange(topic, e)
                  }}
                >
                  ×
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
      <div class={styles.selectWrapper} onClick={toggleDropdown}>
        <input
          type="text"
          placeholder={t('Search topics')}
          class={styles.searchInput}
          value={searchTerm()}
          onInput={handleSearch}
          onClick={(e) => e.stopPropagation()} // Не закрывать список при клике в поле ввода
        />
        <Show when={isOpen()}>
          <div class={styles.options}>
            <Show
              when={!isLoading() && filteredTopics().length > 0}
              fallback={
                <div class={styles.emptyState}>{isLoading() ? t('Loading topics...') : t('No topics found')}</div>
              }
            >
              <For each={filteredTopics()}>
                {(topic) => (
                  <div
                    class={clsx(styles.option, {
                      [styles.selected]: isTopicSelected(topic)
                    })}
                    onClick={(e) => handleChange(topic, e)}
                  >
                    {topic.title}
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}
