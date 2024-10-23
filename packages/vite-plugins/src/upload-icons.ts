import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PluginOption, ResolvedConfig } from 'vite'
import AdmZip from 'adm-zip'
import formidable from 'formidable'
import { Buffer } from 'node:buffer'
import { exec } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

interface OptionsType {
  extractDir: string
}

let _options: OptionsType
let extractDir: string

export function uploadIcons(options: OptionsType): PluginOption {
  _options = options
  return {
    name: 'roxy:upload-icons',
    configureServer(server) {
      server.middlewares.use('/__upload-icons', async (req, res, next) => {
        if (req.method?.toLowerCase() === 'post') {
          const form = formidable()
          let fileBuffer!: Buffer
          form.onPart = (part) => {
            // 处理上传的文件部分
            if (part.originalFilename) {
              const chunks: Uint8Array[] = []

              // 收集文件数据
              part.on('data', (chunk) => {
                chunks.push(chunk)
              })

              // 当文件接收完毕
              part.on('end', () => {
                /**
                 * 将收到的二进制数据合并为一个 Buffer
                 */
                fileBuffer = Buffer.concat(chunks)
              })
            }
            else {
              // 如果是普通字段，默认处理
              form._handlePart(part)
            }
          }

          const [fields] = await form.parse(req)
          if (fields.dirName?.at(0)) {
            extractDir = path.resolve(_options.extractDir, fields.dirName[0])
          }
          // 解压 ZIP 文件
          extractZipFromBuffer(fileBuffer, res)
          console.log('fields', fields)
        }
        else {
          next() // 非 POST 请求直接交给其他中间件处理
        }
      })

      server.middlewares.use('/__open-folder', (req, res) => {
        const query = req.url?.split('?')[1]
        const folderPath = new URLSearchParams(query).get('folder')
        if (!folderPath) {
          res.writeHead(400)
          res.end('Folder path not provided')
          return
        }

        const platform = os.platform()
        let command = ''

        if (platform === 'win32') {
          command = `start "" "${folderPath}"` // Windows
        }
        else if (platform === 'darwin') {
          command = `open "${folderPath}"` // MacOS
        }
        else if (platform === 'linux') {
          command = `xdg-open "${folderPath}"` // Linux
        }

        exec(command, (err) => {
          if (err) {
            console.error('Error opening folder:', err)
            res.writeHead(500)
            res.end('Error opening folder')
          }
          else {
            res.writeHead(200)
            res.end('Folder opened successfully')
          }
        })
      })
    },
  }
}

/**
 * 从 Buffer 中解压 ZIP 文件
 */
function extractZipFromBuffer(zipBuffer: Buffer, res: ServerResponse<IncomingMessage>) {
  try {
    /**
     * 使用 Buffer 创建 adm-zip 实例
     */
    const zip = new AdmZip(zipBuffer)
    /**
     * 获取 ZIP 文件中的所有条目
     */
    const zipEntries = zip.getEntries()

    // 列出 ZIP 文件内容
    const filesList = zipEntries.map((entry) => {
      zip.extractEntryTo(entry, extractDir, false, true)
      return entry.entryName
    })
    res.statusCode = 200
    res.end(JSON.stringify({
      message: `已解压到：${extractDir}`,
      files: filesList,
      saveDir: extractDir,
    }))
    console.log('ZIP 文件解压成功', extractDir)
    // zip.extractAllTo(extractDir, true)
  }
  catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Error while extracting ZIP file')
  }
}
