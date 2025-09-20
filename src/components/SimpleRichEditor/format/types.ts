/**
 * @module format/types
 * @description Типы для системы форматирования редактора
 */

/**
 * Тип для активных форматов
 */
export type ActiveFormatsType = {
  bold: boolean
  italic: boolean
  link: boolean
  blockquote: boolean
  punchline: boolean
  h1: boolean
  h2: boolean
  h3: boolean
  highlight: boolean
  p: boolean
  bulletList: boolean
  orderedList: boolean
}

/**
 * Пустой объект активных форматов
 * @returns Объект ActiveFormatsType со значениями false для всех свойств
 */
export function emptyActiveFormats(): ActiveFormatsType {
  return {
    bold: false,
    italic: false,
    link: false,
    blockquote: false,
    punchline: false,
    h1: false,
    h2: false,
    h3: false,
    highlight: false,
    p: false,
    bulletList: false,
    orderedList: false
  }
}
