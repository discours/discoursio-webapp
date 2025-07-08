import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: 'https://v3.dscrs.site/graphql',
  documents: [
    'src/**/*.{ts,tsx}',
    '!src/graphql/mutation/chat/**',
    '!src/graphql/query/chat/**',
    '!src/graphql/api/chat/**',
    '!src/graphql/mutation/notifier/mark-seen-after.ts',
    '!src/graphql/mutation/notifier/mark-seen-thread.ts',
    '!src/graphql/mutation/notifier/mark-seen.ts',
    '!src/graphql/query/notifier/notifications-load.ts'
  ],
  generates: {
    './src/graphql/generated/': {
      preset: 'client',
      plugins: [],
      presetConfig: {
        gqlTagName: 'gql',
        fragmentMasking: false
      }
    },
    './src/graphql/generated/types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        enumsAsTypes: false,
        onlyOperationTypes: false,
        exportFragmentSpreadSubTypes: true,
        skipTypename: false,
        scalars: {
          DateTime: 'string',
          JSON: 'Record<string, any>'
        }
      }
    },
    './src/graphql/generated/typed-document-nodes.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
      config: {
        enumsAsTypes: false,
        scalars: {
          DateTime: 'string',
          JSON: 'Record<string, any>'
        }
      }
    },
    './src/graphql/generated/sdk.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-graphql-request'],
      config: {
        enumsAsTypes: false,
        rawRequest: false,
        scalars: {
          DateTime: 'string',
          JSON: 'Record<string, any>'
        }
      }
    },
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
    './src/graphql/generated/index.ts': {
      plugins: ['add'],
      config: {
        content: `// Re-export gql function from client preset
export { gql } from './gql'

// Re-export SDK
export { getSdk } from './sdk'
export type { Sdk } from './sdk'

// Re-export все типы и операции
export * from './types'
`
      }
    }
  }
}

export default config
