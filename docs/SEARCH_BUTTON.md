# Кнопка поиска в хедере

## Описание

Восстановлена иконка-кнопка поиска во всех режимах хедера согласно дизайну Figma.

## Компоненты

### HeaderControls.tsx

Кнопка поиска добавлена в три основных компонента:

1. **EditingHeader** - режим редактирования
2. **AuthorizedHeader** - авторизованный пользователь  
3. **GuestHeader** - гостевой режим

### Код кнопки

```tsx
<div class={clsx(styles.userControlItem, styles.userControlItemSearch)}>
  <button class={styles.button} onClick={handleSearchClick} title={t('Search')}>
    <Icon name="search" />
  </button>
</div>
```

### Обработчик клика

```tsx
const handleSearchClick = (event: Event) => {
  event.preventDefault()
  showModal('search')
}
```

## Функциональность

- **Иконка**: Использует существующую SVG иконку `search.svg` из папки `/public/icons/`
- **Модальное окно**: Открывает `SearchModal` с полнофункциональным поиском
- **Поиск**: Поддерживает поиск по статьям, авторам, темам с фильтрацией
- **Стили**: CSS класс `userControlItemSearch` с адаптивной версткой

## Интеграция

- Модальное окно управляется через `useUI()` контекст
- `SearchModal` уже подключен в `Header.tsx`
- Поддерживает URL параметры для состояния модального окна
- Совместим с системой навигации Solid.js

## Стили

CSS стили в `Header.module.scss`:

```scss
.userControlItemSearch {
  @include media-breakpoint-down(xl) {
    order: 1;
  }
  margin: 0 1rem 0 2.2rem;
}
```

## Тестирование

- Проверить клик по кнопке поиска во всех режимах хедера
- Убедиться что открывается модальное окно поиска
- Протестировать функционал поиска (статьи, авторы, темы)
- Проверить адаптивность на мобильных устройствах 