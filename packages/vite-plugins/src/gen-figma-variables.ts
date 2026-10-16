import type { PluginOption, ResolvedConfig } from 'vite'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import bodyParser from 'body-parser'

interface OptionsType {
  targetDir: string
}

export function genFigmaVariables(options: OptionsType): PluginOption {
  const { targetDir } = options
  return {
    name: 'roxy:gen-figma-variables',
    configureServer(server) {
      server.middlewares.use(bodyParser.urlencoded({ extended: false }))
      // 使用 body-parser 中间件解析 JSON 数据
      server.middlewares.use(bodyParser.json())

      // 设置 CORS 头
      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        // 如果是预检请求，直接返回 200
        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }
        next()
      })

      server.middlewares.use('/__gen-figma-variables', async (req, res, next) => {
        if (req.method?.toLowerCase() === 'post') {
          // console.log('req.body338', req.body)
          if (Array.isArray(req.body)) {
            // 生成 CSS 变量文件
            await genVariables(req.body, targetDir)
            genCssVariable(req.body, targetDir)
          }
          res.end(JSON.stringify(req.body))
        }
        else {
          next() // 非 POST 请求直接交给其他中间件处理
        }
      })
    },
  }
}

async function genVariables(files: { fileName: string, body: Record<string, any> }[], targetDir: string) {
  try {
    await access(targetDir)
  }
  catch (error) {
    await mkdir(targetDir, { recursive: true })
  }
  files = files.filter(n => Object.keys(n.body).length)
  const genPromises = files.map(async (item) => {
    // 将斜杆替换为双下划线
    item.fileName = item.fileName.replaceAll('/', '__').replaceAll('.', '_').replaceAll(' ', '')
    if (!item.fileName.startsWith('_')) {
      item.fileName = `_${item.fileName}`
    }
    const { fileName, body } = item
    if (!Object.keys(body).length) {
      return
    }
    await writeFile(`${targetDir}/${fileName}.json`, JSON.stringify(body, null, 2))
  })
  await Promise.all(genPromises)
  console.log('生成 CSS 变量文件成功')
  /** 入口文件内容 */
  const indexContent = `/** 此文件自动生成，请勿修改！ */\n
${files.map(({ fileName }) => `import ${fileName} from './${fileName}.json';`).join('\n')}

export default {
${files.map(file => `  ...${file.fileName},`).join('\n')}
}
  `
  await writeFile(`${targetDir}/index.ts`, indexContent)
}

async function genCssVariable(files: { fileName: string, body: Record<string, any> }[], targetDir: string) {
  const dirPath = join(targetDir, 'theme')
  try {
    await access(dirPath)
  }
  catch (error) {
    await mkdir(dirPath, { recursive: true })
  }

  const genPromises = files.map(async (item) => {
    const { fileName, body } = item
    const bodyPromise = Object.entries(body).map(async ([subname, data]) => {
      const cssVariable = `:root {\n\t--${flattenObject(data).join(';\n\t--')}\n}`
      const name = `${fileName.toLocaleLowerCase().replace(/tokens/g, '').replace(/\./g, '_')}${subname.toLocaleLowerCase()}`
      await writeFile(`${dirPath}/${name}.css`, cssVariable)
      return name
    })
    return await Promise.all(bodyPromise)
  })
  // 其他变量文件暂时没用到，只聚合导出 dark 和 light 变量文件，后期需要用到时在添加
  const fileNames = (await Promise.all(genPromises)).flat().filter(name => ['dark', 'light'].some(subname => name.includes(subname)))
  const indexContent = `/** 此文件自动生成，请勿修改！暂时只聚合 dark 和 light 变量文件，其他文件暂未用到 */\n${fileNames.map(name => `import './${name}.css';`).join('\n')}`
  await writeFile(`${dirPath}/index.ts`, indexContent)
}

function flattenObject(obj: Record<string, any>, prefix = '') {
  function processValue(value: any) {
    if (typeof value !== 'string') return value
    // 整段 {a.b.c}，以及 rgb(from ...) 内部的别名，都要换成 CSS 变量
    return value.replace(/\{([^{}]+)\}/g, (_, tokenPath: string) => {
      return `var(--${tokenPath.replace(/\./g, '-')})`
    })
  }

  return Object.keys(obj).reduce((acc, key) => {
    const newPrefix = prefix ? `${prefix}-${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      acc.push(...flattenObject(obj[key], newPrefix));
    } else {
      const processedValue = processValue(obj[key]);
      acc.push(`${newPrefix}: ${processedValue}`);
    }
    return acc;
  }, [] as string[]);
}