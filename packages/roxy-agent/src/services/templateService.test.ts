import type {
  ResolvedTemplate,
  TemplateReferenceError,
} from './templateService'
import AdmZip from 'adm-zip'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiAgentHttpError } from '@/api/errors'
import { env } from '@/config'
import {
  ensureResolvedTemplateSkillInstalled,
  ensureRemoteSkillInstalledBySlug,
  ensureTemplateSkillInstalled,
  resolveTemplate,
  resolveTemplateSkillFile,
} from './templateService'

const mocks = vi.hoisted(() => ({
  root: `/tmp/roxy-template-service-${process.pid}`,
  officialGetById: vi.fn(),
  userGetById: vi.fn(),
}))

vi.mock('@/api/agentApiClient', () => ({
  agentTemplatesApi: {
    getById: mocks.officialGetById,
  },
  agentUserTemplatesApi: {
    getById: mocks.userGetById,
  },
}))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    skillsBuiltinDir: `${mocks.root}/library/skills/builtin`,
    skillsInstalledDir: `${mocks.root}/library/skills/installed`,
    skillsUserDir: `${mocks.root}/library/skills/user`,
    tmpDir: `${mocks.root}/tmp`,
  },
}))

function skillArchive(content = 'Use this Skill safely.'): Buffer {
  const archive = new AdmZip()
  archive.addFile('SKILL.md', Buffer.from(`---\nname: Template Skill\ndescription: Template skill description\n---\n${content}\n`))
  archive.addFile('references/usage.md', Buffer.from('Use the reference file.\n'))
  return archive.toBuffer()
}

function sha512(data: Uint8Array): string {
  return createHash('sha512').update(data).digest('hex')
}

function templateDetail(id: number, templateType: string) {
  return {
    id,
    workspaceId: 'workspace-1',
    templateType,
    name: `Template ${id}`,
    metadata: {},
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  }
}

function resolvedSkill(data: Buffer, id = 42, suffix = ''): ResolvedTemplate {
  return {
    ref: { namespace: 'user' as const, id, value: `user:${id}` as const },
    kind: 'skill' as const,
    id,
    name: 'Template Skill',
    metadata: {
      ossUrl: `https://roxy-web.oss-cn-beijing.aliyuncs.com/skills/template-skill${suffix}.zip`,
      sha512: sha512(data),
      skillMdPath: 'SKILL.md',
    },
    createdAt: '',
    updatedAt: '',
  }
}

function skillTemplateDetail(data: Buffer, id = 42, suffix = '') {
  const template = resolvedSkill(data, id, suffix)
  return {
    ...templateDetail(id, 'skill'),
    name: template.name,
    metadata: template.metadata,
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([
    fs.mkdir(`${mocks.root}/library/skills/builtin`, { recursive: true }),
    fs.mkdir(`${mocks.root}/library/skills/installed`, { recursive: true }),
    fs.mkdir(`${mocks.root}/library/skills/user`, { recursive: true }),
    fs.mkdir(`${mocks.root}/tmp`, { recursive: true }),
  ])
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await fs.rm(mocks.root, { recursive: true, force: true })
})

describe('resolveTemplate', () => {
  it('uses the namespace to resolve equal official and user ids independently', async () => {
    mocks.officialGetById.mockImplementation(async (id: number) => templateDetail(id, 'script'))
    mocks.userGetById.mockImplementation(async (id: number) => templateDetail(id, 'script'))

    await expect(resolveTemplate('official:88', 'script')).resolves.toMatchObject({
      ref: { value: 'official:88' },
    })
    await expect(resolveTemplate('user:88', 'script')).resolves.toMatchObject({
      ref: { value: 'user:88' },
    })

    expect(mocks.officialGetById).toHaveBeenCalledTimes(1)
    expect(mocks.userGetById).toHaveBeenCalledTimes(1)
  })

  it('does not fall back when the requested namespace returns 404', async () => {
    mocks.officialGetById.mockRejectedValue(new AiAgentHttpError(404, 'Not found'))

    await expect(resolveTemplate('official:88')).rejects.toMatchObject({
      code: 'template_not_found',
    } satisfies Partial<TemplateReferenceError>)
    expect(mocks.userGetById).not.toHaveBeenCalled()
  })

  it('rejects bare numeric ids before making an API request', async () => {
    await expect(resolveTemplate('88')).rejects.toMatchObject({
      code: 'invalid_template_ref',
    } satisfies Partial<TemplateReferenceError>)
    expect(mocks.officialGetById).not.toHaveBeenCalled()
    expect(mocks.userGetById).not.toHaveBeenCalled()
  })

  it('uses the Agent language when normalizing official localized metadata', async () => {
    const originalLanguage = env.SYSTEM_LANGUAGE
    env.SYSTEM_LANGUAGE = 'en'
    mocks.officialGetById.mockImplementation(async (id: number) => ({
      ...templateDetail(id, 'script'),
      name: { zh: '中文名称', us: 'English name' },
      description: { zh: '中文描述', us: 'English description' },
    }))

    try {
      await expect(resolveTemplate('official:88')).resolves.toMatchObject({
        name: 'English name',
        description: 'English description',
      })
    }
    finally {
      env.SYSTEM_LANGUAGE = originalLanguage
    }
  })
})

describe('ensureRemoteSkillInstalledBySlug', () => {
  it('prefers the user template detail endpoint before falling back to official template detail', async () => {
    const data = skillArchive('Remote skill content.')
    const responseBody = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    mocks.userGetById.mockRejectedValue(new AiAgentHttpError(404, 'Not found'))
    mocks.officialGetById.mockResolvedValue({
      id: 999,
      slug: 'amazon-price-tracker',
      templateType: 'skill',
      name: { us: 'Amazon Price Tracker' },
      description: { us: 'Track product prices' },
      meta: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/skills/amazon-price-tracker.zip',
        packageSlug: 'amazon-price-tracker',
        skillMdPath: 'SKILL.md',
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => responseBody,
      headers: new Headers({ 'content-length': String(data.byteLength) }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const installed = await ensureRemoteSkillInstalledBySlug('amazon-price-tracker')

    assert.equal(installed.skillMdPath, `${mocks.root}/library/skills/installed/amazon-price-tracker/SKILL.md`)
    assert.equal(mocks.userGetById.mock.calls[0]?.[0], 'amazon-price-tracker')
    assert.equal(mocks.officialGetById.mock.calls[0]?.[0], 'amazon-price-tracker')
    assert.equal(fetchMock.mock.calls.length, 1)
  })

  it('downloads a remote Skill through the template slug endpoint without requiring SHA-512 metadata', async () => {
    const data = skillArchive('Remote skill content.')
    const responseBody = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    mocks.userGetById.mockResolvedValue({
      id: 998,
      slug: 'amazon-price-tracker',
      templateType: 'skill',
      name: { us: 'Amazon Price Tracker' },
      description: { us: 'Track product prices' },
      metadata: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/skills/amazon-price-tracker.zip',
        packageSlug: 'amazon-price-tracker',
        skillMdPath: 'SKILL.md',
      },
    })
    mocks.officialGetById.mockResolvedValue({
      id: 999,
      slug: 'amazon-price-tracker',
      templateType: 'skill',
      name: { us: 'Amazon Price Tracker' },
      description: { us: 'Track product prices' },
      meta: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/skills/amazon-price-tracker.zip',
        packageSlug: 'amazon-price-tracker',
        skillMdPath: 'SKILL.md',
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => responseBody,
      headers: new Headers({ 'content-length': String(data.byteLength) }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const installed = await ensureRemoteSkillInstalledBySlug('amazon-price-tracker')

    assert.equal(installed.skillMdPath, `${mocks.root}/library/skills/installed/amazon-price-tracker/SKILL.md`)
    assert.equal(installed.name, 'Template Skill')
    assert.equal(mocks.userGetById.mock.calls[0]?.[0], 'amazon-price-tracker')
    assert.equal(mocks.officialGetById.mock.calls.length, 0)
    assert.equal(fetchMock.mock.calls.length, 1)
  })

  it('keeps an existing official- slug stable while still installing under the local slug', async () => {
    const data = skillArchive('Remote skill content.')
    const responseBody = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    mocks.userGetById.mockRejectedValue(new AiAgentHttpError(404, 'Not found'))
    mocks.officialGetById.mockResolvedValue({
      id: 1000,
      slug: 'official-amazon-price-tracker',
      templateType: 'skill',
      name: { us: 'Amazon Price Tracker' },
      description: { us: 'Track product prices' },
      meta: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/skills/amazon-price-tracker.zip',
        packageSlug: 'amazon-price-tracker',
        skillMdPath: 'SKILL.md',
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => responseBody,
      headers: new Headers({ 'content-length': String(data.byteLength) }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const installed = await ensureRemoteSkillInstalledBySlug('official-amazon-price-tracker')

    assert.equal(installed.skillMdPath, `${mocks.root}/library/skills/installed/amazon-price-tracker/SKILL.md`)
    assert.equal(mocks.officialGetById.mock.calls[0]?.[0], 'official-amazon-price-tracker')
  })

  it('reports a missing Skill when both user and official template detail lookups fail', async () => {
    mocks.userGetById.mockRejectedValue(new AiAgentHttpError(404, 'Not found'))
    mocks.officialGetById.mockRejectedValue(new AiAgentHttpError(404, 'Not found'))

    await assert.rejects(
      ensureRemoteSkillInstalledBySlug('amazon-price-tracker'),
      /Failed to fetch Skill amazon-price-tracker\./,
    )
    assert.equal(mocks.userGetById.mock.calls[0]?.[0], 'amazon-price-tracker')
    assert.equal(mocks.officialGetById.mock.calls[0]?.[0], 'amazon-price-tracker')
  })
})

describe('template Skill installation', () => {
  it('installs a Skill template without requiring SHA-512 metadata', async () => {
    const data = skillArchive()
    mocks.userGetById.mockResolvedValue({
      ...templateDetail(42, 'skill'),
      name: 'Template Skill',
      metadata: {
        ossUrl: 'https://roxy-web.oss-cn-beijing.aliyuncs.com/skills/template-skill.zip',
        skillMdPath: 'SKILL.md',
      },
    })
    const fetchMock = vi.fn(async () => new Response(data))
    vi.stubGlobal('fetch', fetchMock)

    const installed = await resolveTemplateSkillFile('user:42', 'SKILL.md')

    assert.equal(installed.ref.value, 'user:42')
    assert.equal(installed.name, 'Template Skill')
    assert.equal(fetchMock.mock.calls.length, 1)
  })

  it('installs a remote Skill under library/skills/installed and reads relative files', async () => {
    const data = skillArchive()
    mocks.userGetById.mockResolvedValue(skillTemplateDetail(data))
    const fetchMock = vi.fn(async () => new Response(data))
    vi.stubGlobal('fetch', fetchMock)

    const first = await resolveTemplateSkillFile('user:42', 'SKILL.md')
    const second = await resolveTemplateSkillFile('user:42', 'references/usage.md')

    assert.equal(fetchMock.mock.calls.length, 1)
    assert.equal(first.ref.value, 'user:42')
    assert.equal(second.relativePath, 'references/usage.md')
    assert.match(first.rootDir, /library\/skills\/installed\/Template_Skill$/)
    assert.match(await fs.readFile(first.filePath, 'utf8'), /Template skill description/)
  })

  it('deduplicates concurrent downloads for the same template reference', async () => {
    const data = skillArchive()
    mocks.userGetById.mockResolvedValue(skillTemplateDetail(data))
    const fetchMock = vi.fn(async () => new Response(data))
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([
      ensureTemplateSkillInstalled('user:42'),
      ensureTemplateSkillInstalled('user:42'),
    ])

    assert.equal(fetchMock.mock.calls.length, 1)
  })

  it('installs an already-resolved Skill without fetching its detail again', async () => {
    const data = skillArchive()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(data)))

    await ensureResolvedTemplateSkillInstalled(resolvedSkill(data))

    assert.equal(mocks.userGetById.mock.calls.length, 0)
  })

  it('serializes updates when the same template reference publishes a new hash', async () => {
    const dataA = skillArchive('First version')
    const dataB = skillArchive('Second version')
    let resolveFirstResponse: ((response: Response) => void) | undefined
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirstResponse = resolve
    })
    mocks.userGetById
      .mockResolvedValueOnce(skillTemplateDetail(dataA, 42, '-a'))
      .mockResolvedValueOnce(skillTemplateDetail(dataB, 42, '-b'))
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('template-skill-a.zip')) {
        return firstResponse
      }

      if (url.endsWith('template-skill-b.zip')) {
        return new Response(dataB)
      }

      throw new Error(`Unexpected Skill URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = ensureTemplateSkillInstalled('user:42')
    await vi.waitFor(() => assert.equal(fetchMock.mock.calls.length, 1))

    const second = ensureTemplateSkillInstalled('user:42')
    await Promise.resolve()
    assert.equal(fetchMock.mock.calls.length, 1)
    if (!resolveFirstResponse) {
      throw new Error('First response resolver was not initialized')
    }
    resolveFirstResponse(new Response(dataA))

    const firstInstalled = await first
    await vi.waitFor(() => assert.equal(fetchMock.mock.calls.length, 2))
    const secondInstalled = await second

    assert.equal(firstInstalled.rootDir, secondInstalled.rootDir)
    assert.match(await fs.readFile(secondInstalled.skillMdPath, 'utf8'), /Second version/)
  })

  it('rejects path traversal before reading from the installed Skill', async () => {
    const data = skillArchive()
    mocks.userGetById.mockResolvedValue(skillTemplateDetail(data))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(data)))

    await assert.rejects(
      resolveTemplateSkillFile('user:42', '../secret.txt'),
      (error: any) => error?.code === 'skill_file_invalid',
    )
  })
})
