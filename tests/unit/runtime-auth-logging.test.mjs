import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const runtimeSources = [
  {
    file: new URL('../../src/context/upload.tsx', import.meta.url),
    forbiddenNames: new Set(['bearerToken', 'currentToken', 'cdnUrl', 'token'])
  },
  {
    file: new URL('../../src/routes/debug-upload.tsx', import.meta.url),
    forbiddenNames: new Set(['bearerToken', 'currentToken', 'cdnUrl', 'token'])
  }
]

const isConsoleCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'console'

const isBooleanPresenceCheck = (node) =>
  ts.isPrefixUnaryExpression(node) &&
  node.operator === ts.SyntaxKind.ExclamationToken &&
  ts.isPrefixUnaryExpression(node.operand) &&
  node.operand.operator === ts.SyntaxKind.ExclamationToken

const findForbiddenRuntimeName = (node, forbiddenNames) => {
  if (isBooleanPresenceCheck(node)) return undefined
  if (ts.isIdentifier(node) && forbiddenNames.has(node.text)) return node.text
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'token') return node.name.text

  let found
  ts.forEachChild(node, (child) => {
    if (!found) found = findForbiddenRuntimeName(child, forbiddenNames)
  })
  return found
}

test('upload runtimes never pass auth previews or endpoint values to console', async () => {
  const violations = []

  for (const runtimeSource of runtimeSources) {
    const source = await readFile(runtimeSource.file, 'utf8')
    const sourceFile = ts.createSourceFile(
      runtimeSource.file.pathname,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )

    const visit = (node) => {
      if (isConsoleCall(node)) {
        for (const argument of node.arguments) {
          const forbiddenName = findForbiddenRuntimeName(argument, runtimeSource.forbiddenNames)
          if (forbiddenName) violations.push(forbiddenName)
          assert.doesNotMatch(argument.getText(sourceFile), /\btoken\s*:|\.token\??\.(?:substring|slice)\s*\(/)
        }
      }
      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  assert.deepEqual(violations, [])
})
