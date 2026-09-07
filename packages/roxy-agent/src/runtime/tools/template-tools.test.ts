import type { ToolContext } from 'roxy-agent-runtime'
import { DelegateHitlHandler } from 'roxy-agent-runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  deleteUserById: vi.fn(),
  deleteInstalledSkillBySlug: vi.fn(),
  getOfficialById: vi.fn(),
  getUserById: vi.fn(),
  listAllOfficial: vi.fn(),
  listOfficialPage: vi.fn(),
  listUser: vi.fn(),
}))

vi.mock('@/api/agentApiClient', () => ({
  agentTemplatesApi: {
    getById: mocks.getOfficialById,
    listAll: mocks.listAllOfficial,
    listPage: mocks.listOfficialPage,
  },
  agentUserTemplatesApi: {
    deleteById: mocks.deleteUserById,
    getById: mocks.getUserById,
    list: mocks.listUser,
  },
}))

vi.mock('@/core/skillManager', () => ({
  getSkillManager: () => ({
    deleteInstalledSkillBySlug: mocks.deleteInstalledSkillBySlug,
  }),
}))

const context: ToolContext = {
  agentId: 'root',
  traceId: 'trace-1',
  signal: new AbortController().signal,
}

function parseResult(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listAllOfficial.mockResolvedValue([
    { id: 1, slug: 'official-one', templateType: 'skill', name: { zh: '官方模板' } },
  ])
  mocks.listOfficialPage.mockResolvedValue({
    items: [{ id: 2, slug: 'official-two', templateType: 'skill', name: { zh: '官方分页模板' } }],
    total: 24,
    limit: 8,
    offset: 8,
  })
  mocks.listUser.mockResolvedValue({ items: [{ id: 2, name: '用户模板' }], total: 21, limit: 10, offset: 10 })
  mocks.getOfficialById.mockResolvedValue({ id: 1, slug: 'official-one' })
  mocks.getUserById.mockResolvedValue({ id: 2, name: '用户模板', templateType: 'script', metadata: {} })
  mocks.deleteUserById.mockResolvedValue(undefined)
  mocks.deleteInstalledSkillBySlug.mockResolvedValue(true)
})

describe('template tools', () => {
  it('returns the complete official catalog without pagination parameters', async () => {
    const { createListTemplatesTool } = await import('./template-tools')
    const tool = createListTemplatesTool()

    const result = await tool.handler({ scope: 'official' }, context)

    expect(result.isError).toBe(false)
    expect(parseResult(result.content)).toMatchObject({ scope: 'official', total: 1 })
    expect(mocks.listAllOfficial).toHaveBeenCalledOnce()
    expect(mocks.listUser).not.toHaveBeenCalled()
  })

  it('serializes to the object schema required by function tools', async () => {
    const { createListTemplatesTool } = await import('./template-tools')
    const tool = createListTemplatesTool()

    expect(z.toJSONSchema(tool.descriptor.inputSchema, { io: 'input' })).toMatchObject({
      type: 'object',
      additionalProperties: false,
    })
  })

  it('paginates the official catalog when limit or offset is provided', async () => {
    const { createListTemplatesTool } = await import('./template-tools')
    const tool = createListTemplatesTool()

    const result = await tool.handler({ scope: 'official', offset: 0, limit: 20 }, context)

    expect(result.isError).toBe(false)
    expect(parseResult(result.content)).toMatchObject({ scope: 'official', total: 24, offset: 8, limit: 8 })
    expect(mocks.listOfficialPage).toHaveBeenCalledWith({ offset: 0, limit: 20 })
    expect(mocks.listAllOfficial).not.toHaveBeenCalled()
  })

  it('paginates user templates within the current workspace', async () => {
    const { createListTemplatesTool } = await import('./template-tools')
    const tool = createListTemplatesTool()

    const result = await tool.handler({ scope: 'user', offset: 10, limit: 10 }, context)

    expect(result.isError).toBe(false)
    expect(parseResult(result.content)).toMatchObject({ scope: 'user', total: 21, offset: 10, limit: 10 })
    expect(mocks.listUser).toHaveBeenCalledWith({ offset: 10, limit: 10 })
    expect(mocks.listAllOfficial).not.toHaveBeenCalled()
  })

  it('uses the backend user-template pagination defaults', async () => {
    const { createListTemplatesTool } = await import('./template-tools')
    const tool = createListTemplatesTool()

    await tool.handler({ scope: 'user' }, context)

    expect(mocks.listUser).toHaveBeenCalledWith({ offset: 0, limit: 20 })
  })

  it('reads equal numeric ids from explicit official and user namespaces', async () => {
    const { createReadTemplateInfoTool } = await import('./template-tools')
    const tool = createReadTemplateInfoTool()

    const official = await tool.handler({ scope: 'official', id: 2 }, context)
    const user = await tool.handler({ scope: 'user', id: 2 }, context)

    expect(parseResult(official.content)).toMatchObject({ scope: 'official', template: { id: 1 } })
    expect(parseResult(user.content)).toMatchObject({ scope: 'user', template: { id: 2 } })
    expect(mocks.getOfficialById).toHaveBeenCalledWith(2)
    expect(mocks.getUserById).toHaveBeenCalledWith(2)
  })

  it('marks only deletion as sensitive under the default HITL policy', async () => {
    const {
      createDeleteUserTemplateTool,
      createListTemplatesTool,
      createReadTemplateInfoTool,
    } = await import('./template-tools')
    const hitl = new DelegateHitlHandler()
    const listTool = createListTemplatesTool()
    const readTool = createReadTemplateInfoTool()
    const deleteTool = createDeleteUserTemplateTool()

    expect(hitl.needsApproval(listTool.descriptor, { scope: 'official' })).toBe(false)
    expect(hitl.needsApproval(readTool.descriptor, { scope: 'official', id: 1 })).toBe(false)
    expect(hitl.needsApproval(deleteTool.descriptor, { id: 2 })).toBe(true)

    const result = await deleteTool.handler({ id: 2 }, context)
    expect(parseResult(result.content)).toEqual({ deleted: true, scope: 'user', id: 2 })
    expect(mocks.deleteUserById).toHaveBeenCalledWith(2)
    expect(mocks.getUserById).toHaveBeenCalledWith(2)
    expect(mocks.deleteInstalledSkillBySlug).not.toHaveBeenCalled()
  })

  it('cleans the local Skill directory before deleting a user Skill template', async () => {
    const { createDeleteUserTemplateTool } = await import('./template-tools')
    const tool = createDeleteUserTemplateTool()
    mocks.getUserById.mockResolvedValueOnce({
      id: 9,
      templateType: 'skill',
      metadata: { slug: 'official-market-research' },
    })

    await tool.handler({ id: 9 }, context)

    expect(mocks.deleteInstalledSkillBySlug).toHaveBeenCalledWith('market-research')
    expect(mocks.deleteUserById).toHaveBeenCalledWith(9)
    expect(mocks.deleteInstalledSkillBySlug.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteUserById.mock.invocationCallOrder[0],
    )
  })
})
