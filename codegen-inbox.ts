import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: process.env.INBOX_GRAPHQL_SCHEMA_URL || './src/graphql/schema/inbox.graphql',
  documents: ['src/graphql/mutation/chat/**/*.ts', 'src/graphql/query/chat/**/*.ts'],
  generates: {
    './src/graphql/generated/inbox/': {
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
        skipTypename: false,
        useTypeImports: true,
        dedupeOperationSuffix: true,
        dedupeFragments: true,
        avoidOptionals: false,
        enumsAsTypes: false
      }
    }
  }
}

export default config
