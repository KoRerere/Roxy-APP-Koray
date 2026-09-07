import { generateKeyPairSync } from 'node:crypto'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { mediaProtocolName, ossObject } from '/@/constants'
import { fileExists } from '/@/utils'
import { genExtensionID } from './extensionId'

export type PluginMeta = Awaited<ReturnType<typeof getPluginMeta>>

export { genExtensionID } from './extensionId'

/** 递归获取 manifest.json 所在目录 */
export async function getPluginDir(dir: string, level = 3): Promise<string> {
  if (level === 0) {
    return ''
  }

  const manifestExist = await fileExists(path.join(dir, 'manifest.json'))
  if (manifestExist) {
    return dir
  }

  const files = await readdir(dir, { withFileTypes: true })
  for (const file of files) {
    if (file.isDirectory()) {
      const pluginDir = path.join(dir, file.name)
      const manifestExist = await fileExists(path.join(pluginDir, 'manifest.json'))
      if (manifestExist) {
        return pluginDir
      }
      else {
        const result = await getPluginDir(pluginDir, level - 1)
        if (result) {
          return result
        }
      }
    }
  }
  return ''
}

/** 获取插件清单文件信息 */
export async function getPluginManifestInfo(pluginDir: string) {
  try {
    // 插件目录下是否有 manifest.json
    // const manifestExist = await access(path.join(pluginDir, 'manifest.json')).then(() => true).catch(() => false)
    const targetPluginDir = await getPluginDir(pluginDir)

    if (!targetPluginDir) {
      throw new Error($t('扩展目录下不存在 manifest.json 文件'))
    }

    // https://developer.chrome.com/docs/extensions/reference/api/i18n?hl=zh-cn
    let manifestFile = await readFile(path.join(targetPluginDir, 'manifest.json'), 'utf-8')
    // 移除 UTF-8 BOM
    if (manifestFile.charCodeAt(0) === 0xFEFF) {
      manifestFile = manifestFile.slice(1)
      console.log('manifestFile removed UTF-8 BOM')
    }
    const manifestInfo = JSON.parse(manifestFile)
    return {
      targetPluginDir,
      manifestInfo,
    }
  }
  catch (error) {
    return Promise.reject(error)
  }
}

/** 获取插件信息 */
export async function getPluginMeta(pluginDir: string) {
  try {
    const { targetPluginDir, manifestInfo } = await getPluginManifestInfo(pluginDir)

    /** 插件图标 */
    let pluginIcon = ''

    // 多语言插件名
    if (manifestInfo.name.startsWith('__MSG_') && manifestInfo.default_locale) {
      const messageKey = manifestInfo.name.replace('__MSG_', '').replace('__', '').toLowerCase()
      const messageJSON = await readFile(path.join(targetPluginDir, '_locales', manifestInfo.default_locale, 'messages.json'), 'utf-8')
      const message = Object.entries(JSON.parse(messageJSON)).reduce((acc, [key, value]) => {
        acc[key.toLowerCase()] = value
        return acc
      }, {})
      manifestInfo.name = message[messageKey]?.message
    }

    // 多语言插件描述
    if (manifestInfo.description?.startsWith('__MSG_') && manifestInfo.default_locale) {
      const messageKey = manifestInfo.description.replace('__MSG_', '').replace('__', '').toLowerCase()
      const messageJSON = await readFile(path.join(targetPluginDir, '_locales', manifestInfo.default_locale, 'messages.json'), 'utf-8')
      const message = Object.entries(JSON.parse(messageJSON)).reduce((acc, [key, value]) => {
        acc[key.toLowerCase()] = value
        return acc
      }, {})
      manifestInfo.description = message[messageKey]?.message
    }

    try {
      const iconPath = manifestInfo.icons?.['128'] || Object.values(manifestInfo.icons || {})[0]
      const iconPathExist = iconPath ? await fileExists(path.join(targetPluginDir, iconPath)) : false
      /** 插件图标所在路径 */
      const pluginIconPath = iconPathExist ? path.join(targetPluginDir, iconPath) : ossObject.defaultPluginIconPath
      await access(pluginIconPath)
      pluginIcon = `${mediaProtocolName}:${pluginIconPath}`
    }
    catch (error) {
      console.log('pluginIcon error', error)
    }

    return {
      pluginIconPath: pluginIcon,
      pluginPath: targetPluginDir,
      pluginName: manifestInfo.name,
      pluginVersion: manifestInfo.version,
      pluginDesc: manifestInfo.description || '',
      provider: 'Chrome Store',
    }
  }
  catch (error) {
    console.log('manifestInfo error', error)
    throw new Error($t('manifest.json 文件不存在或格式有误'))
  }
}
/** 根据插件路径获取插件 ID */
export async function getExtensionIDByPath(pluginDir: string) {
  const { manifestInfo, targetPluginDir } = await getPluginManifestInfo(pluginDir)
  console.log('getExtensionIDByPath', targetPluginDir, manifestInfo.key)
  const extensionID = genExtensionID({
    type: manifestInfo.key ? 'key' : 'path',
    input: manifestInfo.key || targetPluginDir,
  })
  return extensionID
}
/**
 * 生成 RSA 密钥对
 * @returns {object} - 包含公钥和私钥的对象
 */
function generateRSAKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })

  return { publicKey, privateKey }
}

/**
 * 提取公钥的 Base64 编码
 * @param {string} publicKey - PEM 格式的公钥
 * @returns {string} - 公钥的 Base64 编码
 */
function extractBase64PublicKey(publicKey) {
  const base64PublicKey = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\n/g, '')
  return base64PublicKey
}

/** 生成插件公钥，在 manifest.json 的 key 字段中会用到 */
export function genExtensionKey() {
  // 生成 RSA 密钥对
  const { publicKey } = generateRSAKeyPair()

  // 提取公钥的 Base64 编码
  const base64PublicKey = extractBase64PublicKey(publicKey)

  console.log('Base64 encoded public key:', base64PublicKey)
  return base64PublicKey
}
