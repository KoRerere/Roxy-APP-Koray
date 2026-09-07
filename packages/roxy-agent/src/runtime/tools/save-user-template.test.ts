import type { ToolContext } from 'roxy-agent-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  installTemplateSkillFromDir: vi.fn(),
  uploadSkill: vi.fn(),
}))

vi.mock('@/api/agentApiClient', () => ({
  agentUserTemplatesApi: {
    create: mocks.create,
    uploadSkill: mocks.uploadSkill,
  },
}))

vi.mock('@/core/skillManager', () => ({
  getSkillManager: () => ({
    installTemplateSkillFromDir: mocks.installTemplateSkillFromDir,
  }),
}))

const testRoot = `/tmp/roxy-save-user-template-${process.pid}`
const workspaceDir = path.join(testRoot, 'workspace')
const skillDir = path.join(workspaceDir, 'batch-nurture')
const context: ToolContext = {
  agentId: 'root',
  traceId: 'trace-1',
  signal: new AbortController().signal,
}

beforeEach(async () => {
  vi.clearAllMocks()
  await fs.mkdir(skillDir, { recursive: true })
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), [
    '---',
    'name: batch-nurture',
    'description: Run a reusable account nurturing workflow.',
    '---',
    'Run the workflow safely.',
    '',
  ].join('\n'))
  mocks.uploadSkill.mockResolvedValue({
    fileId: 'file-1',
    ossUrl: 'https://example.com/batch-nurture.zip',
    sha512: 'a'.repeat(128),
    skillMetadata: { name: 'batch-nurture' },
    packageSlug: 'batch-nurture',
    packageName: 'batch-nurture',
    packageDescription: 'Run a reusable account nurturing workflow.',
    skillMdPath: 'SKILL.md',
  })
  mocks.create.mockResolvedValue({
    id: 42,
    workspaceId: 'workspace-1',
    officialTemplateId: null,
    templateType: 'skill',
    name: '批量养号',
    description: '重复执行养号任务',
    source: 'custom',
    metadata: {},
    hasFile: true,
    createdAt: null,
    updatedAt: null,
  })
  mocks.installTemplateSkillFromDir.mockResolvedValue({
    name: 'batch-nurture',
    dirPath: '/installed/batch-nurture',
  })
})

afterEach(async () => {
  await fs.rm(testRoot, { recursive: true, force: true })
})

describe('roxy_save_user_template', () => {
  it('packages, uploads, creates, and installs a valid Skill template', async () => {
    const { createSaveUserTemplateTool } = await import('./save-user-template')
    const tool = createSaveUserTemplateTool({ workspaceDir })

    const result = await tool.handler({
      skillPath: 'batch-nurture',
      name: '批量养号',
      description: '重复执行养号任务',
      prompt: '执行 [input:养号时长](15) 分钟的养号任务。',
      sourceReportId: 'report-1',
    }, context)

    expect(result.isError).toBe(false)
    expect(result.content).toContain('user:42')
    expect(mocks.uploadSkill).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      template_type: 'skill',
      metadata: expect.objectContaining({
        prompt: '执行 [input:养号时长](15) 分钟的养号任务。',
        sourceReportId: 'report-1',
        fileId: 'file-1',
      }),
    }))
    expect(mocks.installTemplateSkillFromDir).toHaveBeenCalledWith(await fs.realpath(skillDir), expect.objectContaining({
      templateRef: 'user:42',
      packageName: 'batch-nurture',
    }))
  })

  it('rejects an escaped path and an invalid companion prompt before upload', async () => {
    const { createSaveUserTemplateTool } = await import('./save-user-template')
    const tool = createSaveUserTemplateTool({ workspaceDir })

    const escaped = await tool.handler({
      skillPath: '../outside',
      name: '批量养号',
      description: '重复执行养号任务',
      prompt: '执行任务。',
    }, context)
    const invalidPrompt = await tool.handler({
      skillPath: 'batch-nurture',
      name: '批量养号',
      description: '重复执行养号任务',
      prompt: '使用 {{window}} 执行任务。',
    }, context)

    expect(escaped.isError).toBe(true)
    expect(escaped.content).toContain('workspace')
    expect(invalidPrompt.isError).toBe(true)
    expect(invalidPrompt.content).toContain('Composer prompt')
    expect(mocks.uploadSkill).not.toHaveBeenCalled()
  })

  it('rejects a companion prompt that embeds a browser-window selection', async () => {
    const { createSaveUserTemplateTool } = await import('./save-user-template')
    const tool = createSaveUserTemplateTool({ workspaceDir })

    const result = await tool.handler({
      skillPath: 'batch-nurture',
      name: '批量养号',
      description: '重复执行养号任务',
      prompt: '在 [@profile:0]() 窗口执行任务。',
    }, context)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('browser-window selection')
    expect(mocks.uploadSkill).not.toHaveBeenCalled()
  })

  it('rejects the complete prompt when its target URL is unfilled', async () => {
    const { createSaveUserTemplateTool } = await import('./save-user-template')
    const tool = createSaveUserTemplateTool({ workspaceDir })

    const result = await tool.handler({
      skillPath: 'batch-nurture',
      name: '官网 FAQ 总结',
      description: '提取并总结官网常见问题',
      prompt: '在用户选定的浏览器窗口中打开 [url:目标官网]() 的常见问题（FAQ）页面，提取页面上的全部问题与答案，按网站自身的分类结构做一份口语化、亲切的中文总结，保留网站自己承认的限制（如“无法保证 100% 不被封号”、“不能完全防止追踪”等），并注明内容来源的页面链接。',
    }, context)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('non-empty values: 目标官网')
    expect(mocks.uploadSkill).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
