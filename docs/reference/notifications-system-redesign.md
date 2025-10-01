# 🔔 Дизайн-проект: Модернизация системы уведомлений

## 📋 **Обзор проекта**

### **Цель**
Устранение дублирования и информационного шума в уведомлениях через умную группировку, контекстные действия и современный UX.

### **Анализ текущего интерфейса (по скриншоту)**

#### **Что работает хорошо:**
- ✅ Четкая группировка по времени (сегодня/вчера/ранее)
- ✅ Читаемые описания действий с контекстом
- ✅ Аватары для визуальной идентификации
- ✅ Метки времени для каждого уведомления
- ✅ Кнопки быстрых действий (Подписаться/Пропустить)

#### **Критические проблемы для решения:**
- 🔄 **Дублирование контента**: Одна публикация "Дорого и опасно" упоминается 4+ раза
- 📚 **Отсутствие группировки похожих действий**: 
  - "Олег Олегович и еще 4 пользователя подписались" (повторяется 3 раза)
  - Множественные комментарии к одной публикации не сгруппированы
- ⚡ **Ограниченные действия**: Только подписка, нет лайков/ответов/dismissal
- 📊 **Информационный шум**: Слишком много текста для простых действий
- 🎯 **Нет приоритизации**: Все уведомления выглядят одинаково важными
- 📱 **Неэффективное использование пространства**: Много повторяющегося текста

---

## 🏗️ **Архитектурные изменения**

### **Frontend (TypeScript/SolidJS)**

#### **Новые компоненты**
```
src/components/Notifications/
├── SmartNotificationGroup.tsx     # Умная группировка
├── NotificationActionBar.tsx      # Контекстные действия  
├── NotificationSettings.tsx       # Расширенные настройки
├── NotificationStream.tsx         # Real-time поток
├── NotificationQueue.tsx          # Очередь уведомлений
└── NotificationPreview.tsx        # Превью контента
```

#### **Обновленные сервисы**
```
src/lib/notifications/
├── NotificationProcessor.ts       # Умная обработка
├── DeduplicationEngine.ts         # Дедупликация
├── PriorityCalculator.ts          # Расчет приоритета
├── StreamManager.ts               # Управление потоками
├── SettingsManager.ts             # Настройки пользователя
└── ActionDispatcher.ts            # Быстрые действия
```

### **Клиентская группировка (без изменений бекенда)**

Используем существующую структуру `NotificationGroup` и группируем на клиенте:

```typescript
// Клиентская логика группировки на основе анализа скриншота
interface ClientNotificationGroup {
  id: string
  type: 'single' | 'grouped'
  category: string
  title: string
  count: number
  collapsed: boolean
  notifications: NotificationGroup[]
  avatars: string[] // для показа множественных аватаров
  timestamp: number // время последнего уведомления
  actions: ClientAction[]
}

interface ClientAction {
  type: 'follow' | 'skip' | 'view' | 'dismiss' | 'expand'
  label: string
  primary?: boolean
  handler: () => void
}

// Функция группировки без изменений бекенда
function groupNotificationsClient(notifications: NotificationGroup[]): ClientNotificationGroup[] {
  const groups = new Map<string, NotificationGroup[]>()
  
  notifications.forEach(notification => {
    // Определяем тип уведомления из текущего текста
    const notificationType = detectNotificationType(notification.text)
    const entityId = extractEntityId(notification)
    
    let groupKey: string
    
    switch (notificationType) {
      case 'subscription':
        // Группируем все подписки в один блок
        groupKey = 'subscriptions'
        break
        
      case 'comment':
        // Группируем комментарии к одной публикации
        groupKey = `comments_${entityId}`
        break
        
      case 'reaction':
        // Группируем реакции к одному комментарию
        groupKey = `reactions_${entityId}`
        break
        
      case 'suggestion':
        // Группируем предложения к одному черновику
        groupKey = `suggestions_${entityId}`
        break
        
      default:
        // Остальные оставляем как есть
        groupKey = `single_${notification.id}`
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(notification)
  })
  
  return Array.from(groups.entries()).map(([groupKey, items]) => 
    createClientGroup(groupKey, items)
  )
}

// Определение типа уведомления из текста (парсинг существующих данных)
function detectNotificationType(text: string): string {
  if (text.includes('подписался') || text.includes('подписалась')) {
    return 'subscription'
  }
  if (text.includes('оставил комментарий') || text.includes('оставила комментарий')) {
    return 'comment'
  }
  if (text.includes('ответил') || text.includes('ответила')) {
    return 'comment'
  }
  if (text.includes('отреагировал') || text.includes('отреагировала')) {
    return 'reaction'
  }
  if (text.includes('предложение')) {
    return 'suggestion'
  }
  return 'other'
}

// Извлечение ID сущности из URL или контекста
function extractEntityId(notification: NotificationGroup): string {
  // Пытаемся найти ID в URL или используем хеш текста
  const urlMatch = notification.link?.match(/\/(\d+)/)
  if (urlMatch) {
    return urlMatch[1]
  }
  
  // Если нет URL, группируем по заголовку публикации
  const titleMatch = notification.text.match(/"([^"]+)"/)
  if (titleMatch) {
    return hashString(titleMatch[1])
  }
  
  return 'unknown'
}

// Создание клиентской группы
function createClientGroup(groupKey: string, notifications: NotificationGroup[]): ClientNotificationGroup {
  const first = notifications[0]
  const count = notifications.length
  const isGrouped = count > 1
  
  return {
    id: groupKey,
    type: isGrouped ? 'grouped' : 'single',
    category: detectNotificationType(first.text),
    title: generateGroupTitle(notifications),
    count,
    collapsed: isGrouped,
    notifications: notifications.sort((a, b) => b.updated_at - a.updated_at),
    avatars: extractUniqueAvatars(notifications),
    timestamp: Math.max(...notifications.map(n => n.updated_at)),
    actions: generateClientActions(notifications)
  }
}
```

---

## 🧠 **Умные алгоритмы (основанные на анализе текущих проблем)**

### **Группировка по наблюдаемым паттернам**

```typescript
// Группировка основана на реальных проблемах из скриншота
interface GroupingRules {
  // Группировать подписки от одного пользователя
  multipleSubscriptions: {
    timeWindow: '1 hour',
    pattern: 'USER и еще X пользователей подписались на ваши публикации'
  }
  
  // Группировать комментарии к одной публикации  
  commentsToSamePost: {
    timeWindow: '24 hours',
    pattern: 'X новых комментариев к публикации "TITLE"'
  }
  
  // Группировать реакции к одному комментарию/посту
  reactionsToSameEntity: {
    timeWindow: '6 hours', 
    pattern: 'USER и еще X пользователей отреагировали на ваш комментарий'
  }
  
  // Группировать предложения к одному черновику
  suggestionsToSameDraft: {
    timeWindow: '48 hours',
    pattern: 'X новых предложений к черновику "TITLE"'
  }
}

// Реальные примеры группировки из скриншота:
function groupNotifications(notifications: Notification[]): GroupedNotification[] {
  const groups = new Map<string, Notification[]>()
  
  notifications.forEach(notification => {
    let groupKey: string
    
    switch (notification.type) {
      case 'subscription':
        // Группируем все подписки
        groupKey = 'subscriptions'
        break
        
      case 'comment':
        // Группируем по публикации
        groupKey = `comments_${notification.entityId}`
        break
        
      case 'reaction':
        // Группируем по комментарию/посту  
        groupKey = `reactions_${notification.entityId}`
        break
        
      case 'suggestion':
        // Группируем по черновику
        groupKey = `suggestions_${notification.entityId}`
        break
        
      default:
        groupKey = notification.id
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(notification)
  })
  
  return Array.from(groups.entries()).map(([key, notifications]) => ({
    id: key,
    type: notifications[0].type,
    count: notifications.length,
    notifications: notifications.sort((a, b) => b.timestamp - a.timestamp),
    collapsed: notifications.length > 1,
    title: generateGroupTitle(notifications),
    actions: generateGroupActions(notifications)
  }))
}
```

### **Генерация заголовков групп**

```typescript
// Функция генерации заголовков на основе реальных примеров
function generateGroupTitle(notifications: Notification[]): string {
  const first = notifications[0]
  const count = notifications.length
  
  if (count === 1) {
    return first.title
  }
  
  switch (first.type) {
    case 'subscription':
      const uniqueUsers = new Set(notifications.map(n => n.authorId)).size
      if (uniqueUsers === 1) {
        return `${first.authorName} подписался на ${count} ваших публикаций`
      }
      return `${first.authorName} и еще ${uniqueUsers - 1} пользователей подписались на ваши публикации`
      
    case 'comment':
      const postTitle = first.entityTitle || 'публикацию'
      if (count === 2) {
        return `Новые комментарии к "${postTitle}"`
      }
      return `${count} новых комментариев к "${postTitle}"`
      
    case 'reaction':
      if (first.entityType === 'comment') {
        return `${first.authorName} и еще ${count - 1} пользователей отреагировали на ваш комментарий`
      }
      return `${count} новых реакций на вашу публикацию`
      
    case 'suggestion':
      const draftTitle = first.entityTitle || 'черновик'
      return `${count} новых предложений к черновику "${draftTitle}"`
      
    default:
      return `${count} уведомлений`
  }
}
```

### **Дедупликация и группировка**

```sql
-- SQL функция для умной группировки
CREATE OR REPLACE FUNCTION group_notifications(user_id_param INTEGER)
RETURNS TABLE(group_id VARCHAR, category VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH notification_groups AS (
    SELECT 
      CASE 
        -- Группируем лайки к одному посту
        WHEN n.type = 'reaction' AND n.context_data->>'entityType' = 'shout' 
        THEN CONCAT('likes_', n.context_data->>'entityId')
        
        -- Группируем комментарии к одному посту
        WHEN n.type = 'comment' AND n.context_data->>'entityType' = 'shout'
        THEN CONCAT('comments_', n.context_data->>'entityId')
        
        -- Группируем новых подписчиков
        WHEN n.type = 'follow' 
        THEN 'new_followers'
        
        -- Остальное группируем по типу
        ELSE n.type
      END as calc_group_id,
      n.category,
      COUNT(*) as notification_count
    FROM notifications n
    WHERE n.user_id = user_id_param 
      AND n.read_at IS NULL 
      AND n.dismissed_at IS NULL
      AND n.created_at > NOW() - INTERVAL '7 days'
    GROUP BY calc_group_id, n.category
    HAVING COUNT(*) >= 2  -- Группируем только если больше 1 уведомления
  )
  SELECT ng.calc_group_id, ng.category, ng.notification_count
  FROM notification_groups ng;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔄 **Real-time архитектура**

### **Server-Sent Events улучшения**

```javascript
// Расширенный SSE endpoint
app.get('/api/notifications/stream/:userId', (req, res) => {
  const userId = req.params.userId
  
  // Настройка SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no' // Nginx не буферизует
  })
  
  // Heartbeat каждые 30 секунд
  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\ndata: ping\n\n')
  }, 30000)
  
  // Подписка на изменения уведомлений
  const subscription = pubsub.subscribe(`notifications:${userId}`, (notification) => {
    const groupedNotification = processNotificationForUser(notification, userId)
    
    res.write(`event: notification\n`)
    res.write(`data: ${JSON.stringify(groupedNotification)}\n\n`)
  })
  
  // Cleanup при отключении
  req.on('close', () => {
    clearInterval(heartbeat)
    pubsub.unsubscribe(subscription)
  })
})
```

### **WebSocket fallback**

```javascript
// WebSocket сервер для real-time уведомлений
const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (ws, req) => {
  const userId = extractUserIdFromToken(req.headers.authorization)
  
  if (!userId) {
    ws.close(1008, 'Unauthorized')
    return
  }
  
  // Подписка на персональные уведомления
  const subscription = pubsub.subscribe(`notifications:${userId}`, (notification) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'notification',
        data: notification
      }))
    }
  })
  
  // Обработка сообщений от клиента
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      
      switch (data.type) {
        case 'mark_read':
          markNotificationAsRead(data.notificationId, userId)
          break
        case 'dismiss':
          dismissNotification(data.notificationId, userId)
          break
        case 'action':
          performNotificationAction(data.notificationId, data.actionType, userId)
          break
      }
    } catch (error) {
      console.error('Invalid WebSocket message:', error)
    }
  })
  
  ws.on('close', () => {
    pubsub.unsubscribe(subscription)
  })
})
```

---

## 📊 **Система метрик**

### **Аналитические события**

```sql
-- Таблица для отслеживания взаимодействий
CREATE TABLE IF NOT EXISTS notification_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- sent, delivered, viewed, clicked, dismissed
    event_data JSONB,
    session_id VARCHAR(50),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для аналитики
CREATE INDEX IF NOT EXISTS idx_analytics_user_event ON notification_analytics(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_notification ON notification_analytics(notification_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON notification_analytics(created_at);
```

### **Метрики эффективности**

```sql
-- View для аналитики эффективности
CREATE OR REPLACE VIEW notification_effectiveness AS
SELECT 
    DATE_TRUNC('day', n.created_at) as date,
    n.category,
    n.priority,
    COUNT(*) as sent_count,
    COUNT(na_delivered.id) as delivered_count,
    COUNT(na_viewed.id) as viewed_count,
    COUNT(na_clicked.id) as clicked_count,
    COUNT(na_dismissed.id) as dismissed_count,
    
    -- Процентные метрики
    ROUND(COUNT(na_delivered.id)::numeric / COUNT(*) * 100, 2) as delivery_rate,
    ROUND(COUNT(na_viewed.id)::numeric / COUNT(*) * 100, 2) as view_rate,
    ROUND(COUNT(na_clicked.id)::numeric / COUNT(*) * 100, 2) as click_rate,
    ROUND(COUNT(na_dismissed.id)::numeric / COUNT(*) * 100, 2) as dismiss_rate
    
FROM notifications n
LEFT JOIN notification_analytics na_delivered ON n.id = na_delivered.notification_id AND na_delivered.event_type = 'delivered'
LEFT JOIN notification_analytics na_viewed ON n.id = na_viewed.notification_id AND na_viewed.event_type = 'viewed'
LEFT JOIN notification_analytics na_clicked ON n.id = na_clicked.notification_id AND na_clicked.event_type = 'clicked'
LEFT JOIN notification_analytics na_dismissed ON n.id = na_dismissed.notification_id AND na_dismissed.event_type = 'dismissed'
WHERE n.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', n.created_at), n.category, n.priority
ORDER BY date DESC;
```

---

## 🛠️ **План реализации (только клиентские изменения)**

### **Этап 1: Клиентская группировка (1 день)**
1. ✅ Создание утилит для парсинга существующих уведомлений
2. ✅ Алгоритм группировки по типам и сущностям
3. ✅ Генерация заголовков групп
4. ✅ Извлечение аватаров и метаданных

### **Этап 2: Компоненты UI (1-2 дня)**
1. ✅ `SmartNotificationGroup` - компонент группы
2. ✅ `CollapsibleNotificationList` - сворачиваемый список
3. ✅ `NotificationActionBar` - быстрые действия
4. ✅ Обновление `NotificationsPanel`

### **Этап 3: Интерактивность (1 день)**
1. ✅ Expand/collapse анимации
2. ✅ Множественные аватары в группах
3. ✅ Контекстные действия (лайк, ответ, dismiss)
4. ✅ Клавиатурная навигация

### **Этап 4: Настройки и персонализация (1 день)**
1. ✅ Локальные настройки группировки (localStorage)
2. ✅ Пользовательские фильтры
3. ✅ Настройки автосворачивания
4. ✅ Экспорт/импорт настроек

### **Этап 5: Полировка UX (1 день)**
1. ✅ Микро-анимации
2. ✅ Адаптивный дизайн
3. ✅ Accessibility (ARIA, keyboard)
4. ✅ Performance оптимизация

---

## 🔧 **Технические требования**

### **Только Frontend зависимости (без бекенда)**
```json
{
  "dependencies": {
    "@solid-primitives/storage": "^4.3.2",     // localStorage для настроек
    "date-fns": "^2.30.0",                     // Форматирование времени в группах
    "crypto-js": "^4.2.0"                      // Хеширование для группировки
  }
}
```

### **Никаких дополнительных системных требований**
- ✅ Работает на существующей архитектуре
- ✅ Использует только данные из GraphQL API
- ✅ Группировка происходит в памяти браузера
- ✅ Настройки хранятся в localStorage

---

## 🔒 **Безопасность**

### **Авторизация уведомлений**
```typescript
// Middleware для проверки доступа к уведомлениям
function authorizeNotificationAccess(userId: string, notificationId: string): boolean {
  // Проверяем, что пользователь может видеть это уведомление
  const notification = getNotificationById(notificationId)
  return notification.userId === userId
}

// Rate limiting для защиты от спама
const rateLimiter = {
  maxNotificationsPerMinute: 10,
  maxActionsPerMinute: 20,
  maxSettingsUpdatesPerHour: 5
}
```

### **Валидация данных**
```typescript
// Схемы валидации для настроек
const notificationSettingsSchema = {
  categories: array(object({
    category: oneOf(['reaction', 'comment', 'follow', 'mention', 'system']),
    enabled: boolean(),
    frequency: oneOf(['instant', 'batched', 'hourly', 'daily']),
    channels: array(oneOf(['web', 'email', 'push']))
  })),
  quietHours: optional(object({
    start: string().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: string().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
  }))
}
```

---

## 📈 **Мониторинг и алерты**

### **Ключевые метрики**
- **Delivery Rate**: % успешно доставленных уведомлений
- **Response Time**: Время от создания до доставки
- **User Engagement**: % уведомлений с действиями пользователя
- **Error Rate**: % неудачных доставок
- **Queue Length**: Размер очереди уведомлений

### **Алерты**
```yaml
# Prometheus alerts
groups:
  - name: notifications
    rules:
      - alert: HighNotificationError
        expr: notification_error_rate > 0.05
        for: 5m
        labels:
          severity: warning
        
      - alert: NotificationQueueOverflow
        expr: notification_queue_length > 10000
        for: 2m
        labels:
          severity: critical
```

---

## 🎯 **Критерии успеха**

### **Технические KPI (клиентские)**
- ⚡ **Группировка**: < 100ms для 1000 уведомлений
- 📊 **Снижение шума**: -60% повторяющихся уведомлений
- 📱 **Mobile Performance**: < 200ms рендеринг сгруппированного списка
- 💾 **Memory Usage**: < 10MB для группировки в памяти
- 🔄 **Smooth Animations**: 60fps для expand/collapse

### **Пользовательские KPI**
- 😊 **Снижение информационного шума**: -70% дублирующихся записей
- 🎯 **Улучшение читаемости**: Сгруппированные заголовки вместо повторов
- ⏱️ **Скорость навигации**: Быстрое сворачивание/разворачивание групп
- 📱 **Компактность**: В 2-3 раза меньше прокрутки

### **UX улучшения**
- 📈 **Ясность**: "5 человек подписались" вместо 5 отдельных записей
- 🔔 **Фокус на важном**: Группировка по релевантности
- ⏰ **Экономия времени**: Быстрый просмотр сгруппированного контента
- 🚀 **Интуитивность**: Естественная группировка как в других приложениях

---

## 🏁 **Заключение**

Данный дизайн-проект представляет **клиентскую модернизацию** системы уведомлений без изменений на сервере. Основные преимущества:

### **🎯 Решаемые проблемы из скриншота:**
- ✅ **Устранение дублирования**: "Дорого и опасно" больше не повторяется 4 раза
- ✅ **Группировка подписок**: "Олег Олегович и еще 4 пользователя" вместо отдельных записей
- ✅ **Компактность**: Сворачиваемые группы для экономии места
- ✅ **Ясность**: Понятные заголовки групп с количеством

### **🚀 Технические преимущества:**
- 🧠 **Умная группировка** на основе парсинга существующих данных
- ⚡ **Быстрая реализация** - только frontend изменения
- 🎛️ **Гибкие настройки** в localStorage без серверных изменений
- 📱 **Современный UX** с анимациями и интерактивностью
- 🔄 **Обратная совместимость** с существующим API

### **📈 Результат:**
Проект **значительно улучшает читаемость** уведомлений, **снижает информационный шум** и **повышает пользовательский опыт** без необходимости изменений на сервере. Реализация займет 5-6 дней разработки.

### **🛡️ Безопасность:**
Все обработки происходят в браузере, существующие API endpoints не изменяются, данные не модифицируются - только реорганизуются для отображения.
