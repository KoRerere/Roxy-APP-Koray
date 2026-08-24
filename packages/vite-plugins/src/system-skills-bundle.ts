import type { Buffer } from 'node:buffer'
import type { Plugin } from 'vite'
import AdmZip from 'adm-zip'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

export interface SystemSkillsBundlePluginOptions {
  systemSkillsDir: string
  virtualModuleId?: string
}

interface SystemSkillFile {
  absolutePath: string
  relativePath: string
  content: Buffer
}

function listSystemSkillFiles(rootDir: string, currentDir = rootDir): { files: SystemSkillFile[], directories: string[] } {
  const files: SystemSkillFile[] = []
  const directories: string[] = [currentDir]
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') {
      continue
    }

    const absolutePath = join(currentDir, entry.name)
    const relativePath = relative(rootDir, absolutePath).split('\\').join('/')
    if (entry.isSymbolicLink()) {
      throw new Error(`System Skills cannot contain symbolic links: ${relativePath}`)
    }
    if (entry.isDirectory()) {
      const nested = listSystemSkillFiles(rootDir, absolutePath)
      files.push(...nested.files)
      directories.push(...nested.directories)
      continue
    }
    if (!entry.isFile()) {
      throw new Error(`System Skills contains unsupported file: ${relativePath}`)
    }

    files.push({
      absolutePath,
      relativePath,
      content: readFileSync(absolutePath),
    })
  }
  return { files, directories }
}

function createSystemSkillsZip(systemSkillsDir: string): { archive: Buffer, contentSha512: string } {
  const { files } = listSystemSkillFiles(systemSkillsDir)
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  if (files.length === 0) {
    throw new Error(`System Skills directory is empty: ${systemSkillsDir}`)
  }

  const contentHash = createHash('sha512')
  const zip = new AdmZip()
  for (const file of files) {
    contentHash.update(file.relativePath)
    contentHash.update('\0')
    contentHash.update(file.content)
    zip.addLocalFile(file.absolutePath, dirname(file.relativePath), basename(file.relativePath))
  }

  return {
    archive: zip.toBuffer(),
    contentSha512: contentHash.digest('hex'),
  }
}

export function createSystemSkillsBundlePlugin(options: SystemSkillsBundlePluginOptions): Plugin {
  const virtualModuleId = options.virtualModuleId ?? 'virtual:roxy-system-skills-zip'
  const resolvedVirtualModuleId = `\0${virtualModuleId}`
  const { systemSkillsDir } = options

  return {
    name: 'roxy-system-skills-bundle',
    buildStart() {
      const { files, directories } = listSystemSkillFiles(systemSkillsDir)
      for (const file of files) {
        this.addWatchFile(file.absolutePath)
      }
      for (const directory of directories) {
        this.addWatchFile(directory)
      }
    },
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return undefined
      }

      const { archive, contentSha512 } = createSystemSkillsZip(systemSkillsDir)
      return [
        `export const systemSkillsZipBase64 = ${JSON.stringify(archive.toString('base64'))}`,
        `export const systemSkillsContentSha512 = ${JSON.stringify(contentSha512)}`,
      ].join('\n')
    },
  }
}
