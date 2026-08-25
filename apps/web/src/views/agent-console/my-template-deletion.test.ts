import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import type { MyTemplateItem } from './my-templates'
import { deleteMyTemplate } from './my-template-deletion'

function template(overrides: Partial<MyTemplateItem> = {}): MyTemplateItem {
  return {
    id: 42,
    workspaceId: 'workspace-1',
    kind: 'skill',
    name: 'Research Skill',
    description: '',
    source: 'custom',
    iconInfo: null,
    metadata: { packageSlug: 'research-skill' },
    ...overrides,
  }
}

test('deletes an installed Skill before deleting its remote user template', async () => {
  // Regression: deleting a Skill template left its installed SKILL.md directory on disk.
  // Fixed by: removing the installed slug before deleting the remote template record.
  const calls: string[] = []

  await deleteMyTemplate(template(), {
    deleteInstalledSkill: async (slug) => {
      calls.push(`local:${slug}`)
    },
    deleteRemoteTemplate: async (templateId) => {
      calls.push(`remote:${templateId}`)
    },
  })

  assert.deepEqual(calls, ['local:research-skill', 'remote:42'])
})

test('does not delete local assets for script or prompt templates', async () => {
  const localSlugs: string[] = []
  const remoteIds: number[] = []
  const dependencies = {
    deleteInstalledSkill: async (slug: string) => {
      localSlugs.push(slug)
    },
    deleteRemoteTemplate: async (templateId: number) => {
      remoteIds.push(templateId)
    },
  }

  await deleteMyTemplate(template({ id: 1, kind: 'script' }), dependencies)
  await deleteMyTemplate(template({ id: 2, kind: 'prompt' }), dependencies)

  assert.deepEqual(localSlugs, [])
  assert.deepEqual(remoteIds, [1, 2])
})

test('keeps the remote template when installed Skill deletion fails', async () => {
  let remoteDeleted = false

  await assert.rejects(deleteMyTemplate(template(), {
    deleteInstalledSkill: async () => {
      throw new Error('local delete failed')
    },
    deleteRemoteTemplate: async () => {
      remoteDeleted = true
    },
  }), /local delete failed/)

  assert.equal(remoteDeleted, false)
})
