import Zip from 'adm-zip'
import memfs from 'memfs'
import path from 'node:path'
import { Client } from 'ssh2'

// 创建虚拟文件系统
const vfs = new memfs.Volume()
const zip = new Zip()

// dist 在 apps/web/dist，与当前脚本 apps/web/scripts 同级的上一级
const distPath = path.join(import.meta.dirname, '../dist')
zip.addLocalFolder(distPath, '')

const conn = new Client()

export async function deployWeb(isProd: boolean) {
  const { promise, resolve } = Promise.withResolvers()
  console.log('exec deployWeb isProd', isProd)

  const connectOptions = isProd
    ? {
        host: '8.217.98.238',
        port: 2211,
        username: 'root',
        password: '+Jb5M~XLbbmqj2uLTZcDx=r6XuC6ZDU5',
      }
    : {
        host: '113.10.160.72',
        username: 'root',
        password: '7PjbTOXM8HKRW9',
      }

  conn.on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.log(err)
        throw new Error(`error ${err}`)
      }
      let bytesWritten = 0
      const zipBuffer = zip.toBuffer()
      const totalSize = zipBuffer.length
      vfs.writeFileSync('/dist.zip', zipBuffer)
      const readStream = vfs.createReadStream('/dist.zip')

      const writeStream = sftp.createWriteStream('/root/roxybrowser/dist.zip')

      writeStream.on('close', () => {
        conn.exec(`cd /root/roxybrowser && unzip -o ./dist.zip`, (err, stream) => {
          if (err)
            throw err
          stream
            .on('close', (code, signal) => {
              process.stdout.write('\n')
              console.log('\x1B[34m%s\x1B[0m', '解压完毕！')
              console.log('\x1B[32m%s\x1B[0m', '部署完成！')
              conn.end()
              resolve()
            })
            .on('data', (data) => {
              const input = '文件上传完成，正在解压...'
              process.stdout.write(`\x1B[34m${input}\x1B[0m \r`)
            })
        })
      })

      readStream.on('data', (chunk) => {
        bytesWritten += chunk.length
        const progress = `文件上传中：${((bytesWritten / totalSize) * 100).toFixed(2)}%`
        process.stdout.write(`\x1B[34m${progress}\x1B[0m \r`)
        if (bytesWritten === totalSize) {
          process.stdout.write('\n')
        }
      })

      writeStream.on('end', () => {
        console.log('sftp connection closed')
        conn.end()
      })

      readStream.pipe(writeStream)
    })
  })
    .connect(connectOptions)

  await promise
}
