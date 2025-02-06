import { createMemo, createSignal } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { debounce } from 'throttle-debounce'
import { useLocalize } from '~/context/localize'
import { useSnackbar } from '~/context/ui'
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

interface EditorOptions {
  content?: string
  storageKey?: string
  autoSave?: boolean
  onSaveStart?: () => void
  onSaveEnd?: () => void
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

  // Проверяем есть ли выделение и диапазоны в нем
  const hasValidRange = selection && selection.rangeCount > 0

  setState({
    content,
    format: getFormatStates(selection, editor),
    selection: {
      range: hasValidRange ? selection.getRangeAt(0) : null,
      text: selection?.toString() || '',
      isEmpty: !hasValidRange || selection.isCollapsed,
      position: hasValidRange ? selection.getRangeAt(0).getBoundingClientRect() : { top: 0, left: 0 }
    }
  })

  setCounter?.(editor.textContent?.trim().length || 0)
}

/**
 * Hook for managing editor state
 */
export const useEditor = (options: EditorOptions, editorRef: () => HTMLDivElement | undefined) => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const storageKey = options.storageKey

  // Создаем обработчик сохранения, если включено автосохранение
  const storageHandler = createMemo(() => {
    if (!(options.autoSave && storageKey)) return null
    return createStorageHandler(storageKey)
  })

  // Читаем сохраненный контент только один раз при инициализации
  const initialContent = createMemo(() => {
    if (!(options.autoSave && storageKey)) return options.content || ''
    return options.content || localStorage.getItem(storageKey) || ''
  })

  const [state, setState] = createStore<EditorState>({
    ...defaultEditorState,
    content: initialContent()
  })

  // UI state
  const [isBlurred, setIsBlurred] = createSignal(false)
  const [counter, setCounter] = createSignal(0)

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

  /**
   * Загружает изображения с отображением уведомлений о прогрессе
   * @param files Массив файлов для загрузки
   * @returns Массив URL загруженных изображений
   */
  const handleImageUploadWithSnackbar = async (files: File[]): Promise<string[]> => {
    try {
      showSnackbar({ body: t('Uploading images...') })

      // Здесь должна быть реальная загрузка файлов на сервер
      // Например через API или S3
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const { url } = await response.json()
        return url
      })

      const uploadedUrls = await Promise.all(uploadPromises)

      showSnackbar({
        body: t('Images uploaded successfully'),
        type: 'success'
      })

      return uploadedUrls
    } catch (error) {
      console.error('Error uploading images:', error)
      showSnackbar({
        body: t('Failed to upload images'),
        type: 'error'
      })
      return []
    }
  }

  const saveContent = () => {
    if (!options.autoSave || !options.storageKey) return

    options.onSaveStart?.()

    try {
      const content = editorRef()?.innerHTML || ''
      localStorage.setItem(options.storageKey, content)
    } catch (error) {
      console.error('Failed to save content:', error)
    }

    options.onSaveEnd?.()
  }

  return {
    state,
    setState,
    isBlurred,
    setIsBlurred,
    counter,
    setCounter,
    updateState,
    handleImageUploadWithSnackbar,
    saveContent
  }
}
