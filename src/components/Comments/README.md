# Компоненты комментариев

## Структура и взаимодействие

### CommentCard
Отображает отдельный комментарий со всеми элементами управления.

**Ответственность:**
- Отображение контента комментария и метаданных
- Управление состоянием раскрытия/сворачивания
- Проверка прав на редактирование/удаление
- Загрузка и отображение оценок
- Обработка шаринга комментария

**Взаимодействие:**
- Делегирует логику редактирования/удаления/ответов в CommentsTree
- Использует RatingControl для оценок
- Использует CommentDate для форматирования даты
- Использует AuthorLink для отображения автора

### CommentsTree
Основной компонент управления комментариями.

**Ответственность:**
- Управление состоянием всех комментариев
- Логика создания/редактирования/удаления
- Построение дерева комментариев
- Хранение локальных черновиков через DraftsContext
- Пагинация и подгрузка комментариев

**Взаимодействие:**
- Использует CommentCard для отображения
- Использует CommentsHeader для фильтров и сортировки
- Интегрируется с SimpleRichEditor для редактирования
- Работает с ReactionsContext для API-операций

### CommentsHeader
Управление отображением списка комментариев.

**Ответственность:**
- Отображение количества комментариев
- Фильтрация новых комментариев
- Управление сортировкой
- Отображение статистики

**Взаимодействие:**
- Передает параметры фильтрации в CommentsTree
- Обновляет URL с параметрами сортировки

### CommentDate
Форматирование даты комментария.

**Ответственность:**
- Форматирование абсолютной/относительной даты
- Локализация форматов
- Обновление относительного времени

**Взаимодействие:**
- Используется в CommentCard
- Работает с LocalizeContext

### CommentsList
Упрощенный список комментариев для профиля автора.

**Ответственность:**
- Отображение плоского списка комментариев
- Пагинация комментариев автора
- Фильтрация по статьям

**Взаимодействие:**
- Использует CommentCard в упрощенном режиме
- Интегрируется с AuthorView

## Состояния и данные

### Локальное состояние
- Режимы редактирования/ответа
- Состояние раскрытия веток
- Черновики комментариев
- Кэш оценок

### Глобальное состояние
- Список комментариев (ReactionsContext)
- Авторизация (SessionContext)
- Черновики (DraftsContext)
- Локализация (LocalizeContext)

## Типы данных

### Основные интерфейсы

```typescript
/**
 * Свойства компонента дерева комментариев
 */
interface Props {
  articleAuthors: Author[]      // Авторы статьи для определения специальных меток
  shoutSlug: string            // Уникальный идентификатор статьи
  shoutId: number             // ID статьи
  onDeleteComment?: (id: number) => void  // Callback при удалении комментария
}

/**
 * Свойства компонента карточки комментария
 */
interface CommentCardProps {
  comment: Reaction            // Объект комментария для отображения
  compact?: boolean           // Флаг компактного отображения
  sortedComments?: Reaction[] // Отсортированный список комментариев
  lastSeen?: number          // Временная метка последнего просмотра
  class?: string             // Дополнительные CSS классы
  showArticleLink?: boolean  // Флаг отображения ссылки на статью
  myRate?: ReactionKind      // Оценка текущего пользователя
  onReply?: (id: number) => void  // Обработчик ответа
  clickedReplyId?: Accessor<number | undefined>  // ID комментария для ответа
  onDelete?: (id: number) => void  // Обработчик удаления
  onEdit?: (id: number) => void   // Обработчик редактирования
  children?: JSX.Element      // Дочерние элементы
  articleAuthors?: Author[]   // Авторы статьи
}

/**
 * Результаты API-запросов
 */
interface ApiResult {
  error?: string             // Текст ошибки
  reaction?: Reaction        // Объект реакции
}

interface CreateReactionResult {
  error?: string             // Текст ошибки
  reaction?: Reaction        // Созданная реакция
}
```

### Сигналы состояния

```typescript
// CommentsTree
const [onlyNew, setOnlyNew] = createSignal(false)              // Показ только новых
const [clickedReplyId, setClickedReplyId] = createSignal<number>()  // ID комментария для ответа
const [editingCommentId, setEditingCommentId] = createSignal<number>()  // ID редактируемого
const [posting, setPosting] = createSignal(false)              // Индикатор отправки
const [localContent, setLocalContent] = createSignal('')       // Контент редактора

// CommentCard
const [isExpanded, setExpanded] = createSignal(true)          // Развернут/свернут
const [commentsMyrates, setCommentsMyrates] = createSignal<Record<number, ReactionKind>>({})  // Оценки
```

### Мемоизированные значения

```typescript
// CommentsTree
const comments = createMemo(() => /* фильтрация комментариев */)
const sortedComments = createMemo(() => /* сортировка комментариев */)
const commentTree = createMemo(() => /* построение дерева */)

// CommentCard
const canEdit = createMemo(() => /* проверка прав на редактирование */)
const isNew = createMemo(() => /* проверка новизны комментария */)
const isAuthor = createMemo(() => /* проверка авторства */)
const isArticleAuthor = createMemo(() => /* проверка авторства статьи */)
```

## События и обработчики

### CommentCard
- `handleReply` - показать редактор в режиме ответа на комментарий
- `handleEdit` - показать редактор в режиме редактирования комментария
- `handleDelete` - удаление с подтверждением
- `handleShare` - показать шаринг комментария

### CommentsTree
- `handleSubmitComment` - создание/обновление комментария
- `handleClear` - очистка форм и черновиков
- `loadMoreComments` - подгрузка следующей страницы
- `handleReply` - обработка начала ответа
- `handleEdit` - обработка начала редактирования
- `handleDelete` - обработка удаления

## Форматы данных

### Черновики
```typescript
// Ключи черновиков
`draft-${shoutId}-comment-new`           // Новый комментарий
`draft-${shoutId}-comment-${replyId}`    // Ответ на комментарий
`draft-${shoutId}-comment-edit-${id}`    // Редактирование комментария
```

### URL параметры
```typescript
// Параметры в URL
commentId    // ID комментария для шаринга
```

## Стилизация

Компоненты используют CSS модули:
- `CommentsTree.module.scss` - Стили дерева и форм
- `CommentCard.module.scss` - Стили карточки и кнопок
- `CommentsHeader.module.scss` - Стили заголовка и фильтров

## Примеры использования

### Базовое использование

```tsx
// Простой список комментариев
<CommentsTree
  articleAuthors={authors}
  shoutSlug="article-slug"
  shoutId={123}
  onDeleteComment={(id) => console.log('Comment deleted:', id)}
/>

// Упрощенный список для профиля автора
<CommentsList
  comments={authorComments}
  showArticleLink={true}
  withFilter={false}
/>
```

### Работа с черновиками

```tsx
// Сохранение черновика
const { setEditorContent } = useDrafts()
setEditorContent(`draft-${shoutId}-comment-new`, content)

// Восстановление черновика
const { getEditorContent } = useDrafts()
const savedContent = getEditorContent(`draft-${shoutId}-comment-new`)

// Очистка черновиков
const handleClear = () => {
  setEditorContent(`draft-${shoutId}-comment-new`, '')
  setLocalContent('')
}
```

### Работа с оценками

```tsx
// Загрузка оценок для комментария
const [myRates, { refetch }] = useCommentsMyRates([commentId], client)

// Использование в компоненте
<RatingControl 
  comment={comment}
  myRate={myRates()?.[0]?.my_rate}
/>

// Обновление после действия
await refetch()
```

### Редактирование комментария

```tsx
// Начало редактирования
const handleEdit = (commentId: number) => {
  batch(() => {
    setEditingCommentId(commentId)
    setClickedReplyId(undefined)
    const content = commentToEdit.body || ''
    setLocalContent(content)
    setEditorContent(`draft-${shoutId}-comment-edit-${commentId}`, content)
  })
}

// Сохранение изменений
const handleSubmit = async () => {
  const result = await updateShoutReaction({
    reaction: {
      id: commentId,
      body: sanitizedContent,
      kind: ReactionKind.Comment,
      shout: shoutId
    }
  })
  
  if (result.error) {
    showSnackbar({ type: 'error', body: t(result.error) })
    return
  }
  
  handleClear()
  await refetch()
}
```

### Ответ на комментарий

```tsx
// Начало ответа
const handleReply = (commentId: number) => {
  batch(() => {
    setClickedReplyId(commentId)
    setEditingCommentId(undefined)
    setLocalContent('')
    setEditorContent(`draft-${shoutId}-comment-${commentId}`, '')
  })
}

// Отправка ответа
const handleSubmit = async (parentId: number) => {
  const result = await createShoutReaction({
    reaction: {
      body: sanitizedContent,
      kind: ReactionKind.Comment,
      shout: shoutId,
      reply_to: parentId
    }
  })
  
  if (result.error) {
    showSnackbar({ type: 'error', body: t(result.error) })
    return
  }
  
  handleClear()
  await refetch()
}
```

### Обработка ошибок

```tsx
try {
  const result = await someApiCall()
  if (result?.error) {
    showSnackbar({ type: 'error', body: t(result.error) })
    return
  }
  
  // Успешное выполнение
  showSnackbar({ type: 'success', body: t('Operation successful') })
  await refetch()
} catch (error) {
  console.error('[Component] Operation error:', error)
  showSnackbar({ type: 'error', body: t('Operation failed') })
}
```

### Оптимизация производительности

```tsx
// Мемоизация вычисляемых значений
const canEdit = createMemo(() => {
  const currentAuthor = session()?.user?.app_data?.profile
  return Boolean(currentAuthor?.id) && comment.created_by?.slug === currentAuthor?.slug
})

// Атомарное обновление состояний
batch(() => {
  setEditingCommentId(undefined)
  setClickedReplyId(undefined)
  setLocalContent('')
})

// Предотвращение лишних обновлений
untrack(() => {
  setEditorContent(draftKey, content)
})

// Условный рендеринг
<Show when={canEdit()}>
  <EditButton onClick={handleEdit} />
</Show>
```

### Интеграция с контекстами

```tsx
// Использование всех необходимых контекстов
const { session } = useSession()
const { t } = useLocalize()
const { getEditorContent, setEditorContent } = useDrafts()
const { showModal, showConfirm, showSnackbar } = useUI()
const { 
  reactionEntities,
  createShoutReaction,
  updateShoutReaction,
  deleteShoutReaction
} = useReactions()

// Пример использования в компоненте
const handleDelete = async () => {
  const confirmed = await showConfirm({
    confirmBody: t('Are you sure?')
  })
  
  if (!confirmed) return
  
  const result = await deleteShoutReaction(id)
  if (result.error) {
    showSnackbar({ type: 'error', body: t(result.error) })
    return
  }
  
  showSnackbar({ type: 'success', body: t('Deleted') })
}
```

## Контексты и хуки

### Используемые контексты
```typescript
// Управление реакциями
const { 
  reactionEntities,          // Хранилище всех реакций
  createShoutReaction,       // Создание новой реакции
  updateShoutReaction,       // Обновление реакции
  loadReactionsBy,          // Загрузка реакций по параметрам
  addShoutReactions,        // Добавление реакций в хранилище
  deleteShoutReaction       // Удаление реакции
} = useReactions()

// Управление черновиками
const { 
  getEditorContent,         // Получение контента черновика
  setEditorContent          // Сохранение черновика
} = useDrafts()

// Управление сессией
const { 
  session,                  // Данные текущей сессии
  client                    // GraphQL клиент
} = useSession()

// Локализация
const { t } = useLocalize()

// UI компоненты
const { 
  showModal,               // Показ модального окна
  showConfirm,            // Показ диалога подтверждения
  showSnackbar            // Показ уведомления
} = useUI()
```

## Обработка ошибок

### Валидация
- Проверка пустого контента комментария
- Проверка прав на редактирование/удаление
- Валидация типов данных через TypeScript

### Граничные случаи
- Отсутствие комментария при редактировании
- Отсутствие прав на действие
- Ошибки загрузки данных
- Потеря соединения

## Оптимизация

### Мемоизация
- Использование createMemo для вычисляемых значений
- Кэширование оценок комментариев
- Отложенная загрузка через createResource

### Предотвращение перерисовок
- Использование untrack для независимых операций
- Условный рендеринг через Show
- Оптимизация списков через For

## Тестирование

### Unit тесты
- Проверка валидации комментариев
- Проверка прав доступа
- Тестирование форматирования дат

### Интеграционные тесты
- Создание/редактирование/удаление комментариев
- Работа с черновиками
- Пагинация и сортировка

### E2E тесты
- Полный цикл работы с комментариями
- Проверка уведомлений
- Проверка навигации

