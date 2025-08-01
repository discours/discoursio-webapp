import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  // Используем только inbox схему
  schema: 'https://inbox.dscrs.site',
  documents: [
    'src/graphql/mutation/chat/**/*.ts',
    'src/graphql/query/chat/**/*.ts'
  ],
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
    },
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
