/**
 * @module menu/presets
 * @description Предустановленные наборы команд для разных режимов редактора
 */

/**
 * Предустановленные наборы команд
 */
export const PLUS_COMMANDS = [['image', 'video', 'audio', 'hr']] as const
export const MICRO_COMMANDS = ['bold', 'italic', 'link'] as const
export const MINI_COMMANDS = ['bold', 'italic', 'link', 'blockquote', 'image'] as const
export const FULL_COMMANDS = [
  // Группа форматирования текста
  [
    [
      // кнопка с иконкой editor-headings
      ['h1', 'h2', 'h3'], // Заголовки
      ['blockquote', 'punchline', 'incut'] // Цитаты и врезки
    ]
  ],

  // разделитель

  ['bold', 'italic', 'highlight'], // в строку

  // разделитель

  ['link', 'tooltip'], // в строку

  // разделитель

  // кнопка с иконкой editor-lists
  [
    [
      // кнопка с иконкой editor-lists
      ['bulletList', 'orderedList'] // lists
    ]
  ] // выпадающий список
] as const
