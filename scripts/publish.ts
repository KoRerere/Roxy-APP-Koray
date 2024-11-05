import OSS from 'ali-oss'
import yaml from 'js-yaml'
import Buffer from 'node:buffer'
import fs from 'node:fs'
import { join } from 'node:path'

const isProd = process.env.NODE_ENV === 'production'
const isMac = process.platform === 'darwin'

const ossConfig = {
  region: 'oss-cn-shenzhen',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: isProd ? 'lumibrowser' : 'lumibrowser-test',
}

const file = join(__dirname, `../apps/electron/out/latest${isMac ? '-mac' : ''}.yml`)
// 读取 YAML 文件
const fileContents = fs.readFileSync(file, 'utf8')

// 解析 YAML 文件
const fileContentObj = yaml.load(fileContents)
// 获取版本号
const appVersion = fileContentObj.version

console.log(fileContentObj)

/** 获取上传的路径 */
function genUploadPath(osBit: string, fileName: string) {
  if (process.platform === 'win32') {
    return `/public/package/app/Windows/${osBit}/${appVersion}/${fileName}`
  }
  else if (isMac) {
    return `/public/package/app/macOS/${osBit}/${appVersion}/${fileName}`
  }
}

/** 生成 YAML 文件内容 */
function genYamlContent(osBit: string, extName: string) {
  const targetFile = { ...fileContentObj.files.find(file => file.url === `RoxyBrowser_${osBit}_${appVersion}.${extName}`) }

  if (osBit === 'ia32') {
    targetFile.url = targetFile.url.replace('ia32', 'x86')
  }
  else if (isMac) {
    if (osBit === 'x64') {
      targetFile.url = targetFile.url.replace('x64', 'intel')
    }
    else if (osBit === 'arm64') {
      targetFile.url = targetFile.url.replace('arm64', 'apple')
    }
  }

  return {
    ...fileContentObj,
    files: [targetFile],
    path: targetFile.url,
    sha512: targetFile.sha512,
  }
}

/** 获取上传凭证 */
async function getOssCredentials() {
  const data = await fetch('http://47.239.9.178:8080/fb-admin-api/admin_get_oss_credential', {
    headers: {
      token: 'nfnlQ4tl2UVcKKUh1710868857530',
    },
  }).then(res => res.json()).then(res => res.data)

  console.log(data)

  return data
}

/** 上传文件 */
async function uploadFile() {
  const ossCredential = await getOssCredentials()

  const client = new OSS({
    ...ossConfig,
    ...ossCredential,
  })

  const extNames = isMac ? ['dmg', 'zip'] : ['exe']
  const osBits = isMac ? ['arm64', 'x64'] : ['ia32', 'x64']

  for (const osBit of osBits) {
    for (const extName of extNames) {
      const yamlContent = genYamlContent(osBit, extName)
      const fileName = yamlContent.path
      const filePath = join(__dirname, `../apps/electron/out/${fileName}`)
      const uploadPath = genUploadPath(osBit, fileName)

      await client.put(uploadPath, filePath)
      await client.put(uploadPath.replace(extName, 'yml'), new Buffer.from(JSON.stringify(yamlContent, null, 2)))
    }
  }
}
