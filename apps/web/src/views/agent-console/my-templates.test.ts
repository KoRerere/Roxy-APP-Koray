import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import {
  isReservedOfficialTemplateSlug,
  mapMyTemplateItem,
  normalizeTemplateSlug,
  readUserTemplateMutation,
  sortMyTemplateItems,
} from './my-templates'

test('normalizes a parsed template slug before persistence', () => {
  assert.equal(normalizeTemplateSlug('  uploaded-template  '), 'uploaded-template')
})

test('omits missing or invalid parsed template slugs', () => {
  assert.equal(normalizeTemplateSlug('   '), undefined)
  assert.equal(normalizeTemplateSlug(null), undefined)
  assert.equal(normalizeTemplateSlug(123), undefined)
})

test('reserves the official script slug prefix for catalog templates', () => {
  assert.equal(isReservedOfficialTemplateSlug('official-user-script'), true)
  assert.equal(isReservedOfficialTemplateSlug('  Official-User-Script  '), true)
  assert.equal(isReservedOfficialTemplateSlug('user-official-script'), false)
  assert.equal(isReservedOfficialTemplateSlug('user-script'), false)
})

test('maps a snapshotted official icon from user template metadata', () => {
  const item = mapMyTemplateItem({
    id: 1,
    workspaceId: 'workspace-1',
    officialTemplateId: 8,
    templateType: 'skill',
    name: 'Demo Skill',
    description: null,
    source: 'official',
    metadata: {
      iconInfo: {
        icon: { light: ' https://cdn.example.com/icon.svg ', dark: 'https://cdn.example.com/icon-dark.svg' },
        primaryColor: { light: '#111111' },
        bgColor: { dark: '#222222' },
      },
    },
  })

  assert.deepEqual(item?.iconInfo, {
    icon: { light: 'https://cdn.example.com/icon.svg', dark: 'https://cdn.example.com/icon-dark.svg' },
    primaryColor: { light: '#111111' },
    bgColor: { dark: '#222222' },
  })
})

test('maps the user template top state for card presentation', () => {
  const item = mapMyTemplateItem({
    id: 4,
    workspaceId: 'workspace-1',
    templateType: 'prompt',
    name: 'Pinned prompt',
    source: 'custom',
    metadata: { prompt: 'Draft a report.' },
    isTopped: true,
  })

  assert.equal(item?.isTopped, true)
})

test('sorts user template cards by the newest pin timestamp', () => {
  const template = (id: number, isTopped: boolean, toppedAt?: string) => ({
    id,
    workspaceId: 'workspace-1',
    kind: 'prompt' as const,
    name: `Template ${id}`,
    description: '',
    source: 'custom',
    iconInfo: null,
    metadata: {},
    isTopped,
    toppedAt: toppedAt ?? null,
  })

  const sorted = sortMyTemplateItems([
    template(1, true, '2026-09-03T08:00:00.000Z'),
    template(2, false),
    template(3, true, '2026-09-03T09:00:00.000Z'),
  ])

  assert.deepEqual(sorted.map(item => item.id), [3, 1, 2])
})

test('ignores malformed icon metadata', () => {
  const item = mapMyTemplateItem({
    id: 2,
    workspaceId: 'workspace-1',
    templateType: 'script',
    name: 'Demo Script',
    source: 'custom',
    metadata: { iconInfo: { icon: 'invalid' } },
  })

  assert.equal(item?.iconInfo, null)
})

test('maps script schema and persisted params from user template details', () => {
  const detail = readUserTemplateMutation({
    code: 0,
    data: {
      id: 3,
      workspaceId: 'workspace-1',
      officialTemplateId: 9,
      templateType: 'script',
      name: 'Search Script',
      description: 'Searches the web',
      source: 'official',
      metadata: {
        optionsSchema: '{"type":"object"}',
        params: {
          keyword: 'Roxy',
          profile: { retries: 3 },
        },
      },
    },
  }, 'Failed to load template detail')

  assert.deepEqual(mapMyTemplateItem(detail)?.metadata, {
    optionsSchema: '{"type":"object"}',
    params: {
      keyword: 'Roxy',
      profile: { retries: 3 },
    },
  })
})
