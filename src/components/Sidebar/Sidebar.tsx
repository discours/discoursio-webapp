import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, on, Show } from 'solid-js'
import Typograf from 'typograf'
import { Button } from '~/components/_shared/Button'
import { DarkModeToggle } from '~/components/_shared/DarkModeToggle'
import { Icon } from '~/components/_shared/Icon'
import { DraftInput, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Draft } from '~/graphql/generated/graphql'
import { useEscKeyDownHandler } from '~/lib/useEscKeyDownHandler'
import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'
import styles from './Sidebar.module.scss'

const typograf = new Typograf({ locale: ['ru', 'en-US'] })

type Props = {
  shoutId?: number
}

export const Panel = (props: Props) => {
  const { t } = useLocalize()
  const { showModal } = useUI()
  const [containerRef, setAsideContainerRef] = createSignal<HTMLElement | undefined>()
  const [isShortcutsVisible, setIsShortcutsVisible] = createSignal(false)
  const [isTypographyFixed, setIsTypographyFixed] = createSignal(false)
  const { publishDraft, currentDraft, updateDraft, isEditorPanelVisible, toggleEditorPanel } = useDrafts()
  const [body, setBody] = createSignal('')
  const [chars, setChars] = createSignal(0)
  const [words, setWords] = createSignal(0)

  createEffect(
    on(currentDraft, (d?: Draft) => {
      if (!d) return
      setBody(d.body || '')
      const div = document.createElement('div')
      div.innerHTML = d.body || ''
      setChars(div.textContent?.length || 0)
      setWords(div.textContent?.split(' ').length || 0)
    })
  )

  useEscKeyDownHandler(() => isEditorPanelVisible() && toggleEditorPanel())
  useOutsideClickHandler({
    containerRef: containerRef(),
    predicate: () => isEditorPanelVisible(),
    handler: () => toggleEditorPanel()
  })

  const handleSaveClick = () => {
    const d = currentDraft()
    updateDraft(d as DraftInput)
  }

  const handleFixTypographyClick = () => {
    setBody(typograf.execute(body() || ''))
    setIsTypographyFixed(true)
  }

  return (
    <aside
      ref={setAsideContainerRef}
      class={clsx('col-md-6', styles.Panel, { [styles.hidden]: !isEditorPanelVisible() })}
    >
      <Button
        value={<Icon name="close" />}
        variant={'inline'}
        class={styles.close}
        onClick={() => toggleEditorPanel()}
      />
      <div class={clsx(styles.actionsHolder, styles.scrolled, { hidden: isShortcutsVisible() })}>
        <section>
          <p>
            <span class={styles.link} onClick={() => publishDraft(currentDraft()?.id || 0)}>
              {t('Publish')}
            </span>
          </p>
          <p>
            <span class={styles.link} onClick={handleSaveClick}>
              {t('Save draft')}
            </span>
          </p>
        </section>

        <section>
          <p>
            <span class={styles.link} onClick={() => showModal('inviteMembers')}>
              {t('Invite co-authors')}
            </span>
          </p>
          <p>
            <A class={styles.link} onClick={() => toggleEditorPanel()} href={`/edit/${props.shoutId}/settings`}>
              {t('Publication settings')}
            </A>
          </p>
          <p>
            <span class={styles.link}>{t('Corrections history')}</span>
          </p>
        </section>

        <section>
          <div class={styles.typograph}>
            <div>
              <span class={styles.link} onClick={handleFixTypographyClick}>
                {t('Autotypograph')}
              </span>
            </div>
            <Show when={isTypographyFixed()}>
              <div class={clsx(styles.typographStatus, styles.typographStatusSuccess)}>{t('Fixed')}</div>
            </Show>
          </div>
          <p>{t('Text checking')}</p>
        </section>

        <section>
          <DarkModeToggle />
        </section>

        <section>
          <p>
            <a class={styles.link} href="/how-to-write-a-good-article">
              {t('How to write a good article')}
            </a>
          </p>
          <p>
            <button class={styles.link} onClick={() => setIsShortcutsVisible(true)}>
              {t('Hotkeys')}
            </button>
          </p>
          <p>
            <a class={styles.link} href="/guide/help">
              {t('Help')}
            </a>
          </p>
        </section>

        <div class={styles.stats}>
          <div>
            {t('Characters')}: <em>{chars()}</em>
          </div>
          <div>
            {t('Words')}: <em>{words()}</em>
          </div>
          {/*<div>*/}
          {/*  {t('Last rev.')}: <em>22.03.22 в 18:20</em>*/}
          {/*</div>*/}
        </div>
      </div>

      <div class={clsx(styles.actionsHolder, styles.scrolled, { hidden: !isShortcutsVisible() })}>
        <p>
          <button class={styles.backToMenuControl} onClick={() => setIsShortcutsVisible(false)}>
            {t('Back to menu"').toLocaleLowerCase()}
          </button>
        </p>

        <section class={styles.shortcutList}>
          <p>
            {t('Bold').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>B</span>
            </span>
          </p>
          <p>
            {t('Italic').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>I</span>
            </span>
          </p>
          <p>
            {t('Add link').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>K</span>
            </span>
          </p>
        </section>

        <section class={styles.shortcutList}>
          <p>
            {t('Header 1').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>Alt</span>
              <span class={styles.shortcutButton}>1</span>
            </span>
          </p>
          <p>
            {t('Header 2').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>Alt</span>
              <span class={styles.shortcutButton}>2</span>
            </span>
          </p>
          <p>
            {t('Header 3').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>Alt</span>
              <span class={styles.shortcutButton}>3</span>
            </span>
          </p>
        </section>

        <section class={styles.shortcutList}>
          <p>
            {t('marker list')}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>*</span>
              <span class={styles.shortcutButton}>Space</span>
            </span>
          </p>
          <p>
            {t('number list')}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>1</span>
              <span class={styles.shortcutButton}>Space</span>
            </span>
          </p>
          <p>
            {t('delimiter')}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>***</span>
              <span class={styles.shortcutButton}>Enter</span>
            </span>
          </p>
        </section>

        <section class={styles.shortcutList}>
          <p>
            {t('Cancel').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>Z</span>
            </span>
          </p>
          <p>
            {t('Repeat').toLocaleLowerCase()}
            <span class={styles.shortcut}>
              <span class={styles.shortcutButton}>Ctrl</span>
              <span class={styles.shortcutButton}>Shift</span>
              <span class={styles.shortcutButton}>Z</span>
            </span>
          </p>
        </section>
      </div>
    </aside>
  )
}
