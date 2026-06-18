import type { StructuredToolInterface } from '@langchain/core/tools'
import type { ChildProcess } from 'node:child_process'
import { tool } from 'langchain'
import { fork } from 'node:child_process'
import path from 'node:path'
import { z } from 'zod'
import { API } from '../../api'
import { env } from '../../config'

interface RunScriptParam { scriptName: string, cdpUrl: string }

interface ScriptInfo {
  name?: string
  scriptOssUrl?: string
  title?: string
}

let scriptListCache: ScriptInfo[] | null = null

async function getScriptList(): Promise<ScriptInfo[]> {
  if (scriptListCache) {
    return scriptListCache
  }
  const res = await API.base.userGetRpaScriptLibraryListList()
  scriptListCache = res.data?.rows || []
  return scriptListCache
}

async function resolveScriptUrl(scriptName: string): Promise<string | null> {
  const list = await getScriptList()
  const found = list.find(s => s.name === scriptName)
  return found?.scriptOssUrl || null
}

export const runScriptTools = [
  tool(
    async (
      input: { scripts: Array<RunScriptParam> },
      _config: any,
    ): Promise<string> => {
      const abortSignal: AbortSignal | undefined = _config?.signal

      if (abortSignal?.aborted) {
        return '任务已被中断'
      }

      const sandboxPath = env.ENV_TYPE === 'development' ? env.AGENT_ENTRY_SCRIPT : path.resolve(env.CHECKPOINT_DIR, '../roxy-agent.mjs')

      console.info('self path: ', sandboxPath)
      const allScriptsPromises = input.scripts.map(async (item: RunScriptParam) => {
        console.info('Run scripts: ', item.scriptName, item.cdpUrl)

        const { promise, resolve } = Promise.withResolvers()
        const { scriptName, cdpUrl } = item

        let scriptPath: string
        if (/^https?:\/\//.test(scriptName)) {
          scriptPath = scriptName
        }
        else {
          const url = await resolveScriptUrl(scriptName)
          if (!url) {
            return `脚本 "${scriptName}" 未找到，请确认脚本名称是否正确`
          }
          scriptPath = url
        }

        // const selfPath = fileURLToPath(import.meta.url)

        const worker: ChildProcess = fork(sandboxPath, [scriptPath], {
          env: { ...process.env, ROXY_MODE: 'sandbox', CDP_URL: cdpUrl, DESKTOP_DIR: env.DESKTOP_DIR },
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          execArgv: ['--experimental-strip-types', '--experimental-vm-modules'],
        })

        console.info(`[master] Worker PID: ${worker.pid}`)

        const onAbort = () => {
          console.log(`[master] Abort signal received, killing worker (PID ${worker.pid})...`)
          worker.kill('SIGTERM')
          resolve(`脚本 "${scriptName}" 执行被中断`)
        }

        if (abortSignal) {
          abortSignal.addEventListener('abort', onAbort, { once: true })
        }

        worker.on('error', (err) => {
          console.error(`[master] Worker process error (PID ${worker.pid}):`, err)
        })

        process.on('SIGINT', () => {
          console.log('\n[master] SIGINT received, forwarding to worker...')
          worker.kill('SIGTERM')
        })

        process.on('SIGTERM', () => {
          worker.kill('SIGTERM')
        })

        const messages: string[] = []

        worker.on('message', (msg: any) => {
          if (msg?.type === 'script_message') {
            messages.push(msg.message)
          }
        })

        worker.on('exit', (code, exitSignal) => {
          abortSignal?.removeEventListener('abort', onAbort)
          if (code === 0) {
            console.log(`[master] Worker (PID ${worker.pid}) completed successfully.`)
            const report = messages.length ? `\n\n## 执行报告\n\n${messages.join('\n\n')}` : ''
            resolve(`脚本 "${scriptName}" 执行成功${report}`)
          }
          else if (exitSignal === 'SIGKILL') {
            resolve(`脚本 "${scriptName}" 执行失败：被强制终止`)
          }
          else if (code === 124) {
            resolve(`脚本 "${scriptName}" 执行失败：超时`)
          }
          else {
            resolve(`脚本 "${scriptName}" 执行失败：退出码 ${code}`)
          }
        })

        return promise
      })

      return (await Promise.all(allScriptsPromises)).join('\n')
    },
    {
      name: 'run_script',
      description: `Run one or more automation scripts by name. The script name must match a script from the script library. Each script runs in an isolated sandbox with access to a browser via CDP.`,
      schema: z.object({
        scripts: z
          .array(
            z.object({
              scriptName: z
                .string()
                .describe('The name of the script from the script library (e.g. "enhance-fb-01-0508")'),
              cdpUrl: z.string().describe('CDP URL of the browser to connect to'),
            }),
          )
          .min(1, 'At least one script is required')
          .describe('Array of scripts to run'),
      }),
    },
  ) as unknown as StructuredToolInterface,
]
