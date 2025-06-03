
# Система уведомлений и SSE-соединения в Discours.io

## 1. Обзор системы

Система уведомлений Discours.io построена на основе SSE (Server-Sent Events) соединения, обеспечивающего реактивный пользовательский опыт. Система предоставляет два ключевых функциональных блока:

- **Уведомления** - отображение и управление оповещениями о различных событиях
- **Presence** - информирование о присутствии пользователей и их действиях в реальном времени

## 2. Архитектура

### 2.1. Компоненты системы

- **SSE-соединение** (`connect.tsx`) - базовый уровень для подключения к серверу событий
- **Контекст уведомлений** (`notifications.tsx`) - обработка и хранение уведомлений
- **Компоненты отображения** (`NotificationsPanel`, `NotificationGroup`) - визуализация
- **Awareness провайдер** (`awareness.ts`) - отслеживание присутствия в редакторе

### 2.2. Поток данных

```
Сервер ─────► SSE-соединение ─────► Контекст уведомлений ─────► Компоненты отображения
                  │                        │
                  ▼                        │
         Awareness провайдер ◄─────────────┘
```

## 3. SSE-соединение (connect.tsx)

### 3.1. Основные возможности

- Установка и поддержание SSE-соединения с сервером
- Авторизация через JWT-токен
- Механизм переподключения с экспоненциальной задержкой (exponential backoff)
- Дедупликация сообщений
- Обработка и маршрутизация событий

### 3.2. Ключевые параметры

```typescript
// Максимальное количество попыток переподключения
const RECONNECT_TIMES = 5
// Максимальная задержка между попытками в мс
const MAX_RECONNECT_DELAY = 30000
```

### 3.3. API контекста

```typescript
type ConnectContextType = {
  // Добавление обработчика сообщений, возвращает функцию для отписки
  addHandler: (handler: (data: SSEMessage) => void) => () => void
  // Получение текущего статуса соединения
  getStatus: () => ConnectionStatus // 'connected' | 'connecting' | 'disconnected' | 'error'
}
```

### 3.4. Формат сообщений

```typescript
interface SSEMessage {
  id: string                     // Уникальный ID сообщения
  entity: string                 // Тип сущности (follower, shout, reaction...)
  action: string                 // Тип действия (create, delete, update...)
  payload: Author | Shout | ...  // Полезная нагрузка, зависит от типа сущности
  created_at?: number            // Время создания (unixtime x1000)
  seen?: boolean                 // Флаг просмотра
}
```

## 4. Система уведомлений (notifications.tsx)

### 4.1. Типы сущностей

```typescript
enum PresenceEntityType {
  Global = 'global',     // Глобальные оповещения
  Personal = 'personal', // Персональные оповещения
  Topic = 'topic',       // События тем
  Shout = 'shout',       // События публикаций
  Reaction = 'reaction', // Реакции на контент
  Chat = 'chat',         // События чатов
  Message = 'message',   // Личные сообщения
  Editor = 'editor',     // События редактора
  Cursor = 'cursor',     // Движения курсора
  Draft = 'draft',       // События черновиков
  Proposal = 'proposal'  // Предложения
}
```

### 4.2. Типы действий

```typescript
enum PresenceActionType {
  Create = 'create', // Создание сущности
  Update = 'update', // Обновление сущности
  Delete = 'delete', // Удаление сущности
  Join = 'join',     // Присоединение к сущности
  Left = 'left',     // Покидание сущности
  Seen = 'seen'      // Просмотр сущности
}
```

### 4.3. API контекста уведомлений

```typescript
type NotificationsContextType = {
  // Хранилище уведомлений по ID треда
  notificationEntities: Record<string, NotificationGroup>
  // Количество непрочитанных уведомлений
  unreadNotificationsCount: Accessor<number>
  // Временная метка последнего просмотра
  after: Accessor<number | null>
  // Отсортированные уведомления
  sortedNotifications: Accessor<NotificationGroup[]>
  // Количество загруженных уведомлений
  loadedNotificationsCount: Accessor<number>
  // Общее количество уведомлений
  totalNotificationsCount: Accessor<number>
  // Показать панель уведомлений
  showNotificationsPanel: () => void
  // Скрыть панель уведомлений
  hideNotificationsPanel: () => void
  // Отметить уведомление как прочитанное
  markSeen: (notification_id: number) => Promise<void>
  // Отметить тред как прочитанный
  markSeenThread: (threadId: string) => Promise<void>
  // Отметить все уведомления как прочитанные
  markSeenAll: () => Promise<void>
  // Загрузить группы уведомлений
  loadNotificationsGrouped: (options: QueryLoad_NotificationsArgs) => Promise<NotificationGroup[]>
}
```

### 4.4. Создание уведомлений из SSE

```typescript
// Генерация уникального ID треда
const threadId = `${data.entity}::${data.id}::${data.action}`

// Создание уведомления
const notificationPayload = {
  authors: [] as Author[],
  shout: null as Shout | null,
  entity: data.entity,
  action: data.action,
  thread: threadId,
  updated_at: timestamp,
  seen: false
}
```

### 4.5. Обработка разных типов уведомлений

- **Reaction** - уведомления о реакциях на контент
- **Message** - уведомления о личных сообщениях
- **Shout** - уведомления о публикациях
- **Global/Personal** - системные и персональные уведомления
- **Другие типы** - обработка по умолчанию

## 5. Компоненты отображения уведомлений

### 5.1. NotificationsPanel

Панель уведомлений отображает все уведомления, сгруппированные по времени:
- **Сегодня** - уведомления за текущий день
- **Вчера** - уведомления за предыдущий день
- **Ранее** - более старые уведомления

Основные функции:
- Показ/скрытие панели
- Подгрузка уведомлений при скролле
- Отметка всех уведомлений как прочитанных

### 5.2. NotificationGroup

Компонент для отображения группы уведомлений с одинаковым `thread`. Поддерживает:
- Различные форматы времени (ago, time, date)
- Специальное отображение для разных типов уведомлений
- Навигацию к соответствующему контенту
- Визуальное отличие прочитанных/непрочитанных уведомлений

## 6. Awareness система (awareness.ts)

### 6.1. Назначение

Awareness - это механизм для отслеживания присутствия и активности пользователей в совместном редакторе:
- Синхронизация позиций курсора
- Информирование о пользователях, редактирующих документ
- Отслеживание изменений полей черновика

### 6.2. Структура данных

```typescript
type EditorState = {
  // Информация о пользователе
  user: {
    id: string | number
    name: string
    color: string
    tabId: string
  }
  // Идентификатор редактора
  editorId: string
  // Временная метка обновления
  timestamp: number
  // Содержимое черновика
  draftContent?: DraftContent
  // Позиция курсора
  cursor?: {
    anchor: number
    head: number
  }
}
```

### 6.3. Механизм синхронизации

1. **Онлайн режим** - данные передаются через SSE-соединение
2. **Оффлайн режим** - данные сохраняются в localStorage
3. **Восстановление** - при восстановлении соединения происходит синхронизация

### 6.4. API Awareness

```typescript
// Инициализация
provider.connect(editorId, draftId)

// Установка информации о пользователе
provider.setUserInfo(editorId, userInfo)

// Обновление позиции курсора
provider.setCursorPosition(anchor, head)

// Обновление содержимого поля
provider.updateDraftField(draftId, fieldName, content, isEmpty)

// Получение присутствующих пользователей
provider.getConnectedUsers()
```

## 7. Интеграция с другими системами

### 7.1. Интеграция с системой авторизации

SSE-соединение автоматически устанавливается при наличии активной сессии:

```typescript
createEffect(
  on(
    session,
    (s) => {
      if (s?.token) {
        initConnection(s.token)
      } else {
        closeConnection()
      }
    },
    { defer: false }
  )
)
```

### 7.2. Интеграция с черновиками

Awareness система интегрируется с черновиками для совместного редактирования:

```typescript
// В контексте черновиков
const { provider } = useEditorAwareness(editorId, draftId)
// Обновление поля черновика
provider.updateDraftField(draftId, 'body', content, isEmpty)
```

## 8. Обработка ошибок и восстановление

### 8.1. Стратегии переподключения

1. **Exponential backoff** - увеличение задержки между попытками
2. **Ограничение попыток** - максимальное количество попыток
3. **Сброс счетчика** - при успешном подключении

```typescript
const calculateReconnectDelay = () => {
  const baseDelay = 1000; // 1 секунда
  const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  return delay;
};
```

### 8.2. Оффлайн режим

При отсутствии сетевого соединения:
1. Данные сохраняются локально
2. Система продолжает функционировать в ограниченном режиме
3. При восстановлении соединения происходит синхронизация

## 9. Примеры использования

### 9.1. Подписка на уведомления

```typescript
// В компоненте
const { sortedNotifications, markSeenThread } = useNotifications()

// Отображение уведомлений
<For each={sortedNotifications()}>
  {(notification) => (
    <NotificationItem
      notification={notification}
      onRead={() => markSeenThread(notification.thread)}
    />
  )}
</For>
```

### 9.2. Использование Awareness

```typescript
// В редакторе
const { 
  updateCursorPosition, 
  updateEditorContent,
  getActiveUsers, 
  cursors 
} = useEditorAwareness(editorId, draftId)

// Обновление позиции курсора
onSelectionChange((selection) => {
  updateCursorPosition(selection.anchor, selection.head)
})

// Обновление содержимого
onChange((content) => {
  updateEditorContent(content)
})

// Показ активных пользователей
<For each={getActiveUsers()}>
  {(user) => <ActiveUserBadge user={user} />}
</For>

// Отображение курсоров других пользователей
<For each={cursors()}>
  {([clientId, cursor]) => (
    <RemoteCursor
      position={cursor.head}
      color={cursor.user.color}
      name={cursor.user.name}
    />
  )}
</For>
```

## 10. Рекомендации по расширению

### 10.1. Добавление новых типов уведомлений

1. Добавить новый тип в `PresenceEntityType`
2. Расширить обработчик в `handlePresenceMessage`
3. Добавить отображение в `NotificationGroup`

### 10.2. Расширение функционала Awareness

1. Создать новый тип состояния в `EditorState`
2. Добавить методы в `AwarenessProvider`
3. Расширить API хука `useEditorAwareness`

### 10.3. Оптимизация производительности

- Использовать виртуализацию для больших списков уведомлений
- Реализовать пагинацию для загрузки старых уведомлений
- Оптимизировать обновление состояний через `batch`

## 11. Ограничения и известные проблемы

1. Максимальное количество уведомлений в кэше дедупликации - 1000
2. Ограниченное количество попыток переподключения - 5
3. Необходимость правильного закрытия соединения при размонтировании компонентов
