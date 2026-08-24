import AdmZip from 'adm-zip'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { restoreSystemSkillsBundle } from './systemSkillsBundle'

const temporaryRoots: string[] = []

function createZip(entries: Record<string, string>): Buffer {
  const zip = new AdmZip()
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.from(content))
  }
  return zip.toBuffer()
}

function sha512(data: Buffer): string {
  return createHash('sha512').update(data).digest('hex')
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

describe('restoreSystemSkillsBundle', () => {
  it('restores the embedded zip into the builtin Skill directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-system-skills-test-'))
    temporaryRoots.push(root)
    const targetDir = path.join(root, 'library', 'skills', 'builtin')
    const archive = createZip({
      'roxybrowser-automation/SKILL.md': '---\nname: roxybrowser-automation\ndescription: Browser\n---\n',
      'roxybrowser-automation/references/workflows.md': '# Workflows\n',
    })

    await restoreSystemSkillsBundle(archive, targetDir, sha512(archive))

    await expect(
      readFile(path.join(targetDir, 'roxybrowser-automation', 'SKILL.md'), 'utf8'),
    ).resolves.toContain('roxybrowser-automation')
    await expect(
      readFile(path.join(targetDir, 'roxybrowser-automation', 'references', 'workflows.md'), 'utf8'),
    ).resolves.toBe('# Workflows\n')
    await expect(
      readFile(path.join(targetDir, '.system-skills-bundle.json'), 'utf8'),
    ).resolves.toContain(sha512(archive))
  })

  it('keeps the existing bundle when the embedded zip is invalid', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-system-skills-test-'))
    temporaryRoots.push(root)
    const targetDir = path.join(root, 'library', 'skills', 'builtin')
    const oldSkillPath = path.join(targetDir, 'old-skill', 'SKILL.md')
    await mkdir(path.dirname(oldSkillPath), { recursive: true })
    await writeFile(oldSkillPath, 'old skill')
    const archive = Buffer.from('not a zip archive')

    await expect(
      restoreSystemSkillsBundle(archive, targetDir, sha512(archive)),
    ).rejects.toThrow(/not a valid ZIP/)

    await expect(readFile(oldSkillPath, 'utf8')).resolves.toBe('old skill')
  })

  it('replaces a legacy marked builtin directory so deleted Skills do not linger', async () => {
    // Regression: older installs could have a matching bundle hash marker while
    // stale top-level Skill directories remained in builtin, so startup skipped
    // restoration and the Agent still saw deleted or renamed Skills.
    // Fixed by: treating the legacy marker as stale and replacing builtin from
    // the freshly validated embedded archive.
    const root = await mkdtemp(path.join(os.tmpdir(), 'roxy-system-skills-test-'))
    temporaryRoots.push(root)
    const targetDir = path.join(root, 'library', 'skills', 'builtin')
    const archive = createZip({
      'new-skill/SKILL.md': '---\nname: new-skill\ndescription: New\n---\n',
    })
    const archiveSha512 = sha512(archive)

    await mkdir(path.join(targetDir, 'old-skill'), { recursive: true })
    await writeFile(path.join(targetDir, 'old-skill', 'SKILL.md'), 'old skill\n')
    await writeFile(
      path.join(targetDir, '.system-skills-bundle.json'),
      JSON.stringify({
        version: 1,
        sha512: archiveSha512,
      }, null, 2),
    )

    await restoreSystemSkillsBundle(archive, targetDir, archiveSha512)

    await expect(readFile(path.join(targetDir, 'new-skill', 'SKILL.md'), 'utf8')).resolves.toContain('new-skill')
    await expect(readFile(path.join(targetDir, 'old-skill', 'SKILL.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
    await expect(
      readFile(path.join(targetDir, '.system-skills-bundle.json'), 'utf8').then(content => JSON.parse(content)),
    ).resolves.toMatchObject({
      version: 2,
      sha512: archiveSha512,
    })
  })
})
