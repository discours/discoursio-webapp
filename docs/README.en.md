# Documentation of the frontend of discours.io

The project uses: SolidJS, Typescript, GraphQL, SASS

## Articles

### How [asynchronous observers](solid-async.md) work
- Working with `createResource` instead of `createAsync` (will be removed in SolidJS 2.0)
- Optimization of SSR
- State management
- Data caching

### How [cached component state](solid-memo.md) works
- Working with `createMemo` to avoid repeated calculations
- Caching calculations
- Dependency management

### [Battling cyclic effects](solid-effects.md)
- Working with `createEffect`, `on`, `defer`, `batch`, `untrack`
- State management

### [data caching](caching.md)
- [data caching 2.0](caching-v2.md) (SolidJS 2.0)
- Cache management
- Optimization of performance

### [view tracking system](views.md)
- Working with GA4 (as an analytics backend)
- Caching calculations

### [common feed mechanics](feed-components.md)
- Filtering and sorting
- Working with `FeedProvider`
- Working with `FeedSwitcher` and `FeedFilter`
- Optimization of SSR
- State management

### [фильтры комментариев](comments-filter.md)
- Filtering and sorting
- State management

### [how the review of PRs works](pr-review.md)
- Order of reviewing PRs
- Conditions for accepting PRs