import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import type { UserTemplateDTO } from './my-templates'
import type { UserTaskDTO } from './task-manager'
import { buildTemplateTaskComposerPrompt } from './template-task-execution'

function template(overrides: Partial<UserTemplateDTO> = {}): UserTemplateDTO {
  return {
    id: 7,
    workspaceId: 'workspace-1',
    templateType: 'skill',
    name: 'Research Skill',
    source: 'official',
    metadata: { skillMdPath: 'SKILL.md' },
    ...overrides,
  }
}

function task(overrides: Partial<UserTaskDTO> = {}): UserTaskDTO {
  return {
    id: 3,
    workspaceId: 'workspace-1',
    name: 'Research task',
    userTemplateId: 7,
    windowIds: ['window-a', 'window-b'],
    metadata: { prompt: 'Summarize recent changes.' },
    planType: 'manual',
    enabled: true,
    ...overrides,
  }
}

test('Skill task composer prompt preserves the template token, snapshot prompt, and windows', () => {
  assert.equal(
    buildTemplateTaskComposerPrompt(template(), task()),
    '[$Research Skill](user:7) Summarize recent changes. [@profile:2](window-a,window-b)',
  )
})

test('Skill task can run without an auxiliary prompt', () => {
  assert.equal(
    buildTemplateTaskComposerPrompt(template(), task({ metadata: { prompt: null } })),
    '[$Research Skill](user:7) [@profile:2](window-a,window-b)',
  )
})

test('Prompt task uses its task snapshot and selected window token', () => {
  assert.equal(
    buildTemplateTaskComposerPrompt(template({
      templateType: 'prompt',
      name: 'Report Prompt',
      metadata: { prompt: 'Current template text' },
    }), task({
      windowIds: ['window-a'],
      metadata: { prompt: 'Snapshotted task text' },
    })),
    'Snapshotted task text [@profile:1](window-a)',
  )
})
