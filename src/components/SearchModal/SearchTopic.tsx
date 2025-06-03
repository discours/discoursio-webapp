import { For, Show } from 'solid-js'
import { TopicBadge } from '~/components/Topic/TopicBadge/TopicBadge'
import { useUI } from '~/context/ui'
import type { Topic } from '~/graphql/schema/core.gen'

import styles from './SearchModal.module.scss'

interface SearchTopicsProps {
  searchValue: string
  isLoading: boolean
  hasMore: boolean
  setSentinelEl: (el: HTMLDivElement) => void
  sentinelStyle: Record<string, string>
  topicsList: Topic[]
}

export const SearchTopics = (props: SearchTopicsProps) => {
  const { hideModal } = useUI()

  const handleTopicClick = () => {
    hideModal()
  }

  return (
    <>
      <Show when={props.topicsList.length > 0}>
        <div class={styles.searchResults} onClick={handleTopicClick}>
          <For each={props.topicsList}>{(topic) => <TopicBadge topic={topic} showStat={true} />}</For>
        </div>

        {/* Sentinel element for infinite scrolling */}
        <div ref={props.setSentinelEl} style={props.sentinelStyle} />
      </Show>
    </>
  )
}
