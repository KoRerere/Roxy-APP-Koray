import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
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

const isMacOS = process.platform === 'darwin'

const basePath = path.join(import.meta.dirname, '../src-tauri/target/release')
const exePath = path.join(basePath, isMacOS ? 'bundle/macos/roxybrowser.app' : 'roxybrowser.exe')

const platform = isMacOS ? 'macOS' : 'Windows'
console.log('平台：', process.platform, platform)
const version = process.env.VITE_VERSION
console.log('APP 版本号：', version)
if (version === undefined) {
  throw new Error('请在 env 环境变量中配置版本号')
}

const baseUrl = isProd
  ? 'https://admin.lumibrowser.com'
  : 'https://admintest.roxybrowser.co'

const baseOssConfig = {
  region: 'oss-cn-shenzhen',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: isProd ? 'lumibrowser' : 'lumibrowser-test',
}

// 将 web 资源包添加到 zip 中, 排除 .map 文件
// zip.addLocalFolder(webPath, '', (filename) => {
//   return !filename.endsWith('.map')
// })

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
  console.log('上传 APP 资源包中...')

  const fileName = isMacOS ? 'roxybrowser.app.zip' : 'roxybrowser.exe'
  const uploadFilePath = isMacOS ? path.join(basePath, fileName) : exePath

  if (isMacOS) {
    // macOS：必须用 ditto 打包 .app，才能最大概率保留 bundle 内的可执行位/资源 fork
    // 否则解压后经常出现 .app “不被识别/无法执行”
    try {
      fs.rmSync(uploadFilePath, { force: true })
    }
    catch {}

    const r = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', exePath, uploadFilePath], {
      stdio: 'inherit',
    })
    if (r.status !== 0) {
      throw new Error('ditto 打包 roxybrowser.app.zip 失败')
    }
  }

  const uploadZip = await ossClient.put(
    `/public/static/browser-launcher/${platform}/${fileName}`,
    uploadFilePath,
  )
  console.log('上传 APP 资源包成功：', uploadZip.url)
  const data = Buffer.from(
    JSON.stringify({
      version,
      releaseTime: getCurrentFormattedTime(),
    }),
  )
  const uploadVersionRes = await ossClient.put(
    `/public/static/browser-launcher/${platform}/version.json`,
    data,
  )
  console.log('上传版本号成功：', uploadVersionRes.url)
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
