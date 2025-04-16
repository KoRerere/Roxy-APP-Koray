import { glob } from 'glob'
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import pLimit from 'p-limit' // 控制并发

// 正则匹配 $t('key')，避免多余匹配问题
export const translationRegex = /\$t\s*\(\s*(['"`])([\s\S]*?)\1\s*(?:,.*?\))?/g
/**
 * 限制并发数
 */
const CONCURRENCY_LIMIT = 5

/**
 * 记录错误日志
 */
async function logError(error: string) {
  const errorLogPath = './error.log'
  await appendFile(errorLogPath, `${new Date().toISOString()} - ${error}\n`, 'utf-8')
}

/**
 * 文件匹配，忽略 node_modules 和 dist 目录
 */
async function matchFiles(cwd?: string) {
  console.log('matchFiles cwd:', cwd)
  return glob('**/*.{vue,ts,js,tsx}', {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', 'packages/**'],
  })
}

/**
 * 使用正则表达式从文件内容中提取键
 */
function extractKeys(content: string) {
  const keys = new Set<string>()
  let match
  while ((match = translationRegex.exec(content)) !== null) {
    keys.add(match[2]) // 捕获的键
  }
  return [...keys]
}

const limit = pLimit(CONCURRENCY_LIMIT)

/**
 * 扫描文件，提取所有翻译键
 */
export async function scanFiles(cwd?: string) {
  const files = await matchFiles(cwd)
  const allKeys = new Set<string>()

  const promiseArr = files.map(file => limit(async () => {
    try {
      const content = await readFile(file, 'utf-8')
      const keys = extractKeys(content)
      keys.forEach(key => allKeys.add(key)) // 添加到全局键集合
    }
    catch (error) {
      await logError(`读取文件出错: ${file} - ${error}`)
    }
  }))

  await Promise.all(promiseArr)
  return [...allKeys] // 返回去重后的键
}

/**
 * 替换文件中旧的翻译键为新的翻译键
 */
export async function scanFilesAndReplaceKey(oldKey: string, newKey: string) {
  const files = await matchFiles()

  const promiseArr = files.map(async (file) => {
    try {
      const content = await readFile(file, 'utf-8')
      let isContentChanged = false

      // 正确处理替换，确保仅替换 $t() 中的键
      const newContent = content.replaceAll(translationRegex, (match, quote, key, args) => {
        if (key === oldKey) {
          isContentChanged = true
          // 如果匹配到的 key 是目标 key，则进行替换
          return match.replace(oldKey, newKey)
        }
        return match // 否则返回原内容
      })

      if (isContentChanged) {
        await writeFile(file, newContent, 'utf-8') // 仅当内容变化时写入
      }
    }
    catch (error) {
      console.error(`读取文件出错: ${file} - ${error}`)
    }
  })

  await Promise.all(promiseArr)
}

/**
 * 将内容写入指定文件
 */
async function writeKeysToFile(fileContent: string, outputFile: string) {
  const outputDir = path.dirname(outputFile)
  try {
    await mkdir(outputDir, { recursive: true })
  }
  catch (error) {
    await logError(`创建目录失败: ${outputDir} - ${error}`)
  }
  // 替换 JSON.stringify 结果中的 `\\n` 为真正的 `\n`
  const formattedContent = fileContent.replace(/\\\\n|\\\\t/g, match => match === '\\\\n' ? '\\n' : '\\t')
  await writeFile(outputFile, formattedContent, 'utf-8')
}

/**
 * 生成并合并语言文件
 */
export async function genLangFiles(langFiles: string[] = [], outputDir: string, defaultLang = 'en', cwd?: string) {
  /**
   * 扫描提取的键，value 为空字符串的 key，排在最后
   */
  const keys = await scanFiles(cwd)
  const replacer = (key: string, value: any) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { empty = [], notEmpty = [] } = Object.groupBy(Object.keys(value).sort(), k => {
        return value[k] === '' ? 'empty' : 'notEmpty'
      })
      const sorted = notEmpty.reduce((sorted, k) => {
        sorted[k] = value[k]
        return sorted
      }, {})

      const emptySorted = empty.reduce((sorted, k) => {
        sorted[k] = value[k]
        return sorted
      }, {})
      return {
        ...sorted,
        ...emptySorted,
      }
    }
    return value
  }

  langFiles.forEach(async (lang) => {
    const langFilePath = path.join(outputDir, `${lang}.json`)
    let langFileObj = {} as Record<string, string>
    try {
      langFileObj = JSON.parse(await readFile(langFilePath, 'utf-8'))
    }
    catch (error) {
      // 忽略不存在的文件错误，自动生成新的语言文件
    }

    const newLangFileObj = keys.reduce<Record<string, string>>((acc, key) => {
      // 替换 JSON.stringify 结果中的 `\\n` 为真正的 `\n`
      key = key.replaceAll('\\n', '\n')
      acc[key] = defaultLang === lang ? key : langFileObj[key] || ''
      return acc
    }, {})

    await writeKeysToFile(JSON.stringify(newLangFileObj, replacer, 2), langFilePath)
  })
}

// genLangFiles(['zh-CN', 'en', 'de'], './output')
// scanFilesAndReplaceKey('Remember me', 'Remember me888')
