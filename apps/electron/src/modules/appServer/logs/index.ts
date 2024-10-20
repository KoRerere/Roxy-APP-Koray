import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { appConfig } from '/@/constants'
import styles from './style.css?raw'

const app = express()
const PORT = 8090

// 路由：显示日志页面
app.get('/__logs__', (req, res) => {
  const logDir = appConfig.logsDir
  console.log('logDir', logDir)

  // 获取最新的日志文件 (按日期命名的日志文件)
  fs.readdir(logDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading logs directory.')
    }

    // 选择最新的日志文件（按照文件名日期排序）
    const logFiles = files.filter(file => file.endsWith('.log')).sort().reverse()
    if (logFiles.length === 0) {
      return res.status(404).send('No log files found.')
    }

    const latestLogFile = path.join(logDir, logFiles[0])

    // 读取最新的日志文件
    fs.readFile(latestLogFile, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).send('Error reading log file.')
      }

      // 转换日志文件为 HTML 格式
      const html = formatLogToHtml(data)

      // 返回 HTML 页面
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Logs</title>
          <style>${styles}</style>
        </head>
        <body>
          <h1>Application Logs</h1>
          <div class="logs">${html}</div>
        </body>
        </html>
      `)
    })
  })
})

/**
 * 函数：将日志格式化为 HTML
 */
function formatLogToHtml(logData) {
  const logLines = logData.split('\n').filter(line => line.trim() !== '')
  return logLines.map((line) => {
    /**
     * 默认样式
     */
    let logClass = 'info'
    if (line.includes('[error]'))
      logClass = 'error'
    if (line.includes('[warn]'))
      logClass = 'warn'
    return `<p class="log ${logClass}">${line}</p>`
  }).join('')
}

// 启动服务器
app.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}`)
})
