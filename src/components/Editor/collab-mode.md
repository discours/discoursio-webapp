# Коллаборативный режим редактора

## Архитектура

### Основные компоненты

- [Hocuspocus](https://tiptap.dev/hocuspocus) как WebSocket сервер
- [Y.js](https://docs.yjs.dev/) для CRDT
- [TipTap Collaboration](https://tiptap.dev/api/extensions/collaboration) для синхронизации
- [CollaborationCursor](https://tiptap.dev/api/extensions/collaboration-cursor) для курсоров

### Реализация

#### 1. Инициализация провайдера
Из [editor.tsx](src/context/editor.tsx):

```typescript
const provider = new HocuspocusProvider({
    url: WS_URL,
    name: documentId,
    document: new Doc(),
    token: authToken,
    onConnect() {
        setIsConnected(true)
    },
    onDisconnect() {
        setIsConnected(false)
    },
    onStatus(status) {
        setConnectionStatus(status)
    }
})
```
#### 2. Подключение расширений

```typescript
const extensions = [
    // Базовые расширения
    StarterKit,
    // Коллаборация
    Collaboration.configure({
        document: provider.document,
        fragmentContent: false,
    }),
    // Курсоры пользователей
    CollaborationCursor.configure({
        provider,
        user: {
            name: userName,
            color: userColor,
            avatar: userAvatar // TODO: добавить аватарку
        }
    })
]
```


## Функциональность

### 1. Синхронизация контента

- Автоматическая синхронизация через Y.js CRDT
- Разрешение конфликтов
- Поддержка оффлайн-режима
- Восстановление соединения

### 2. Управление пользователями

- Отображение активных пользователей
- Цветовая идентификация
- Аватары в курсорах
- Статусы присутствия

### 3. Курсоры и выделения

- Отображение курсоров пользователей
- Подсветка выделений
- Анимация перемещений
- Имена пользователей

## Конфигурация

### 1. WebSocket соединение
В [config.ts](src/config/editor.ts):

```typescript
export const EDITOR_CONFIG = {
    WS_URL: process.env.WS_URL || 'wss://collab.discours.io',
    RECONNECT_INTERVAL: 1000,
    MAX_RECONNECT_ATTEMPTS: 5,
    SYNC_INTERVAL: 100
}
```


### 2. Настройки провайдера
В [EditorProvider.tsx](src/components/Editor/EditorProvider.tsx):

```typescript
const collabConfig = {
    // Интервал синхронизации
    syncInterval: EDITOR_CONFIG.SYNC_INTERVAL,
    // Обработка конфликтов
    onConflict: (ydoc: Doc, remote: Update) => {
        // Логика разрешения конфликтов
    },
    // Сохранение локальных изменений
    onUpdate: (update: Update) => {
        localStorage.setItem('local-changes', JSON.stringify(update))
    }
}
```


## Мониторинг и отладка

### 1. Состояние соединения

```typescript
const ConnectionStatus = () => {
    const { status, isConnected } = useEditorContext()
    return (
    <div class="status">
            <StatusIcon status={status} />
            {isConnected ? 'Connected' : 'Disconnected'}
        </div>
    )
}
```

### 2. Логирование событий

```typescript
provider.on('sync', (isSynced: boolean) => {
    console.log('Sync status:', isSynced)
})
provider.on('status', ({ status }: { status: string }) => {
    console.log('Connection status:', status)
})
```


## Оптимизация

### 1. Производительность
- Батчинг обновлений
- Дебаунсинг синхронизации
- Оптимизация размера сообщений
- Сжатие данных

### 2. Сетевая устойчивость
- Автоматическое переподключение
- Очередь изменений
- Локальное кеширование
- Обработка таймаутов

## Безопасность

### 1. Аутентификация
- Проверка прав доступа
- Валидация операций
- Защита от инъекций

### 2. Валидация данных
- Проверка входящих изменений
- Санитизация контента
- Ограничение размера
- Защита от флуда
