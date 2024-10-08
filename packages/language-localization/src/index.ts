import type { PluginOption } from 'vite'
import { GoogleTranslator } from '@roxy/puppeteer-google-translate'
import bodyParser from 'body-parser'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import serveStatic from 'serve-static'

interface OptionsType {
  targetDir: string
}

const baseUrl = '/__language-localization__'

let googleTranslator: GoogleTranslator

export default (options: OptionsType): PluginOption => {
  const { targetDir } = options
  return {
    name: 'roxy:language-localization',
    configureServer(server) {
      server.middlewares.use(bodyParser.urlencoded({ extended: false }))
      // 使用 body-parser 中间件解析 JSON 数据
      server.middlewares.use(bodyParser.json())

      server.middlewares.use(`${baseUrl}/api`, async (req, res, next) => {
        const url = req.url
        if (url === '/getLangs') {
          const files = await readdir(targetDir, { withFileTypes: true })
          const promiseArr = files.map(async (file) => {
            if (file.isFile() && file.name.endsWith('.json')) {
              const data = await readFile(join(targetDir, file.name), 'utf-8')
              return { fileName: file.name.replace('.json', ''), body: JSON.parse(data) }
            }
          })
          const result = await Promise.all(promiseArr)
          console.log('result', result)
          res.end(JSON.stringify(result))
        }
        else if (url === '/translate') {
          const { text, from = 'auto', to } = req.body
          googleTranslator ||= new GoogleTranslator()

          // googleTranslator.translateText('A bird in hand is worth two in the bush.', 'auto', 'zh-CN')
          // googleTranslator.translateText('Better be the head of a dog than the tail of a lion.', 'auto', 'zh-CN')
          // googleTranslator.translateText('Treat yourself well. ', 'auto', 'zh-CN')
          try {
            const result = await googleTranslator.translateText(text, from, to)
            res.end(result)
          }
          catch (error) {
            res.end(error.message)
          }
        }
        else {
          next()
        }
      })
      // 使用 serve-static 中间件提供静态资源服务
      server.middlewares.use(baseUrl, serveStatic(join(__dirname, '../page'), { index: ['index.html'] }))
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
