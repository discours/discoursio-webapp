import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createSignal } from 'solid-js'
import { createEditorTransaction, useEditorHTML } from 'solid-tiptap'
import Typograf from 'typograf'
import { Button } from '~/components/_shared/Button'
import { DarkModeToggle } from '~/components/_shared/DarkModeToggle'
import { Icon } from '~/components/_shared/Icon'
import { useEditorContext } from '~/context/editor'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { useEscKeyDownHandler } from '~/lib/useEscKeyDownHandler'
import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'

import styles from './Panel.module.scss'

const typograf = new Typograf({ locale: ['ru', 'en-US'] })

type Props = {
  shoutId: number
}

export const Panel = (props: Props) => {
  const { t } = useLocalize()
  const { showModal } = useUI()
  const {
    setIsCollabMode,
    isEditorPanelVisible,
    form,
    toggleEditorPanel,
    saveShout,
    saveDraft,
    publishShout,
    editing: editor
  } = useEditorContext()
  const [containerRef, setAsideContainerRef] = createSignal<HTMLElement | undefined>()
  const [isShortcutsVisible, setIsShortcutsVisible] = createSignal(false)
  const [isTypographyFixed, setIsTypographyFixed] = createSignal(false)

  useOutsideClickHandler({
    containerRef: containerRef(),
    predicate: () => isEditorPanelVisible(),
    handler: () => toggleEditorPanel()
  })

  useEscKeyDownHandler(() => {
    if (isEditorPanelVisible()) {
      toggleEditorPanel()
    }
  })

  const handleSaveClick = () => {
    const hasTopics = form.selectedTopics?.length > 0
    const data = { ...form, body: editor()?.getHTML() || '' }
    if (hasTopics) {
      saveShout(data)
    } else {
      saveDraft(data)
    }
  }

  const html = useEditorHTML(editor)

  const handleFixTypographyClick = () => {
    editor()?.commands.setContent(typograf.execute(html() || '')) // here too
    setIsTypographyFixed(true)
  }

  const counter = createEditorTransaction(editor, (e) => e?.storage.characterCount)

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
            <span class={styles.link} onClick={() => publishShout(form)}>
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
          {/* TODO: <Show when={coauthorsCount() > 0}> */}
          <p>
            <span class={styles.link} onClick={() => setIsCollabMode((x) => !x)}>
              {t('Collaborative mode')}
            </span>
          </p>
          {/*</Show> */}
          <p>
            <A
              class={styles.link}
              onClick={() => toggleEditorPanel()}
              href={`/edit/${props.shoutId}/settings`}
            >
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
            {t('Characters')}: <em>{counter()?.characters()}</em>
          </div>
          <div>
            {t('Words')}: <em>{counter()?.words()}</em>
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
