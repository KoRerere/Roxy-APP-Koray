import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeTempDir } from '../helpers/tempDir.ts'
import {
  MAX_SKILL_DESCRIPTION_LENGTH,
  MAX_SKILL_NAME_LENGTH,
  loadSkillBody,
  scanSkills,
  scanSkillsWithDiagnostics,
  validateSkillFile,
} from '../../src/skills/manifest.ts'
import { SkillRegistry } from '../../src/skills/registry.ts'

// ---------------------------------------------------------------------------
// scanSkills
// ---------------------------------------------------------------------------

describe('scanSkills', () => {
  it('empty directory returns []', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      const manifests = await scanSkills(path)
      expect(manifests).toHaveLength(0)
    } finally {
      await cleanup()
    }
  })

  it('finds SKILL.md with valid frontmatter', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      await mkdir(join(path, 'my_skill'))
      await writeFile(
        join(path, 'my_skill', 'SKILL.md'),
        `---\nname: my_skill\ndescription: Does my thing.\n---\n# Body\n`,
      )
      const manifests = await scanSkills(path)
      expect(manifests).toHaveLength(1)
      expect(manifests[0]).toMatchObject({
        name: 'my_skill',
        description: 'Does my thing.',
      })
      expect(manifests[0]?.bodyPath).toContain('SKILL.md')
    } finally {
      await cleanup()
    }
  })

  it('skips subdirectories without SKILL.md', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      await mkdir(join(path, 'not_a_skill'))
      await writeFile(join(path, 'not_a_skill', 'README.md'), '# Not a skill')
      const manifests = await scanSkills(path)
      expect(manifests).toHaveLength(0)
    } finally {
      await cleanup()
    }
  })

  it('scans multiple skills', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      for (const n of ['skill_a', 'skill_b']) {
        await mkdir(join(path, n))
        await writeFile(join(path, n, 'SKILL.md'), `---\nname: ${n}\ndescription: Skill ${n}.\n---\nbody\n`)
      }
      const manifests = await scanSkills(path)
      expect(manifests).toHaveLength(2)
      const names = manifests.map((m) => m.name).toSorted()
      expect(names).toEqual(['skill_a', 'skill_b'])
    } finally {
      await cleanup()
    }
  })

  it('rejects invalid metadata and returns structured diagnostics', async () => {
    // Regression: malformed YAML and missing descriptions were silently loaded
    // as routable skills with empty metadata.
    // Fixed by: validating every SKILL.md and retaining per-file diagnostics.
    const { path, cleanup } = await makeTempDir()
    try {
      for (const [name, content] of [
        ['bad-yaml', '---\nname: [unterminated\ndescription: broken\n---\nbody'],
        ['missing-description', '---\nname: missing-description\n---\nbody'],
        ['no-frontmatter', '# Just markdown'],
      ] as const) {
        await mkdir(join(path, name))
        await writeFile(join(path, name, 'SKILL.md'), content)
      }

      const result = await scanSkillsWithDiagnostics(path)

      expect(result.skills).toEqual([])
      expect(result.errors.map((error) => error.code).toSorted()).toEqual([
        'description_missing',
        'frontmatter_invalid',
        'frontmatter_missing',
      ])
      expect(result.errors.every((error) => error.path.endsWith('SKILL.md'))).toBe(true)
    } finally {
      await cleanup()
    }
  })

  it('enforces metadata length limits and exposes a reusable validator', async () => {
    // Regression: unbounded names and descriptions could consume the complete
    // skill catalog budget and make other skills undiscoverable.
    // Fixed by: applying the same strict validator in scans and authoring checks.
    const { path, cleanup } = await makeTempDir()
    try {
      const skillDir = join(path, 'oversized')
      const skillPath = join(skillDir, 'SKILL.md')
      await mkdir(skillDir)
      await writeFile(
        skillPath,
        `---\nname: ${'n'.repeat(MAX_SKILL_NAME_LENGTH + 1)}\ndescription: ${'d'.repeat(MAX_SKILL_DESCRIPTION_LENGTH + 1)}\n---\nbody`,
      )

      const validation = await validateSkillFile(skillPath)

      expect(validation.skill).toBeUndefined()
      expect(validation.errors.map((error) => error.code)).toEqual(['name_too_long', 'description_too_long'])
    } finally {
      await cleanup()
    }
  })

  it('sorts manifests deterministically by name then path', async () => {
    // Regression: filesystem enumeration order leaked into the model prompt,
    // reducing prompt-cache stability between equivalent runs.
    // Fixed by: sorting validated manifests before publishing a snapshot.
    const { path, cleanup } = await makeTempDir()
    try {
      for (const [dir, name] of [
        ['z-dir', 'alpha'],
        ['a-dir', 'zeta'],
      ] as const) {
        await mkdir(join(path, dir))
        await writeFile(join(path, dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n---\nbody`)
      }

      const manifests = await scanSkills(path)

      expect(manifests.map((manifest) => manifest.name)).toEqual(['alpha', 'zeta'])
    } finally {
      await cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// loadSkillBody
// ---------------------------------------------------------------------------

describe('loadSkillBody', () => {
  it('returns content after the frontmatter fence', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      await mkdir(join(path, 's'))
      await writeFile(join(path, 's', 'SKILL.md'), '---\nname: s\ndescription: d\n---\n# The body\n\nHello body.\n')
      const [manifest] = await scanSkills(path)
      const body = await loadSkillBody(manifest!)
      expect(body).toContain('Hello body.')
    } finally {
      await cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// SkillRegistry
// ---------------------------------------------------------------------------

describe('SkillRegistry', () => {
  it('list() returns [] before scan()', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      const registry = new SkillRegistry(path)
      expect(registry.list()).toEqual([])
    } finally {
      await cleanup()
    }
  })

  it('scan() + list() shows skills', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      await mkdir(join(path, 'alpha'))
      await writeFile(
        join(path, 'alpha', 'SKILL.md'),
        '---\nname: alpha\ndescription: Alpha skill.\n---\nAlpha body.\n',
      )
      const registry = new SkillRegistry(path)
      await registry.scan()
      expect(registry.list()).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })

  it('get(name) finds skill after scan', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      await mkdir(join(path, 'alpha'))
      await writeFile(join(path, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: Alpha.\n---\nbody\n')
      const registry = new SkillRegistry(path)
      await registry.scan()
      expect(registry.get('alpha')).toMatchObject({ name: 'alpha' })
      expect(registry.get('nonexistent')).toBeUndefined()
    } finally {
      await cleanup()
    }
  })

  it('reload() refreshes the manifest', async () => {
    const { path, cleanup } = await makeTempDir()
    try {
      const registry = new SkillRegistry(path)
      await registry.scan()
      expect(registry.list()).toHaveLength(0)

      await mkdir(join(path, 'new_skill'))
      await writeFile(join(path, 'new_skill', 'SKILL.md'), '---\nname: new_skill\ndescription: New.\n---\nbody\n')
      await registry.reload()
      expect(registry.list()).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })

  it('publishes the latest scan diagnostics', async () => {
    // Regression: hosts could not explain why a broken skill was absent.
    // Fixed by: retaining structured errors on the registry snapshot.
    const { path, cleanup } = await makeTempDir()
    try {
      await mkdir(join(path, 'broken'))
      await writeFile(join(path, 'broken', 'SKILL.md'), '---\nname: broken\n---\nbody')
      const registry = new SkillRegistry(path)

      await registry.scan()

      expect(registry.diagnostics().errors).toMatchObject([{ code: 'description_missing' }])
    } finally {
      await cleanup()
    }
  })
})
