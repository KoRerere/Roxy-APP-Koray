import { convertToOpenAITool } from '@langchain/core/utils/function_calling'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it, vi } from 'vitest'
import {
  loadSkillFileTools,
  resolveSkillDisplay,
} from './skill'

const mocks = vi.hoisted(() => ({
  getKnownSkill: vi.fn(),
  listAvailableSkills: vi.fn(),
  resolveAvailableSkillFile: vi.fn(),
  resolveTemplateSkillFile: vi.fn(),
}))

vi.mock('@/core/skillManager', () => ({
  getSkillManager: () => ({
    listAvailableSkills: mocks.listAvailableSkills,
    resolveAvailableSkillFile: mocks.resolveAvailableSkillFile,
  }),
}))

vi.mock('@/services/templateService', () => ({
  getKnownTemplateSkill: mocks.getKnownSkill,
  resolveTemplateSkillFile: mocks.resolveTemplateSkillFile,
  TemplateReferenceError: class TemplateReferenceError extends Error {},
}))

const temporaryRoots: string[] = []

function loadSkillFile(input: unknown): Promise<string> {
  const tool = loadSkillFileTools[0] as unknown as {
    invoke: (input: unknown) => Promise<string>
  }
  return tool.invoke(input)
}

async function createTemporarySkillFile(content: string): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roxy-agent-skill-tool-'))
  temporaryRoots.push(rootDir)

  const filePath = path.join(rootDir, 'SKILL.md')
  await fs.writeFile(filePath, content)
  return filePath
}

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(temporaryRoots.splice(0).map(rootDir => fs.rm(rootDir, { recursive: true, force: true })))
})

describe('load_skill_file', () => {
  it('serializes an OpenAI-compatible object schema with separate name and ref fields', () => {
    const openAITool = convertToOpenAITool(loadSkillFileTools[0] as any) as {
      function: {
        parameters: {
          anyOf?: unknown
          properties?: Record<string, unknown>
          type?: string
        }
      }
    }

    assert.equal(openAITool.function.parameters.type, 'object')
    assert.equal(openAITool.function.parameters.anyOf, undefined)
    assert.ok(openAITool.function.parameters.properties?.name)
    assert.ok(openAITool.function.parameters.properties?.ref)
    assert.equal(openAITool.function.parameters.properties?.skill, undefined)
    assert.equal(openAITool.function.parameters.properties?.path, undefined)
  })

  it('resolves, installs, and reads a template Skill through ref', async () => {
    const filePath = await createTemporarySkillFile('Remote template Skill\n')
    mocks.resolveTemplateSkillFile.mockResolvedValue({ filePath })

    const result = await loadSkillFile({ ref: 'user:42' })

    assert.match(result, /1\tRemote template Skill/)
    assert.deepEqual(mocks.resolveTemplateSkillFile.mock.calls, [['user:42', 'SKILL.md']])
    assert.equal(mocks.resolveAvailableSkillFile.mock.calls.length, 0)
  })

  it('reads an available local Skill by its frontmatter name', async () => {
    const filePath = await createTemporarySkillFile('Local Skill\n')
    mocks.resolveAvailableSkillFile.mockResolvedValue({ filePath })

    const result = await loadSkillFile({
      name: 'local-skill',
      file: 'references/usage.md',
    })

    assert.match(result, /1\tLocal Skill/)
    assert.deepEqual(mocks.resolveAvailableSkillFile.mock.calls, [['local-skill', 'references/usage.md']])
    assert.equal(mocks.resolveTemplateSkillFile.mock.calls.length, 0)
  })

  it('allows an installed template Skill to be loaded by its frontmatter name', async () => {
    const filePath = await createTemporarySkillFile('Installed template Skill\n')
    mocks.resolveAvailableSkillFile.mockResolvedValue({ filePath })

    const result = await loadSkillFile({ name: 'template-skill' })

    assert.match(result, /1\tInstalled template Skill/)
    assert.deepEqual(mocks.resolveAvailableSkillFile.mock.calls, [['template-skill', 'SKILL.md']])
    assert.equal(mocks.resolveTemplateSkillFile.mock.calls.length, 0)
  })

  it('requires exactly one of name or ref', async () => {
    await assert.rejects(loadSkillFile({}))
    await assert.rejects(loadSkillFile({ name: 'local-skill', ref: 'user:42' }))
    await assert.rejects(loadSkillFile({ skill: 'user:42' }))
    await assert.rejects(loadSkillFile({ path: '/tmp/local-skill/SKILL.md' }))

    assert.equal(mocks.resolveTemplateSkillFile.mock.calls.length, 0)
    assert.equal(mocks.resolveAvailableSkillFile.mock.calls.length, 0)
  })

  it('rejects malformed refs and non-relative Skill file paths before resolving', async () => {
    await assert.rejects(loadSkillFile({ ref: 'invalid:42' }))
    await assert.rejects(loadSkillFile({ name: 'local-skill', file: '/tmp/outside.md' }))
    await assert.rejects(loadSkillFile({ name: 'local-skill', file: 'C:\\temp\\outside.md' }))
    await assert.rejects(loadSkillFile({ name: 'local-skill', file: '../outside.md' }))

    assert.equal(mocks.resolveTemplateSkillFile.mock.calls.length, 0)
    assert.equal(mocks.resolveAvailableSkillFile.mock.calls.length, 0)
  })

  it('uses an installed template name for ref display and supports local name display', () => {
    mocks.getKnownSkill.mockReturnValueOnce({ name: 'Template Skill' })
    assert.deepEqual(resolveSkillDisplay({
      ref: 'official:88',
      file: 'references/usage.md',
    }), {
      skillName: 'Template Skill',
      skillFilePath: 'Template Skill/references/usage.md',
    })

    assert.deepEqual(resolveSkillDisplay({ name: 'local-skill' }), {
      skillName: 'local-skill',
      skillFilePath: 'local-skill/SKILL.md',
    })
  })
})
