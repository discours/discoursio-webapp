import { createSignal, JSX, onMount } from 'solid-js'

// see: https://github.com/WICG/translation-api

interface TranslationWrapperProps {
  children: string
  targetLanguage: string
  sourceLanguage?: string
}

// Define the Translation API types
interface TranslationAPI {
  canTranslate: (options: { sourceLanguage?: string; targetLanguage: string }) => Promise<'yes' | 'no' | 'limited'>
  createTranslator: (options: { sourceLanguage?: string; targetLanguage: string }) => Promise<Translator>
}

interface Translator {
  translate: (text: string) => Promise<string | { result: string }>
}
// Extend the Window interface to include the translation property
declare global {
  interface Window {
    translation?: TranslationAPI
  }
}

export default function TranslationWrapper(props: TranslationWrapperProps): JSX.Element {
  const [translatedText, setTranslatedText] = createSignal<string | null>(null)
  const [isTranslating, setIsTranslating] = createSignal(false)

  onMount(async () => {
    if (window && 'translation' in window) {
      const translation = (window as Window)?.translation

      const canTranslate = await translation?.canTranslate({
        sourceLanguage: props.sourceLanguage || 'ru',
        targetLanguage: props.targetLanguage
      })

      if (translation && canTranslate !== 'no') {
        setIsTranslating(true)

        try {
          const translator = await translation?.createTranslator({
            sourceLanguage: props.sourceLanguage,
            targetLanguage: props.targetLanguage
          })

          const result = await translator?.translate(props.children)

          if (typeof result === 'string') {
            setTranslatedText(result)
          } else if (result && 'result' in result) {
            setTranslatedText(result.result)
          }
        } catch (error) {
          console.error('Translation failed:', error)
        } finally {
          setIsTranslating(false)
        }
      }
    }
  })

  return (
    <>{isTranslating() ? <span style="opacity: 0.9">{props.children}</span> : translatedText() || props.children}</>
  )
}
