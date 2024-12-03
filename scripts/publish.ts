import OSS from 'ali-oss'
import yaml from 'js-yaml'
import { Buffer } from 'node:buffer'
import fs, { renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const isProd = process.env.NODE_ENV === 'production'
const isMac = process.platform === 'darwin'
console.log('isMac:', isMac)
console.log('isProd:', isProd)
const ossConfig = {
  region: 'oss-cn-shenzhen',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: isProd ? 'lumibrowser' : 'lumibrowser-test',
}

const apiBaseUrl = `${isProd ? 'https://admin.lumibrowser.com' : 'https://admintest.lumibrowser.com'}/fb-admin-api`
// 懒得模拟登录获取 token 了，反正 token 是永久的
const token = 'nfnlQ4tl2UVcKKUh1710868857530'
/** 安装包输出路径 */
const outDir = join(__dirname, '../out')
/** YAML 文件路径 */
const ymlFilePath = join(outDir, `latest${isMac ? '-mac' : ''}.yml`)
// 读取 YAML 文件
const fileContents = fs.readFileSync(ymlFilePath, 'utf8')
// 解析 YAML 文件
const fileContentObj = yaml.load(fileContents)
/** 获取版本号 */
const appVersion = fileContentObj.version
/** APP 名称 */
const appName = fileContentObj.path.split('_').at(0)
const osBitMap = {
  x64: 'intel',
  ia32: 'x86',
  arm64: 'apple',
} as const
// console.log(fileContentObj)

/** 获取上传的路径 */
function genUploadPath(osBit: string, fileName: string) {
  if (process.platform === 'win32') {
    osBit = osBit.replaceAll('x64', '64').replaceAll('ia32', '32')
    return `/public/package/app/Windows/${osBit}/${appVersion}/${fileName}`
  }
  else if (isMac) {
    return `/public/package/app/macOS/${osBitMap[osBit]}/${appVersion}/${fileName}`
  }
}

/** 生成 YAML 文件内容 */
function genYamlContent(osBit: string, extName: string) {
  const targetFile = { ...fileContentObj.files.find(file => file.url === `${appName}_${osBit}_${appVersion}.${extName}`) }

  if (osBit === 'ia32' || isMac) {
    const newFileName = targetFile.url.replace(osBit, osBitMap[osBit])
    try {
      renameSync(join(outDir, targetFile.url), join(outDir, newFileName))
    }
    catch (error) {

    }
    targetFile.url = newFileName
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
  const data = await fetch(`${apiBaseUrl}/admin_get_oss_credential`, {
    headers: {
      token,
    },
  }).then(res => res.json()).then(res => res.data)

  // console.log(data)

  return data
}

/** 获取后台目标版本，有则为更新，无则为新增 */
async function getTargetVersion(params: { osBit: string, cpu: string }) {
  const { osBit, cpu } = params
  const os = isMac ? 'macOS' : 'Windows'
  return fetch(`${apiBaseUrl}/admin_version_list?page_index=1&page_size=15&versionType=app&os=${os}&dataType=new`, {
    headers: {
      token,
    },
  }).then(res => res.json()).then(res => res.data.rows.find((row) => {
    return row.version === appVersion && row.osBit === osBit && row.cpu === cpu
  }))
}

/** 发布版本 */
async function publishVersion({ osBit, cpu, downloadUrl }) {
  const defaultParams = {
    os: isMac ? 'macOS' : 'Windows',
    osVersion: '',
    osBit: isMac ? '64' : osBit,
    cpu: isMac ? cpu : '',
    versionType: 'app',
    coreVersion: '',
    coreRealVersion: '',
    version: appVersion,
    upgradeTitle: '',
    upgradeDesc: '',
    upgradeContent: `
<p style="line-height: 2;"><strong>1. 修复了一些已知问题</strong></p>
<p style="line-height: 2;"><strong>2. 优化了部分功能</strong></p>
    `,
    upgradeContentEn: `
<p style="line-height: 2;"><strong>1. Fixed some known issues</strong></p>
<p style="line-height: 2;"><strong>2. Optimized some functions</strong></p>
    `,
    downloadUrl,
    forceUpgrade: true,
    ipLimit: isProd,
    dataType: 'new',
    status: true,
  }
  const targetVersion = await getTargetVersion({
    osBit: defaultParams.osBit,
    cpu: defaultParams.cpu,
  })
  Object.assign(defaultParams, { ...targetVersion })

  fetch(`${apiBaseUrl}/${defaultParams.id ? `/admin_mdf_version` : `/admin_add_version`}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token,
    },
    body: JSON.stringify(defaultParams),
  }).then(res => res.json()).then((res) => {
    console.log(res)
  })
}

/** 上传文件 */
async function uploadFile() {
  const ossCredential = await getOssCredentials()

  const client = new OSS({
    ...ossConfig,
    ...ossCredential,
    stsToken: ossCredential.securityToken,
    timeout: '120s',
  })

  const extNames = isMac ? ['dmg', 'zip'] : ['exe']
  const osBits = isMac ? ['arm64', 'x64'] : ['ia32', 'x64']

  for (const osBit of osBits) {
    for (const extName of extNames) {
      const yamlContent = genYamlContent(osBit, extName)
      const fileName = yamlContent.path
      const filePath = join(outDir, fileName)
      const uploadPath = genUploadPath(osBit, fileName)
      console.log('上传路径：', uploadPath)
      if (fileName.endsWith('.exe') || fileName.endsWith('.zip')) {
        const { url: ymlUrl } = await client.put(`${dirname(uploadPath)}/${basename(ymlFilePath)}`, Buffer.from(yaml.dump(yamlContent, { lineWidth: 1000 })))
        console.log(`${basename(ymlFilePath)} 上传成功：`, ymlUrl)
      }
      await client.multipartUpload(uploadPath, filePath, {
        progress: (p) => {
          const progress = `${fileName} 上传中：${((p) * 100).toFixed(2)}%`
          process.stdout.write(`\x1B[34m${progress}\x1B[0m \r`)

          if (p === 1) {
            process.stdout.write('\n')
          }
        },
      }).then(({ res }) => {
        const url = res.requestUrls[0]?.split('?')[0].replace('http://', 'https://')
        console.log(`${fileName} 上传成功: `, url)
        if (url.endsWith('.exe') || url.endsWith('.dmg')) {
          publishVersion({
            osBit: osBit === 'ia32' ? '32' : '64',
            cpu: osBit === 'arm64' ? 'apple' : 'intel',
            downloadUrl: url,
          })
        }
      })
    }
  }
}

uploadFile()
