# Open Graph и SSR: Ограничения @solidjs/meta

## Проблема

`@solidjs/meta` имеет известные проблемы с Server-Side Rendering (SSR):

- **Issue #54**: Комбинация символов `$'` ломает серверный рендеринг
- **Issue #33**: Resource в title рендерится как `[object Object]`
- **Issue #29**: Отсутствует функция `renderTags()` для SSR
- **Issue #28**: Ошибки гидратации при использовании `<Meta />` в SolidStart

## Архитектура решения

### Двойной подход

1. **SSR** (`entry-server.tsx`) - статичные метатеги в HTML
2. **CSR** (`PageLayout.tsx`) - динамические обновления через `@solidjs/meta`

### Серверная часть (entry-server.tsx)

```tsx
// Генерация метатегов на сервере
function generateMetaTags(contentInfo: any, pathname: string, locale: 'ru' | 'en', t: any) {
  return (
    <>
      <title>{ogMetadata.title}</title>
      <meta property="og:type" content={ogMetadata.type} />
      <meta property="og:title" content={ogMetadata.title} />
      {/* ... остальные метатеги */}
    </>
  )
}
```

### Клиентская часть (PageLayout.tsx)

```tsx
// Только для динамических обновлений в браузере
<Meta property="og:type" content={ogType()} />
<Meta property="og:title" content={pageTitle()} />
```

## Преимущества подхода

- ✅ Корректная работа SSR
- ✅ Динамические метатеги в браузере
- ✅ Поддержка многоязычности
- ✅ Совместимость с поисковыми системами

## Будущее

Следим за [RFC #2294](https://github.com/solidjs/solid/discussions/2294) - планируется встроенная поддержка метатегов в ядро Solid.

## Статус

**Текущее решение стабильно и рекомендуется к использованию.** 