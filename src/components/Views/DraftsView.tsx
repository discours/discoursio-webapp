import { useNavigate } from '@solidjs/router'
import { createEffect, createSignal, For, on, onMount, Show } from 'solid-js'
import { toast } from 'solid-toast'
import { DraftCard } from '~/components/Draft'
import { Placeholder } from '~/components/Feed/Placeholder'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalDrafts } from '~/context/localDrafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Draft } from '~/graphql/generated/graphql'
import styles from '~/styles/views/DraftsView.module.scss'
import { Loading } from '../_shared/Loading'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication, session, isSessionLoaded, isSessionValidating } = useSession()
  const { t } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts, unpublishShout } = useDrafts()
  const { removeLocalDraft, checkDraftExistsOnServer } = useLocalDrafts()
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

    try {
      const isLocalOnly = (d as ExtendedDraft).isLocalOnly === true
      console.log('[DraftsView] Удаление черновика:', d.id, {
        title: d.title,
        isLocalOnly,
        activeVersion: d.id ? activeVersions()[d.id] : undefined
      })

      if (isLocalOnly) {
        // Удаляем локальный черновик
        console.log('[DraftsView] Удаляем локальный черновик:', d.id)
        const success = removeLocalDraft(d.id)

        if (success) {
          console.log('[DraftsView] Локальный черновик успешно удален')
          toast.success(t('Draft successfully deleted'))
        } else {
          console.error('[DraftsView] Ошибка при удалении локального черновика')
          toast.error(t('Error deleting local draft'))
        }
        return
      }

      // Для серверных черновиков сначала проверяем существование на сервере
      console.log('[DraftsView] Проверяем существование черновика на сервере:', d.id)
      const existsOnServer = await checkDraftExistsOnServer(d.id)

      if (!existsOnServer) {
        console.log('[DraftsView] Черновик не существует на сервере, удаляем локально')
        const success = removeLocalDraft(d.id)

        if (success) {
          console.log('[DraftsView] Черновик успешно удален локально')
          toast.success(t('Draft successfully deleted'))
        } else {
          console.error('[DraftsView] Ошибка при локальном удалении')
          toast.error(t('Error deleting draft'))
        }
        return
      }

      // Черновик существует на сервере, удаляем через API
      console.log('[DraftsView] Отправляем запрос на удаление серверной версии черновика:', d.id)
      const result = await deleteDraft(d.id)
      const success = !!(result?.data?.delete_draft && !result?.data?.delete_draft.error && !result?.error)

      console.log('[DraftsView] Результат delete_draft:', success ? 'Успешно' : 'Ошибка', {
        graphQLError: result?.error?.message,
        apiError: result?.data?.delete_draft?.error
      })

      if (success) {
        // Успешно удалили с сервера
        console.log('[DraftsView] Серверный черновик успешно удален')
        toast.success(t('Draft successfully deleted'))

        // Перезагружаем список после удаления
        console.log('[DraftsView] Перезагружаем список черновиков после удаления')
        await loadDrafts()
        console.log('[DraftsView] Список черновиков перезагружен после удаления')
        return
      }

      // Если сервер вернул ошибку "черновик не существует",
      // пытаемся удалить локально как fallback
      const apiError = result?.data?.delete_draft?.error
      if (
        apiError &&
        (apiError.includes('не существует') || apiError.includes('not found') || apiError.includes('does not exist'))
      ) {
        console.log('[DraftsView] Сервер сообщает, что черновик не существует, удаляем локально как fallback')

        // Удаляем из локального состояния
        const success = removeLocalDraft(d.id)

        if (success) {
          console.log('[DraftsView] Черновик успешно удален локально (fallback)')
          toast.success(t('Draft successfully deleted'))
        } else {
          console.error('[DraftsView] Ошибка при локальном удалении (fallback)')
          toast.error(t('Error deleting draft'))
        }
        return
      }

      // Другие ошибки сервера
      toast.error(apiError || t('Error deleting draft'))
    } catch (error) {
      console.error('[DraftsView] Общая ошибка при удалении черновика:', error)

      // При сетевых ошибках пытаемся удалить локально как fallback
      if (
        error instanceof Error &&
        (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('timeout'))
      ) {
        console.log('[DraftsView] Сетевая ошибка, пытаемся удалить локально как fallback')
        const success = removeLocalDraft(d.id)

        if (success) {
          console.log('[DraftsView] Черновик успешно удален локально (fallback)')
          toast.success(t('Draft successfully deleted'))
        } else {
          toast.error(t('Error deleting draft'))
        }
        return
      }

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
      console.log('[DraftsView] loading finished, isLoading:', false, 'drafts count:', drafts()?.length || 0)
    }
  }

  // Загружаем черновики после полной загрузки сессии
  createEffect(
    on(
      [() => session()?.token, () => isSessionLoaded?.(), () => isSessionValidating?.()],
      async ([token, loaded, validating]) => {
        console.log('[DraftsView] session state:', { token: !!token, loaded, validating })
        if (!loaded || validating) return
        if (!token) {
          try {
            await requireAuthentication(() => {}, 'edit')
          } catch (err) {
            console.error('[DraftsView] Authentication failed:', err)
          }
          return
        }
        setIsLoading(true)
        try {
          await loadData()
        } catch (err) {
          console.error('[DraftsView] Failed to load drafts:', err)
        } finally {
          setIsLoading(false)
        }
      },
      { defer: true }
    )
  )

  // Эффект для ограничения доступа только авторизованными пользователями
  onMount(() => {
    // Ждём готовности сессии, чтобы не потерять логин на рефреше
    if (session()?.token && !isSessionValidating?.()) void loadData()
  })

  /**
   * Проверяет, опубликован ли черновик
   * @param {Draft | ExtendedDraft} draft - Черновик для проверки
   * @return {boolean} true если черновик опубликован
   */
  const isDraftPublished = (draft: Draft | ExtendedDraft): boolean => {
    return !!(draft.shout?.published_at || ('published_at' in draft && draft.published_at))
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
