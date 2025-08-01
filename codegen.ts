import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: '../core/schema',
  documents: [
    'src/graphql/queries/**/*.ts',
    'src/**/*.{ts,tsx}',
    '!src/graphql/generated/**',
    '!src/graphql/mutation/chat/**',
    '!src/graphql/query/chat/**',
    '!src/graphql/mutation/notifier/**',
    '!src/graphql/query/notifier/**'
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
        }
      }
    }
  }
}

export default config
