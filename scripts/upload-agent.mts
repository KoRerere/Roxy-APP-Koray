import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvFile } from 'node:process'
import readline from 'node:readline'

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const isProd = process.env.NODE_ENV === 'production'

try {
  loadEnvFile(path.join(import.meta.dirname, '../packages/roxy-agent/.env.local'))
  loadEnvFile(path.join(import.meta.dirname, '../.env.local'))
}
catch {
  // .env.local 不存在时忽略
}

const token = isProd ? process.env.PUBLISH_ADMIN_TOKEN : 'WUYtoKyw5TvUT8iW1780026837812'
if (isProd && !token) {
  throw new Error('缺少 PUBLISH_ADMIN_TOKEN，请在 .env.local 中配置')
}

const platformList = process.env.PLATFORM
  ? [process.env.PLATFORM === 'mac' ? 'macOS' : 'Windows']
  : ['Windows', 'macOS']
console.log('平台：', process.env.PLATFORM, platformList)

const baseUrl = isProd
  ? 'https://admin.lumibrowser.com'
  : 'https://admintest.roxybrowser.co'

const baseOssConfig = {
  region: 'oss-cn-shenzhen',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: isProd ? 'lumibrowser' : 'lumibrowser-test',
}

// 正式环境 agent 版本
const prodVersion = process.env.AI_AGENT_VERSION_PROD
// 开发环境 agent 版本
const devVersion = process.env.AI_AGENT_VERSION_DEV

/**
 * 读取必填的 .env.local 配置项；为空时直接报错，避免把 undefined 写进 OSS 路径与 compat-index 记录
 */
function requireEnvValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`缺少 ${name}，请在 .env.local 配置`)
  }
  return value
}

// 当前 agent 的版本
const version = requireEnvValue(
  isProd ? prodVersion : devVersion,
  isProd ? 'AI_AGENT_VERSION_PROD' : 'AI_AGENT_VERSION_DEV',
)
// 此 agent 兼容的最低 app 版本
const minAppVersion = requireEnvValue(
  isProd ? process.env.MIN_APP_VERSION_PROD : process.env.MIN_APP_VERSION_DEV,
  isProd ? 'MIN_APP_VERSION_PROD' : 'MIN_APP_VERSION_DEV',
)

/** compat-index.json 在 OSS 上的路径（不区分平台，由 app 侧根据 os 自行拼接脚本地址） */
const compatIndexOssPath = '/public/package/agent/compat-index.json'

console.log('app 最低支持版本：', minAppVersion)
console.log('agent 版本：', version)

async function getOssToken() {
  const response = await fetch(
    `${baseUrl}/fb-admin-api/admin_get_oss_credential`,
    {
      headers: {
        token,
      },
    },
  )
  if (!response.ok) {
    throw new Error(`请求 oss token 失败: ${response.statusText}`)
  }
  const result = await response.json()
  const { code, data, msg } = result
  if (code !== 0) {
    throw new Error(`获取 oss token 失败: ${msg}`)
  }
  return data
}

async function startUpload() {
  const ossConfig = await getOssToken()
  // console.log('ossConfig',ossConfig)
  const ossClient = new AliOss({
    ...baseOssConfig,
    ...ossConfig,
    stsToken: ossConfig.securityToken,
  })
  console.log('上传 agent worker 脚本中...')

  function calculateFileSha512Hex(filePath: string) {
    const hashSum = createHash('sha512')
    hashSum.update(fs.readFileSync(filePath))
    return hashSum.digest('hex')
  }

  for (const platform of platformList) {
    const scripts = [
      { key: 'roxy-agent', localPath: 'packages/roxy-agent/dist/roxy-agent.mjs' },
    ]

    const checksums: Record<string, string> = {}
    for (const { key, localPath } of scripts) {
      const ossName = path.basename(localPath)
      checksums[key] = calculateFileSha512Hex(localPath)
      await ossClient.put(
        `/public/package/agent/scripts/${version}/${platform}/${ossName}`,
        localPath,
      )
      console.log(`上传 ${key} 脚本成功：`, `/public/package/agent/scripts/${version}/${platform}/${ossName}`)
    }

    const checksumsOssPath = `/public/package/agent/scripts/${version}/${platform}/checksums.json`
    await ossClient.put(checksumsOssPath, Buffer.from(JSON.stringify(checksums)))
    console.log('上传 checksums.json 成功：', checksumsOssPath)
  }

  // 更新兼容性索引：读取现有 compat-index.json，按 minimum_app_version 去重更新，回传
  interface CompatEntry {
    version: string
    minimum_app_version: string
    releaseTime: string
    skills: string[]
  }
  let compatIndex: CompatEntry[] = []
  try {
    const res = await ossClient.get(compatIndexOssPath)
    compatIndex = JSON.parse(res.content.toString())
    console.log('读取现有 compat-index.json 成功，共', compatIndex.length, '条记录')
  }
  catch {
    console.log('compat-index.json 不存在，将新建')
  }

  const newEntry: CompatEntry = {
    version,
    minimum_app_version: minAppVersion,
    releaseTime: getCurrentFormattedTime(),
    // 系统 Skills 已内嵌到 roxy-agent.mjs，Electron 更新器无需再下载额外 zip。
    skills: [],
  }

  const existingIndex = compatIndex.findIndex(e => e.minimum_app_version === minAppVersion)
  if (existingIndex !== -1) {
    // 已有相同 minimum_app_version 的记录，直接更新
    compatIndex[existingIndex] = newEntry
    console.log(`更新已有记录 [minimum_app_version: ${minAppVersion}] → agent ${version}`)
  }
  else {
    // 新的 minimum_app_version，头部插入
    compatIndex.unshift(newEntry)
    console.log(`新增记录 [minimum_app_version: ${minAppVersion}] → agent ${version}`)
  }

  await ossClient.put(compatIndexOssPath, Buffer.from(JSON.stringify(compatIndex, null, 2)))
  console.log('更新 compat-index.json 成功，当前记录：')
  compatIndex.forEach(e => console.log(`  agent ${e.version}  ← app >= ${e.minimum_app_version}`))
}

function getCurrentFormattedTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

if (isProd) {
  if (process.env.SKIP_CONFIRM === '1') {
    startUpload()
      .catch((err) => {
        console.error(err)
        process.exit(1)
      })
      .finally(() => {
        rl.close()
        process.exit(0)
      })
  }
  else {
    rl.question('您正准备发正式环境，请输入 1234 确认（这只是简单的验证，防止不小心执行错命令）：', (answer) => {
      if (answer === '1234') {
        startUpload()
          .catch((err) => {
            console.error(err)
            process.exit(1)
          })
          .finally(() => {
            rl.close()
            process.exit(0)
          })
      }
      else {
        console.log('输入错误，请重新输入')
        rl.close()
      }
    })
  }
}
else {
  startUpload()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(() => {
      process.exit(0)
    })
}
