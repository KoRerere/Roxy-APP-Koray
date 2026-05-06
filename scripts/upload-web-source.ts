import Zip from 'adm-zip'
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
const isWhitelist = process.argv.includes('--whitelist')

const webPath = path.join(import.meta.dirname, '../apps/web/dist')

console.log('当前环境：', isProd ? '生产环境' : '开发环境')
console.log('是否部署到白名单环境：', isWhitelist)
console.log('平台：', process.env.PLATFORM)
const version = fs.readFileSync(path.join(webPath, 'version'), 'utf-8')
const minimumAppVersion = fs.readFileSync(
  path.join(webPath, 'minimum_app_version'),
  'utf-8',
)
const currentAppVersion = fs.readFileSync(
  path.join(webPath, 'current_app_version'),
  'utf-8',
)
console.log('web 版本号：', version)
console.log('最低支持 APP 版本：', minimumAppVersion)
console.log('当前 APP 版本：', currentAppVersion)
if (version === undefined) {
  throw new Error('请在package.json中配置版本号')
}

// 将 web 资源包添加到 zip 中, 排除 .map 和 .gz 文件
zip.addLocalFolder(webPath, '', (filename) => {
  return !filename.endsWith('.map') && !filename.endsWith('.gz')
})

async function startUpload() {
  const { deployWeb } = await import('../apps/web/scripts/deploy')
  await deployWeb(isProd, isWhitelist)
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
