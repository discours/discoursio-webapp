import { Accessor, createSignal, onCleanup, onMount } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { AutoSaveNotice } from './AutoSaveNotice'

const AUTO_SAVE_DELAY = 3000

interface AutoSaveProps {
  cacheId: Accessor<string>
  data: Accessor<string>
}

export const AutoSave = (props: AutoSaveProps) => {
  const [saving, setSaving] = createSignal(false)
  const [hasChanges, setHasChanges] = createSignal(false)
  const autoSave = () => {
    console.log('autoSave called')
    if (hasChanges()) {
      setSaving(true)
      localStorage.setItem(props.cacheId(), props.data())
      setSaving(false)
      setHasChanges(false)
    }
  }
  const debouncedAutoSave = debounce(AUTO_SAVE_DELAY, autoSave)
  onMount(() => window.addEventListener('beforeunload', autoSave))
  onCleanup(() => window.removeEventListener('beforeunload', autoSave))
  onMount(autoSave)
  onCleanup(debouncedAutoSave.cancel)
  return (
    <>
      <AutoSaveNotice active={saving()} />
    </>
  )
}
