import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import {
  getInvalidTemplateReferenceLabels,
  getMissingComposerTokenLabels,
  hasComposerProtocolTokens,
  parsePromptString,
  serializePromptDoc,
  updateInputTokenValue,
} from './protocol'
import type { AgentComposerItem } from './types'

const profiles: AgentComposerItem[] = [
  {
    id: 'profile-mou-72',
    kind: 'profile',
    title: 'MOU-72 · dance_daily',
    label: 'MOU-72 · dance_daily',
    description: 'tiktok.com/@dance_daily',
    iconName: 'base/rx_ic_at',
    group: 'Windows',
    payload: { dirId: 'profile-mou-72' },
  },
  {
    id: 'profile-mou-89',
    kind: 'profile',
    title: 'MOU-89 · store_admin',
    label: 'MOU-89 · store_admin',
    description: 'facebook.com/store_admin',
    iconName: 'base/rx_ic_at',
    group: 'Windows',
    payload: { dirId: 'profile-mou-89' },
  },
]

describe('prompt line breaks', () => {
  it('preserves Shift+Enter hard breaks when serializing the editor document', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'first line' },
          { type: 'hardBreak' },
          { type: 'text', text: 'second line' },
        ],
      }],
    }

    assert.equal(serializePromptDoc(doc), 'first line\nsecond line')
  })
})

describe('prompt links', () => {
  it('parses explicit markdown links into rendered link marks', () => {
    const href = 'https://test.roxybrowser.cn/download'
    const prompt = `Open link: [${href}](${href})`
    const doc = parsePromptString(prompt, { profiles: [], slashItems: [] })
    const nodes = doc.content?.[0]?.content ?? []

    assert.deepEqual(nodes, [
      { type: 'text', text: 'Open link: ' },
      {
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href, markdownSource: `[${href}](${href})` } }],
      },
    ])
    assert.equal(serializePromptDoc(doc), prompt)
  })

  it('keeps protocol tokens from being parsed as ordinary markdown links', () => {
    const prompt = 'Run [@profile:1](profile-mou-72)'
    const doc = parsePromptString(prompt, { profiles, slashItems: [] })

    assert.equal(doc.content?.[0]?.content?.[1]?.type, 'agentToken')
    assert.equal(serializePromptDoc(doc), prompt)
  })

  it('preserves a pasted rich link href when its visible text is the page title', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: '翻译 - 搜索',
          marks: [{ type: 'link', attrs: { href: 'https://www.google.com/search?q=translate' } }],
        }],
      }],
    }

    assert.equal(
      serializePromptDoc(doc),
      '[翻译 - 搜索](https://www.google.com/search?q=translate)',
    )
  })

  it('keeps text typed after a rich link outside the serialized link', () => {
    const href = 'https://www.tiktok.com/search?q=%E5%B8%A6%E8%B4%A7'
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '在 TikTok 上查找“带货” | TikTok 搜索',
            marks: [{ type: 'link', attrs: { href } }],
          },
          { type: 'text', text: '这是什么' },
        ],
      }],
    }

    assert.equal(
      serializePromptDoc(doc),
      `[在 TikTok 上查找“带货” | TikTok 搜索](${href})这是什么`,
    )
  })

  it('uses explicit markdown to preserve the boundary after a visible URL', () => {
    const href = 'https://cn.bing.com/search?q=%E7%BF%BB%E8%AF%91'
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: href,
            marks: [{ type: 'link', attrs: { href } }],
          },
          { type: 'text', text: '这是什么链接还是文本' },
        ],
      }],
    }

    assert.equal(
      serializePromptDoc(doc),
      `[${href}](${href})这是什么链接还是文本`,
    )
  })

  it('keeps a visible URL as a plain URL instead of wrapping it in redundant markdown', () => {
    const href = 'https://example.com/docs'
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: href,
          marks: [{ type: 'link', attrs: { href } }],
        }],
      }],
    }

    assert.equal(serializePromptDoc(doc), href)
  })

  it('serializes adjacent text nodes from the same rich link only once', () => {
    const href = 'https://example.com/search'
    const link = { type: 'link', attrs: { href } }
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: '翻译', marks: [link] },
          { type: 'text', text: ' - 搜索', marks: [link, { type: 'bold' }] },
        ],
      }],
    }

    assert.equal(serializePromptDoc(doc), `[翻译 - 搜索](${href})`)
  })
})

describe('profile protocol tokens', () => {
  it('detects composer protocol tokens before custom paste handling', () => {
    assert.equal(hasComposerProtocolTokens('[@script:Cookie机器人](official:104) run [@profile:1](profile-mou-72)'), true)
    assert.equal(hasComposerProtocolTokens('我的产品：[input:产品名]'), true)
    assert.equal(hasComposerProtocolTokens('Open [@profile:0]()'), true)
    assert.equal(hasComposerProtocolTokens('[$Batch account nurturing](user:42)'), true)
    assert.equal(hasComposerProtocolTokens('[@script:Legacy](104)'), false)
    assert.equal(hasComposerProtocolTokens('[$Legacy](/skills/batch/SKILL.md)'), false)
    assert.equal(hasComposerProtocolTokens('plain text with https://example.com'), false)
  })

  it('serializes a profile aggregate token as one count token with comma-separated dirIds', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          {
            type: 'agentToken',
            attrs: {
              id: 'profile-mou-72,profile-mou-89',
              kind: 'profile',
              title: 'Window × 2',
              label: 'Window × 2',
              description: '',
              iconName: 'base/rx_ic_browser',
              group: 'Windows',
              payload: { dirIds: 'profile-mou-72,profile-mou-89' },
            },
          },
        ],
      }],
    }

    assert.equal(serializePromptDoc(doc), '[@profile:2](profile-mou-72,profile-mou-89)')
  })

  it('parses a count token with dirIds back into one profile aggregate node', () => {
    const doc = parsePromptString('Run [@profile:2](profile-mou-72,profile-mou-89)', {
      profiles,
      slashItems: [],
    })

    assert.deepEqual(doc.content?.[0]?.content?.map(node => node.type), ['text', 'agentToken'])
    assert.equal(doc.content?.[0]?.content?.[1]?.attrs?.title, 'Window × 2')
    assert.equal(doc.content?.[0]?.content?.[1]?.attrs?.payload?.dirIds, 'profile-mou-72,profile-mou-89')
  })

  it('parses an empty profile token as the default unselected window token', () => {
    const doc = parsePromptString('Open [@profile:0]()', {
      profiles,
      slashItems: [],
    })

    assert.equal(doc.content?.[0]?.content?.[1]?.attrs?.kind, 'profile')
    assert.equal(doc.content?.[0]?.content?.[1]?.attrs?.title, 'Window × 0')
    assert.equal(serializePromptDoc(doc), 'Open [@profile:0]()')
    assert.deepEqual(getMissingComposerTokenLabels(serializePromptDoc(doc)), [])
  })

  it('does not report a selected profile token as missing', () => {
    assert.deepEqual(
      getMissingComposerTokenLabels('Open [@profile:1](profile-mou-72)'),
      [],
    )
  })
})

describe('template protocol tokens', () => {
  const slashItems: AgentComposerItem[] = [
    {
      id: 'official:104',
      kind: 'script',
      title: 'Cookie机器人',
      label: 'Cookie机器人',
      description: '',
      iconName: 'roxy-agent/rx-ic-scripts',
      group: 'Scripts',
      payload: { templateRef: 'official:104' },
    },
    {
      id: 'user:42',
      kind: 'skill',
      title: 'Batch account nurturing',
      label: 'Batch account nurturing',
      description: '',
      iconName: 'roxy-agent/rx-ic-skills',
      group: 'Skills',
      payload: { templateRef: 'user:42' },
    },
  ]

  it('restores canonical Script and Skill references only when the kind and ref match', () => {
    const doc = parsePromptString(
      'Run [@script:Cookie机器人](official:104) with [$Batch account nurturing](user:42)',
      { profiles: [], slashItems },
    )
    const nodes = doc.content?.[0]?.content ?? []

    assert.equal(nodes[1]?.attrs?.kind, 'script')
    assert.equal(nodes[1]?.attrs?.payload?.templateRef, 'official:104')
    assert.equal(nodes[3]?.attrs?.kind, 'skill')
    assert.equal(nodes[3]?.attrs?.payload?.templateRef, 'user:42')
    assert.equal(
      serializePromptDoc(doc),
      'Run [@script:Cookie机器人](official:104) with [$Batch account nurturing](user:42)',
    )
  })

  it('restores canonical references before slash items are loaded', () => {
    const prompt = 'Run [@script:Cookie机器人](official:104) with [$Batch account nurturing](user:42)'
    const doc = parsePromptString(prompt, { profiles: [], slashItems: [] })
    const nodes = doc.content?.[0]?.content ?? []

    assert.equal(nodes[1]?.attrs?.kind, 'script')
    assert.equal(nodes[1]?.attrs?.payload?.templateRef, 'official:104')
    assert.equal(nodes[3]?.attrs?.kind, 'skill')
    assert.equal(nodes[3]?.attrs?.payload?.templateRef, 'user:42')
    assert.equal(serializePromptDoc(doc), prompt)
  })

  it('keeps an official reference when the loaded candidate uses its acquired user reference', () => {
    const acquiredSlashItems: AgentComposerItem[] = [{
      id: 'user:73',
      kind: 'script',
      title: 'Cookie机器人',
      label: 'Cookie机器人',
      description: '',
      iconName: 'roxy-agent/rx-ic-scripts',
      group: 'Scripts',
      payload: {
        officialTemplateId: '104',
        templateRef: 'user:73',
      },
    }]
    const prompt = '[@script:Cookie机器人](official:104)'
    const doc = parsePromptString(prompt, { profiles: [], slashItems: acquiredSlashItems })

    assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.kind, 'script')
    assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.payload?.templateRef, 'official:104')
    assert.equal(serializePromptDoc(doc), prompt)
  })

  it('keeps legacy numeric and local-path template references as text', () => {
    const prompt = 'Run [@script:Legacy](104) with [$Legacy skill](/skills/legacy/SKILL.md)'
    const doc = parsePromptString(prompt, { profiles: [], slashItems })
    const nodes = doc.content?.[0]?.content ?? []

    assert.ok(nodes.every(node => node.type === 'text'))
    assert.equal(nodes.map(node => node.text).join(''), prompt)
    assert.equal(serializePromptDoc(doc), prompt)
    assert.deepEqual(getInvalidTemplateReferenceLabels(prompt), ['Legacy', 'Legacy skill'])
  })

  it('does not recover a canonical reference through a title or cross-kind fallback', () => {
    const prompt = '[$Cookie机器人](official:104)'
    const doc = parsePromptString(prompt, { profiles: [], slashItems })

    assert.deepEqual(doc.content?.[0]?.content, [{ type: 'text', text: prompt }])
    assert.deepEqual(getInvalidTemplateReferenceLabels(prompt), [])
  })
})

describe('input protocol tokens', () => {
  it('parses empty input placeholders and reports them as missing', () => {
    const doc = parsePromptString('我的产品：[input:产品名]；目标市场：[input:目标市场]()', {
      profiles: [],
      slashItems: [],
    })

    assert.equal(doc.content?.[0]?.content?.[1]?.attrs?.kind, 'input')
    assert.equal(doc.content?.[0]?.content?.[1]?.attrs?.title, '产品名')
    assert.deepEqual(getMissingComposerTokenLabels(serializePromptDoc(doc)), ['产品名', '目标市场'])
  })

  it('serializes filled input chips as plain text', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: '我的产品：' },
          {
            type: 'agentToken',
            attrs: {
              id: 'input:产品名',
              kind: 'input',
              title: '产品名',
              label: '产品名',
              description: '',
              iconName: 'roxy-agent/rx-ic-prompts',
              group: 'Inputs',
              payload: { name: '产品名', value: 'XX榨汁杯' },
            },
          },
        ],
      }],
    }

    assert.equal(serializePromptDoc(doc), '我的产品：XX榨汁杯')
  })

  it('reports empty input tokens but allows an unselected profile token before send', () => {
    assert.deepEqual(
      getMissingComposerTokenLabels('我的产品：[input:产品名]() 打开 [@profile:0]()'),
      ['产品名'],
    )
  })

  it('updates all input tokens with the same title together', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          {
            type: 'agentToken',
            attrs: {
              id: 'input:产品名-1',
              kind: 'input',
              title: '产品名',
              label: '产品名',
              description: '',
              iconName: 'roxy-agent/rx-ic-prompts',
              group: 'Inputs',
              payload: { name: '产品名', value: '' },
            },
          },
          { type: 'text', text: ' / ' },
          {
            type: 'agentToken',
            attrs: {
              id: 'input:产品名-2',
              kind: 'input',
              title: '产品名',
              label: '产品名',
              description: '',
              iconName: 'roxy-agent/rx-ic-prompts',
              group: 'Inputs',
              payload: { name: '产品名', value: '' },
            },
          },
        ],
      }],
    }

    assert.equal(
      serializePromptDoc(updateInputTokenValue(doc, '产品名', 'XX榨汁杯')),
      'XX榨汁杯 / XX榨汁杯',
    )
  })
})
