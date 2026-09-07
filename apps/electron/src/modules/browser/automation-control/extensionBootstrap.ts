import { createHash } from 'node:crypto'
import { cp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { appConfig } from '/@/constants'
import { genExtensionID } from '/@/modules/extension/helper'
import { automationControlExtensionBridge } from './extensionBridge'

function profileExtensionDirectory(dirId: string): string {
  const key = createHash('sha256').update(dirId).digest('hex').slice(0, 24)
  return join(appConfig.tempDir, 'automation-control-extension', key)
}

function unpackedExtensionId(extensionDir: string): string {
  return genExtensionID({ type: 'path', input: extensionDir })
}

export async function prepareAutomationControlExtension(dirId: string): Promise<string> {
  const targetDir = profileExtensionDirectory(dirId)
  const sourceDir = join(appConfig.staticResourceDir, 'automation-control-extension')
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: true })
  automationControlExtensionBridge.registerProfile(dirId, unpackedExtensionId(targetDir))
  return targetDir
}

export function ensureAutomationExtensionLaunchArg(args: string[], extensionDir: string): void {
  const index = args.findIndex(arg => arg.startsWith('--load-extension='))
  if (index < 0) {
    args.push(`--load-extension=${extensionDir}`)
    return
  }
  const paths = args[index]!.slice('--load-extension='.length).split(',').filter(Boolean)
  if (!paths.includes(extensionDir)) {
    paths.unshift(extensionDir)
  }
  args[index] = `--load-extension=${paths.join(',')}`
}
