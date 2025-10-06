/**
 * @module format/config
 * @description Конфигурация форматирования для команд редактора
 */

import { CommandType } from '../lib/types'

/**
 * Конфигурация команд форматирования
 */
export const FORMAT_CONFIG: Record<CommandType, { tag: string; attributes?: Record<string, string> }> = {
  bold: { tag: 'strong', attributes: {} },
  italic: { tag: 'em', attributes: {} },
  link: {
    tag: 'a',
    attributes: { href: '#' }
  },
  unlink: {
    tag: 'a', // Используется для поиска ссылок для удаления
    attributes: {}
  },
  blockquote: { tag: 'blockquote', attributes: {} },
  h1: { tag: 'h1', attributes: {} },
  h2: { tag: 'h2', attributes: {} },
  h3: { tag: 'h3', attributes: {} },
  highlight: { tag: 'mark', attributes: {} },
  bulletList: { tag: 'ul', attributes: {} },
  orderedList: { tag: 'ol', attributes: {} },
  punchline: {
    tag: 'div',
    attributes: { class: 'punchline' }
  },
  hr: { tag: 'hr' },
  separator: { tag: 'hr' },
  image: { tag: 'img', attributes: {} },
  video: { tag: 'div', attributes: { 'data-type': 'video' } },
  audio: { tag: 'audio', attributes: { controls: 'true' } },
  media: { tag: 'span', attributes: {} }, // UI команда, не используется
  upload: { tag: 'span', attributes: {} }, // UI команда, не используется
  embed: { tag: 'embed', attributes: {} }, // Кастомный тег для встраивания
  p: { tag: 'p', attributes: {} },
  incut: { tag: 'div', attributes: { class: 'incut', 'data-align': 'left' } },
  'align-left': { tag: 'div', attributes: { 'data-align': 'left' } },
  'align-center': { tag: 'div', attributes: { 'data-align': 'center' } },
  'align-right': { tag: 'div', attributes: { 'data-align': 'right' } },
  'bg-gray': { tag: 'div', attributes: { 'data-bg': 'gray' } },
  'bg-white': { tag: 'div', attributes: { 'data-bg': 'white' } },
  'bg-black': { tag: 'div', attributes: { 'data-bg': 'black' } },
  'bg-yellow': { tag: 'div', attributes: { 'data-bg': 'yellow' } },
  'bg-red': { tag: 'div', attributes: { 'data-bg': 'red' } },
  'bg-green': { tag: 'div', attributes: { 'data-bg': 'green' } },
  'bg-color': { tag: 'div', attributes: { 'data-bg': '' } },
  tooltip: { tag: 'tooltip', attributes: {} }
} as const

/**
 * Возвращает HTML тег для команды форматирования (из FORMAT_CONFIG)
 */
export const getTagForCommand = (cmd: CommandType): string => {
  const config = FORMAT_CONFIG[cmd as keyof typeof FORMAT_CONFIG]
  return config?.tag || 'span'
}

/**
 * Создает элемент с правильными атрибутами для заданной команды
 */
export const createElement = (command: CommandType): HTMLElement => {
  const config = FORMAT_CONFIG[command as keyof typeof FORMAT_CONFIG] || { tag: 'span' }
  const element = document.createElement(config.tag)

  if (config.attributes) {
    Object.entries(config.attributes).forEach(([key, value]) => {
      // Для класса используем className, а не setAttribute
      if (key === 'class') {
        element.className = value
      } else {
        element.setAttribute(key, value)
      }
    })
  }

  return element
}
