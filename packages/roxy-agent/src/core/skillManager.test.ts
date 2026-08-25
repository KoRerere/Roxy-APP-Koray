import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'
import { SkillManager } from './skillManager'

const temporaryRoots: string[] = []

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-local-skills-test-'))
  temporaryRoots.push(root)

  const dirs = {
    skillsDir: path.join(root, 'user'),
    installedSkillsDir: path.join(root, 'installed'),
    builtinSkillsDir: path.join(root, 'builtin'),
  }

  return { dirs, manager: new SkillManager(dirs) }
}

async function writeSkill(
  dir: string,
  name: string,
  description: string,
  marker = '',
): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    marker,
  ].join('\n'))
  await mkdir(path.join(dir, 'references'), { recursive: true })
  await writeFile(path.join(dir, 'references', 'usage.md'), `${marker || name} reference\n`)
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

describe('skillManager local Skill index', () => {
  it('lists builtin, user, and installed Skills with an optional validated template ref', async () => {
    const { dirs, manager } = await createFixture()
    await writeSkill(path.join(dirs.builtinSkillsDir, 'builtin-skill'), 'builtin-skill', 'Builtin')
    await writeSkill(path.join(dirs.skillsDir, 'user-skill'), 'user-skill', 'User')

    const installedDir = path.join(dirs.installedSkillsDir, 'installed-skill')
    await writeSkill(installedDir, 'installed-skill', 'Installed')
    await writeFile(path.join(installedDir, '.skill_meta.json'), JSON.stringify({
      templateRef: 'official:42',
      enabled: true,
    }))

    const invalidRefDir = path.join(dirs.installedSkillsDir, 'invalid-ref')
    await writeSkill(invalidRefDir, 'invalid-ref', 'Invalid ref')
    await writeFile(path.join(invalidRefDir, '.skill_meta.json'), JSON.stringify({
      templateRef: 'invalid:42',
      enabled: true,
    }))

    const skills = await manager.listAvailableSkills()

    assert.deepEqual(skills, [
      { name: 'builtin-skill', description: 'Builtin' },
      { name: 'installed-skill', description: 'Installed', ref: 'official:42' },
      { name: 'invalid-ref', description: 'Invalid ref' },
      { name: 'user-skill', description: 'User' },
    ])
  })

  it('resolves local Skill files by frontmatter name and relative path only', async () => {
    const { dirs, manager } = await createFixture()
    await writeSkill(path.join(dirs.skillsDir, 'local-skill'), 'local-skill', 'Local', 'Local content')

    const entry = await manager.resolveAvailableSkillFile('local-skill')
    const reference = await manager.resolveAvailableSkillFile('local-skill', 'references/usage.md')

    assert.ok(entry)
    assert.ok(reference)
    assert.match(await readFile(entry.filePath, 'utf8'), /Local content/)
    assert.equal(reference.relativePath, 'references/usage.md')
    await assert.rejects(
      manager.resolveAvailableSkillFile('local-skill', '/tmp/outside.txt'),
      /relative path/,
    )
    await assert.rejects(
      manager.resolveAvailableSkillFile('local-skill', 'C:\\temp\\outside.txt'),
      /relative path/,
    )
    await assert.rejects(
      manager.resolveAvailableSkillFile('local-skill', '../outside.txt'),
      /stay inside/,
    )
  })

  it('does not use package metadata slug as a local Skill identifier', async () => {
    const { dirs, manager } = await createFixture()
    const installedDir = path.join(dirs.installedSkillsDir, 'installed-skill')
    await writeSkill(installedDir, 'frontmatter-name', 'Installed')
    await writeFile(path.join(installedDir, '.skill_meta.json'), JSON.stringify({
      slug: 'package-slug',
      enabled: true,
    }))

    await assert.doesNotReject(manager.resolveAvailableSkillFile('frontmatter-name'))
    assert.equal(await manager.resolveAvailableSkillFile('package-slug'), null)
  })

  it('rejects an ambiguous frontmatter name across local Skill roots', async () => {
    const { dirs, manager } = await createFixture()
    await writeSkill(path.join(dirs.skillsDir, 'shared-user'), 'shared-skill', 'User')
    await writeSkill(path.join(dirs.installedSkillsDir, 'shared-installed'), 'shared-skill', 'Installed')

    await assert.rejects(
      manager.resolveAvailableSkillFile('shared-skill'),
      /ambiguous/,
    )
  })

  it('returns runtime Skill manifests with absolute SKILL.md paths', async () => {
    // Regression: chat-agent created AgentRuntime without SkillManifest data,
    // so the runtime skill catalog renderer always received an empty list.
    // Fixed by: exposing local Skill records as runtime manifests and passing
    // them into AgentRuntime.create.
    const { dirs, manager } = await createFixture()
    const skillDir = path.join(dirs.builtinSkillsDir, 'runtime-skill')
    await writeSkill(skillDir, 'runtime-skill', 'Runtime visible', 'Runtime instructions')

    const manifests = await manager.listRuntimeSkillManifests()

    assert.equal(manifests.length, 1)
    assert.deepEqual(manifests[0], {
      name: 'runtime-skill',
      description: 'Runtime visible',
      sourcePath: skillDir,
      bodyPath: path.join(skillDir, 'SKILL.md'),
      frontmatter: {
        name: 'runtime-skill',
        description: 'Runtime visible',
      },
    })
  })
})

describe('skillManager template installation', () => {
  it('deletes the requested installed and user Skill directories by slug', async () => {
    // Regression: deleting a user Skill template removed only the remote template record,
    // leaving its local Skill package on disk.
    // Fixed by: deleting the matching direct child under installed and user Skill roots.
    const { dirs, manager } = await createFixture()
    const installedDir = path.join(dirs.installedSkillsDir, 'template-package')
    const otherInstalledDir = path.join(dirs.installedSkillsDir, 'other-package')
    const userDir = path.join(dirs.skillsDir, 'template-package')
    const builtinDir = path.join(dirs.builtinSkillsDir, 'template-package')
    await Promise.all([
      writeSkill(installedDir, 'installed-template', 'Installed'),
      writeSkill(otherInstalledDir, 'other-template', 'Other installed'),
      writeSkill(userDir, 'user-template', 'User'),
      writeSkill(builtinDir, 'builtin-template', 'Builtin'),
    ])

    assert.equal(await manager.deleteInstalledSkillBySlug('template-package'), true)
    assert.equal(await manager.deleteInstalledSkillBySlug('template-package'), false)
    await assert.rejects(readFile(path.join(installedDir, 'SKILL.md'), 'utf8'))
    assert.match(await readFile(path.join(otherInstalledDir, 'SKILL.md'), 'utf8'), /other-template/)
    await assert.rejects(readFile(path.join(userDir, 'SKILL.md'), 'utf8'))
    assert.match(await readFile(path.join(builtinDir, 'SKILL.md'), 'utf8'), /builtin-template/)
    await assert.rejects(manager.deleteInstalledSkillBySlug('../user/template-package'), /Invalid installed Skill slug/)
  })

  it('normalizes slash-containing slugs to the local directory name before deleting', async () => {
    // Regression: slash-containing slugs could not be deleted even when the installed
    // directory used the same canonical safe name as the installer.
    // Fixed by: normalizing the input slug before resolving the directory path.
    const { dirs, manager } = await createFixture()
    const installedDir = path.join(dirs.installedSkillsDir, 'research_skill')
    const userDir = path.join(dirs.skillsDir, 'research_skill')
    await writeSkill(installedDir, 'research-skill', 'Installed')
    await writeSkill(userDir, 'research-skill-user', 'User')

    assert.equal(await manager.deleteInstalledSkillBySlug('research/skill'), true)
    await assert.rejects(readFile(path.join(installedDir, 'SKILL.md'), 'utf8'))
    await assert.rejects(readFile(path.join(userDir, 'SKILL.md'), 'utf8'))
  })

  it('deletes a matching user Skill even when no installed copy exists', async () => {
    // Regression: local user Skill sources created from "My Templates" could survive
    // deletion and still appear in the runtime Skill catalog.
    // Fixed by: checking the user Skill root as part of template Skill cleanup.
    const { dirs, manager } = await createFixture()
    const userDir = path.join(dirs.skillsDir, 'template-package')
    await writeSkill(userDir, 'user-template', 'User')

    assert.equal(await manager.deleteInstalledSkillBySlug('template-package'), true)
    assert.equal(await manager.deleteInstalledSkillBySlug('template-package'), false)
    await assert.rejects(readFile(path.join(userDir, 'SKILL.md'), 'utf8'))
  })

  it('installs template Skills under installed and records their canonical ref', async () => {
    const { dirs, manager } = await createFixture()
    const sourceDir = path.join(path.dirname(dirs.skillsDir), 'source-skill')
    await writeSkill(sourceDir, 'template-skill', 'Template Skill', 'Version one')

    const installed = await manager.installTemplateSkillFromDir(sourceDir, {
      templateRef: 'user:84',
      sha512: 'a'.repeat(128),
      slug: 'template-package',
    })

    assert.equal(installed.dirPath, path.join(dirs.installedSkillsDir, 'template-package'))
    assert.equal(installed.ref, 'user:84')
    assert.equal(installed.sha512, 'a'.repeat(128))
    const meta = JSON.parse(await readFile(path.join(installed.dirPath, '.skill_meta.json'), 'utf8'))
    assert.equal(meta.source, 'store')
    assert.equal(meta.slug, 'template-package')
    assert.equal(meta.templateRef, 'user:84')
    assert.equal(meta.sha512, 'a'.repeat(128))

    const resolvedByName = await manager.resolveAvailableSkillFile('template-skill')
    assert.ok(resolvedByName)
    assert.equal(resolvedByName.entry.ref, 'user:84')
  })

  it('installs template Skills without SHA-512 metadata', async () => {
    const { dirs, manager } = await createFixture()
    const sourceDir = path.join(path.dirname(dirs.skillsDir), 'source-skill-without-sha')
    await writeSkill(sourceDir, 'template-skill', 'Template Skill', 'Version one')

    const installed = await manager.installTemplateSkillFromDir(sourceDir, {
      templateRef: 'user:84',
      slug: 'template-package',
    })

    assert.equal(installed.dirPath, path.join(dirs.installedSkillsDir, 'template-package'))
    assert.equal(installed.ref, 'user:84')
    assert.equal(installed.sha512, undefined)
    const meta = JSON.parse(await readFile(path.join(installed.dirPath, '.skill_meta.json'), 'utf8'))
    assert.equal(meta.source, 'store')
    assert.equal(meta.slug, 'template-package')
    assert.equal(meta.templateRef, 'user:84')
    assert.equal(meta.sha512, undefined)
  })

  it('updates the matching installed package without overwriting the user directory', async () => {
    const { dirs, manager } = await createFixture()
    const userDir = path.join(dirs.skillsDir, 'template-skill')
    const firstSource = path.join(path.dirname(dirs.skillsDir), 'first-source')
    const secondSource = path.join(path.dirname(dirs.skillsDir), 'second-source')
    await writeSkill(userDir, 'template-skill', 'User Skill', 'User content')
    await writeSkill(firstSource, 'template-skill', 'Template Skill', 'Version one')
    await writeSkill(secondSource, 'template-skill', 'Template Skill', 'Version two')

    const first = await manager.installTemplateSkillFromDir(firstSource, {
      templateRef: 'official:42',
      sha512: 'a'.repeat(128),
      slug: 'template-package',
    })
    const second = await manager.installTemplateSkillFromDir(secondSource, {
      templateRef: 'user:84',
      sha512: 'b'.repeat(128),
      slug: 'template-package',
    })

    assert.equal(second.dirPath, first.dirPath)
    assert.equal(second.ref, 'user:84')
    assert.match(await readFile(path.join(second.rootDir, 'SKILL.md'), 'utf8'), /Version two/)
    assert.match(await readFile(path.join(userDir, 'SKILL.md'), 'utf8'), /User content/)
  })
})
