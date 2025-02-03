import clsx from 'clsx'
import { Component, createSignal, onCleanup, onMount } from 'solid-js'
import { Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Portal } from 'solid-js/web'
import { UploadModalContent } from '~/components/Upload/UploadModalContent'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Modal } from '~/components/_shared/Modal'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { UploadedFile } from '~/types/upload'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import { SimpleMicroBubbleMenu } from './SimpleMicroBubbleMenu'
import { SimpleToolbarControl as Control } from './SimpleToolbarControl'

import styles from './SimpleRichEditor.module.scss'

interface SimpleEditorProps {
  content?: string
  onChange?: (content: string) => void
  onSubmit?: (content: string) => Promise<boolean> | boolean
  onCancel?: () => void
  onBlur?: () => void
  limit?: number
  placeholder?: string
  autoFocus?: boolean
  micro?: boolean
  shownAsLead?: boolean
}

export const SimpleRichEditor: Component<SimpleEditorProps> = (props) => {
  const { t } = useLocalize()
  const { showModal } = useUI()
  let editorRef: HTMLDivElement | undefined
  let blurTimer: number
  let lastSelection: Range | null = null

  const [state, setState] = createStore({
    content: props.content || '',
    format: {
      bold: false,
      italic: false,
      link: false,
      blockquote: false,
      underline: false
    }
  })

  const [showLinkForm, setShowLinkForm] = createSignal(false)
  const [isBlurred, setIsBlurred] = createSignal(false)
  const [counter, setCounter] = createSignal(0)
  const [showBubbleMenu, setShowBubbleMenu] = createSignal(false)
  const [bubbleMenuPosition, setBubbleMenuPosition] = createSignal({ top: 0, left: 0 })

  // Улучшенная работа с выделением
  const getSelectedRange = () => {
    const selection = window.getSelection()
    if (!(selection && editorRef)) return

    // Проверяем что выделение внутри редактора
    const s1 = editorRef.contains(selection.anchorNode)
    const s2 = editorRef.contains(selection.focusNode)
    if (!(s1 && s2)) return

    return selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  }

  const getSelectedText = () => {
    const range = getSelectedRange()
    return range ? range.toString() : ''
  }

  const saveSelection = () => {
    const range = getSelectedRange()
    if (range) {
      lastSelection = range.cloneRange()
    }
  }

  const restoreSelection = () => {
    if (!(lastSelection && editorRef)) return false

    try {
      const selection = window.getSelection()
      if (!selection) return false

      selection.removeAllRanges()
      selection.addRange(lastSelection.cloneRange())
      editorRef.focus()
      return true
    } catch (e) {
      console.warn('Failed to restore selection:', e)
      return false
    }
  }

  // Улучшенная работа с форматированием
  const execCommand = (command: string, value?: string) => {
    if (!editorRef) return false

    try {
      editorRef.focus()
      const result = document.execCommand(command, false, value)
      updateState()
      return result
    } catch (e) {
      console.warn(`Failed to execute command ${command}:`, e)
      return false
    }
  }

  // Улучшенная работа с ссылками
  const isLinkActive = () => {
    const range = getSelectedRange()
    if (!range) return false

    // Проверяем находится ли курсор внутри ссылки
    const commonAncestor = range.commonAncestorContainer
    const linkElement =
      commonAncestor.nodeType === 1
        ? (commonAncestor as Element).closest('a')
        : commonAncestor.parentElement?.closest('a')

    return !!linkElement
  }

  const getCurrentLink = () => {
    const range = getSelectedRange()
    if (!range) return null

    const commonAncestor = range.commonAncestorContainer
    const linkElement =
      commonAncestor.nodeType === 1
        ? (commonAncestor as Element).closest('a')
        : commonAncestor.parentElement?.closest('a')

    return linkElement ? linkElement.getAttribute('href') : null
  }

  const toggleLinkForm = () => {
    const hasSelection = !!getSelectedText()
    const isLink = isLinkActive()

    if (hasSelection || isLink) {
      saveSelection()
      setShowLinkForm(!showLinkForm())
    }
  }

  const setLink = (url: string) => {
    if (!url) {
      setShowLinkForm(false)
      return
    }

    if (restoreSelection()) {
      execCommand('createLink', url)
      // Сохраняем фокус на редакторе
      editorRef?.focus()
    }
    // Всегда закрываем форму после попытки добавления ссылки
    setShowLinkForm(false)
  }

  const removeLink = () => {
    if (isLinkActive()) {
      execCommand('unlink')
    }
    setShowLinkForm(false)
  }

  const handleLinkButtonClick = () => {
    if (isLinkActive()) {
      const currentUrl = getCurrentLink()
      if (currentUrl) {
        saveSelection()
        const newUrl = window.prompt(t('Edit link URL:'), currentUrl)
        if (newUrl !== null) {
          if (newUrl) {
            if (restoreSelection()) {
              execCommand('createLink', newUrl)
              // Возвращаем фокус
              editorRef?.focus()
            }
          } else {
            removeLink()
          }
        }
      } else {
        removeLink()
      }
    } else if (getSelectedText()) {
      toggleLinkForm()
    }
  }

  // Предотвращаем потерю фокуса при клике на форму
  const handleFormClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const insertImage = (image: UploadedFile) => {
    restoreSelection()
    const img = `<img src="${image.url}" alt="${image.originalFilename}" />`
    execCommand('insertHTML', img)
  }

  // Обновляем updateState
  const updateState = () => {
    if (!editorRef) return
    const c = editorRef.textContent?.trim().length || 0
    setCounter(c)

    const content = editorRef.innerHTML
    setState('content', content)

    // Always call onChange with the latest content
    if (props.onChange) {
      props.onChange(content)
    }

    const selection = window.getSelection()
    const hasSelection = selection && !selection.isCollapsed && editorRef.contains(selection.anchorNode)

    // Определяем текущий блок
    const currentBlock = selection?.anchorNode?.parentElement?.closest('blockquote, p')
    const isInBlockquote = currentBlock?.tagName.toLowerCase() === 'blockquote'

    setState('format', {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      link: hasSelection ? document.queryCommandState('createLink') : false,
      blockquote: isInBlockquote,
      underline: document.queryCommandState('underline')
    })

    // Сохраняем в localStorage
    if (props.content !== content) {
      localStorage.setItem('editor-content', content)
    }
  }

  // Обработчики событий
  const handleFocus = () => {
    clearTimeout(blurTimer)
    setIsBlurred(false)
  }

  const handleBlur = () => {
    blurTimer = window.setTimeout(() => {
      setIsBlurred(true)
      updateState()

      // Если это лид и он пустой - вызываем onBlur
      if (props.shownAsLead && counter() === 0) {
        props.onBlur?.()
      }
    }, 100)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Существующие хоткеи
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }

    // Выход из blockquote по Shift+Enter
    if (e.key === 'Enter' && e.shiftKey && state.format.blockquote) {
      e.preventDefault()
      execCommand('formatBlock', '<p>')
      return
    }

    // Выход из blockquote по двойному Enter на пустой строке
    if (e.key === 'Enter' && !e.shiftKey && state.format.blockquote) {
      const selection = window.getSelection()
      if (!selection) return

      const range = selection.getRangeAt(0)
      const blockquote = range.startContainer.parentElement?.closest('blockquote')

      if (blockquote && range.startContainer.textContent?.trim() === '') {
        e.preventDefault()
        execCommand('formatBlock', '<p>')

        // Удаляем пустой параграф внутри blockquote если он остался
        const emptyP = blockquote.querySelector('p:empty')
        if (emptyP) {
          emptyP.remove()
        }
      }
    }

    // Остальные хоткеи
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b': {
          e.preventDefault()
          execCommand('bold')
          break
        }
        case 'i': {
          e.preventDefault()
          execCommand('italic')
          break
        }
        case 'u': {
          e.preventDefault()
          execCommand('underline')
          break
        }
        case 'k': {
          e.preventDefault()
          handleLinkButtonClick()
          break
        }
        default: {
          break
        }
      }
    }
  }

  // Обновляем handleSubmit
  const handleSubmit = async () => {
    if (!props.onSubmit || counter() === 0) return

    try {
      const success = await props.onSubmit(state.content)
      if (success) {
        // Очищаем редактор только после успешного сохранения
        editorRef!.innerHTML = ''
        updateState()
      }
      // Если сохранение не удалось, оставляем редактор открытым
      return success
    } catch (error) {
      console.error('Error submitting content:', error)
      return false
    }
  }

  const handleClear = () => {
    editorRef!.innerHTML = ''
    updateState()
    props.onCancel?.()
  }

  // Add function to update bubble menu position
  const updateBubbleMenuPosition = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setShowBubbleMenu(false)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    setBubbleMenuPosition({
      top: rect.top - 40, // Adjust this value to position menu above selection
      left: rect.left + rect.width / 2
    })
    setShowBubbleMenu(true)
  }

  // Update existing selection handlers
  const handleSelectionChange = () => {
    if (props.micro) {
      updateBubbleMenuPosition()
    }
    updateState()
  }

  // Инициализация и очистка
  onMount(() => {
    if (!editorRef) return

    // Пытаемся восстановить контент
    const savedContent = localStorage.getItem('editor-content')
    editorRef.innerHTML = props.content || savedContent || ''

    if (props.placeholder) {
      editorRef.setAttribute('data-placeholder', props.placeholder)
    }

    editorRef.addEventListener('input', updateState)
    editorRef.addEventListener('keydown', handleKeyDown)

    if (props.autoFocus) {
      editorRef.focus()
    }

    // Инициализируем состояние
    updateState()

    document.addEventListener('selectionchange', handleSelectionChange)
  })

  onCleanup(() => {
    clearTimeout(blurTimer)
    editorRef?.removeEventListener('input', updateState)
    editorRef?.removeEventListener('keydown', handleKeyDown)
    if (editorRef) {
      editorRef.removeEventListener('input', updateState)
    }
    document.removeEventListener('selectionchange', handleSelectionChange)
  })

  // Обработка клика для выхода из blockquote
  const handleEditorClick = (e: MouseEvent) => {
    if (!editorRef) return

    const clickedElement = e.target as Node
    const isInBlockquote = clickedElement.parentElement?.closest('blockquote')

    // Если кликнули вне blockquote и мы в режиме цитирования
    if (!isInBlockquote && state.format.blockquote) {
      execCommand('formatBlock', '<p>')
    }
  }

  const SimpleToolbar = () => {
    if (props.micro) return null
    return (
      <div class={styles.controls}>
        <div class={styles.actions}>
          <Control
            key="bold"
            isActive={state.format.bold}
            onChange={() => execCommand('bold')}
            caption={`${t('Bold')} (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+B)`}
          >
            <Icon name="editor-bold" />
          </Control>
          <Control
            key="italic"
            isActive={state.format.italic}
            onChange={() => execCommand('italic')}
            caption={`${t('Italic')} (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+I)`}
          >
            <Icon name="editor-italic" />
          </Control>
          <Control
            key="link"
            isActive={state.format.link}
            onChange={handleLinkButtonClick}
            caption={`${t('Add url')} (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K)`}
          >
            <Icon name="editor-link" />
          </Control>
          <Control
            key="blockquote"
            isActive={state.format.blockquote}
            onChange={() => {
              if (state.format.blockquote) {
                execCommand('formatBlock', '<p>')
              } else {
                execCommand('formatBlock', '<blockquote>')
              }
            }}
            caption={t('Add blockquote')}
          >
            <Icon name="editor-quote" />
          </Control>
          <Control key="image" onChange={() => showModal('editorUploadImage')} caption={t('Add image')}>
            <Icon name="editor-image-dd-full" />
          </Control>
          <SimpleInsertLinkForm
            class={clsx([styles.linkInput, { [styles.linkInputactive]: showLinkForm() }])}
            onClose={toggleLinkForm}
            onSubmit={setLink}
            onRemove={removeLink}
            onClick={handleFormClick}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      class={clsx(styles.editor, {
        [styles.micro]: props.micro,
        [styles.isFocused]: !isBlurred()
      })}
    >
      <Show when={!props.micro}>
        <SimpleToolbar />
      </Show>

      <Show when={props.micro && showBubbleMenu()}>
        <Portal>
          <SimpleMicroBubbleMenu
            position={bubbleMenuPosition()}
            onBold={() => execCommand('bold')}
            onItalic={() => execCommand('italic')}
            onLink={handleLinkButtonClick}
            format={state.format}
            onClose={() => setShowBubbleMenu(false)}
          />
        </Portal>
      </Show>

      <Portal>
        <Modal variant="narrow" name="editorUploadImage">
          <UploadModalContent
            onClose={(image) => {
              if (image) {
                insertImage(image as UploadedFile)
              }
            }}
          />
        </Modal>
      </Portal>

      <div
        ref={editorRef}
        class={styles.content}
        contentEditable
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleEditorClick}
        data-placeholder={props.placeholder}
      />

      <Show when={!props.micro}>
        <div class={clsx(styles.buttons, { [styles.visible]: counter() > 1 })}>
          <Button value={t('Clear')} variant="secondary" onClick={handleClear} />
          <Button value={t('Save')} variant="primary" onClick={handleSubmit} />
        </div>
      </Show>

      <Show when={counter() > 0}>
        <small class={styles.limit}>
          {counter()} / {props.limit || '∞'}
        </small>
      </Show>
    </div>
  )
}
