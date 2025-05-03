import { clsx } from 'clsx'
import { For, Show, batch, createEffect, createSignal, on, untrack } from 'solid-js'
import toast from 'solid-toast'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/schema/core.gen'

import styles from './TopicPillsCloud.module.scss'

/**
 * Компонент отображения тем в виде кликабельного облака тегов
 *
 * @param props - Свойства компонента
 * @param props.topics - Полный список тем
 * @param props.selectedTopics - Список выбранных тем
 * @param props.onChange - Функция обратного вызова при изменении выбора тем
 * @param props.mainTopic - Главная тема
 * @param props.onMainTopicChange - Функция обратного вызова при изменении главной темы
 * @returns JSX компонент облака тегов
 *
 * @example
 * ```tsx
 * <TopicPillsCloud
 *   topics={topics}
 *   selectedTopics={selectedTopics}
 *   onChange={handleTopicChange}
 *   mainTopic={mainTopic}
 *   onMainTopicChange={handleMainTopicChange}
 * />
 * ```
 */
type TopicPillsCloudProps = {
  topics: Topic[]
  selectedTopics: Topic[]
  onChange: (selectedTopics: Topic[]) => void
  mainTopic?: Topic
  onMainTopicChange: (mainTopic: Topic) => void
}

export const TopicPillsCloud = (props: TopicPillsCloudProps) => {
  const { t } = useLocalize()
  const { sortedTopics, topicsByShouts, isLoading: topicsLoading } = useTopics()
  const [searchTerm, setSearchTerm] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [popularTopics, setPopularTopics] = createSignal<Topic[]>([])
  const [selectedTopicIds, setSelectedTopicIds] = createSignal<Set<number>>(new Set())
  const [localSelectedTopics, setLocalSelectedTopics] = createSignal<Topic[]>([])
  const [isAddingTopic, setIsAddingTopic] = createSignal(false)
  // Флаг для предотвращения циклических обновлений
  const [isProcessing, setIsProcessing] = createSignal(false)

  // При монтировании загружаем популярные темы
  createEffect(() => {
    if (props.topics && props.topics.length > 0) {
      // Проверяем, есть ли темы в контексте
      const shoutTopics = topicsByShouts()

      // Если есть популярные темы по публикациям, берем их
      if (shoutTopics && shoutTopics.length > 0) {
        console.log('[TopicPillsCloud] Использую популярные темы из контекста:', shoutTopics.length)
        // Берем 20 самых популярных тем по публикациям
        const popular = shoutTopics.slice(0, 20)
        setPopularTopics(popular)
        setIsLoading(false)
      } else {
        // Иначе используем переданные в компонент темы
        console.log(
          '[TopicPillsCloud] Нет популярных тем в контексте, использую переданные:',
          props.topics.length
        )
        // Если у тем есть статистика, сортируем по количеству публикаций
        const sortedByPublications = [...props.topics]
          .sort((a, b) => {
            const aShouts = a?.stat?.shouts || 0
            const bShouts = b?.stat?.shouts || 0
            return bShouts - aShouts
          })
          .slice(0, 20)

        setPopularTopics(sortedByPublications)
        setIsLoading(false)
      }
    } else {
      // Если нет тем в props, отображаем состояние загрузки
      setIsLoading(topicsLoading())
    }
  })

  // Обновляем список выбранных тем при изменении props
  createEffect(() => {
    // Избегаем обновления, если в данный момент идет обработка изменений
    if (isProcessing()) {
      console.log(
        '[TopicPillsCloud] Пропускаем обновление выбранных тем из props, т.к. isProcessing = true'
      )
      return
    }

    const topics = props.selectedTopics || []
    console.log('[TopicPillsCloud] Получены selectedTopics из props:', topics)

    // Проверяем, изменились ли выбранные темы
    const currentTopicIds = new Set(localSelectedTopics().map((t) => t.id))
    const newTopicIds = new Set(topics.map((t) => t.id))

    // Если идентификаторы тем совпадают (без учета порядка), пропускаем обновление
    const areEqual =
      currentTopicIds.size === newTopicIds.size && [...currentTopicIds].every((id) => newTopicIds.has(id))

    if (areEqual && localSelectedTopics().length > 0) {
      console.log('[TopicPillsCloud] Пропускаем обновление, т.к. списки тем идентичны')
      return
    }

    // Копируем темы, чтобы избежать мутации исходных данных
    const topicsCopy = JSON.parse(JSON.stringify(topics)) as Topic[]
    setLocalSelectedTopics(topicsCopy)

    const newSelectedIds = new Set(topics.map((topic) => topic.id))
    setSelectedTopicIds(newSelectedIds)

    console.log(
      '[TopicPillsCloud] Обновлены selectedTopics локально:',
      topicsCopy,
      'mainTopic:',
      props.mainTopic
    )
  })

  // Обеспечиваем наличие главной темы, если есть выбранные темы
  createEffect(() => {
    // Избегаем обновления, если в данный момент идет обработка изменений
    if (isProcessing()) {
      console.log('[TopicPillsCloud] Пропускаем проверку главной темы, т.к. isProcessing = true')
      return
    }

    const topics = localSelectedTopics()
    // Используем untrack для чтения mainTopic, чтобы избежать циклической зависимости
    const mainTopic = untrack(() => props.mainTopic)

    console.log('[TopicPillsCloud] Проверка согласованности тем и главной темы:', {
      topicsCount: topics.length,
      hasMainTopic: !!mainTopic?.id,
      mainTopicId: mainTopic?.id
    })

    // Если есть выбранные темы, но нет главной темы, назначаем первую выбранную главной
    if (topics.length > 0 && (!mainTopic || mainTopic.id === -1)) {
      console.log('[TopicPillsCloud] Нет главной темы, устанавливаем первую тему главной:', topics[0].id)
      // Используем безопасный вызов для обновления главной темы
      safeCallMainTopicChange(topics[0])
    } else if (topics.length === 0 && mainTopic && mainTopic.id !== -1) {
      // Если нет выбранных тем, но есть главная тема (некорректное состояние)
      console.log('[TopicPillsCloud] Нет выбранных тем, но есть главная тема - несогласованное состояние')
      // Используем defer:true через on(()=>{}) для разрыва цикла обновлений
      on(
        // biome-ignore lint/suspicious/noEmptyBlockStatements: test
        () => {},
        () => {
          console.log('[TopicPillsCloud] Отложенное исправление несогласованного состояния')
          // Мы НЕ вызываем callback, так как это создаст циклические обновления
          // Вместо этого добавляем главную тему в список выбранных локально
          if (mainTopic && mainTopic.id > 0) {
            batch(() => {
              setLocalSelectedTopics([mainTopic])
              setSelectedTopicIds(new Set([mainTopic.id]))
            })
          }
        },
        { defer: true }
      )()
    }
  })

  /**
   * Безопасно вызывает функцию обратного вызова для обновления главной темы
   * с защитой от циклической рекурсии
   *
   * @param topic - Тема, которую нужно установить главной
   */
  const safeCallMainTopicChange = (topic: Topic) => {
    // Блокируем множественные вызовы
    if (isProcessing()) return

    // Проверяем валидность темы перед обновлением
    if (!topic || !topic.id) {
      console.error('[TopicPillsCloud] Попытка установить невалидную главную тему:', topic)
      return
    }

    // Проверяем, существует ли тема в списке доступных
    const availableTopics = props.topics || []
    const topicExists = availableTopics.some((t) => t.id === topic.id)

    // Если не найдена в доступных, проверяем в контексте
    let enrichedTopic = topic
    if (topicExists) {
      // Если тема существует в доступных, берем полную информацию оттуда
      enrichedTopic = availableTopics.find((t) => t.id === topic.id) || topic
    } else {
      const contextTopic = sortedTopics().find((t) => t.id === topic.id)
      if (contextTopic) {
        console.log(`[TopicPillsCloud] Главная тема с ID ${topic.id} найдена в контексте`)
        enrichedTopic = contextTopic
      } else {
        console.warn(
          `[TopicPillsCloud] Главная тема с ID ${topic.id} не найдена ни в доступных темах, ни в контексте`
        )
      }
    }

    setIsProcessing(true)
    console.log('[TopicPillsCloud] Безопасное обновление главной темы:', enrichedTopic.id)

    setTimeout(() => {
      props.onMainTopicChange(enrichedTopic)
      // Снимаем блокировку после задержки
      setTimeout(() => {
        setIsProcessing(false)
      }, 50)
    }, 0)
  }

  /**
   * Безопасно вызывает функцию обратного вызова для обновления списка выбранных тем
   * с защитой от циклической рекурсии
   *
   * @param topics - Новый список выбранных тем
   */
  const safeCallTopicsChange = (topics: Topic[]) => {
    // Блокируем множественные вызовы
    if (isProcessing()) {
      console.log('[TopicPillsCloud] safeCallTopicsChange: пропускаем вызов, т.к. isProcessing = true')
      return
    }

    // Проверяем валидность массива тем
    if (!topics || !Array.isArray(topics)) {
      console.error('[TopicPillsCloud] Попытка установить невалидный список тем:', topics)
      return
    }

    // Фильтруем темы, чтобы убедиться, что все элементы валидны
    const validTopics = topics.filter((topic) => topic?.id)

    if (validTopics.length === 0) {
      console.warn('[TopicPillsCloud] Попытка установить пустой список тем')
    }

    // Сделаем глубокую копию тем для защиты от мутаций
    const topicsCopy = JSON.parse(JSON.stringify(validTopics)) as Topic[]

    // Дополнительная проверка тем на существование в списке доступных тем
    const availableTopics = props.topics || []
    const availableTopicIds = new Set(availableTopics.map((t) => t.id))

    // Попытка обогатить данные тем из контекста
    const enrichedTopics = topicsCopy.map((topic) => {
      // Если тема существует в доступных, берем полную информацию оттуда
      const availableTopic = availableTopics.find((t) => t.id === topic.id)
      if (availableTopic) {
        return { ...availableTopic } // Создаем копию для безопасности
      }

      // Если темы нет в доступных, но она есть в контексте, берем из контекста
      const contextTopic = sortedTopics().find((t) => t.id === topic.id)
      if (contextTopic) {
        console.log(`[TopicPillsCloud] Тема с ID ${topic.id} найдена в контексте:`, contextTopic)
        return { ...contextTopic } // Создаем копию для безопасности
      }

      // Если нигде не нашли, возвращаем исходную тему
      return { ...topic } // Создаем копию для безопасности
    })

    // Фильтруем темы, чтобы оставить только существующие в доступных или контексте
    const existingTopics = enrichedTopics.filter(
      (topic) => availableTopicIds.has(topic.id) || sortedTopics().find((t) => t.id === topic.id) !== null
    )

    if (existingTopics.length !== validTopics.length) {
      console.warn(
        `[TopicPillsCloud] Некоторые темы не найдены. Отфильтровано ${validTopics.length - existingTopics.length} тем`,
        validTopics.map((t) => t.id).filter((id) => !existingTopics.some((et) => et.id === id))
      )
    }

    // Убедимся, что у всех тем есть минимально необходимые свойства
    const safeTopics = existingTopics.map((topic) => ({
      ...topic,
      title: topic.title || `Тема ${topic.id}` // Гарантируем наличие заголовка
    }))

    setIsProcessing(true)
    console.log('[TopicPillsCloud] Безопасное обновление списка тем:', safeTopics.length, safeTopics)

    // Используем микрозадачу для защиты от циклических обновлений
    Promise.resolve().then(() => {
      try {
        props.onChange(safeTopics)

        // Обновляем локальное состояние после вызова колбэка,
        // чтобы оно соответствовало тому, что было передано родителю
        batch(() => {
          setLocalSelectedTopics(safeTopics)
          setSelectedTopicIds(new Set(safeTopics.map((t) => t.id)))
        })

        console.log('[TopicPillsCloud] Колбэк onChange выполнен успешно')
      } catch (error) {
        console.error('[TopicPillsCloud] Ошибка в колбэке onChange:', error)
      } finally {
        // Снимаем блокировку после задержки
        setTimeout(() => {
          setIsProcessing(false)
          console.log('[TopicPillsCloud] isProcessing сброшен в false')
        }, 50)
      }
    })
  }

  const handleToggleTopic = (topic: Topic, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Логируем начало процесса добавления/удаления темы
    console.log('[TopicPillsCloud] Попытка добавить/удалить тему:', topic?.id, topic?.title)

    // Блокируем множественные клики
    if (isAddingTopic() || isProcessing()) {
      console.log(
        '[TopicPillsCloud] Действие заблокировано: isAddingTopic =',
        isAddingTopic(),
        'isProcessing =',
        isProcessing()
      )
      return
    }

    // Проверяем валидность темы
    if (!topic || !topic.id) {
      console.error('[TopicPillsCloud] Попытка переключить невалидную тему:', topic)
      return
    }

    // Делаем копию темы, чтобы избежать проблем с обновлением ссылок
    const topicCopy = { ...topic }

    // Дополнительная проверка на существование темы в списке доступных тем
    const topicExists = props.topics.some((t) => t.id === topicCopy.id)
    if (!topicExists && !selectedTopicIds().has(topicCopy.id)) {
      console.error(`[TopicPillsCloud] Тема с ID ${topicCopy.id} не найдена в списке доступных тем`)
      toast.error(t('Topic not found'), { duration: 1500 })
      return
    }

    setIsAddingTopic(true)
    console.log('[TopicPillsCloud] isAddingTopic установлен в true')

    // Очищаем поле поиска при клике на таблетку
    setSearchTerm('')

    try {
      const isSelected = selectedTopicIds().has(topicCopy.id)
      console.log('[TopicPillsCloud] Тема уже выбрана?', isSelected, 'ID:', topicCopy.id)

      let newSelectedTopics: Topic[]

      if (isSelected) {
        // Удаляем тему
        newSelectedTopics = localSelectedTopics().filter((t) => t.id !== topicCopy.id)
        console.log('[TopicPillsCloud] Удаление темы, новое количество тем:', newSelectedTopics.length)
        toast.success(t('Topic removed'), { duration: 1500 })
      } else {
        // Добавляем тему
        newSelectedTopics = [...localSelectedTopics(), topicCopy]
        console.log(
          '[TopicPillsCloud] Добавление темы, новое количество тем:',
          newSelectedTopics.length,
          'добавлена тема:',
          topicCopy
        )
        toast.success(t('Topic added'), { duration: 1500 })
      }

      // Замораживаем новый список выбранных тем, чтобы избежать изменений по ссылке
      const frozenNewSelectedTopics = JSON.parse(JSON.stringify(newSelectedTopics)) as Topic[]

      // Обновляем локальное состояние сразу для мгновенного отклика интерфейса
      batch(() => {
        setLocalSelectedTopics(frozenNewSelectedTopics)
        const newSet = new Set(frozenNewSelectedTopics.map((t) => t.id))
        console.log('[TopicPillsCloud] Установка выбранных ID:', Array.from(newSet))
        setSelectedTopicIds(newSet)
      })

      console.log(
        '[TopicPillsCloud] Локальное состояние обновлено, вызов колбэка с темами:',
        frozenNewSelectedTopics
      )

      // Сохраняем информацию о темах в черновике через колбэк onChange
      // Используем защищенный метод для предотвращения рекурсии
      safeCallTopicsChange(frozenNewSelectedTopics)

      // Проверка на необходимость обновления главной темы
      if (frozenNewSelectedTopics.length === 1 && !isSelected) {
        // Если это первая тема, делаем её главной
        console.log('[TopicPillsCloud] Автоматическая установка главной темы:', topicCopy.id)
        safeCallMainTopicChange(topicCopy)
      } else if (
        isSelected &&
        props.mainTopic &&
        topicCopy.id === props.mainTopic.id &&
        frozenNewSelectedTopics.length > 0
      ) {
        // Если удалили главную тему, но есть другие - назначаем первую из оставшихся главной
        console.log('[TopicPillsCloud] Смена главной темы после удаления:', frozenNewSelectedTopics[0].id)
        safeCallMainTopicChange(frozenNewSelectedTopics[0])
      } else if (frozenNewSelectedTopics.length === 0) {
        // Если удалили последнюю тему, сбрасываем главную тему в родительском компоненте
        console.log('[TopicPillsCloud] Нет тем, сброс главной темы')
        // Здесь намеренно не вызываем onMainTopicChange, чтобы избежать ошибок валидации при публикации
      }

      // Убеждаемся, что тема отображается в правильной секции
      setTimeout(() => {
        console.log('[TopicPillsCloud] Разблокировка isAddingTopic через 100ms')
        setIsAddingTopic(false)
      }, 100)
    } catch (error) {
      console.error('[TopicPillsCloud] Error toggling topic:', error)
      setIsAddingTopic(false)
      setIsProcessing(false)
    }
  }

  const handleMainTopicChange = (topic: Topic, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Блокируем действие на уже выбранной главной теме и во время обработки других изменений
    if (isMainTopic(topic) || isProcessing()) return

    // Используем безопасный метод для обновления главной темы
    safeCallMainTopicChange(topic)
    console.log('[TopicPillsCloud] Changed main_topic_id:', topic.id)
    toast.success(t('Main topic changed'), { duration: 1500 })
  }

  const handleSearch = (event: InputEvent) => {
    const value = (event.currentTarget as HTMLInputElement).value
    setSearchTerm(value)
  }

  const filteredTopics = () => {
    const search = searchTerm().toLowerCase().trim()
    const selectedIds = selectedTopicIds()

    // Основной список тем для фильтрации - популярные или все
    const topicsToFilter = search ? props.topics : popularTopics()

    // Проверяем, что у нас есть темы для отображения
    if (!topicsToFilter || topicsToFilter.length === 0) {
      return []
    }

    // Фильтруем темы, исключая уже выбранные
    return topicsToFilter.filter((topic: Topic) => {
      // Пропускаем темы без названия
      if (!topic?.title) return false

      // Проверяем, что тема ещё не выбрана
      if (selectedIds.has(topic.id)) return false

      // Если есть поисковый запрос, проверяем соответствие
      return !search || topic.title.toLowerCase().includes(search)
    })
  }

  const isMainTopic = (topic: Topic) => {
    if (!props.mainTopic || !topic) return false

    // Явно приводим к числовому типу для корректного сравнения
    const mainTopicId = Number(props.mainTopic.id)
    const topicId = Number(topic.id)

    return mainTopicId === topicId
  }

  return (
    <div class={styles.TopicPillsCloud}>
      {/* Единый блок для поля ввода и выбранных тем */}
      <div class={styles.searchAndTopicsContainer}>
        <div class={styles.searchInputWithTagsContainer}>
          {/* Поле ввода с таблетками внутри */}
          <div class={styles.inputContainer}>
            <input
              type="text"
              placeholder={t('Search topics')}
              class={styles.searchInput}
              value={searchTerm()}
              onInput={handleSearch}
            />

            {/* Выбранные темы внутри поля ввода справа */}
            <div class={styles.selectedTopicsInline}>
              <For each={localSelectedTopics()}>
                {(topic) => (
                  <div
                    class={clsx(styles.selectedTopic, {
                      [styles.mainTopic]: isMainTopic(topic)
                    })}
                    onClick={(e) => handleMainTopicChange(topic, e)}
                    title={isMainTopic(topic) ? t('Main topic') : t('Click to set as main topic')}
                  >
                    <Show when={isMainTopic(topic)}>
                      <Icon name="star" class={styles.mainTopicIcon} />
                    </Show>
                    <span class={styles.topicTitle}>{topic.title}</span>
                    <span
                      class={styles.removeTopicBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleTopic(topic, e)
                      }}
                      title={t('Remove topic')}
                    >
                      ×
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
        <hr />
        <div class={styles.topicCloud}>
          <Show
            when={!isLoading() && filteredTopics().length > 0}
            fallback={
              <div class={styles.emptyState}>
                {isLoading()
                  ? t('Loading topics...')
                  : searchTerm()
                    ? t('No topics found matching "{0}"', searchTerm())
                    : t('No topics available. Try adding some topics first.')}
              </div>
            }
          >
            <For each={filteredTopics()}>
              {(topic) => (
                <div
                  class={clsx(styles.topicPill, {
                    [styles.disabled]: isAddingTopic() || isProcessing()
                  })}
                  onClick={(e) => handleToggleTopic(topic, e)}
                  title={t('Add topic')}
                >
                  {topic.title}
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
