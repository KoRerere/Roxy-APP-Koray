import path from 'node:path'
import { Client } from 'ssh2'
import {
  createSplitZipPackages,
  JumpServerClient,
  JumpServerDeployer,
  loadDeployEnvFile,
  loadJumpServerConfigFromEnv,
  requireDeployEnv,
} from '@roxybrowser/jumpserver-deploy'
import type { DeployTarget, JumpServerConfig } from '@roxybrowser/jumpserver-deploy'

const SSH_READY_TIMEOUT_MS = 30_000
const SSH_KEEPALIVE_INTERVAL_MS = 10_000
const REMOTE_COMMAND_TIMEOUT_MS = 10 * 60_000

const DEPLOY_ENV_FILE = path.join(import.meta.dirname, '../.env.deploy')
const DEPLOY_ENV_HINT = 'apps/web/.env.deploy（参考 .env.deploy.example）'
const DIST_PATH = path.join(import.meta.dirname, '../dist')

// 延后部署：入口 html 与版本号文件最后更新，避免用户加载到一半的旧资源
const DELAYED_DEPLOY_FILE_NAMES = new Set(['version'])

loadDeployEnvFile(DEPLOY_ENV_FILE)

function getDeployTargets(isProd: boolean, isWhitelist: boolean): DeployTarget[] {
  if (isProd) {
    return [
      {
        label: '8.217.98.238',
        assetId: requireDeployEnv('JMS_ASSET_ID_PROD_1', DEPLOY_ENV_HINT),
        remoteBasePath: isWhitelist ? '/root/roxybrowser/dist-whitelist' : '/root/roxybrowser/dist',
      },
      {
        label: '42.121.165.6',
        assetId: requireDeployEnv('JMS_ASSET_ID_PROD_2', DEPLOY_ENV_HINT),
        remoteBasePath: isWhitelist ? '/var/www/roxybrowser/dist-whitelist' : '/var/www/roxybrowser/dist',
      },
    ]
  }

  return [
    {
      label: '8.218.38.36',
      assetId: requireDeployEnv('JMS_ASSET_ID_DEV', DEPLOY_ENV_HINT),
      remoteBasePath: isWhitelist ? '/var/www/roxybrowser/dist-whitelist' : '/var/www/roxybrowser/dist',
    },
  ]
}

export async function deployWeb(isProd: boolean, isWhitelist = true) {
  console.log('exec deployWeb isProd', isProd)

  const jmsConfig = loadJumpServerConfigFromEnv({ envFileHint: DEPLOY_ENV_HINT })
  const targets = getDeployTargets(isProd, isWhitelist)

  console.log('正在打包 dist 资源…')
  const packages = createSplitZipPackages({
    sourceDir: DIST_PATH,
    isDelayedFile: relativePath =>
      relativePath.endsWith('.html') || DELAYED_DEPLOY_FILE_NAMES.has(relativePath),
  })

  const deployer = new JumpServerDeployer({
    client: JumpServerClient.fromConfig(jmsConfig),
    jumpServerHost: jmsConfig.host,
    jumpServerPort: jmsConfig.port,
  })

  await deployer.deploy({
    targets,
    packages,
    systemUsername: jmsConfig.systemUsername,
  })
}

async function execRemoteCommand(
  jmsConfig: JumpServerConfig,
  target: DeployTarget,
  command: string,
): Promise<void> {
  const client = JumpServerClient.fromConfig(jmsConfig)

  console.log(`正在创建 JumpServer Connection Token：${target.label}`)
  const token = await client.createConnectionToken(target.assetId, jmsConfig.systemUsername)

  try {
    await new Promise<void>((resolve, reject) => {
      const conn = new Client()
      let settled = false
      let timeout: ReturnType<typeof setTimeout>

      const finish = (error?: Error) => {
        if (settled)
          return
        settled = true
        clearTimeout(timeout)
        conn.end()
        if (error)
          reject(error)
        else
          resolve()
      }

      timeout = setTimeout(() => {
        finish(new Error(`SSH 连接超时（${SSH_READY_TIMEOUT_MS / 1000}s），请检查 JumpServer 或网络`))
      }, SSH_READY_TIMEOUT_MS)

      conn.on('error', (error: Error) => finish(error))
      conn.on('ready', () => {
        clearTimeout(timeout)
        console.log(`SSH 已连接：${target.label}，正在执行远程命令…`)

        timeout = setTimeout(() => {
          finish(new Error(`远程命令执行超时（${REMOTE_COMMAND_TIMEOUT_MS / 1000}s）：${command}`))
        }, REMOTE_COMMAND_TIMEOUT_MS)

        conn.exec(command, (error: Error | undefined, stream) => {
          if (error) {
            finish(error)
            return
          }

          let stderr = ''
          // 必须消费 stdout，否则远程命令输出过多时会阻塞
          stream.on('data', () => {})
          stream.stderr.on('data', (chunk) => {
            const text = chunk.toString()
            stderr += text
            process.stdout.write(`\x1B[34m${text}\x1B[0m`)
          })
          stream.on('close', (code: number | null) => {
            if (code !== 0) {
              finish(new Error(`远程命令执行失败 (exit ${code})：${stderr || command}`))
              return
            }
            finish()
          })
        })
      })

      console.log(`正在建立 SSH 连接：${target.label}（经 JumpServer ${jmsConfig.host}）…`)
      conn.connect({
        host: jmsConfig.host,
        port: jmsConfig.port,
        username: `JMS-${token.id}`,
        password: token.value,
        readyTimeout: SSH_READY_TIMEOUT_MS,
        keepaliveInterval: SSH_KEEPALIVE_INTERVAL_MS,
      })
    })
  }
  finally {
    await client.expireConnectionToken(token.id).catch((error) => {
      console.warn(`销毁 Connection Token 失败（${token.id}）：`, error)
    })
  }
}

export async function releaseWebFromWhitelist(isProd: boolean) {
  console.log('exec releaseWebFromWhitelist isProd', isProd)

  const jmsConfig = loadJumpServerConfigFromEnv({ envFileHint: DEPLOY_ENV_HINT })
  const whitelistTargets = getDeployTargets(isProd, true)
  const mainTargets = getDeployTargets(isProd, false)

  for (let i = 0; i < whitelistTargets.length; i++) {
    const whitelistTarget = whitelistTargets[i]
    const mainTarget = mainTargets[i]
    const command = [
      `mkdir -p ${mainTarget.remoteBasePath}`,
      `rsync -a --info=progress2 ${whitelistTarget.remoteBasePath}/ ${mainTarget.remoteBasePath}/`,
    ].join(' && ')

    console.log(`[${whitelistTarget.label}] 同步白名单资源到正式路径…`)
    console.log(`  ${whitelistTarget.remoteBasePath} → ${mainTarget.remoteBasePath}`)
    await execRemoteCommand(jmsConfig, whitelistTarget, command)
    console.log('\x1B[34m%s\x1B[0m', `[${whitelistTarget.label}] 放开白名单完成`)
  }

  console.log('\x1B[32m%s\x1B[0m', '全部服务器放开白名单完成！')
}
