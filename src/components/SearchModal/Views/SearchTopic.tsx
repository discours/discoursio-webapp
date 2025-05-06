import { For, Show } from 'solid-js'
import { TopicBadge } from '~/components/Topic/TopicBadge/TopicBadge'
import type { Topic } from '~/graphql/schema/core.gen'
import styles from '../Styles/SearchModal.module.scss'

interface SearchTopicsProps {
  searchValue: string
  isLoading: boolean
  hasMore: boolean
  setSentinelEl: (el: HTMLDivElement) => void
  sentinelStyle: Record<string, string>
  topicsList: Topic[]
}

export const SearchTopics = (props: SearchTopicsProps) => {
  return (
    <>
      <Show when={props.topicsList.length > 0}>
        <div class={styles.searchResults}>
          <For each={props.topicsList}>
            {(topic) => (
              <TopicBadge topic={topic} showStat={true} />
            )}
          </For>
        </div>
        
        {/* Sentinel element for infinite scrolling */}
        <div ref={props.setSentinelEl} style={props.sentinelStyle}></div>
      </Show>
    </>
  )
}