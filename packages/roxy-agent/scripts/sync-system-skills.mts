#!/usr/bin/env node

import type { ExecFileSyncOptions } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RemoteSystemSkill {
  name: string
  repo: string
  remotePath: string
}

export const remoteSystemSkills: readonly RemoteSystemSkill[] = [
  {
    name: 'roxybrowser-control',
    repo: 'https://github.com/roxybrowserlabs/roxybrowser-mcp-server.git',
    remotePath: 'skills/roxybrowser-control',
  },
  {
    name: 'roxybrowser-automation',
    repo: 'https://github.com/roxybrowserlabs/roxybrowser-playwright-mcp.git',
    remotePath: 'skills/roxybrowser-automation',
  },
]

type GitRunner = (command: string, args: string[], options?: ExecFileSyncOptions) => void

export interface SyncRemoteSystemSkillsOptions {
  rootDir?: string
  workDir?: string
  run?: GitRunner
  logger?: Pick<Console, 'log'>
}

function defaultRun(command: string, args: string[], options?: ExecFileSyncOptions): void {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
}

function ensureSourceTreeHasSkillMd(skillName: string, sourceDir: string): void {
  if (!fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    throw new Error(`远端目录缺少 SKILL.md: ${skillName}`)
  }
}

function syncRemoteSkill(
  skill: RemoteSystemSkill,
  systemSkillsDir: string,
  workDir: string,
  rootDir: string,
  run: GitRunner,
  logger: Pick<Console, 'log'>,
): void {
  const repoDir = path.join(workDir, skill.name)
  const sourceDir = path.join(repoDir, skill.remotePath)
  const targetDir = path.join(systemSkillsDir, skill.name)

  logger.log(`同步 ${skill.name}...`)
  run('git', [
    'clone',
    '--depth',
    '1',
    '--filter=blob:none',
    '--sparse',
    '--no-checkout',
    skill.repo,
    repoDir,
  ])
  run('git', ['-C', repoDir, 'sparse-checkout', 'set', skill.remotePath])
  run('git', ['-C', repoDir, 'checkout', 'HEAD', '--', skill.remotePath])

  ensureSourceTreeHasSkillMd(skill.name, sourceDir)

  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(targetDir), { recursive: true })
  fs.cpSync(sourceDir, targetDir, { recursive: true })
  logger.log(`已更新 ${path.relative(rootDir, targetDir)}`)
}

export function syncRemoteSystemSkills(options: SyncRemoteSystemSkillsOptions = {}): void {
  const rootDir = options.rootDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const systemSkillsDir = path.join(rootDir, 'src', 'system-skills')
  const run = options.run ?? defaultRun
  const logger = options.logger ?? console
  const workDir = options.workDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-skills-'))
  const shouldCleanupWorkDir = !options.workDir

  try {
    for (const skill of remoteSystemSkills) {
      syncRemoteSkill(skill, systemSkillsDir, workDir, rootDir, run, logger)
    }

    logger.log('远端 skills 同步完成')
  }
  finally {
    if (shouldCleanupWorkDir) {
      fs.rmSync(workDir, { recursive: true, force: true })
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    syncRemoteSystemSkills()
  }
  catch (error) {
    console.error(
      '[sync-system-skills] 同步失败:',
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = 1
  }
}
