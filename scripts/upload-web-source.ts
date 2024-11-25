import Zip from 'adm-zip'
import AliOss from 'ali-oss'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const zip = new Zip()

const isProd = process.env.NODE_ENV === 'production'

const webPath = path.join(__dirname, '../apps/web/dist')

const platformList = process.env.PLATFORM ? [process.env.PLATFORM === 'mac' ? 'macOS' : 'Windows'] : ['Windows', 'macOS']
console.log('平台：', process.env.PLATFORM, platformList)
const version = fs.readFileSync(path.join(webPath, 'version'), 'utf-8')
console.log('版本号：', version)

if (version === undefined) {
  throw new Error('请在package.json中配置版本号')
}

const baseUrl = isProd
  ? `https://admin.lumibrowser.com`
  : `https://admintest.lumibrowser.com`

const baseOssConfig = {
  region: 'oss-cn-shenzhen',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: isProd ? 'lumibrowser' : 'lumibrowser-test',
}

zip.addLocalFolder(webPath, '')

async function getOssToken(token = 'nfnlQ4tl2UVcKKUh1710868857530') {
  const response = await fetch(`${baseUrl}/fb-admin-api/admin_get_oss_credential`, {
    headers: {
      token,
    },
  })
  const { code, data } = await response.json()
  return data
}

async function startUpload(minimum_app_version = '0.0.0') {
  const ossConfig = await getOssToken()
  // console.log('ossConfig',ossConfig)
  const ossClient = new AliOss({
    ...baseOssConfig,
    ...ossConfig,
    stsToken: ossConfig.securityToken,
  })
  console.log('上传 web 资源包中...')
  for (const platform of platformList) {
    const uploadZip = await ossClient.put(`/public/package/web/${platform}/dist.zip`, zip.toBuffer())
    console.log('上传 web 资源包成功：', uploadZip.url)
    const data = Buffer.from(JSON.stringify({
      version,
      minimum_app_version,
      releaseTime: getCurrentFormattedTime(),
    }))
    const uploadVersionRes = await ossClient.put(`/public/package/web/${platform}/version.json`, data)
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

rl.question('最低支持的 APP 版本： ', (version) => {
  if (version) {
    console.log(`最低支持的 APP 版本：${version}`)
  }
  else {
    console.log('未输入最低支持的 APP 版本，将默认为 0.0.0')
  }
  startUpload(version || '0.0.0')
  rl.close()
})
