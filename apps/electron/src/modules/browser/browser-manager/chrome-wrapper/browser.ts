import CDP from 'chrome-remote-interface'
import type { Client } from 'chrome-remote-interface'
import { ChildProcess, execSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { ChromeTarget } from './target'
import { ChromePage } from './page'
import type { Protocol } from 'puppeteer-core'
import { ChromeCDPSession } from './cdp-session'
import type { BrowserEvents } from './types'
import { isErrorLike, pidExists, safeParseJSON } from '/@/utils'
import { setTimeout } from 'node:timers/promises'

/**
 * 基于 chrome-remote-interface 的浏览器封装
 * 提供类似 puppeteer-core 的 API
 */
export class ChromeBrowser extends EventEmitter {
  client: Client
  private browserProcess: ChildProcess | null = null
  private _wsEndpoint: string
  private targetsMap: Map<string, ChromeTarget> = new Map()
  private disconnectedEmitted = false
  #browserProcessExiting: Promise<void> | null = null
  #exited = false;
  actualPort?: number

  constructor(client: Client, wsEndpoint: string, browserProcess?: ChildProcess, actualPort?: number) {
    super()
    this.client = client
    this._wsEndpoint = wsEndpoint
    this.browserProcess = browserProcess || null
    this.actualPort = actualPort
    this.setupEventListeners()
    this.#browserProcessExiting = new Promise<void>((resolve) => {
      this.browserProcess?.once('exit', () => {
        console.debug(`Browser process ${this.browserProcess?.pid} onExit`);
        this.#exited = true;
        resolve();
      });
    });
  }

  private setupEventListeners() {
    // 监听目标创建/销毁事件
    this.client.Target.targetCreated((params: Protocol.Target.TargetCreatedEvent) => {
      const target = new ChromeTarget(this.client, params.targetInfo, this)
      this.targetsMap.set(params.targetInfo.targetId, target)
      this.emit('targetcreated', target)
    })

    this.client.Target.targetDestroyed((params: Protocol.Target.TargetDestroyedEvent) => {
      const target = this.targetsMap.get(params.targetId)
      if (target) {
        this.targetsMap.delete(params.targetId)
        this.emit('targetdestroyed', target)
      }
    })

    this.client.Target.targetInfoChanged((params: Protocol.Target.TargetInfoChangedEvent) => {
      const target = this.targetsMap.get(params.targetInfo.targetId)
      if (target) {
        target.updateInfo(params.targetInfo)
        this.emit('targetchanged', target)
      }
    })

    // 监听断开连接事件
    this.client.on('disconnect', () => {
      this.emitDisconnected()
    })

    // 监听浏览器进程事件
    if (this.browserProcess) {
      let closed = false;

      // 进程退出事件
      this.browserProcess.on('exit', async (code, signal) => {
        console.debug('browser process exit', code, signal)
        this.emitDisconnected()
        this.emit('process-exit', { code, signal })
        await setTimeout(1500)
        // 如果底层管道建立失败或早期崩溃，导致 Node 无法 cleanly 收尾，则需要手动触发 close
        if (!closed) {
          this.emit('process-close', { code, signal })
          this.kill()
        }
      })

      // 进程关闭事件
      this.browserProcess.on('close', (code, signal) => {
        console.debug('browser process close', code, signal)
        this.emitDisconnected()
        this.emit('process-close', { code, signal })
        closed = true;
      })

      // 进程错误事件
      this.browserProcess.on('error', (error) => {
        console.debug('browser process error', error)
        this.emit('process-error', error)
      })
    }
  }

  private emitDisconnected() {
    if (!this.disconnectedEmitted) {
      this.disconnectedEmitted = true
      this.emit('disconnected')
    }
  }

  wsEndpoint(): string {
    return this._wsEndpoint
  }

  async close(): Promise<void> {
    // 调用 Browser.close 关闭浏览器
    await this.client.Browser.close()
    if (!this.#exited) {
      await setTimeout(100)
      this.kill();
    }
    return this.#browserProcessExiting!;
  }

  kill(): void {
    console.debug(`Trying to kill ${this.browserProcess?.pid}`);
    // 如果进程启动失败（例如浏览器可执行路径无效），则进程不会获得pid
    // 调用`proc.kill`会出错，因为找不到要杀死的`pid`
    if (
      this.browserProcess &&
      this.browserProcess.pid &&
      pidExists(this.browserProcess.pid)
    ) {
      try {
        console.debug(`Browser process ${this.browserProcess.pid} exists`);
        if (process.platform === 'win32') {
          try {
            execSync(
              `taskkill /pid ${this.browserProcess.pid} /T /F`,
            );
          } catch (error) {
            console.debug(
              `Killing ${this.browserProcess.pid} using taskkill failed`,
              error,
            );
            // taskkill可能由于权限不足等原因无法杀死进程
            // 让我们通过Node API杀死进程。这会延迟杀死`this.proc`的所有子进程
            // 直到主Node.js进程死亡
            this.browserProcess.kill();
          }
        } else {
          // 在linux上，进程组可以通过前缀为负号的组ID来杀死
          // 进程组ID是组领导者的pid
          const processGroupId = -this.browserProcess.pid;

          try {
            process.kill(processGroupId, 'SIGKILL');
          } catch (error) {
            console.debug(
              `Killing ${this.browserProcess.pid} using process.kill failed`,
              error,
            );
            // 由于权限不足等原因，杀死进程组可能会失败
            // 让我们通过Node API杀死进程。这会延迟杀死`this.proc`的所有子进程
            // 直到主Node.js进程死亡
            this.browserProcess.kill('SIGKILL');
          }
        }
      } catch (error) {
        throw new Error(
          `Browser process ${this.browserProcess?.pid} kill failed\nError cause: ${isErrorLike(error) ? error.stack : error
          }`,
        );
      }
    }
  }

  async pages(): Promise<ChromePage[]> {
    // @ts-ignore Chrome DevTools Protocol 类型定义中缺少 getTabs 方法
    const { tabs } = await this.client.Browser.getTabs()
    const allTabs = safeParseJSON(tabs)
    const pages: ChromePage[] = []
    for (const tab of allTabs) {
      const { targetInfo } = await this.client.Target.getTargetInfo({ targetId: tab.target_id })
      const page = new ChromePage(this.client, targetInfo, this)
      pages.push(page)
    }

    return pages
  }

  target(): ChromeTarget {
    // 返回浏览器主目标
    // 注意：浏览器本身没有一个特定的 target，这里返回一个特殊的目标
    // 如果需要创建 CDP Session，应该使用具体的页面 target
    const browserTargetInfo: Protocol.Target.TargetInfo = {
      targetId: 'browser',
      type: 'browser',
      title: 'Browser',
      url: '',
      attached: true,
      canAccessOpener: false,
      browserContextId: undefined
    }
    return new ChromeTarget(this.client, browserTargetInfo, this)
  }

  process(): ChildProcess | null {
    return this.browserProcess
  }

  async newPage(url = 'about:blank'): Promise<ChromePage> {
    const { targetId } = await this.client.Target.createTarget({ url, })
    const { targetInfo } = await this.client.Target.getTargetInfo({ targetId })
    return new ChromePage(this.client, targetInfo, this)
  }

  /**
   * 创建浏览器级别的 CDP Session
   * 这个 Session 可以访问浏览器级别的 CDP 命令，如 Storage、Network 等
   */
  async createBrowserCDPSession(): Promise<ChromeCDPSession> {
    // 对于浏览器级别的操作，我们直接使用主 client
    // 创建一个特殊的 CDPSession，它直接使用主连接
    return new ChromeCDPSession(this.client, '', 'browser')
  }

  // 类型安全的事件方法
  on<K extends keyof BrowserEvents>(event: K, listener: BrowserEvents[K]): this {
    return super.on(event, listener)
  }

  off<K extends keyof BrowserEvents>(event: K, listener: BrowserEvents[K]): this {
    return super.removeListener(event, listener)
  }

  emit<K extends keyof BrowserEvents>(event: K, ...args: Parameters<BrowserEvents[K]>): boolean {
    return super.emit(event, ...args)
  }
}
