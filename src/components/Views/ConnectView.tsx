import { createSignal, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'

export const ConnectView = () => {
  const { t } = useLocalize()
  const [state, setState] = createSignal<'initial' | 'loading' | 'success' | 'error'>('initial')
  let formRef: HTMLFormElement | null = null

  const handleFormSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    setState('loading')

    const postData = formRef
      ? Array.from(formRef.elements).reduce(
          (acc, element) => {
            const formField = element as HTMLInputElement
            if (formField.name) {
              acc[formField.name] = formField.value
            }
            return acc
          },
          {} as Record<string, string>
        )
      : {}

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    }

    try {
      const result = await fetch('/api/feedback', requestOptions)
      if (!result.ok) {
        console.error('[handleFormSubmit]', result)
        setState('error')
        return
      }
      setState('success')
      window.scrollTo({
        top: 0
      })
    } catch (error) {
      console.error('[handleFormSubmit]', error)
      setState('error')
    }
  }

  return (
    <article class="wide-container container--static-page">
      <div class="row">
        <div class="col-sm-20 col-md-16 col-lg-14 col-xl-12 offset-md-5">
          <Show when={state() !== 'success'}>
            <h1>
              <span class="wrapped">{t('Suggest an idea')}</span>
            </h1>

            <p>
              {t(
                'Want to suggest, discuss or advise something? Share a topic or an idea?  Please send us a message!'
              )}
              {t('Specify your e-mail and we will reply.')}
            </p>

            <form onSubmit={handleFormSubmit} ref={(el) => (formRef = el)}>
              <div class="pretty-form__item">
                <select name="subject" disabled={state() === 'loading'}>
                  <option value={t('Collaborate')} selected>
                    {t('Collaborate')}
                  </option>
                  <option value={t('Recommend some new topic')}>{t('Recommend some new topic')}</option>
                  <option value={t('Report an error')}>{t('Report an error')}</option>
                  <option value={t('Volounteering')}>{t('Volounteering')}</option>
                  <option value={t('Anything else')}>{t('Anything else')}</option>
                </select>
              </div>
              <div class="pretty-form__item">
                <input
                  type="email"
                  name="contact"
                  placeholder={t('Your contact for answer')}
                  disabled={state() === 'loading'}
                />
                <label for="contact-email">{t('Your contact for answer')}</label>
              </div>
              <div class="pretty-form__item">
                <textarea name="message" placeholder={t('Message text')} disabled={state() === 'loading'} />
                <label for="message">{t('Message text')}</label>
              </div>
              <button class="button" disabled={state() === 'loading'} type="submit">
                {t('Send')}
              </button>
            </form>
          </Show>
          <Show when={state() === 'error'}>
            <br />
            {t('Something went wrong, please try again')}
          </Show>
          <Show when={state() === 'success'}>
            <br />
            {t('Thank you for reaching us')}!
          </Show>
        </div>
      </div>
    </article>
  )
}
