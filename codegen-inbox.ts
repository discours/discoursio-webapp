import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  // Используем только inbox схему
  schema: 'https://inbox.dscrs.site',
  documents: [], // Пока нет документов для inbox
  generates: {
    './src/graphql/generated/inbox-introspection.json': {
      plugins: ['introspection'],
      config: {
        minify: true
      }
    },
    './src/graphql/generated/inbox-schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: false
      }
    }
  }
}

export default config
