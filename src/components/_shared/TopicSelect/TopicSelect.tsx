import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/schema/core.gen'
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

  // При монтировании или изменении props.topics обновляем доступные темы
  createEffect(() => {
    if (props.topics && props.topics.length > 0) {
      setAvailableTopics(props.topics)
    }
  })

  // Если получили пустой список тем, попробуем загрузить из контекста
  createEffect(async () => {
    if ((!props.topics || props.topics.length === 0) && topicsContext) {
      try {
        console.log('[TopicSelect] Requesting topics from context')
        const loadedTopics = await topicsContext.loadTopics()
        if (loadedTopics && loadedTopics.length > 0) {
          console.log('[TopicSelect] Loaded topics from context:', loadedTopics.length)
          setAvailableTopics(loadedTopics)
        }
      } catch (error) {
        console.error('[TopicSelect] Error loading topics:', error)
      }
    }
  })

  const handleChange = (topic: Topic) => {
    const isSelected = props.selectedTopics.some((selectedTopic) => selectedTopic.slug === topic.slug)
    let newSelectedTopics: Topic[]

    if (isSelected) {
      newSelectedTopics = props.selectedTopics.filter((selectedTopic) => selectedTopic.slug !== topic.slug)
    } else {
      newSelectedTopics = [...props.selectedTopics, topic]
    }

    props.onChange(newSelectedTopics)
  }

  const handleMainTopicChange = (topic: Topic) => {
    props.onMainTopicChange(topic)
    setIsOpen(false)
  }

  const handleSearch = (event: InputEvent) => {
    setSearchTerm((event.currentTarget as HTMLInputElement).value)
  }

  const filteredTopics = () => {
    const search = searchTerm().toLowerCase().trim()
    if (!search) return availableTopics()

    return availableTopics().filter((topic: Topic) => {
      if (!topic?.title) return false
      return topic.title.toLowerCase().includes(search)
    })
  }

  return (
    <div class="TopicSelect">
      <div class={styles.selectedTopics}>
        <For each={props.selectedTopics}>
          {(topic) => (
            <div
              class={clsx(styles.selectedTopic, {
                [styles.mainTopic]: props.mainTopic?.slug === topic.slug
              })}
              onClick={() => handleMainTopicChange(topic)}
            >
              {topic.title}
            </div>
          )}
        </For>
      </div>
      <div class={styles.selectWrapper} onClick={() => setIsOpen(true)}>
        <input
          type="text"
          placeholder={t('Topics')}
          class={styles.searchInput}
          value={searchTerm()}
          onInput={handleSearch}
        />
        <Show when={isOpen()}>
          <div class={styles.options}>
            <Show
              when={filteredTopics().length > 0}
              fallback={<div class={styles.emptyState}>{t('No topics found')}</div>}
            >
              <For each={filteredTopics()}>
                {(topic) => (
                  <div
                    class={clsx(styles.option, {
                      [styles.disabled]: props.selectedTopics.some(
                        (selectedTopic) => selectedTopic.slug === topic.slug
                      )
                    })}
                    onClick={() => handleChange(topic)}
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
