import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import type { UserTemplateDTO } from '../../my-templates'
import { templateItemToPrompt } from './protocol'
import {
  mapRecommendedTemplateComposerItem,
  mapUserTemplateComposerItem,
  mergeTemplateComposerItems,
  recommendedTemplateToChatPrompt,
  scriptTemplateToRunPrompt,
  setAgentSkillInstalledRoot,
  userScriptTemplateToRunPrompt,
  userTemplateToChatPrompt,
  userTemplateToPrompt,
  userTemplateToReference,
} from './templateItems'

(globalThis as typeof globalThis & { $t: (key: string, params?: Record<string, string>) => string }).$t = (key, params = {}) => {
  return key.replace(/\{(\w+)\}/g, (_match: string, name: string) => params[name] ?? `{${name}}`)
}

const skillRoot = '/tmp/roxy-agent/library/skills/installed'
const skillPath = `${skillRoot}/amazon-price-tracker/SKILL.md`
const configuredSkillPath = `${skillRoot}/configured-skill/SKILL.md`
const officialSkillPath = `${skillRoot}/official-skill/SKILL.md`

setAgentSkillInstalledRoot(skillRoot)

function userTemplate(overrides: Partial<UserTemplateDTO> = {}): UserTemplateDTO {
  return {
    id: 42,
    workspaceId: 'workspace-1',
    templateType: 'script',
    name: 'Team script',
    description: 'Template description',
    source: 'official',
    metadata: {},
    ...overrides,
  }
}

test('user script template serializes its canonical reference before the auxiliary prompt', () => {
  const item = mapUserTemplateComposerItem(userTemplate({
    metadata: {
      scriptPath: 'official-team-script',
      prompt: 'Run it for the selected windows.',
    },
  }))

  assert.equal(item.id, 'user-template-42')
  assert.equal(item.payload.userTemplateId, '42')
  assert.equal(item.payload.workspaceId, 'workspace-1')
  assert.equal(
    templateItemToPrompt(item),
    '[@script:Team script](user:42) Run it for the selected windows.',
  )
  assert.equal(
    userTemplateToPrompt(userTemplate({
      metadata: {
        prompt: 'Run it for the selected windows.',
      },
    })),
    '[@script:Team script](user:42) Run it for the selected windows.',
  )
  assert.equal(
    userTemplateToReference(userTemplate({ metadata: { prompt: 'Ignored auxiliary prompt.' } })),
    '[@script:Team script](user:42)',
  )
  assert.equal(
    userScriptTemplateToRunPrompt(userTemplate()),
    '在 [@profile:0]() 窗口中运行 [@script:Team script](user:42)',
  )
  assert.equal(
    userTemplateToChatPrompt(userTemplate()),
    '在 [@profile:0]() 窗口中运行 [@script:Team script](user:42)',
  )
  assert.equal(
    scriptTemplateToRunPrompt('Official script', 'official:88'),
    '在 [@profile:0]() 窗口中运行 [@script:Official script](official:88)',
  )
  assert.equal(scriptTemplateToRunPrompt('Legacy script', '88'), '')
})

test('recommended Script slash selection inserts only an official Script reference', () => {
  const item = mapRecommendedTemplateComposerItem({
    id: 104,
    kind: 'script',
    title: 'TikTok For You Account Nurturing',
    description: 'Browse TikTok videos.',
    iconName: 'roxy-agent/rx-ic-scripts',
    prompt: 'This run prompt belongs to the home Execute action.',
  })

  assert.equal(item.payload.officialTemplateId, '104')
  assert.equal(
    templateItemToPrompt(item),
    '[@script:TikTok For You Account Nurturing](official:104)',
  )
})

test('recommended Skill uses a canonical installed SKILL.md path', () => {
  const item = mapRecommendedTemplateComposerItem({
    id: 105,
    kind: 'skill',
    title: 'Competitor teardown',
    description: 'Analyze a competitor.',
    iconName: 'roxy-agent/rx-ic-skills',
    metadata: { packageSlug: 'amazon-price-tracker' },
    prompt: 'Analyze the selected competitor.',
  })

  assert.equal(item.template?.tokens[0]?.payload.skillPath, skillPath)
  assert.equal(
    templateItemToPrompt(item),
    `[$Competitor teardown](${skillPath}) Analyze the selected competitor.`,
  )
})

test('recommended Skill derives its package slug from an official template slug when metadata is missing', () => {
  const item = mapRecommendedTemplateComposerItem({
    id: 137,
    slug: 'official-viral-trend-catcher',
    kind: 'skill',
    title: '社媒爆品评估',
    description: '评估爆款潜力。',
    iconName: 'roxy-agent/rx-ic-skills',
    prompt: '评估这个产品。',
  })

  const viralTrendSkillPath = `${skillRoot}/viral-trend-catcher/SKILL.md`
  assert.equal(item.template?.tokens[0]?.payload.skillPath, viralTrendSkillPath)
  assert.equal(templateItemToPrompt(item), `[$社媒爆品评估](${viralTrendSkillPath}) 评估这个产品。`)
})

test('user template metadata never changes the user template reference', () => {
  const item = mapUserTemplateComposerItem(userTemplate({
    id: 73,
    metadata: {
      ossUrl: 'https://oss.example.com/scripts/team-script.js',
      fileId: 'file-73',
      scriptPath: 'legacy-script-path',
      prompt: 'Use the configured script.',
    },
  }))

  assert.equal(
    templateItemToPrompt(item),
    '[@script:Team script](user:73) Use the configured script.',
  )
})

test('user Skill uses a canonical installed SKILL.md path from package slug metadata', () => {
  const item = mapUserTemplateComposerItem(userTemplate({
    templateType: 'skill',
    name: 'Readable Skill Name',
    metadata: {
      packageSlug: 'amazon-price-tracker',
      skillMetadata: {
        name: 'official-internal-slug',
        entry: 'SKILL.md',
      },
      skills: [{ name: 'legacy-internal-slug', entry: 'SKILL.md' }],
      prompt: 'Auxiliary prompt.',
    },
  }))

  assert.equal(item.template?.tokens[0]?.title, 'Readable Skill Name')
  assert.equal(item.template?.tokens[0]?.payload.skillPath, skillPath)
  assert.equal(
    templateItemToPrompt(item),
    `[$Readable Skill Name](${skillPath}) Auxiliary prompt.`,
  )
})

test('official-derived user Skill strips the template slug prefix when package slug metadata is missing', () => {
  const item = mapUserTemplateComposerItem(userTemplate({
    id: 137,
    officialTemplateId: 137,
    templateType: 'skill',
    name: '社媒爆品评估',
    metadata: {
      slug: 'official-viral-trend-catcher',
      prompt: '评估这个产品。',
    },
  }))

  const viralTrendSkillPath = `${skillRoot}/viral-trend-catcher/SKILL.md`
  assert.equal(item.template?.tokens[0]?.payload.skillSlug, 'viral-trend-catcher')
  assert.equal(item.template?.tokens[0]?.payload.skillPath, viralTrendSkillPath)
  assert.equal(templateItemToPrompt(item), `[$社媒爆品评估](${viralTrendSkillPath}) 评估这个产品。`)
})

test('user prompt template only expands its prompt text', () => {
  const promptItem = mapUserTemplateComposerItem(userTemplate({
    templateType: 'prompt',
    metadata: { prompt: 'Write a concise report.' },
  }))
  const emptyScriptItem = mapUserTemplateComposerItem(userTemplate())

  assert.equal(templateItemToPrompt(promptItem), 'Write a concise report.')
  assert.equal(templateItemToPrompt(emptyScriptItem), '[@script:Team script](user:42)')
})

test('a matching user template replaces a recommended item with its user reference', () => {
  const recommended = mapRecommendedTemplateComposerItem({
    id: 8,
    kind: 'script',
    title: 'Recommended script',
    description: 'Recommended description',
    iconName: 'roxy-agent/rx-ic-scripts',
    prompt: '',
  })
  const installedPreset = mapUserTemplateComposerItem(userTemplate({
    id: 42,
    officialTemplateId: 8,
    metadata: { prompt: 'Use the installed template.' },
  }))
  const customTemplate = mapUserTemplateComposerItem(userTemplate({ id: 43, officialTemplateId: null }))
  const otherOfficialTemplate = mapUserTemplateComposerItem(userTemplate({ id: 44, officialTemplateId: 9 }))

  const merged = mergeTemplateComposerItems([recommended], [installedPreset, customTemplate, otherOfficialTemplate])

  assert.deepEqual(merged.map(item => item.id), ['user-template-42', 'user-template-43', 'user-template-44'])
  assert.equal(merged[0], installedPreset)
  assert.equal(templateItemToPrompt(merged[0]!), '[@script:Team script](user:42) Use the installed template.')
})

test('home recommendations prefer matching user templates for every template kind', () => {
  assert.equal(
    recommendedTemplateToChatPrompt({
      id: 8,
      kind: 'script',
      title: 'Official script',
      description: 'Official script description',
      iconName: 'roxy-agent/rx-ic-scripts',
      prompt: '',
    }, userTemplate({
      id: 81,
      officialTemplateId: 8,
      name: 'Configured script',
    })),
    '在 [@profile:0]() 窗口中运行 [@script:Configured script](user:81)',
  )
  assert.equal(
    recommendedTemplateToChatPrompt({
      id: 9,
      kind: 'skill',
      title: 'Official skill',
      description: 'Official skill description',
      iconName: 'roxy-agent/rx-ic-skills',
      prompt: 'Official usage example.',
    }, userTemplate({
      id: 91,
      officialTemplateId: 9,
      templateType: 'skill',
      name: 'Configured skill',
      metadata: { packageSlug: 'configured-skill', prompt: 'Configured usage example.' },
    })),
    `[$Configured skill](${configuredSkillPath}) Configured usage example.`,
  )
  assert.equal(
    recommendedTemplateToChatPrompt({
      id: 10,
      kind: 'prompt',
      title: 'Official prompt',
      description: 'Official prompt description',
      iconName: 'roxy-agent/rx-ic-prompts',
      prompt: 'Official prompt text.',
    }, userTemplate({
      id: 101,
      officialTemplateId: 10,
      templateType: 'prompt',
      name: 'Configured prompt',
      metadata: { prompt: 'Configured prompt text.' },
    })),
    'Configured prompt text.',
  )
})

test('home recommendations use official templates when no matching user template exists', () => {
  assert.equal(
    recommendedTemplateToChatPrompt({
      id: 8,
      kind: 'script',
      title: 'Official script',
      description: 'Official script description',
      iconName: 'roxy-agent/rx-ic-scripts',
      prompt: '',
    }),
    '在 [@profile:0]() 窗口中运行 [@script:Official script](official:8)',
  )
  assert.equal(
    recommendedTemplateToChatPrompt({
      id: 9,
      kind: 'skill',
      slug: 'official-skill',
      title: 'Official skill',
      description: 'Official skill description',
      iconName: 'roxy-agent/rx-ic-skills',
      metadata: { packageSlug: 'official-skill' },
      prompt: 'Official usage example.',
    }),
    `[$Official skill](${officialSkillPath}) Official usage example.`,
  )
  assert.equal(
    recommendedTemplateToChatPrompt({
      id: 10,
      kind: 'prompt',
      title: 'Official prompt',
      description: 'Official prompt description',
      iconName: 'roxy-agent/rx-ic-prompts',
      prompt: 'Official prompt text.',
    }, userTemplate({
      id: 111,
      officialTemplateId: 11,
      templateType: 'prompt',
      metadata: { prompt: 'Unrelated prompt text.' },
    })),
    'Official prompt text.',
  )
})
