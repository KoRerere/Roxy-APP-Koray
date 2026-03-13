import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'
// import fs from 'node:fs'
// import path from 'node:path'
import readline from 'node:readline'

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const isProd = process.env.NODE_ENV === 'production'
const token = isProd ? 'mjloBiRGORuGJikc1744800946396' : 'UJ4UKYUU3UKGfAmo1743595549211'

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

// 正式环境版本
const prodVersion = '1.0.2'

// 开发环境版本
const devVersion = '1.2.4'

// 当前agent的版本
const version = isProd ? prodVersion : devVersion
// app 最低支持版本
const minAppVersion = isProd ? '3.7.4' : '7.0.0'

async function getOssToken() {
  const response = await fetch(
    `${baseUrl}/fb-admin-api/admin_get_oss_credential`,
    {
      headers: {
        token,
      },
    },
  )
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
  for (const platform of platformList) {
    const agentWorkerZip = await ossClient.put(
      `/public/package/agent/${version}/${platform}/agent-worker.jsc`,
      'packages/roxy-agent/dist/agent-worker.jsc',
    )
    console.log('上传 agent worker 脚本成功：', agentWorkerZip.url)

    const playwrightMcpZip = await ossClient.put(
      `/public/package/agent/${version}/${platform}/roxybrowser-playwright-mcp.cjs`,
      'packages/roxybrowser-playwright-mcp/dist/index.cjs',
    )
    console.log('上传 playwright mcp 脚本成功：', playwrightMcpZip.url)

    const openapiMcpZip = await ossClient.put(
      `/public/package/agent/${version}/${platform}/roxybrowser-openapi-mcp.jsc`,
      'packages/roxybrowser-mcp-server/dist/roxybrowser-openapi-mcp.jsc',
    )
    console.log('上传 openapi mcp 脚本成功：', openapiMcpZip.url)

    const data = Buffer.from(
      JSON.stringify({
        version,
        minimum_app_version: minAppVersion,
        releaseTime: getCurrentFormattedTime(),
      }),
    )
    const uploadVersionRes = await ossClient.put(
      `/public/package/agent/${platform}/version.json`,
      data,
    )
    console.log('上传版本号成功：', uploadVersionRes.url)
  }
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
