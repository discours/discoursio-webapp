# GraphQL API Functions

Этот документ описывает основные функции GraphQL API для загрузки данных в приложении.

## Topics API

### loadTopicBySlug(slug: string)

Кешируемый метод для загрузки конкретного топика по его slug.

**Использование:**
```ts
// В route.load (SSR):
const topicLoader = loadTopicBySlug('javascript')
const topic = await topicLoader()

// В компоненте (клиент):
const topic = await loadTopicBySlug('javascript')()
```

**Особенности:**
- Использует браузерное кеширование для оптимизации
- Подходит для SSR и клиентских запросов
- Построен на базе GraphQL query `get_topic`
- Поддерживает TypeScript типизацию

### useTopicBySlug(slug: string)

Реактивный ресурс для загрузки топика по slug с кешированием.

**Использование:**
```tsx
const [topic] = useTopicBySlug('javascript')

return (
  <Show when={topic()} fallback={<Loading />}>
    <TopicView topic={topic()} />
  </Show>
)
```

### loadTopics()

Загружает все доступные топики.

### loadTopicsByCommunity(args)

Загружает топики по сообществу с пагинацией.

## Shouts API

### loadShouts(options)

Кешируемый метод для загрузки публикаций с фильтрацией.

### useShout(options)

Реактивный ресурс для загрузки одной публикации.

## Authors API

### loadAuthors(options)

Кешируемый метод для загрузки авторов с фильтрацией.

### useAuthor(options)

Реактивный ресурс для загрузки данных автора.

## Принципы архитектуры

1. **Кеширование**: Все публичные данные кешируются для оптимизации
2. **SSR поддержка**: Функции работают как на сервере, так и на клиенте
3. **Типизация**: Полная поддержка TypeScript из GraphQL схемы
4. **Реактивность**: Ресурсы автоматически обновляются при изменении параметров 