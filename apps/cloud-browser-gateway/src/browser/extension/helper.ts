import crypto from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileExists } from '~/utils'

/** 递归获取 manifest.json 所在目录 */
export async function getPluginDir(dir: string, level = 3): Promise<string> {
  if (level === 0) return ''

  const manifestExist = await fileExists(path.join(dir, 'manifest.json'))
  if (manifestExist) return dir

  const files = await readdir(dir, { withFileTypes: true })
  for (const file of files) {
    if (file.isDirectory()) {
      const pluginDir = path.join(dir, file.name)
      const manifestExist = await fileExists(path.join(pluginDir, 'manifest.json'))
      if (manifestExist) return pluginDir

      const result = await getPluginDir(pluginDir, level - 1)
      if (result) return result
    }
  }
  return ''
}

/** 获取插件清单文件信息 */
export async function getPluginManifestInfo(pluginDir: string) {
  const targetPluginDir = await getPluginDir(pluginDir)
  if (!targetPluginDir) {
    throw new Error($t('扩展目录下不存在 manifest.json 文件'))
  }

  let manifestFile = await readFile(path.join(targetPluginDir, 'manifest.json'), 'utf-8')
  if (manifestFile.charCodeAt(0) === 0xFEFF) {
    manifestFile = manifestFile.slice(1)
  }
  const manifestInfo = JSON.parse(manifestFile)
  return { targetPluginDir, manifestInfo }
}

/** 计算插件 ID（与 Chromium 算法对齐） */
export function genExtensionID(options: { type: 'path' | 'key', input: string }) {
  const kIdSize = 16
  let input = ''
  const isPath = options.type === 'path'

  if (isPath) {
    for (let i = 0; i < options.input.length; i++) {
      input += options.input[i] + '\0'
    }
  }
  else {
    input = options.input
  }

  const encoding = isPath ? 'utf8' : 'base64'
  const hash = crypto.createHash('sha256').update(Buffer.from(input, encoding)).digest()
  const hashString = hash.subarray(0, kIdSize).toString('hex')
  return hashString.replace(/[0-9a-f]/g, (char) => {
    const val = Number.parseInt(char, 16)
    return String.fromCharCode('a'.charCodeAt(0) + val)
  })
}

/** 根据插件路径获取插件 ID */
export async function getExtensionIDByPath(pluginDir: string) {
  const { manifestInfo, targetPluginDir } = await getPluginManifestInfo(pluginDir)
  return genExtensionID({
    type: manifestInfo.key ? 'key' : 'path',
    input: manifestInfo.key || targetPluginDir,
  })
}
