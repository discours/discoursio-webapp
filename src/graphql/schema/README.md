# GraphQL schema snapshots

The application generates TypeScript operation types from versioned local schema snapshots so that a clean install,
typecheck, and build do not depend on production API availability or introspection permissions.

- `core/{enum,input,mutation,query,type}.graphql` is synced from `discours/discours-backend` at commit
  `3c56fdfaeaa8a8fe8478ee3b88d4eae1a46024c6`.
- `core/compatibility.graphql` contains only fields exercised by the checked-in webapp operations that post-date that
  backend snapshot. It is a build-time compatibility contract, not proof that every field is currently live.
- `inbox.graphql` preserves the public inbox contract previously generated in this repository (see commit
  `7417cd12cd94a1e7b66198f99a0c8e6acef8e0c2`) and the currently used operations under `src/graphql/{query,mutation}/chat`.

Run `npm run codegen:all` after changing a snapshot or GraphQL operation. Set `GRAPHQL_SCHEMA_URL` or
`INBOX_GRAPHQL_SCHEMA_URL` only when intentionally validating against another schema source.
