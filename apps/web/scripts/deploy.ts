import Zip from 'adm-zip'
import memfs from 'memfs'
import type { Buffer } from 'node:buffer'
import path from 'node:path'
import { Client } from 'ssh2'

// 创建虚拟文件系统
const vfs = new memfs.Volume()
const zip = new Zip()

// dist 在 apps/web/dist，与当前脚本 apps/web/scripts 同级的上一级
const distPath = path.join(import.meta.dirname, '../dist')
zip.addLocalFolder(distPath, '')

interface DeployServer {
  host: string
  port?: number
  username: string
  password: string
  remoteBasePath: string
}

function deployToServer(server: DeployServer, zipBuffer: Buffer, totalSize: number, index: number, total: number): Promise<void> {
  const { host, port = 22, username, password, remoteBasePath } = server
  console.log(`上传到 ${host} (${index + 1}/${total}) …`)

  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('error', reject)

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end()
          reject(err)
          return
        }

        let bytesWritten = 0
        vfs.writeFileSync('/dist.zip', zipBuffer)
        const readStream = vfs.createReadStream('/dist.zip')
        const writeStream = sftp.createWriteStream(`${remoteBasePath}/dist.zip`)

        writeStream.on('close', () => {
          conn.exec(`cd ${remoteBasePath} && unzip -o ./dist.zip`, (execErr, stream) => {
            if (execErr) {
              conn.end()
              reject(execErr)
              return
            }
            stream
              .on('close', () => {
                process.stdout.write('\n')
                console.log('\x1B[34m%s\x1B[0m', `解压完毕：${host}`)
                conn.end()
                resolve()
              })
              .on('data', () => {
                const input = '文件上传完成，正在解压...'
                process.stdout.write(`\x1B[34m${input}\x1B[0m \r`)
              })
          })
        })

        readStream.on('data', (chunk) => {
          bytesWritten += chunk.length
          const progress = `[${host}] 上传：${((bytesWritten / totalSize) * 100).toFixed(2)}%`
          process.stdout.write(`\x1B[34m${progress}\x1B[0m \r`)
          if (bytesWritten === totalSize) {
            process.stdout.write('\n')
          }
        })

        writeStream.on('error', (writeErr) => {
          conn.end()
          reject(writeErr)
        })

        readStream.pipe(writeStream)
      })
    })

    conn.connect({ host, port, username, password })
  })
}

export async function deployWeb(isProd: boolean, isWhitelist = true) {
  console.log('exec deployWeb isProd', isProd)

  const servers: DeployServer[] = isProd
    ? [
        {
          host: '8.217.98.238',
          port: 2211,
          username: 'root',
          password: '+Jb5M~XLbbmqj2uLTZcDx=r6XuC6ZDU5',
          remoteBasePath: isWhitelist ? '/root/roxybrowser/dist-whitelist' : '/root/roxybrowser/dist',
        },
        {
          host: '42.121.165.6',
          port: 2211,
          username: 'root',
          password: '-JiVcdYeEv?V3-kaydD6',
          remoteBasePath: isWhitelist ? '/var/www/roxybrowser/dist-whitelist' : '/var/www/roxybrowser/dist',
        },
      ]
    : [
        {
          host: '113.10.160.72',
          username: 'root',
          password: '7PjbTOXM8HKRW9',
          remoteBasePath: isWhitelist ? '/root/roxybrowser/dist-whitelist' : '/root/roxybrowser/dist',
        },
      ]

  const zipBuffer = zip.toBuffer()
  const totalSize = zipBuffer.length

  for (let i = 0; i < servers.length; i++) {
    await deployToServer(servers[i], zipBuffer, totalSize, i, servers.length)
  }

  console.log('\x1B[32m%s\x1B[0m', '全部服务器部署完成！')
}
