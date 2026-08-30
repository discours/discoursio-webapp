import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowUrl = new URL('../../.gitea/workflows/main.yml', import.meta.url)
const workflow = await readFile(workflowUrl, 'utf8')

test('GitHub sync keeps credentials out of URLs and diagnostics', () => {
  assert.doesNotMatch(workflow, /https:\/\/\$\{\{\s*secrets\./)
  assert.doesNotMatch(workflow, /git remote -v/)
  assert.doesNotMatch(workflow, /curl[^\n]+Authorization/)
  assert.match(workflow, /GIT_ASKPASS/)
  assert.match(
    workflow,
    /git remote add github https:\/\/github\.com\/discours\/discoursio-webapp\.git/,
  )
})

test('GitHub sync rejects unsupported branches and history rewrites', () => {
  assert.match(workflow, /feature\/\*\|hotfix\/\*/)
  assert.match(workflow, /Refusing to sync unsupported branch/)
  assert.doesNotMatch(workflow, /--force(?:-with-lease)?/)
  assert.match(
    workflow,
    /git push github "\$\{CURRENT_BRANCH\}:\$\{CURRENT_BRANCH\}"/,
  )
})
