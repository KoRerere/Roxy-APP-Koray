import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import {
  getTemplateUnreadKey,
  isTemplateUnread,
  markTemplateDrawerRead,
  markTemplateRead,
  markTemplateUnread,
  readUnreadTemplateDrawerKeys,
  readUnreadTemplateKeys,
} from './template-unread'

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

const template = { id: 7, workspaceId: 'workspace-1' }

test('persists unread templates by workspace and template id', () => {
  const storage = createStorage()
  const keys = markTemplateUnread(template, storage)

  assert.equal(getTemplateUnreadKey(template), 'workspace-1:7')
  assert.equal(isTemplateUnread(keys, template), true)
  assert.equal(isTemplateUnread(readUnreadTemplateKeys(storage), template), true)
  assert.equal(isTemplateUnread(readUnreadTemplateDrawerKeys(storage), template), true)
})

test('removes both unread states after the template is read in My Templates', () => {
  const storage = createStorage()
  markTemplateUnread(template, storage)

  const keys = markTemplateRead(template, storage)

  assert.equal(isTemplateUnread(keys, template), false)
  assert.equal(isTemplateUnread(readUnreadTemplateKeys(storage), template), false)
  assert.equal(isTemplateUnread(readUnreadTemplateDrawerKeys(storage), template), false)
})

test('reading a template in the drawer leaves My Templates unread', () => {
  const storage = createStorage()
  markTemplateUnread(template, storage)

  const drawerKeys = markTemplateDrawerRead(template, storage)

  assert.equal(isTemplateUnread(drawerKeys, template), false)
  assert.equal(isTemplateUnread(readUnreadTemplateDrawerKeys(storage), template), false)
  assert.equal(isTemplateUnread(readUnreadTemplateKeys(storage), template), true)
})

test('isolates matching template ids across workspaces', () => {
  const storage = createStorage()
  const keys = markTemplateUnread(template, storage)

  assert.equal(isTemplateUnread(keys, { id: 7, workspaceId: 'workspace-2' }), false)
})
