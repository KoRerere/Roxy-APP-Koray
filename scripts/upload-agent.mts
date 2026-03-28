import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
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
const prodVersion = '1.0.4'

// 开发环境版本
const devVersion = '2.0.8'

// 当前agent的版本
const version = isProd ? prodVersion : devVersion
// app 最低支持版本
const minAppVersion = isProd ? '3.7.7' : '7.6.6'

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

  function calculateFileSha512Hex(filePath: string) {
    const hashSum = createHash('sha512')
    hashSum.update(fs.readFileSync(filePath))
    return hashSum.digest('hex')
  }

  // 读取 roxy-skills/dist 下所有压缩包并上传（不写死名称）
  const skillsDistDir = path.join(process.cwd(), 'packages/roxy-skills/dist')
  const skillNames: string[] = []
  if (fs.existsSync(skillsDistDir)) {
    const distFiles = fs.readdirSync(skillsDistDir)
    const zipFiles = distFiles.filter(f => path.extname(f).toLowerCase() === '.zip')
    for (const filename of zipFiles) {
      const localPath = path.join(skillsDistDir, filename)
      if (!fs.statSync(localPath).isFile())
        continue
      await ossClient.put(
        `/public/package/agent/${version}/skills/${filename}`,
        localPath,
      )

      skillNames.push(filename)
      console.log('上传 skill 压缩包成功：', filename)
    }
  }
  if (skillNames.length === 0) {
    console.log('未发现 packages/roxy-skills/dist 下的压缩包，跳过 skills 上传')
  }

  for (const platform of platformList) {
    const agentLocalPath = 'packages/roxy-agent/dist/index.mjs'
    const agentSha512 = calculateFileSha512Hex(agentLocalPath)
    await ossClient.put(
      `/public/package/agent/${version}/${platform}/roxy-agent.mjs`,
      agentLocalPath,
    )
    console.log('上传 agent worker 脚本成功：', `/public/package/agent/${version}/${platform}/roxy-agent.mjs`)

    const playwrightLocalPath = 'packages/roxy-playwright/dist/index.mjs'
    const playwrightSha512 = calculateFileSha512Hex(playwrightLocalPath)
    await ossClient.put(
      `/public/package/agent/${version}/${platform}/roxy-playwright.mjs`,
      playwrightLocalPath,
    )
    console.log('上传 playwright mcp 脚本成功：', `/public/package/agent/${version}/${platform}/roxy-playwright.mjs`)

    const openapiLocalPath = 'packages/roxy-openapi/dist/index.mjs'
    const openapiSha512 = calculateFileSha512Hex(openapiLocalPath)
    await ossClient.put(
      `/public/package/agent/${version}/${platform}/roxy-openapi.mjs`,
      openapiLocalPath,
    )
    console.log('上传 openapi mcp 脚本成功：', `/public/package/agent/${version}/${platform}/roxy-openapi.mjs`)

    const versionPayload = {
      version,
      minimum_app_version: minAppVersion,
      releaseTime: getCurrentFormattedTime(),
      skills: skillNames,
      agent_sha512: agentSha512,
      openapi_sha512: openapiSha512,
      playwright_sha512: playwrightSha512,
    }
    const data = Buffer.from(JSON.stringify(versionPayload))
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
