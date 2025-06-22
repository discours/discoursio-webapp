import { createSignal, JSX, onMount, ParentComponent, Show } from 'solid-js'

// Компонент для рендеринга только на клиенте
export const ClientOnly: ParentComponent<{ fallback?: JSX.Element }> = (props) => {
  const [mounted, setMounted] = createSignal(false)

  onMount(() => setMounted(true))

  return (
    <Show when={mounted()} fallback={props.fallback}>
      {props.children}
    </Show>
  )
}
