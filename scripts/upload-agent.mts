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

// 正式环境 agent 版本
const prodVersion = '1.0.9'
// 开发环境 agent 版本
const devVersion = '2.2.39'

// 当前 agent 的版本
const version = isProd ? prodVersion : devVersion
// 此 agent 兼容的最低 app 版本
const minAppVersion = isProd ? '3.8.1' : '7.6.6'

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
        `/public/package/agent/scripts/${version}/skills/${filename}`,
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
    const scripts = [
      { key: 'roxy-agent', localPath: 'packages/roxy-agent/dist/roxy-agent.mjs' },
      { key: 'roxy-playwright', localPath: 'packages/roxy-playwright/dist/roxy-playwright.mjs' },
      { key: 'roxy-openapi', localPath: 'packages/roxy-openapi/dist/roxy-openapi.mjs' },
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
    skills: skillNames,
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
