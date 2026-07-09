import readline from 'node:readline'

// 忽略 SSL/TLS 证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const isProd = process.env.NODE_ENV === 'production'

console.log('当前环境：', isProd ? '生产环境' : '开发环境')
console.log('操作：将远程 dist-whitelist 同步到正式 dist 路径')

async function startRelease() {
  const { releaseWebFromWhitelist } = await import('../apps/web/scripts/deploy')
  await releaseWebFromWhitelist(isProd)
}

function confirmRelease() {
  return new Promise<void>((resolve, reject) => {
    rl.question('您正准备将白名单环境（dist-whitelist）同步到正式环境（dist），全量用户将生效，请输入 1234 确认（这只是简单的验证，防止不小心执行错命令）：', (answer) => {
      if (answer === '1234')
        resolve()
      else
        reject(new Error('输入错误，请重新输入'))
    })
  })
}

async function main() {
  if (isProd)
    await confirmRelease()

  await startRelease()
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => {
    rl.close()
    process.exit(0)
  })
