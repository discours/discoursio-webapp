import { Accessor, createMemo, createSignal } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { debounce } from 'throttle-debounce'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar } from '~/context/ui'
import { handleImageUpload } from '~/lib/handleFileUpload'
import { selectedTextToImage } from './embed'
import { getFormatStates } from './format'

// Типы для состояния редактора
export interface EditorState {
  content: string
  format: {
    text: {
      bold: boolean
      italic: boolean
      underline?: boolean
      link: boolean
      strikethrough?: boolean
    }
    block: {
      h1?: boolean
      h2?: boolean
      h3?: boolean
      blockquote?: boolean
      orderedList?: boolean
      unorderedList?: boolean
      incut?: boolean
    }
    media: {
      image?: boolean
      video?: boolean
      figcaption?: boolean
    }
  }
  selection: {
    range?: Range | null
    text?: string
    isEmpty?: boolean
    position?: { top: number; left: number }
  }
  history?: {
    undo: string[]
    redo: string[]
  }
  handleImageUploadWithSnackbar?: (files: File[]) => Promise<void>
}

// Начальное состояние редактора
export const defaultEditorState: EditorState = {
  content: '',
  format: {
    text: {
      bold: false,
      italic: false,
      underline: false,
      link: false,
      strikethrough: false
    },
    block: {
      h1: false,
      h2: false,
      h3: false,
      blockquote: false,
      orderedList: false,
      unorderedList: false,
      incut: false
    },
    media: {
      image: false,
      video: false,
      figcaption: false
    }
  },
  selection: {
    range: null,
    text: '',
    isEmpty: true,
    position: { top: 0, left: 0 }
  },
  history: {
    undo: [],
    redo: []
  }
}

interface EditorConfig {
  storageKey?: string // уникальный ключ для localStorage
  content?: string // начальный контент
  autoSave?: boolean // нужно ли автосохранение
}

// Создаем фабрику для дебаунсированного сохранения
const createStorageHandler = (storageKey: string) =>
  debounce(500, (content: string) => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, content)
    } catch (e) {
      console.warn(`Failed to save editor content for ${storageKey}:`, e)
    }
  })

/**
 * Updates editor state with current selection and content
 */
const updateEditorState = (
  editor: HTMLElement,
  selection: Selection | null,
  setState: SetStoreFunction<EditorState>,
  setCounter?: (count: number) => void
) => {
  const content = editor.innerHTML

  setState({
    content,
    format: getFormatStates(selection, editor),
    selection: {
      range: selection?.getRangeAt(0) || null,
      text: selection?.toString() || '',
      isEmpty: selection?.isCollapsed ?? true,
      position: selection?.getRangeAt(0)?.getBoundingClientRect() || { top: 0, left: 0 }
    }
  })

  setCounter?.(editor.textContent?.trim().length || 0)
}

/**
 * Hook for managing editor state
 */
export function useEditor(config: EditorConfig, editorRef: Accessor<HTMLDivElement | undefined>) {
  const { session } = useSession()
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const storageKey = config.storageKey

  // Создаем обработчик сохранения, если включено автосохранение
  const storageHandler = createMemo(() => {
    if (!(config.autoSave && storageKey)) return null
    return createStorageHandler(storageKey)
  })

  // Читаем сохраненный контент только один раз при инициализации
  const initialContent = createMemo(() => {
    if (!(config.autoSave && storageKey)) return config.content || ''
    return config.content || localStorage.getItem(storageKey) || ''
  })

  const [state, setState] = createStore<EditorState>({
    ...defaultEditorState,
    content: initialContent()
  })

  // UI state
  const [isBlurred, setIsBlurred] = createSignal(false)
  const [counter, setCounter] = createSignal(0)
  const [showBubbleMenu, setShowBubbleMenu] = createSignal(false)
  const [showLinkForm, setShowLinkForm] = createSignal(false)

  // History management
  let historyTimeout: number
  const saveToHistory = debounce(500, () => {
    const editor = editorRef()
    if (!editor) return

    clearTimeout(historyTimeout)
    historyTimeout = window.setTimeout(() => {
      const content = editor.innerHTML
      if (content !== state.content) {
        setState('history', 'undo', (prev: string[]) => [...prev.slice(-20), content])
        setState('history', 'redo', (r: string[]) => r.slice(0, -1))
      }
    }, 100)
  })

  // Обновляем State updates с поддержкой автосохранения
  const updateState = debounce(100, () => {
    const editor = editorRef()
    if (!editor) return

    const sel = window.getSelection()
    updateEditorState(editor, sel, setState, setCounter)
    saveToHistory()

    // Вызываем автосохранение, если оно включено
    const storage = storageHandler()
    if (storage && editor.innerHTML) {
      storage(editor.innerHTML)
    }
  })

  // Image upload handling
  const handleImageUploadWithSnackbar = async (files: File[]) => {
    try {
      const result = await handleImageUpload(files, session()?.access_token || '')
      if (result && Array.isArray(result)) {
        result.forEach((file) => {
          const image = selectedTextToImage(file.url, file.originalFilename)
          const editor = editorRef()
          if (editor) {
            editor.focus()
            document.execCommand('insertHTML', false, image)
          }
        })
        showSnackbar({ body: t('Images uploaded') })
      } else if (typeof result === 'string') {
        showSnackbar({ body: t(result), type: 'error' })
      }
    } catch (error) {
      console.error('Upload error:', error)
      showSnackbar({ body: t('Upload failed'), type: 'error' })
    }
  }

  return {
    state,
    setState,
    isBlurred,
    setIsBlurred,
    counter,
    setCounter,
    showBubbleMenu,
    setShowBubbleMenu,
    showLinkForm,
    setShowLinkForm,
    updateState,
    handleImageUploadWithSnackbar
  }
}
