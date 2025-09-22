/**
 * @module ui/EditorUILayer
 * @description UI слой для элементов интерфейса редактора (Plus-меню, тулбары)
 */

import { Component, createEffect, createSignal, Show } from 'solid-js'
import { CommandType } from '../lib/types'
import { PlusMenu } from '../menu/PlusMenu'
import styles from './EditorUILayer.module.scss'

interface EditorUILayerProps {
  editorRef: () => HTMLDivElement | undefined
  showPlusMenu: boolean
  onPlusAction: (action: CommandType) => void
  editorId?: string
  updateTrigger: number // Сигнал для обновления позиции Plus-меню
}

export const EditorUILayer: Component<EditorUILayerProps> = (props) => {
  const [uiLayerRef, setUILayerRef] = createSignal<HTMLDivElement>()
  const [plusMenuPosition, setPlusMenuPosition] = createSignal({ top: 0, visible: false })

  // Синхронизация размеров с редактором
  const syncWithEditor = () => {
    const editor = props.editorRef()
    const uiLayer = uiLayerRef()

    if (!editor || !uiLayer) return

    const editorRect = editor.getBoundingClientRect()
    const editorStyle = window.getComputedStyle(editor)

    // Копируем размеры и позицию редактора
    uiLayer.style.position = 'absolute'
    uiLayer.style.top = '0'
    uiLayer.style.left = '0'
    uiLayer.style.width = `${editor.offsetWidth}px`
    uiLayer.style.height = `${editor.offsetHeight}px`
    uiLayer.style.paddingTop = editorStyle.paddingTop
    uiLayer.style.paddingBottom = editorStyle.paddingBottom
    uiLayer.style.paddingLeft = editorStyle.paddingLeft
    uiLayer.style.paddingRight = editorStyle.paddingRight
    uiLayer.style.lineHeight = editorStyle.lineHeight
    uiLayer.style.fontSize = editorStyle.fontSize
    uiLayer.style.fontFamily = editorStyle.fontFamily

    console.log('[EditorUILayer] Synced with editor:', {
      editorSize: { width: editor.offsetWidth, height: editor.offsetHeight },
      editorRect,
      padding: {
        top: editorStyle.paddingTop,
        left: editorStyle.paddingLeft
      }
    })
  }

  // Реакция на updateTrigger из главного обработчика
  createEffect(() => {
    // Отслеживаем изменения updateTrigger
    props.updateTrigger
    updatePlusMenuPosition()
  })

  // Определение позиции Plus-меню на основе курсора
  const updatePlusMenuPosition = () => {
    const editor = props.editorRef()
    const uiLayer = uiLayerRef()

    if (!editor || !uiLayer) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setPlusMenuPosition({ top: 0, visible: false })
      return
    }

    const range = selection.getRangeAt(0)
    const rangeRect = range.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()

    if (rangeRect.height > 0) {
      // Позиция относительно UI-слоя
      const relativeTop = rangeRect.top - editorRect.top + rangeRect.height / 2

      setPlusMenuPosition({
        top: relativeTop,
        visible: true
      })

      console.log('[EditorUILayer] Plus menu position updated:', {
        rangeRect: { top: rangeRect.top, height: rangeRect.height },
        editorRect: { top: editorRect.top },
        relativeTop,
        finalPosition: { top: relativeTop, visible: true }
      })
    }
  }

  // Отслеживание изменений в редакторе
  createEffect(() => {
    const editor = props.editorRef()
    if (!editor) return

    // Синхронизация при изменении размеров
    const resizeObserver = new ResizeObserver(() => {
      syncWithEditor()
    })
    resizeObserver.observe(editor)

    // Отслеживание изменений курсора
    // Не добавляем свой обработчик selectionchange - используем единый из SimpleRichEditor
    // const handleSelectionChange = () => {
    //   updatePlusMenuPosition()
    // }
    editor.addEventListener('input', updatePlusMenuPosition)
    editor.addEventListener('keyup', updatePlusMenuPosition)
    editor.addEventListener('click', updatePlusMenuPosition)

    // Первоначальная синхронизация
    syncWithEditor()
    updatePlusMenuPosition()

    return () => {
      resizeObserver.disconnect()
      // document.removeEventListener('selectionchange', handleSelectionChange) // Убрали
      editor.removeEventListener('input', updatePlusMenuPosition)
      editor.removeEventListener('keyup', updatePlusMenuPosition)
      editor.removeEventListener('click', updatePlusMenuPosition)
    }
  })

  return (
    <div ref={setUILayerRef} class={styles.editorUILayer}>
      <Show when={props.showPlusMenu && plusMenuPosition().visible}>
        <div
          class={styles.plusMenuContainer}
          style={{
            position: 'absolute',
            top: `${plusMenuPosition().top - 16}px`, // Центрируем по вертикали
            left: '-50px', // Слева от редактора
            'z-index': 1000
          }}
        >
          <PlusMenu
            position={{ top: 0, left: 0 }} // Позиция относительно контейнера
            isVisible={true}
            onAction={props.onPlusAction}
            editorId={props.editorId}
          />
        </div>
      </Show>
    </div>
  )
}
