import { glob } from 'glob'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// 匹配 $t('key') 或 $t('key', {params})，包括带点或破折号的键
const translationRegex = /\$t\(\s*['"]([^'"]+)['"]\s*(?:,\s*([\s\S]*?)\s*)?\)/g

// 用于移除注释的正则表达式模式（包括单行和多行注释）
const commentRegexList = [
  /\/\/.*$/gm, // 匹配单行注释
  /\/\*[\s\S]*?\*\//g, // 匹配多行注释
]

/**
 * 移除文件内容中的注释
 */
function removeComments(content: string) {
  let noCommentsContent = content
  commentRegexList.forEach((regex) => {
    noCommentsContent = noCommentsContent.replace(regex, '') // 移除所有匹配的注释
  })
  return noCommentsContent
}

/**
 * 使用正则表达式从文件内容中提取键
 */
function extractKeys(content: string) {
  const keys = new Set<string>()
  // 从内容中移除注释
  const noCommentsContent = removeComments(content)

  let match
  while ((match = translationRegex.exec(noCommentsContent)) !== null) {
    if (match[1])
      keys.add(match[1]) // 将唯一键添加到集合中
  }

  return [...keys] // 以数组形式返回键
}

/**
 * 扫描文件并提取键
 */
export async function scanFiles() {
  // 匹配项目目录中的所有 .vue, .ts, .js 和 .tsx 文件
  const files = await glob('**/*.{vue,ts,js,tsx}', { ignore: ['**/node_modules/**', '**/dist/**'] })

  const allKeys = new Set<string>()

  const promiseArr = files.map(async (file) => {
    // if (file.includes('ry-table/index.vue')) {
    //   console.log('file', file)
    //   const content = await readFile(file, 'utf-8')
    //   const keys = extractKeys(content)
    //   console.log('keys', keys)
    // }

    try {
      const content = await readFile(file, 'utf-8')
      const keys = extractKeys(content)
      keys.forEach(key => allKeys.add(key)) // 添加到全局键集合中
    }
    catch (error) {
      console.error(`读取文件出错: ${file}`)
    }
  })
  await Promise.all(promiseArr)
  return [...allKeys] // 以数组形式返回
}

/**
 * 将键写入输出文件
 */
export async function writeKeysToFile(fileContent: string, outputFile: string) {
  const outputDir = path.dirname(outputFile)
  try {
    await access(outputDir)
  }
  catch (error) {
    console.log(`创建目录: ${outputDir}`)
    await mkdir(outputDir, { recursive: true })
  }
  await writeFile(outputFile, fileContent, 'utf-8') // 以 JSON 格式写入键
}

const langFiles = ['zh-CN', 'en', 'de']

function replacer(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // 对对象的键进行排序
    return Object.keys(value).sort().reduce((sorted, k) => {
      sorted[k] = value[k]
      return sorted
    }, {})
  }
  return value
}

/**
 * 扫描文件并生成语言文件
 */
export async function genLangFiles(langFiles: string[] = [], outputDir: string, defaultLang = 'en') {
  /**
   * 从文件中提取键
   */
  const keys = await scanFiles()
  console.log('keys', keys)
  langFiles.forEach(async (lang) => {
    const langFilePath = path.join(outputDir, `${lang}.json`)
    let langFileObj = {} as Record<string, string>
    try {
      langFileObj = JSON.parse(await readFile(langFilePath, 'utf-8'))
    }
    catch (error) {

    }
    const newLangFileObj = keys.reduce<Record<string, string>>((acc, key) => {
      acc[key] = defaultLang === lang ? key : langFileObj[key] || ''
      return acc
    }, {})
    await writeKeysToFile(JSON.stringify(newLangFileObj, replacer, 2), langFilePath) // 将提取的键
  })
}
