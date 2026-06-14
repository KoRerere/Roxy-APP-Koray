import path from 'node:path'
import {
  createSplitZipPackages,
  JumpServerClient,
  JumpServerDeployer,
  loadDeployEnvFile,
  loadJumpServerConfigFromEnv,
  requireDeployEnv,
} from '@roxybrowser/jumpserver-deploy'
import type { DeployTarget } from '@roxybrowser/jumpserver-deploy'

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
