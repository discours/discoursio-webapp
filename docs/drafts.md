# Работа с черновиками

Черновики в Discours.io - это центральный элемент процесса создания контента. Система обеспечивает надежное сохранение, редактирование и публикацию черновиков с поддержкой как онлайн, так и оффлайн режимов работы.

## Структура черновиков

Черновик представлен в системе двумя связанными компонентами:

1. **Серверный черновик** - хранится в базе данных PostgreSQL и содержит основную информацию.
2. **Локальный черновик** - копия, хранящаяся в localStorage браузера для оффлайн-работы.

### Основные поля черновика (`Draft` и `ExtendedDraft`)

```typescript
interface ExtendedDraft extends Draft {
  isLocalOnly?: boolean        // Флаг локального черновика  
  localId?: string            // ID для локального черновика
  hasPublishedVersion?: boolean // Флаг наличия публикации
  published_at?: number | null // Временная метка публикации
  mainTopic?: Topic | null    // Главная тема статьи
  authors: Draft['authors']   // Авторы черновика
  localVersionId?: number
  serverVersionId?: number
}
```

## Контекст черновиков (DraftsProvider)

Весь функционал работы с черновиками инкапсулирован в контексте `DraftsProvider`. Доступ к API черновиков осуществляется через хук `useDrafts()`.

```tsx
const {
  drafts,               // Список черновиков
  currentDraft,         // Текущий черновик
  updateDraftField,     // Обновление поля черновика
  publishDraft,         // Публикация черновика
  // ... другие методы
} = useDrafts();
```

## Основные операции с черновиками

### Создание черновика

```tsx
const { createDraft } = useDrafts();

// Создание нового черновика
const draftInput: DraftInput = {
  title: 'Заголовок черновика',
  layout: 'article',
  // ... другие поля
};

const result = await createDraft(draftInput);
```

### Обновление полей черновика

```tsx
const { updateDraftField } = useDrafts();

// Обновление одного поля
updateDraftField(draftId, 'title', 'Новый заголовок', false);

// Обновление массива тем
const topics = [{ id: 1, title: 'Тема' }];
updateDraftField(draftId, 'topics', JSON.stringify(topics), false);
```

### Публикация черновика

```tsx
const { publishDraft } = useDrafts();

try {
  // Публикация черновика по ID
  const result = await publishDraft(draftId);
  
  if (result?.data?.publish_draft?.error) {
    // Обработка ошибки
  } else if (result?.data?.publish_draft?.draft) {
    // Успешная публикация
    navigate(`/${result.data.publish_draft.draft.slug}`);
  }
} catch (error) {
  // Обработка исключения
}
```

## Особенности публикации черновиков

Перед публикацией черновика система проводит ряд проверок:

1. **Проверка наличия тем** - для публикации требуется хотя бы одна тема (категория)
2. **Валидация полей** - проверка заголовка, автора, тела и других обязательных полей
3. **Синхронизация** - если есть локальные изменения, они синхронизируются с сервером

Если черновик не проходит валидацию, пользователь перенаправляется на страницу настроек публикации, где может исправить ошибки.

## Синхронизация и оффлайн режим

Система поддерживает автоматическую синхронизацию между локальными и серверными версиями черновиков:

1. **Автоматическое сохранение** - изменения сохраняются в localStorage с задержкой (debounce)
2. **Переключение версий** - возможность переключаться между локальной и серверной версиями
3. **Разрешение конфликтов** - механизмы определения более новой версии по timestamp

```tsx
// Переключение на локальную версию
const handleSwitchToLocalVersion = (draft) => {
  if (draft.id) {
    setActiveVersionForDraft(draft.id, 'local');
  }
};

// Переключение на серверную версию
const handleSwitchToServerVersion = (draft) => {
  if (draft.id) {
    setActiveVersionForDraft(draft.id, 'server');
  }
};
```

## Преобразование тем при публикации

Важной частью процесса публикации является корректное преобразование объектов тем в их идентификаторы:

```tsx
/**
 * Преобразует список тем-объектов в массив их идентификаторов для DraftInput
 *
 * @param {Array<Partial<Topic> | null | undefined>} topics - Массив объектов тем
 * @returns {number[]} Массив идентификаторов тем
 */
export const topicsToTopicIds = (topics?: Array<Partial<Topic> | null | undefined> | null): number[] => {
  if (!Array.isArray(topics)) return [];
  return topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id);
}
```

## Обработка ошибок

Система включает комплексную обработку ошибок:

1. **Валидация перед отправкой** - проверка на клиенте перед отправкой на сервер
2. **Обработка серверных ошибок** - информативные сообщения пользователю
3. **Логирование** - подробное логирование действий для диагностики проблем

```tsx
// Пример валидации черновика перед публикацией
const validateCurrentDraft = async (): Promise<boolean> => {
  const draft = currentDraft();
  if (!draft) return false;
  
  // Создание объекта для валидации
  const draftInput: DraftInput = {
    // ... поля из черновика
  };
  
  const validationResult = validateDraftForPublishing(draftInput);
  
  if (!validationResult.isValid) {
    // Обработка ошибок валидации
    setValidationErrors(errorsMap);
    return false;
  }
  
  return true;
};
```

## Компоненты пользовательского интерфейса

Основные компоненты для работы с черновиками:

1. **DraftCard** - карточка черновика в списке
2. **PublishSettings** - компонент настроек публикации
3. **PublishButton** - кнопка публикации в заголовке
4. **DraftsView** - представление списка черновиков

## Рекомендации по использованию

1. **Всегда используйте контекст** - Обращайтесь к черновикам только через `useDrafts()`
2. **Проверяйте наличие тем** - Перед публикацией убедитесь, что выбрана хотя бы одна тема
3. **Обрабатывайте ошибки** - Всегда обрабатывайте возможные ошибки и предоставляйте пользователю информативную обратную связь
4. **Используйте логирование** - При отладке и разработке используйте существующие механизмы логирования 