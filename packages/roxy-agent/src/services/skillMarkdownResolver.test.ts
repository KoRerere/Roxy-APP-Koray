import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { preloadSkillMarkdownLinks } from './skillMarkdownResolver'

const mocks = vi.hoisted(() => ({
  root: `/tmp/roxy-skill-markdown-resolver-${process.pid}`,
  ensureRemoteSkillInstalledBySlug: vi.fn(),
}))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    skillsInstalledDir: `${mocks.root}/library/skills/installed`,
  },
}))

vi.mock('./templateService', () => ({
  ensureRemoteSkillInstalledBySlug: mocks.ensureRemoteSkillInstalledBySlug,
}))

beforeEach(async () => {
  vi.clearAllMocks()
  await fs.mkdir(`${mocks.root}/library/skills/installed`, { recursive: true })
})

afterEach(async () => {
  await fs.rm(mocks.root, { recursive: true, force: true })
})

describe('preloadSkillMarkdownLinks', () => {
  it('downloads a missing installed Skill path by slug without returning runtime injection fields', async () => {
    // Regression: path-token parsing was removed together with explicit Skill
    // body injection, so a new machine could not materialize the referenced Skill.
    // Fixed by: keeping Markdown AST parsing as a download preloader only.
    mocks.ensureRemoteSkillInstalledBySlug.mockResolvedValue({
      skillMdPath: `${mocks.root}/library/skills/installed/official-viral-trend-catcher/SKILL.md`,
    })

    const result = await preloadSkillMarkdownLinks(
      '评估 [$社媒爆品评估](/Users/other/.roxy-agent-dev/library/skills/installed/official-viral-trend-catcher/SKILL.md) 这个产品。',
    )

    assert.deepEqual(result.downloaded, ['official-viral-trend-catcher'])
    assert.deepEqual(result.existing, [])
    assert.deepEqual(result.errors, [])
    assert.equal(mocks.ensureRemoteSkillInstalledBySlug.mock.calls.length, 1)
    assert.equal(mocks.ensureRemoteSkillInstalledBySlug.mock.calls[0]?.[0], 'official-viral-trend-catcher')
    assert.equal(Object.hasOwn(result, 'skills'), false)
    assert.equal(Object.hasOwn(result, 'messageForModel'), false)
  })

  it('reuses an already installed canonical SKILL.md without downloading', async () => {
    const skillDir = `${mocks.root}/library/skills/installed/market-analysis`
    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(`${skillDir}/SKILL.md`, '# Market analysis\n')

    const result = await preloadSkillMarkdownLinks(`Use [$Market](${skillDir}/SKILL.md).`)

    assert.deepEqual(result.existing, ['market-analysis'])
    assert.deepEqual(result.downloaded, [])
    assert.deepEqual(result.errors, [])
    assert.equal(mocks.ensureRemoteSkillInstalledBySlug.mock.calls.length, 0)
  })

  it('does not recognize legacy official or user Skill refs as preloadable links', async () => {
    const result = await preloadSkillMarkdownLinks('Use [$Old](official:137) and [$Team](user:42).')

    assert.deepEqual(result, { existing: [], downloaded: [], errors: [] })
    assert.equal(mocks.ensureRemoteSkillInstalledBySlug.mock.calls.length, 0)
  })

  it('deduplicates repeated links for the same slug', async () => {
    mocks.ensureRemoteSkillInstalledBySlug.mockResolvedValue({
      skillMdPath: `${mocks.root}/library/skills/installed/collect/SKILL.md`,
    })

    const result = await preloadSkillMarkdownLinks(
      '[$Collect](/x/library/skills/installed/collect/SKILL.md) then [$Collect again](/y/library/skills/installed/collect/SKILL.md)',
    )

    assert.deepEqual(result.downloaded, ['collect'])
    assert.equal(mocks.ensureRemoteSkillInstalledBySlug.mock.calls.length, 1)
  })

  it('reports download errors without throwing or changing the prompt', async () => {
    mocks.ensureRemoteSkillInstalledBySlug.mockRejectedValue(new Error('network unavailable'))

    const result = await preloadSkillMarkdownLinks('Use [$Collect](/x/library/skills/installed/collect/SKILL.md).')

    assert.deepEqual(result.existing, [])
    assert.deepEqual(result.downloaded, [])
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0]?.slug, 'collect')
    assert.equal(result.errors[0]?.message, 'network unavailable')
  })
})
