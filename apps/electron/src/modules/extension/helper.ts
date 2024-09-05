import path from 'node:path'
import url from 'node:url'
import { access, readFile, readdir } from 'node:fs/promises'
import { mediaProtocolName } from '/@/constants'
import { fileExists } from '/@/utils'

/** 递归获取 manifest.json 所在目录 */
async function getPluginDir(dir, level = 3) {
  if (level === 0) {
    return null
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
}

/** 获取插件信息 */
export async function getPluginMeta(pluginDir) {
  try {
    // 插件目录下是否有 manifest.json
    // const manifestExist = await access(path.join(pluginDir, 'manifest.json')).then(() => true).catch(() => false)
    const targetPluginDir = await getPluginDir(pluginDir)

    if (!targetPluginDir) {
      return Promise.reject('插件目录下不存在 manifest.json 文件')
    }

    // https://developer.chrome.com/docs/extensions/reference/api/i18n?hl=zh-cn
    const manifestFile = await readFile(path.join(targetPluginDir, 'manifest.json'), 'utf-8')
    const manifestInfo = JSON.parse(manifestFile)

    /** 插件图标 */
    let pluginIcon = ''

    // 多语言插件名
    if (manifestInfo.name.startsWith('__MSG_') && manifestInfo.default_locale) {
      const messageKey = manifestInfo.name.replace('__MSG_', '').replace('__', '')
      const messageJSON = await readFile(path.join(targetPluginDir, '_locales', manifestInfo.default_locale, 'messages.json'), 'utf-8')
      const message = JSON.parse(messageJSON)
      manifestInfo.name = message[messageKey].message
    }

    // 多语言插件描述
    if (manifestInfo.description?.startsWith('__MSG_') && manifestInfo.default_locale) {
      const messageKey = manifestInfo.description.replace('__MSG_', '').replace('__', '')
      const messageJSON = await readFile(path.join(targetPluginDir, '_locales', manifestInfo.default_locale, 'messages.json'), 'utf-8')
      const message = JSON.parse(messageJSON)
      manifestInfo.description = message[messageKey].message
    }

    try {
      const iconPath = manifestInfo.icons?.['128'] || Object.values(manifestInfo.icons || {})[0]
      /** 插件图标所在路径 */
      const pluginIconPath = path.join(targetPluginDir, iconPath)
      await access(pluginIconPath)
      pluginIcon = url.format({
        protocol: mediaProtocolName,
        slashes: true,
        pathname: pluginIconPath,
      })
    }
    catch (error) {
      console.log('pluginIcon error', error)
    }

    return {
      pluginIcon,
      pluginDir: targetPluginDir,
      pluginName: manifestInfo.name,
      pluginVersion: manifestInfo.version,
      pluginDesc: manifestInfo.description,
      provider: 'Chrome Store',
    }
  }
  catch (error) {
    console.log('manifestInfo error', error)
    return Promise.reject('manifest.json 文件不存在或格式有误')
  }
}
