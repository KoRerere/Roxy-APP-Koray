import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- agent-console tests use Node's built-in runner
import test from 'node:test'
import { readProjectSelection, writeProjectSelection } from './projectSelectionCache'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

test('remembers the selected project for each workspace', () => {
  const storage = createStorage()

  writeProjectSelection('workspace-1', 'project-1', storage)
  writeProjectSelection('workspace-2', 'project-2', storage)

  assert.equal(readProjectSelection('workspace-1', storage), 'project-1')
  assert.equal(readProjectSelection('workspace-2', storage), 'project-2')
})

test('ignores selections without a workspace or project id', () => {
  const storage = createStorage()

  writeProjectSelection(undefined, 'project-1', storage)
  writeProjectSelection('workspace-1', '  ', storage)

  assert.equal(readProjectSelection(undefined, storage), undefined)
  assert.equal(readProjectSelection('workspace-1', storage), undefined)
})

test('treats storage failures as a cache miss', () => {
  const storage = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
  }

  assert.doesNotThrow(() => writeProjectSelection('workspace-1', 'project-1', storage))
  assert.equal(readProjectSelection('workspace-1', storage), undefined)
})
