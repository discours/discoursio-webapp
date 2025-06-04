import { useNavigate } from '@solidjs/router'
import { For, Show, createEffect, createSignal, on, onMount } from 'solid-js'
import { toast } from 'solid-toast'
import { DraftCard } from '~/components/Draft'
import { Placeholder } from '~/components/Feed/Placeholder'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Draft } from '~/graphql/schema/core.gen'
import styles from '~/styles/views/DraftsView.module.scss'
import { Loading } from '../_shared/Loading'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication, session } = useSession()
  const { t } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts, removeLocalDraft, unpublishShout } = useDrafts()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = createSignal(true)
  // Сигнал для отслеживания текущего отображаемого черновика (локальный или серверный)
  const [activeVersions, setActiveVersions] = createSignal<Record<number, 'local' | 'server'>>({})

  const handleDraftDelete = async (d: Draft | ExtendedDraft) => {
    // Проверяем наличие ID у черновика
    if (!d.id) {
      console.error('[DraftsView] Попытка удалить черновик без ID:', d)
      toast.error(t('Cannot delete draft without ID'))
      return
    }

    // Проверяем, является ли черновик только локальным
    const isLocalOnly = 'isLocalOnly' in d && d.isLocalOnly === true

    // Для черновиков с локальной и серверной версией удаляем ту, которая активна
    const activeVersion = d.id ? activeVersions()[d.id] : undefined
    const shouldDeleteLocal = isLocalOnly || activeVersion === 'local'

    try {
      console.log(
        '[DraftsView] Удаление черновика:',
        d.id,
        shouldDeleteLocal ? '(локальная версия)' : '(серверная версия)',
        {
          title: d.title,
          isLocalOnly: isLocalOnly,
          activeVersion: activeVersion
        }
      )

      if (shouldDeleteLocal) {
        // Удаляем локальный черновик
        console.log('[DraftsView] Удаляем локальную версию черновика:', d.id)
        try {
          const result = removeLocalDraft(d.id)
          console.log('[DraftsView] Результат удаления локальной версии:', result)

          // Если была активна локальная версия и есть серверная, переключаемся на неё
          if (activeVersion === 'local' && !isLocalOnly) {
            setActiveVersionForDraft(d.id, 'server')
          }
        } catch (localError) {
          console.error('[DraftsView] Ошибка при удалении локальной версии:', localError)
          toast.error(t('Error deleting local draft'))
        }
      } else {
        // Удаляем черновик на сервере
        console.log('[DraftsView] Отправляем запрос на удаление серверной версии черновика:', d.id)
        try {
          const result = await deleteDraft(d.id)
          const success = result?.data?.delete_draft && !result?.data?.delete_draft.error

          console.log(
            '[DraftsView] Результат удаления серверной версии:',
            success ? 'Успешно' : 'Ошибка',
            result?.data?.delete_draft?.error || '',
            result?.error || ''
          )

          if (!success && result?.data?.delete_draft?.error) {
            toast.error(result.data.delete_draft.error || t('Error deleting draft'))
          }
        } catch (serverError) {
          console.error('[DraftsView] Ошибка при запросе на удаление серверной версии:', serverError)
          toast.error(t('Server error when deleting draft'))
        }
      }

      // Перезагружаем список после удаления
      console.log('[DraftsView] Перезагружаем список черновиков после удаления')
      await loadDrafts()
      console.log('[DraftsView] Список черновиков перезагружен после удаления')
    } catch (error) {
      console.error('[DraftsView] Общая ошибка при удалении черновика:', error)
      toast.error(t('Error deleting draft'))
    }
  }

  // Отслеживаем состояние черновиков
  createEffect(() => {
    const currentDrafts = drafts()
    console.log('[DraftsView] current drafts:', currentDrafts)
    console.log('[DraftsView] drafts breakdown:', {
      total: currentDrafts.length,
      withId: currentDrafts.filter((d) => d.id).length,
      withoutId: currentDrafts.filter((d) => !d.id).length,
      localOnly: currentDrafts.filter((d) => 'isLocalOnly' in d && d.isLocalOnly).length,
      serverOnly: currentDrafts.filter((d) => !('isLocalOnly' in d) || !d.isLocalOnly).length,
      uniqueIds: uniqueDraftIds().length
    })

    // Логируем детали каждого черновика
    currentDrafts.forEach((draft) => {
      console.log(`[DraftsView] Draft ${draft.id}:`, {
        title: draft.title,
        isLocalOnly: 'isLocalOnly' in draft ? draft.isLocalOnly : false,
        updated_at: draft.updated_at,
        activeVersion: draft.id ? activeVersions()[draft.id] || 'server' : 'local'
      })
    })
  })

  // Отслеживаем состояние загрузки
  createEffect(() => {
    console.log('[DraftsView] isLoading:', isLoading(), 'drafts count:', drafts()?.length || 0)
  })

  // Функция загрузки данных черновиков
  const loadData = async () => {
    setIsLoading(true)
    try {
      await loadDrafts()
      console.log('[DraftsView] drafts loaded, count:', drafts()?.length || 0)
    } catch (error) {
      console.error('[DraftsView] Error loading drafts:', error)
    } finally {
      setIsLoading(false)
      console.log(
        '[DraftsView] loading finished, isLoading:',
        false,
        'drafts count:',
        drafts()?.length || 0
      )
    }
  }

  // Загружаем черновики при монтировании и при изменении сессии
  createEffect(
    on(
      () => session()?.token,
      async (token: string | undefined, prevToken: string | undefined) => {
        console.log('[DraftsView] token changed:', { token: !!token, prevToken: !!prevToken })

        if (token) {
          console.log('[DraftsView] session is ready, loading drafts...')
          setIsLoading(true)
          try {
            await loadData()
          } catch (err) {
            console.error('[DraftsView] Failed to load drafts:', err)
            setIsLoading(false)
          }
        } else {
          console.log('[DraftsView] no session, requiring authentication...')
          setIsLoading(true)
          try {
            await requireAuthentication(() => {}, 'edit')
          } catch (err) {
            console.error('[DraftsView] Authentication failed:', err)
            setIsLoading(false)
          }
        }
      },
      {}
    )
  ) // Убираем defer чтобы эффект сработал сразу

  // Эффект для ограничения доступа только авторизованными пользователями
  onMount(() => {
    loadData()
    requireAuthentication(() => {}, 'edit')
  })

  /**
   * Проверяет, опубликован ли черновик
   * @param {Draft | ExtendedDraft} draft - Черновик для проверки
   * @return {boolean} true если черновик опубликован
   */
  const isDraftPublished = (draft: Draft | ExtendedDraft): boolean => {
    return !!(draft.publication?.published_at || ('published_at' in draft && draft.published_at))
  }

  const handleUnpublish = async (draft: Draft | ExtendedDraft) => {
    console.log('[DraftsView] Запрос на снятие с публикации черновика:', draft.id)

    // Проверяем, опубликован ли черновик
    if (!isDraftPublished(draft)) {
      console.warn('[DraftsView] Попытка снять с публикации неопубликованный черновик:', draft.id)
      toast.error(t('This draft is not currently published'), {
        style: { 'z-index': 10001 },
        position: 'bottom-center'
      })
      return
    }

    // Проверяем наличие ID
    if (!draft.id) {
      console.error('[DraftsView] Попытка снять с публикации черновик без ID')
      toast.error(t('Unable to unpublish: no draft ID'), {
        style: { 'z-index': 10001 },
        position: 'bottom-center'
      })
      return
    }

    try {
      console.log('[DraftsView] Отправляем запрос на снятие с публикации для черновика:', draft.id)
      const result = await unpublishShout(draft.id)
      console.log(
        '[DraftsView] Получен ответ на запрос снятия с публикации:',
        result?.data?.unpublish_shout ? 'Данные получены' : 'Данные отсутствуют'
      )

      if (result?.data?.unpublish_shout) {
        // Проверяем наличие ошибки в ответе
        if (result.data.unpublish_shout.error) {
          console.error('[DraftsView] Ошибка при снятии с публикации:', result.data.unpublish_shout.error)
          toast.error(result.data.unpublish_shout.error || t('Error unpublishing article'), {
            style: { 'z-index': 10001 },
            position: 'bottom-center'
          })
          return
        }

        console.log('[DraftsView] Черновик успешно снят с публикации:', draft.id)
        toast.success(t('Article unpublished successfully'), {
          style: { 'z-index': 10001 },
          position: 'bottom-center'
        })
        await loadDrafts()
        console.log('[DraftsView] Список черновиков перезагружен после снятия с публикации')
      } else {
        console.error('[DraftsView] Ошибка при снятии с публикации: ответ не содержит данных')
        toast.error(t('Error unpublishing article'), {
          style: { 'z-index': 10001 },
          position: 'bottom-center'
        })
      }
    } catch (error) {
      console.error('[DraftsView] Error unpublishing article:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'), {
        style: { 'z-index': 10001 },
        position: 'bottom-center'
      })
    }
  }

  /**
   * Находит и возвращает локальную версию черновика по ID серверного черновика
   * @param {Draft | ExtendedDraft} draft - Серверный черновик
   * @return {ExtendedDraft | undefined} Локальная версия черновика или undefined
   */
  const findLocalVersion = (draft: Draft | ExtendedDraft): ExtendedDraft | undefined => {
    if (!draft.id) return undefined

    // Ищем локальную версию среди всех черновиков
    return drafts().find((d) => 'isLocalOnly' in d && d.isLocalOnly === true && d.id === draft.id)
  }

  /**
   * Находит и возвращает серверную версию черновика по ID
   * @param {number} draftId - ID черновика
   * @return {ExtendedDraft | undefined} Серверная версия черновика или undefined
   */
  const findServerVersion = (draftId: number): ExtendedDraft | undefined => {
    // Ищем серверную версию среди всех черновиков
    return drafts().find((d) => d.id === draftId && (!('isLocalOnly' in d) || d.isLocalOnly !== true))
  }

  /**
   * Проверяет, есть ли рассинхронизация версий (существуют и локальная, и серверная версии)
   * @param {Draft | ExtendedDraft} draft - Черновик для проверки
   * @return {boolean} true если есть рассинхронизация версий
   */
  const hasVersionSynchronizationIssue = (draft: Draft | ExtendedDraft): boolean => {
    // Проверяем наличие обеих версий
    const localDraft = findLocalVersion(draft)
    const serverDraft = draft.id ? findServerVersion(draft.id) : undefined

    // Если нет одной из версий, то нет проблемы синхронизации
    if (!localDraft || !serverDraft) {
      return false
    }

    // Сравниваем временные метки обновления
    const localUpdatedAt = localDraft.updated_at || 0
    const serverUpdatedAt = serverDraft.updated_at || 0

    // Если метки отличаются на более чем 1 секунду, считаем что есть рассинхронизация
    // (небольшая погрешность нужна для учёта возможной неточности меток времени)
    const timeDifference = Math.abs(localUpdatedAt - serverUpdatedAt)
    const hasTimeDifference = timeDifference > 1000 // Разница больше 1 секунды

    // Убираем излишнее логирование
    return hasTimeDifference
  }

  /**
   * Устанавливает активную версию для указанного черновика
   * @param {number} draftId - ID черновика
   * @param {'local' | 'server'} version - Версия черновика
   */
  const setActiveVersionForDraft = (draftId: number, version: 'local' | 'server') => {
    // Принудительно обновляем состояние с новой ссылкой на объект, чтобы гарантировать перерисовку
    setActiveVersions((prev) => {
      const newState = { ...prev, [draftId]: version }
      console.log(`[DraftsView] Set active version for draft ${draftId} to ${version}`, newState)
      return newState
    })

    // Принудительно запускаем перерисовку списка после небольшой задержки
    setTimeout(() => {
      setActiveVersions((prev) => ({ ...prev }))
    }, 50)
  }

  /**
   * Возвращает текущую активную версию черновика
   * @param {Draft | ExtendedDraft} draft - Черновик
   * @return {'local' | 'server'} Активная версия
   */
  const getActiveVersion = (draft: Draft | ExtendedDraft): 'local' | 'server' => {
    if (!draft.id) return 'local' // Если нет ID, считаем локальным

    // Если черновик отмечен как isLocalOnly, то это однозначно локальная версия
    if ('isLocalOnly' in draft && draft.isLocalOnly === true) {
      return 'local'
    }

    // Иначе проверяем по сохраненному состоянию
    const version = activeVersions()[draft.id] || 'server'
    return version
  }

  /**
   * Обработчик переключения на локальную версию черновика
   * @param {Draft | ExtendedDraft} draft - Серверный черновик
   */
  const handleSwitchToLocalVersion = (draft: Draft | ExtendedDraft) => {
    if (!draft.id) return

    const localDraft = findLocalVersion(draft)
    if (!localDraft) {
      toast.error(t('Local version not found'), {
        style: { 'z-index': 10001 }
      })
      return
    }

    // Отмечаем, что для этого ID активна локальная версия
    setActiveVersionForDraft(draft.id, 'local')
    toast.success(t('Switched to local version'), {
      style: { 'z-index': 10001 }
    })
  }

  /**
   * Обработчик переключения на серверную версию черновика
   * @param {Draft | ExtendedDraft} draft - Локальный черновик
   */
  const handleSwitchToServerVersion = (draft: Draft | ExtendedDraft) => {
    if (!draft.id) return

    const serverDraft = findServerVersion(draft.id)
    if (!serverDraft) {
      toast.error(t('Server version not found'), {
        style: { 'z-index': 10001 }
      })
      return
    }

    // Отмечаем, что для этого ID активна серверная версия
    setActiveVersionForDraft(draft.id, 'server')
    toast.success(t('Switched to server version'), {
      style: { 'z-index': 10001 }
    })
  }

  /**
   * Обработчик публикации черновика с обработкой ошибок
   * @param {number} draftId - ID черновика
   */
  const handleDraftPublish = (draftId: number) => {
    console.log(`[DraftsView] Запрос на публикацию черновика #${draftId}`)

    // Находим черновик по ID
    const draft = drafts().find((d) => d.id === draftId)
    if (!draft) {
      console.error(`[DraftsView] Не найден черновик с ID ${draftId} для публикации`)
      toast.error(t('Draft not found'))
      return
    }

    // Проверяем наличие тем перед вызовом publishDraft
    if (!Array.isArray(draft.topics) || draft.topics.length === 0) {
      console.log(`[DraftsView] У черновика #${draftId} отсутствуют темы, перенаправляем на настройки`)
      // Просто перенаправляем на страницу настроек публикации
      // для добавления тем без показа сообщения об ошибке
      navigate(`/edit/${draftId}/settings`)
      return
    }

    // Если темы есть, пробуем опубликовать
    console.log(`[DraftsView] Вызываем publishDraft для черновика #${draftId}`)
    try {
      publishDraft(draftId)
        .then((result) => {
          console.log(
            `[DraftsView] Результат публикации для черновика #${draftId}:`,
            result?.data?.publish_draft ? 'Данные получены' : 'Данные отсутствуют'
          )

          if (result?.data?.publish_draft?.error) {
            console.error(`[DraftsView] Ошибка при публикации: ${result.data.publish_draft.error}`)
            toast.error(result.data.publish_draft.error || t('Publication error'))

            // При ошибке перенаправляем на страницу настроек
            navigate(`/edit/${draftId}/settings`)
          } else if (result?.data?.publish_draft?.draft) {
            console.log(`[DraftsView] Черновик #${draftId} успешно опубликован`)
            const publishedDraft = result.data.publish_draft.draft

            // Переходим на страницу опубликованной статьи
            if (publishedDraft.slug) {
              toast.success(t('Article published successfully'))
              navigate(`/${publishedDraft.slug}`)
            } else {
              console.warn(`[DraftsView] У опубликованного черновика #${draftId} отсутствует slug`)
              toast.success(t('Article published successfully'))
              // Обновляем список черновиков
              loadDrafts()
            }
          }
        })
        .catch((err) => {
          console.error(`[DraftsView] Ошибка при публикации черновика #${draftId}:`, err)
          toast.error(t('An error occurred during publication'))
          navigate(`/edit/${draftId}/settings`)
        })
    } catch (err) {
      console.error(`[DraftsView] Исключение при вызове publishDraft для черновика #${draftId}:`, err)
      toast.error(t('An error occurred during publication'))
      navigate(`/edit/${draftId}/settings`)
    }
  }

  /**
   * Отображает правильную карточку черновика в зависимости от активной версии
   * @param {Draft | ExtendedDraft} draft - Черновик (локальный или серверный)
   */
  const renderDraftCard = (draft: Draft | ExtendedDraft) => {
    console.log(`[DraftsView] renderDraftCard for draft ${draft.id}:`, {
      title: draft.title,
      hasId: !!draft.id,
      isLocalOnly: 'isLocalOnly' in draft ? draft.isLocalOnly : false
    })

    if (!draft.id) {
      // Для черновиков без ID отображаем как есть
      console.log(`[DraftsView] Rendering draft without ID: ${draft.title}`)
      return (
        <DraftCard
          draft={draft as ExtendedDraft}
          onDelete={() => handleDraftDelete(draft)}
          onUnpublish={() => handleUnpublish(draft)}
          onPublish={() => handleDraftPublish(draft.id)}
          onSwitchToLocal={undefined}
          onSwitchToServer={undefined}
        />
      )
    }

    // Определяем текущую активную версию для этого ID
    const activeVersion = getActiveVersion(draft)

    // Если текущий черновик не совпадает с активной версией, не отображаем его
    const isLocalDraft = 'isLocalOnly' in draft && draft.isLocalOnly === true
    if ((isLocalDraft && activeVersion !== 'local') || (!isLocalDraft && activeVersion !== 'server')) {
      console.log(`[DraftsView] Skipping draft ${draft.id} - version mismatch:`, {
        isLocalDraft,
        activeVersion,
        shouldShow: false
      })
      return null
    }

    console.log(`[DraftsView] Will render draft ${draft.id}:`, {
      title: draft.title,
      isLocalDraft,
      activeVersion
    })

    // Проверяем наличие рассинхронизации версий
    const hasSyncIssue = hasVersionSynchronizationIssue(draft)

    // Определяем, какие переключатели показывать, только если есть рассинхронизация
    const showSwitchToLocal = hasSyncIssue && !isLocalDraft
    const showSwitchToServer = hasSyncIssue && isLocalDraft

    return (
      <div class={styles.draftCardContainer}>
        <DraftCard
          draft={draft as ExtendedDraft}
          onDelete={() => handleDraftDelete(draft)}
          onUnpublish={() => handleUnpublish(draft)}
          onPublish={() => handleDraftPublish(draft.id)}
          onSwitchToLocal={showSwitchToLocal ? () => handleSwitchToLocalVersion(draft) : undefined}
          onSwitchToServer={showSwitchToServer ? () => handleSwitchToServerVersion(draft) : undefined}
          activeVersion={activeVersion}
        />
      </div>
    )
  }

  // Получаем уникальные ID черновиков, чтобы не дублировать карточки
  const uniqueDraftIds = () => {
    const ids = new Set<number>()
    drafts().forEach((draft) => {
      if (draft.id) {
        ids.add(draft.id)
      }
    })
    return Array.from(ids)
  }

  /**
   * Рендерит карточку черновика для конкретного ID
   * @param {number} draftId - ID черновика
   */
  const renderDraftById = (draftId: number) => {
    // Находим все черновики с этим ID
    const draftVersions = drafts().filter((d) => d.id === draftId)
    const serverVersion = draftVersions.find((d) => !('isLocalOnly' in d) || !d.isLocalOnly)
    const localVersion = draftVersions.find((d) => 'isLocalOnly' in d && d.isLocalOnly)

    // Определяем, какую версию показывать - используем getActiveVersion для первого найденного черновика
    const firstDraft = draftVersions[0]
    const activeVersion = firstDraft ? getActiveVersion(firstDraft) : 'server'
    const draftToShow = activeVersion === 'local' && localVersion ? localVersion : serverVersion

    console.log(`[DraftsView] renderDraftById ${draftId}:`, {
      versionsFound: draftVersions.length,
      hasServer: !!serverVersion,
      hasLocal: !!localVersion,
      activeVersion,
      willShow: !!draftToShow,
      draftToShowTitle: draftToShow?.title,
      firstDraftIsLocal: firstDraft ? 'isLocalOnly' in firstDraft && firstDraft.isLocalOnly : false
    })

    return draftToShow ? renderDraftCard(draftToShow) : null
  }

  // Используем uniqueDraftIds в рендеринге списка черновиков
  const renderDraftsList = () => {
    const uniqueIds = uniqueDraftIds()
    const draftsWithoutId = drafts().filter((d) => !d.id)

    console.log('[DraftsView] renderDraftsList:', {
      totalDrafts: drafts().length,
      uniqueIds: uniqueIds.length,
      draftsWithoutId: draftsWithoutId.length,
      uniqueIdsList: uniqueIds,
      draftsWithoutIdTitles: draftsWithoutId.map((d) => d.title)
    })

    return (
      <div class={styles.draftsList}>
        <For each={uniqueIds}>{(draftId) => renderDraftById(draftId)}</For>

        {/* Добавляем черновики без ID в конце */}
        <For each={draftsWithoutId}>{(draft) => renderDraftCard(draft)}</For>
      </div>
    )
  }

  return (
    <div class={styles.draftsView}>
      <div class="wide-container">
        <div class="row">
          <div class="col-md-14 col-lg-12 col-xl-10 offset-md-7">
            <div class={styles.draftsHeader}>
              <h2>{t('Drafts')}</h2>
            </div>

            <Show
              when={drafts()?.length > 0}
              fallback={
                <Show when={!isLoading()} fallback={<Loading />}>
                  <div class="row">
                    <div class="col-md-20 col-lg-18">
                      <Placeholder type="drafts" mode="profile" />
                    </div>
                  </div>
                </Show>
              }
            >
              {renderDraftsList()}
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
