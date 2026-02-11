import type { FirefoxOptions } from './types'
import type { ChildProcess } from 'node:child_process'
import child_process from 'node:child_process'

export class FirefoxProcess {
  private process: ChildProcess | null = null
  private wsUrl: string | null = null
  private onWsUrlFound?: (url: string) => void

  constructor(private options: FirefoxOptions) {}

  /**
   * 启动 Firefox 进程
   */
  start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const { executablePath, userDataDir, urls = [] } = this.options

      const args = [
        '-profile',
        userDataDir,
        '--remote-debugging-port=0',
        ...urls,
      ]

      this.process = child_process.spawn(executablePath, args)

      if (!this.process) {
        reject(new Error('Failed to spawn Firefox process'))
        return
      }

      // 监听标准输出
      this.process.stdout?.on('data', (data) => {
        console.log(data.toString())
      })

      // 监听标准错误输出，查找 WebSocket URL
      this.process.stderr?.on('data', (data) => {
        const output = data.toString()
        console.error(output)

        if (!this.wsUrl) {
          const match = output.match(/WebDriver BiDi listening on (ws:\/\/\S+)/)
          if (match) {
            this.wsUrl = match[1]
            console.log(`Found WebSocket URL: ${this.wsUrl}`)
            if (this.wsUrl) {
              resolve(this.wsUrl)
              if (this.onWsUrlFound) {
                this.onWsUrlFound(this.wsUrl)
              }
            }
          }
        }
      })

      // 监听进程错误
      this.process.on('error', (error) => {
        console.error('Firefox process error:', error)
        reject(error)
      })

      // 监听进程退出
      this.process.on('exit', (code, signal) => {
        console.log(`Firefox process exited with code ${code} and signal ${signal}`)
      })

      // 超时处理
      setTimeout(() => {
        if (!this.wsUrl) {
          reject(new Error('Timeout waiting for WebSocket URL'))
        }
      }, 30000) // 30秒超时
    })
  }

  /**
   * 停止 Firefox 进程
   */
  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.wsUrl = null
    }
  }

  /**
   * 获取 WebSocket URL
   */
  getWsUrl(): string | null {
    return this.wsUrl
  }

  /**
   * 设置 WebSocket URL 发现回调
   */
  setOnWsUrlFound(callback: (url: string) => void): void {
    this.onWsUrlFound = callback
  }
}
