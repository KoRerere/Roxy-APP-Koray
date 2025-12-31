import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { getDefaultTargetsForHost } from './utils.ts'

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function getArchDirFromTarget(target: string): string {
  if (target === 'aarch64-apple-darwin')
    return 'apple'
  if (target === 'x86_64-apple-darwin')
    return 'intel'
  if (target === 'x86_64-pc-windows-msvc')
    return 'x64'
  if (target === 'i686-pc-windows-msvc')
    return 'x86'
  if (target === 'x86_64-unknown-linux-gnu')
    return 'x64'
  return target
}

const isProd = process.env.NODE_ENV === 'production'
const token = isProd ? 'mjloBiRGORuGJikc1744800946396' : 'UJ4UKYUU3UKGfAmo1743595549211'

const isMacOS = process.platform === 'darwin'
const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'

const platform = isMacOS ? 'macos' : (isWindows ? 'windows' : (isLinux ? 'linux' : process.platform))
console.log('平台：', process.platform, platform)
const version = process.env.VITE_VERSION
console.log('APP 版本号：', version)
if (version === undefined) {
  throw new Error('请在 env 环境变量中配置版本号')
}

const appName = process.env.ROXY_DEFAULT_BROWSER_APP_NAME?.trim()
console.log('APP 名称（上传文件名）：', appName)
if (!appName) {
  throw new Error('请在 env 环境变量中配置 ROXY_DEFAULT_BROWSER_APP_NAME（用于上传到 OSS 的文件名）')
}

const defaultTargets = getDefaultTargetsForHost()
// 默认就是 all-targets：按当前平台上传所有默认 targets
const targetsToUpload = defaultTargets

if (targetsToUpload.length === 0) {
  throw new Error(`无法根据当前平台推断默认 targets：${process.platform}`)
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
  console.log('上传 APP 资源包中...', 'targets:', targetsToUpload.join(', '))

  const versionPayload = Buffer.from(JSON.stringify({
    version,
    releaseTime: getCurrentFormattedTime(),
  }))

  for (const target of targetsToUpload) {
    const archDir = getArchDirFromTarget(target)
    const releaseDir = path.join(import.meta.dirname, '../src-tauri/target', target, 'release')

    let fileName: string
    let uploadFilePath: string

    if (isMacOS) {
      const macosBundleDir = path.join(releaseDir, 'bundle/macos')
      const appPath = path.join(macosBundleDir, `${appName}.app`)

      if (!fs.existsSync(appPath))
        throw new Error(`未找到 macOS .app：${appPath}（target=${target}）`)

      // macOS：必须用 ditto 打包 .app，才能最大概率保留 bundle 内的可执行位/资源 fork
      fileName = `${appName}.app.zip`
      uploadFilePath = path.join(releaseDir, fileName)

      try {
        fs.rmSync(uploadFilePath, { force: true })
      }
      catch {}

      const r = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, uploadFilePath], {
        stdio: 'inherit',
      })
      if (r.status !== 0) {
        throw new Error(`ditto 打包失败：${uploadFilePath}（target=${target}）`)
      }
    }
    else if (isWindows) {
      fileName = `${appName}.exe`
      uploadFilePath = path.join(releaseDir, `${appName}.exe`)

      if (!fs.existsSync(uploadFilePath))
        throw new Error(`未找到 Windows .exe：${uploadFilePath}（target=${target}）`)
    }
    else if (isLinux) {
      const appimageDir = path.join(releaseDir, 'bundle/appimage')
      uploadFilePath = path.join(appimageDir, `${appName}.AppImage`)

      if (!fs.existsSync(uploadFilePath)) {
        // 兼容 Tauri 默认命名：<productName>_<version>_<arch>.AppImage
        const candidates = fs.readdirSync(appimageDir)
          .filter(f => /\.appimage$/i.test(f))
          .filter(f => !/\.(zsync|sig)$/i.test(f))
          .sort((a, b) => a.localeCompare(b))

        const found = candidates[0]
        if (!found) {
          throw new Error(`未找到 Linux AppImage：${appimageDir}（target=${target}）`)
        }

        const fromPath = path.join(appimageDir, found)
        try {
          fs.rmSync(uploadFilePath, { force: true })
        }
        catch {}
        fs.renameSync(fromPath, uploadFilePath)
        console.log('已重命名 AppImage：', found, '->', `${appName}.AppImage`)
      }

      // 远程统一用 appName 命名；扩展名沿用真实产物（.AppImage/.appimage）
      fileName = `${appName}${path.extname(uploadFilePath)}`
    }
    else {
      throw new Error(`不支持的平台：${process.platform}`)
    }

    const remoteBase = `/public/static/browser-launcher/${platform}/${archDir}`

    const uploadZip = await ossClient.put(
      `${remoteBase}/${fileName}`,
      uploadFilePath,
    )
    console.log(`上传 APP 资源包成功（${platform}/${archDir}）：`, uploadZip.url)

    const uploadVersionResByArch = await ossClient.put(
      `${remoteBase}/version.json`,
      versionPayload,
    )
    console.log(`上传版本号成功（${platform}/${archDir}）：`, uploadVersionResByArch.url)
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
