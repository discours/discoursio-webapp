import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: [
    'https://v3.dscrs.site/graphql',
    'https://staging.discours.io/graphql'
  ],
  documents: [
    'src/graphql/queries/**/*.ts',
    'src/**/*.{ts,tsx}',
    '!src/graphql/generated/**',
    '!src/graphql/mutation/chat/**',
    '!src/graphql/query/chat/**',
    '!src/graphql/mutation/notifier/**',
    '!src/graphql/query/notifier/**',
    // Исключаем все документы из inbox для избежания конфликтов
    '!src/graphql/mutation/inbox/**',
    '!src/graphql/query/inbox/**'
  ],
  generates: {
    './src/graphql/generated/introspection.json': {
      plugins: ['introspection'],
      config: {
        minify: true
      }
    },
    './src/graphql/generated/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: false
      }
    },
    './src/graphql/generated/': {
      preset: 'client',
      plugins: [],
      presetConfig: {
        gqlTagName: 'gql',
        fragmentMasking: false
      },
      config: {
        scalars: {
          DateTime: 'string',
          JSON: 'Record<string, any>'
        },
        // Настройки для правильной работы
        skipTypename: false,
        useTypeImports: true,
        dedupeOperationSuffix: true,
        dedupeFragments: true,
        // Избегаем конфликтов при объединении
        avoidOptionals: false,
        enumsAsTypes: false
      }
    }
  },
  // Глобальные настройки для правильной работы
  config: {
    skipTypename: false,
    useTypeImports: true,
    dedupeOperationSuffix: true,
    dedupeFragments: true,
    // Настройки для объединения схем
    avoidOptionals: false,
    enumsAsTypes: false
  }
}

export default config
