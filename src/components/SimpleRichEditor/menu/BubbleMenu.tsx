import { Component } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { For } from 'solid-js'
import { MenuProps } from '../lib/types'
import clsx from 'clsx'

import styles from './BubbleMenu.module.scss'

export const BubbleMenu: Component<MenuProps & {
  position: { top: number; left: number }
  isVisible: boolean
  onClose: () => void
}> = (props) => {
  return (
    <div 
      class={clsx(styles.bubbleMenu, props.isVisible && styles.visible)}
      style={{ top: `${props.position.top}px`, left: `${props.position.left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <For each={props.commands}>
        {(cmd) => {
          const config = props.config[cmd]
          const act: Record<string, boolean> = {
            bold: props.state.format.text.bold,
            italic: props.state.format.text.italic,
            link: props.state.format.text.link,
            blockquote: props.state.format.block.blockquote as boolean,
            image: props.state.format.media.image as boolean,
            h1: props.state.format.block.h1 as boolean,
            h2: props.state.format.block.h2 as boolean,
            h3: props.state.format.block.h3 as boolean,
            orderedList: props.state.format.block.orderedList as boolean,
            unorderedList: props.state.format.block.unorderedList as boolean,
            incut: props.state.format.block.incut as boolean,
            underline: props.state.format.text.underline as boolean,
            strikethrough: props.state.format.text.strikethrough as boolean,
          }
          return (
            <button
              class={styles.button}
              onClick={() => props.actions[cmd]()}
              data-active={act[cmd]}
              title={`${config.title}${config.shortcut ? ` (${config.shortcut})` : ''}`}
            >
              <Icon name={config.icon} />
            </button>
          )
        }}
      </For>
    </div>
  )
} 