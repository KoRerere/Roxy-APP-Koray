import assert from 'node:assert/strict'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'
import { AiAgentHttpError } from '@/api/errors'
import { env } from '@/config'
import { getScriptSelfDescription, getScriptSelfDescriptionTool, localizeScriptSelfDescription } from './get_script_self_description'

const agentApiMocks = vi.hoisted(() => ({
  getOfficialScriptBySlug: vi.fn(),
  getOfficialTemplateById: vi.fn(),
  getUserTemplateById: vi.fn(),
}))

vi.mock('@/api/agentApiClient', () => ({
  agentOfficialScriptsApi: {
    getBySlug: agentApiMocks.getOfficialScriptBySlug,
  },
  agentTemplatesApi: {
    getById: agentApiMocks.getOfficialTemplateById,
  },
  agentUserTemplatesApi: {
    getById: agentApiMocks.getUserTemplateById,
  },
}))

const originalSystemLanguage = env.SYSTEM_LANGUAGE

afterEach(() => {
  env.SYSTEM_LANGUAGE = originalSystemLanguage
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('localizes self-description for the system language without mutating the extracted data', () => {
  env.SYSTEM_LANGUAGE = 'zh-CN'
  const result = {
    script: {
      slug: 'search-videos',
      name: 'search-videos',
      scriptFile: '/tmp/search-videos.ts',
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    metadata: {
      name: { zh: '搜索视频', us: 'Search videos', ru: 'Поиск видео' },
      description: {
        zh: ['# 功能', '搜索并观看视频。'],
        us: ['# Purpose', 'Search and watch videos.'],
        ru: ['# Назначение', 'Поиск и просмотр видео.'],
      },
    },
    paramsSchema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: { zh: '搜索关键词', us: 'Search keyword', ru: 'Ключевое слово для поиска' },
          enum: ['news', 'music'],
        },
      },
      required: ['keyword'],
    },
  }

  const localized = localizeScriptSelfDescription(result)

  assert.equal(localized.script.name, '搜索视频')
  assert.equal(localized.metadata.name, '搜索视频')
  assert.equal(localized.metadata.description, '# 功能\n搜索并观看视频。')
  assert.equal(
    (localized.paramsSchema.properties?.keyword as { description?: string }).description,
    '搜索关键词',
  )
  assert.deepEqual(
    (localized.paramsSchema.properties?.keyword as { enum?: string[] }).enum,
    ['news', 'music'],
  )
  assert.deepEqual(result.metadata.name, { zh: '搜索视频', us: 'Search videos', ru: 'Поиск видео' })
})

it('maps Russian to ru and other system languages to us', () => {
  const result = {
    script: {
      slug: 'localized-script',
      name: 'localized-script',
      scriptFile: '/tmp/localized-script.ts',
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    metadata: {
      name: { zh: '中文', us: 'English', ru: 'Русский' },
    },
    paramsSchema: { type: 'object' as const, properties: {} },
  }

  env.SYSTEM_LANGUAGE = 'ru'
  assert.equal(localizeScriptSelfDescription(result).metadata.name, 'Русский')

  env.SYSTEM_LANGUAGE = 'en'
  assert.equal(localizeScriptSelfDescription(result).metadata.name, 'English')

  env.SYSTEM_LANGUAGE = 'de'
  assert.equal(localizeScriptSelfDescription(result).metadata.name, 'English')
})

it('returns only the selected language in the tool output', async () => {
  env.SYSTEM_LANGUAGE = 'zh-CN'
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-agent-'))
  const scriptFile = path.join(tempDir, 'localized-script.ts')
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({
  name: { zh: '搜索视频', us: 'Search videos', ru: 'Поиск видео' },
  description: {
    zh: ['# 功能', '搜索并观看视频。'],
    us: ['# Purpose', 'Search and watch videos.'],
    ru: ['# Назначение', 'Поиск и просмотр видео.'],
  },
})
defineParams({
  type: 'object',
  properties: {
    keyword: {
      type: 'string',
      description: { zh: '搜索关键词', us: 'Search keyword', ru: 'Ключевое слово для поиска' },
    },
  },
  required: ['keyword'],
})

export async function main(params) {
  console.log(params.keyword)
}
`
  await fsPromises.writeFile(scriptFile, code, 'utf-8')

  const output = await getScriptSelfDescriptionTool.invoke({ scriptPath: scriptFile }) as string

  assert.match(output, /"name": "搜索视频"/)
  assert.match(output, /"description": "# 功能\\n搜索并观看视频。"/)
  assert.match(output, /"description": "搜索关键词"/)
  assert.doesNotMatch(output, /Search videos|Поиск видео|Search keyword|Ключевое слово/)
})

it('resolves an official script self-description from the detail API without downloading it', async () => {
  env.SYSTEM_LANGUAGE = 'zh-CN'
  const fetchMock = vi.fn()
  const getBySlug = vi.fn(async () => ({
    slug: 'official-bing-search',
    name: { zh: '必应搜索', en: 'Bing search', ru: 'Поиск Bing' },
    description: { zh: '按关键词搜索', en: 'Search by keyword', ru: 'Поиск по ключевому слову' },
    version: 3,
    optionsSchema: JSON.stringify({
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: { cn: '搜索关键词', en: 'Search keyword', ru: 'Ключевое слово' },
        },
      },
      required: ['keyword'],
    }),
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }))
  agentApiMocks.getOfficialScriptBySlug.mockImplementation(getBySlug)
  vi.stubGlobal('fetch', fetchMock)

  const result = await getScriptSelfDescription({ scriptPath: 'official-bing-search' })

  assert.deepEqual(getBySlug.mock.calls, [['official-bing-search']])
  assert.equal(fetchMock.mock.calls.length, 0)
  assert.equal(result.script.slug, 'official-bing-search')
  assert.equal(result.script.scriptFile, 'official-bing-search')
  assert.equal(result.script.name, '必应搜索')
  assert.equal(result.metadata.version, '3')
  assert.equal((result.metadata.name as Record<string, string>).us, 'Bing search')
  assert.deepEqual(result.paramsSchema.required, ['keyword'])

  const localized = localizeScriptSelfDescription(result)
  assert.equal(localized.metadata.description, '按关键词搜索')
  assert.equal(
    (localized.paramsSchema.properties?.keyword as { description?: string }).description,
    '搜索关键词',
  )

  const localizedEnglish = localizeScriptSelfDescription(result, 'en')
  assert.equal(localizedEnglish.metadata.name, 'Bing search')
  assert.equal(localizedEnglish.metadata.description, 'Search by keyword')
  assert.equal(
    (localizedEnglish.paramsSchema.properties?.keyword as { description?: string }).description,
    'Search keyword',
  )
})

it('resolves a user script template reference self-description with saved template params', async () => {
  env.SYSTEM_LANGUAGE = 'zh-CN'
  agentApiMocks.getUserTemplateById.mockImplementation(async (templateId: number) => {
    assert.equal(templateId, 73)
    return {
      id: 73,
      templateType: 'script',
      name: '团队脚本',
      description: '已配置参数的脚本模板',
      metadata: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/scripts/team.ts',
        sha512: 'a'.repeat(128),
        params: { keyword: 'shoes', limit: 5 },
        optionsSchema: JSON.stringify({
          type: 'object',
          properties: {
            keyword: { type: 'string', description: { zh: '搜索关键词', en: 'Search keyword' } },
            limit: { type: 'number', description: { zh: '数量', en: 'Limit' } },
          },
          required: ['keyword'],
        }),
      },
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-15T00:00:00.000Z',
    }
  })

  const result = await getScriptSelfDescription({ scriptPath: 'user:73' })

  assert.equal(result.script.scriptFile, 'user:73')
  assert.equal(result.script.name, '团队脚本')
  assert.equal(result.metadata.name, '团队脚本')
  assert.deepEqual(result.templateParams, { keyword: 'shoes', limit: 5 })
  assert.deepEqual(result.paramsSchema.required, ['keyword'])

  const localized = localizeScriptSelfDescription(result)
  assert.equal(
    (localized.paramsSchema.properties?.keyword as { description?: string }).description,
    '搜索关键词',
  )
})

it('resolves an official script template reference without querying the user namespace', async () => {
  env.SYSTEM_LANGUAGE = 'zh-CN'
  const userGetById = vi.fn(async () => {
    throw new AiAgentHttpError(404, 'Template not found')
  })
  const officialGetById = vi.fn(async (templateId: number) => {
    assert.equal(templateId, 88)
    return {
      id: 88,
      slug: 'official-template-88',
      templateType: 'script',
      name: { zh: '官方模板脚本', en: 'Official template script' },
      description: { zh: '直接运行官方模板', en: 'Run the official template directly' },
      metadata: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/scripts/official.ts',
        sha512: 'a'.repeat(128),
        params: { keyword: '默认关键词' },
        optionsSchema: JSON.stringify({
          type: 'object',
          properties: {
            keyword: { type: 'string', description: { zh: '搜索关键词', en: 'Search keyword' } },
          },
          required: ['keyword'],
        }),
      },
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-21T00:00:00.000Z',
    }
  })
  const fetchMock = vi.fn()
  agentApiMocks.getUserTemplateById.mockImplementation(userGetById)
  agentApiMocks.getOfficialTemplateById.mockImplementation(officialGetById)
  vi.stubGlobal('fetch', fetchMock)

  const result = await getScriptSelfDescription({ scriptPath: 'official:88' })

  assert.deepEqual(userGetById.mock.calls, [])
  assert.deepEqual(officialGetById.mock.calls, [[88]])
  assert.equal(fetchMock.mock.calls.length, 0)
  assert.equal(result.script.scriptFile, 'official:88')
  assert.equal(result.script.slug, 'official-template-88')
  assert.equal(result.script.name, '官方模板脚本')
  assert.deepEqual(result.templateParams, { keyword: '默认关键词' })
  assert.deepEqual(result.paramsSchema.required, ['keyword'])

  const localized = localizeScriptSelfDescription(result)
  assert.equal(localized.metadata.name, '官方模板脚本')
  assert.equal(localized.metadata.description, '直接运行官方模板')
  assert.equal(
    (localized.paramsSchema.properties?.keyword as { description?: string }).description,
    '搜索关键词',
  )
})

it('rejects bare numeric template ids before querying either namespace', async () => {
  await assert.rejects(
    getScriptSelfDescription({ scriptPath: '88' }),
    (error: any) => error?.code === 'invalid_template_ref',
  )

  assert.equal(agentApiMocks.getUserTemplateById.mock.calls.length, 0)
  assert.equal(agentApiMocks.getOfficialTemplateById.mock.calls.length, 0)
})

it('resolves script self-description from a library script file path', async () => {
  const scriptFile = '/tmp/roxy-agent/library/scripts/search-products.ts'
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Search products', description: 'Search by keyword' })
defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string', description: 'Search keyword' },
  },
  required: ['keyword'],
})

export async function main(options) {
  console.log(options.keyword)
}
`

  const result = await getScriptSelfDescription(
    { scriptPath: scriptFile },
    {
      get: () => null,
      list: () => [{
        slug: 'search-products',
        name: 'Search products',
        description: 'Search by keyword',
        scriptFile,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      }],
      readCode: slug => (slug === 'search-products' ? code : null),
    },
  )

  assert.equal(result.script.slug, 'search-products')
  assert.equal(result.metadata.name, 'Search products')
  assert.equal(result.metadata.description, 'Search by keyword')
  assert.equal(result.paramsSchema.type, 'object')
  const keywordSchema = result.paramsSchema.properties?.keyword as { type?: string }
  assert.equal(keywordSchema.type, 'string')
  assert.deepEqual(result.paramsSchema.required, ['keyword'])
})

it('parses defineParams statically without evaluating other top-level code', async () => {
  const scriptFile = '/tmp/roxy-agent/library/scripts/static-params.ts'
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

type ScriptParams = { keyword: string }

defineMetadata({ name: 'Static params' })
defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string' },
  },
  required: ['keyword'],
})

throw new Error('top-level code must not run')

export async function main(params: ScriptParams): Promise<void> {
  console.log(params.keyword)
}
`

  const result = await getScriptSelfDescription(
    { scriptPath: scriptFile },
    {
      get: () => null,
      list: () => [{
        slug: 'static-params',
        name: 'Static params',
        scriptFile,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      }],
      readCode: slug => (slug === 'static-params' ? code : null),
    },
  )

  assert.equal(result.metadata.name, 'Static params')
  const keywordSchema = result.paramsSchema.properties?.keyword as { type?: string }
  assert.equal(keywordSchema.type, 'string')
})

it('resolves script self-description from a readable absolute script path outside list_scripts', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-agent-'))
  const scriptFile = path.join(tempDir, 'skill-script.ts')
  const code = `
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'

defineMetadata({ name: 'Skill script', description: 'Readable from any path' })
defineParams({
  type: 'object',
  properties: {
    id: { type: 'string' },
  },
  required: ['id'],
})

export async function main(params) {
  console.log(params.id)
}
`

  await fsPromises.writeFile(scriptFile, code, 'utf-8')

  const result = await getScriptSelfDescription(
    { scriptPath: scriptFile },
    {
      get: () => null,
      list: () => [],
      readCode: () => null,
    },
  )

  assert.equal(result.script.scriptFile, scriptFile)
  assert.equal(result.script.name, 'skill-script')
  assert.equal(result.metadata.name, 'Skill script')
  assert.equal(result.metadata.description, 'Readable from any path')
  const idSchema = result.paramsSchema.properties?.id as { type?: string }
  assert.equal(idSchema.type, 'string')
  assert.deepEqual(result.paramsSchema.required, ['id'])
})

it('rejects a direct script URL instead of downloading it', async () => {
  const scriptUrl = 'https://roxy-web.oss-cn-beijing.aliyuncs.com/scripts/remote-search.ts'
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  await assert.rejects(
    getScriptSelfDescription({ scriptPath: scriptUrl }),
    /Pass a canonical template reference or official script slug instead/,
  )

  assert.equal(agentApiMocks.getOfficialScriptBySlug.mock.calls.length, 0)
  assert.equal(fetchMock.mock.calls.length, 0)
})

it('rejects an invalid optionsSchema returned by the official script API', async () => {
  agentApiMocks.getOfficialScriptBySlug.mockResolvedValue({
    slug: 'official-invalid-schema',
    name: 'Invalid schema',
    optionsSchema: '{not-json}',
  })

  await assert.rejects(
    getScriptSelfDescription({ scriptPath: 'official-invalid-schema' }),
    /invalid optionsSchema JSON/,
  )
})
