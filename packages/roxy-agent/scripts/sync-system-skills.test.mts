import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { remoteSystemSkills, syncRemoteSystemSkills } from './sync-system-skills.mts'

const temporaryRoots: string[] = []

function seedRemoteSkillTree(workDir: string, skillName: string, remotePath: string, files: Record<string, string>): void {
  const sourceDir = path.join(workDir, skillName, remotePath)
  fs.mkdirSync(sourceDir, { recursive: true })

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(sourceDir, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }
}

afterEach(() => {
  for (const rootDir of temporaryRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true })
  }
})

describe('syncRemoteSystemSkills', () => {
  it('syncs only the remote-backed system skills into src/system-skills', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-system-skills-sync-'))
    temporaryRoots.push(rootDir)
    const workDir = path.join(rootDir, 'work')
    const srcDir = path.join(rootDir, 'src', 'system-skills')
    fs.mkdirSync(workDir, { recursive: true })
    fs.mkdirSync(srcDir, { recursive: true })

    const runCalls: Array<{ command: string, args: string[] }> = []
    const loggerMessages: string[] = []
    const logger = {
      log(message: string): void {
        loggerMessages.push(message)
      },
    }

    for (const skill of remoteSystemSkills) {
      seedRemoteSkillTree(workDir, skill.name, skill.remotePath, {
        'SKILL.md': `---\nname: ${skill.name}\ndescription: remote ${skill.name}\n---\nremote ${skill.name}\n`,
        'references/workflows.md': `# ${skill.name}\n`,
      })

      const targetDir = path.join(srcDir, skill.name)
      fs.mkdirSync(targetDir, { recursive: true })
      fs.writeFileSync(path.join(targetDir, 'SKILL.md'), 'stale local copy\n')
      fs.writeFileSync(path.join(targetDir, 'obsolete.txt'), 'remove me\n')
    }

    syncRemoteSystemSkills({
      rootDir,
      workDir,
      run(command, args) {
        runCalls.push({ command, args })
      },
      logger,
    })

    for (const skill of remoteSystemSkills) {
      const targetDir = path.join(srcDir, skill.name)
      expect(fs.readFileSync(path.join(targetDir, 'SKILL.md'), 'utf8')).toContain(`remote ${skill.name}`)
      expect(fs.readFileSync(path.join(targetDir, 'references', 'workflows.md'), 'utf8')).toBe(`# ${skill.name}\n`)
      expect(fs.existsSync(path.join(targetDir, 'obsolete.txt'))).toBe(false)
    }

    expect(runCalls).toHaveLength(remoteSystemSkills.length * 3)
    expect(runCalls[0]).toMatchObject({
      command: 'git',
      args: [
        'clone',
        '--depth',
        '1',
        '--filter=blob:none',
        '--sparse',
        '--no-checkout',
        remoteSystemSkills[0]!.repo,
        path.join(workDir, remoteSystemSkills[0]!.name),
      ],
    })
    expect(loggerMessages).toContain('远端 skills 同步完成')
  })
})
