import type { PluginOption } from 'vite'
import { GoogleTranslator } from '@roxy/puppeteer-google-translate'
import bodyParser from 'body-parser'
import { set } from 'es-toolkit/compat'
import { readdir, readFile, writeFile } from 'node:fs/promises'
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
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(bodyParser.urlencoded({ extended: false }))
      // 使用 body-parser 中间件解析 JSON 数据
      server.middlewares.use(bodyParser.json())

      server.middlewares.use(`${baseUrl}/api`, async (req, res, next) => {
        const url = req.url
        // 获取语言列表
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
        // 翻译文本
        else if (url === '/translate') {
          const { text, from = 'auto', to } = req.body
          googleTranslator ||= new GoogleTranslator()

          // googleTranslator.translateText('A bird in hand is worth two in the bush.', 'auto', 'zh-CN')
          try {
            const result = await googleTranslator.translateText(text, from, to)
            res.end(result)
          }
          catch (error) {
            res.end(error.message)
          }
        }
        else if (url === '/saveTranslate') {
          const { fileName, key, value } = req.body
          const filePath = join(targetDir, `${fileName}.json`)
          try {
            const data = await readFile(filePath, 'utf-8')
            const jsonData = JSON.parse(data)
            set(jsonData, key, value)
            await writeFile(filePath, JSON.stringify(jsonData, null, 2))
            res.end('ok')
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
