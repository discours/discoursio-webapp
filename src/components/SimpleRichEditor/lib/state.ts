import { Accessor, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { debounce } from 'throttle-debounce'
import { applyFormatting as applyFormat, getActiveFormats, removeFormatting, resetFormat } from '../format/format'
import { getCommandType } from '../menu/config'
import { CommandType, HistoryJournal, Position } from './types'

/**
 * @module state
 * @description Модуль управления состоянием rich text редактора
 *
 * Основные возможности:
 * - Управление форматированием текста
 * - История изменений (undo/redo)
 * - Автосохранение в localStorage
 * - Отслеживание выделения
 * - Подсчет символов
 * - Управление UI-компонентами (формы, модальные окна)
 *
 * @example
 * ```tsx
 * const { state, format, updateState } = useEditor({
 *   id: 'my-editor',
 *   content: initialContent,
 *   editorRef,
 *   onChange: (content) => console.log(content)
 * })
 * ```
 */

/**
 * Состояние редактора
 */
export interface EditorState {
  id: string
  content: string
  selection: {
    range: Range | null
    text: string
    isEmpty: boolean
    position: { top: number; left: number }
  }
  activeFormats: Set<CommandType>
  format?: {
    block?: {
      blockquote?: boolean
      punchline?: boolean
      incut?: boolean
    }
    text?: {
      bold?: boolean
      italic?: boolean
      link?: boolean
      highlight?: boolean
    }
    media?: {
      image?: boolean
      video?: boolean
    }
  }
  history: {
    undo: string[]
    redo: string[]
  }
  isBlurred: boolean
  cursorPosition?: Position
  currentCommand?: CommandType
  setActiveFormats: (formats: Set<CommandType>) => void
  setContent: (content: string) => void
  setIsBlurred: (isBlurred: boolean) => void
}

/**
 * Пропсы редактора
 */
export interface EditorProps {
  id?: string
  content?: string
  editorRef: Accessor<HTMLDivElement | undefined>
  onChange: (content: string) => void
  onShowModal?: (type: string) => void
  limit?: number
  onSaveStart?: () => void
  onSaveEnd?: () => void
}

const MAX_HISTORY_LENGTH = 100

/**
 * Сигналы для управления состоянием UI компонентов редактора
 */

// Сигнал для отображения формы вставки ссылки
export const [showLinkForm, setShowLinkForm] = createSignal<boolean>(false)

// Сигнал для отображения формы вставки видео
export const [showVideoForm, setShowVideoForm] = createSignal<boolean>(false)

// Сигнал для отображения формы вставки аудио
export const [showAudioForm, setShowAudioForm] = createSignal<boolean>(false)

// Сигнал для отображения модального окна загрузки файлов
export const [showUploadModal, setShowUploadModal] = createSignal<boolean>(false)

// Текущий редактируемый сквиб (блок)
export const [editingIncutId, setEditingIncutId] = createSignal<string | null>(null)

// Footnotes removed

/**
 * Хук управления состоянием редактора
 */
export const useEditor = (props: EditorProps) => {
  const [counter, setCounter] = createSignal(0)

  // Ключ для автосохранения
  const storageKey = () => (props.id ? `editor-${props.id}` : '')

  // Начальное состояние
  const [state, setState] = createStore<EditorState>({
    id: props.id || `editor-${Math.random().toString(36).slice(2)}`,
    content: props.content || '',
    selection: {
      range: null,
      text: '',
      isEmpty: true,
      position: { top: 0, left: 0 }
    },
    activeFormats: new Set(),
    history: {
      undo: [],
      redo: []
    },
    isBlurred: false,
    currentCommand: undefined,
    setActiveFormats: (formats: Set<CommandType>) => setState('activeFormats', formats),
    setContent: (content: string) => setState('content', content),
    setIsBlurred: (isBlurred: boolean) => setState('isBlurred', isBlurred)
  })

  // Дебаунсированное сохранение
  const saveToStorage = debounce(500, (content: string) => {
    const key = storageKey()
    if (!key) return
    try {
      localStorage.setItem(key, content)
    } catch (e) {
      console.warn('Failed to save editor content:', e)
    }
  })

  /**
   * Обновляет состояние редактора
   */
  const updateState = debounce(100, () => {
    const editor = props.editorRef()
    if (!editor) return

    const selection = window.getSelection()
    const content = editor.innerHTML
    const hasValidRange = selection && selection.rangeCount > 0

    // Получаем активные форматы и трансформируем их в нужную структуру
    const activeFormats = getActiveFormats(selection || undefined, editor || undefined)

    setState({
      content,
      format: {
        text: {
          bold: activeFormats.bold,
          italic: activeFormats.italic,
          link: activeFormats.link,
          highlight: activeFormats.highlight
        },
        block: {
          blockquote: activeFormats.blockquote,
          punchline: activeFormats.punchline
        }
      },
      selection: {
        range: hasValidRange ? selection.getRangeAt(0) : null,
        text: selection?.toString() || '',
        isEmpty: !hasValidRange || selection.isCollapsed,
        position: hasValidRange ? selection.getRangeAt(0).getBoundingClientRect() : { top: 0, left: 0 }
      }
    })

    setCounter(editor.textContent?.trim().length || 0)
    saveToStorage(content)
    saveToHistory()
  })

  /**
   * Форматирование текста
   */
  const format = (cmd: CommandType) => {
    const editor = props.editorRef()
    if (!editor) return

    const kind = getCommandType(cmd)
    const { range } = state.selection
    if (!range) return

    // Сброс форматирования
    if (cmd === 'p') {
      resetFormat(editor, range)
      setState('activeFormats', new Set())
      props.onChange(editor.innerHTML)
      return
    }

    // Модальные команды
    if (kind === 'links' || kind === 'media') {
      props.onShowModal?.(cmd)
      return
    }

    // Применение/удаление форматирования
    const isActive = state.activeFormats.has(cmd)
    if (isActive) {
      removeFormatting(cmd, state.selection)
      setState('activeFormats', (formats: Set<CommandType>) => {
        const newFormats = new Set(formats)
        newFormats.delete(cmd)
        return newFormats
      })
    } else {
      applyFormat(cmd, state.selection)
      setState('activeFormats', (formats: Set<CommandType>) => {
        const newFormats = new Set(formats)
        newFormats.add(cmd)
        return newFormats
      })
    }

    props.onChange(editor.innerHTML)
  }

  /**
   * История изменений
   */
  const undo = () => {
    const editor = props.editorRef()
    if (!editor || state.history.undo.length === 0) return

    const currentContent = editor.innerHTML
    const previousContent = state.history.undo[state.history.undo.length - 1]

    setState('history', (history: HistoryJournal) => ({
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, currentContent].slice(-MAX_HISTORY_LENGTH)
    }))

    editor.innerHTML = previousContent
    props.onChange(previousContent)
  }

  const redo = () => {
    const editor = props.editorRef()
    if (!editor || state.history.redo.length === 0) return

    const currentContent = editor.innerHTML
    const nextContent = state.history.redo[state.history.redo.length - 1]

    setState('history', (history: HistoryJournal) => ({
      undo: [...history.undo, currentContent].slice(-MAX_HISTORY_LENGTH),
      redo: history.redo.slice(0, -1)
    }))

    editor.innerHTML = nextContent
    props.onChange(nextContent)
  }

  const saveToHistory = debounce(500, () => {
    const editor = props.editorRef()
    if (!editor) return

    setState('history', (history: HistoryJournal) => ({
      undo: [...history.undo, editor.innerHTML].slice(-MAX_HISTORY_LENGTH),
      redo: []
    }))
  })

  return {
    state,
    format,
    updateState,
    counter,
    undo,
    redo
    // updateSelection,
    //restoreSelection
  }
}
