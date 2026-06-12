import Zip from 'adm-zip'
import memfs from 'memfs'
import type { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'ssh2'

// 创建虚拟文件系统
const vfs = new memfs.Volume()

// dist 在 apps/web/dist，与当前脚本 apps/web/scripts 同级的上一级
const distPath = path.join(import.meta.dirname, '../dist')
const delayedDeployFileNames = new Set(['version'])

interface DeployServer {
  host: string
  port?: number
  username: string
  password: string
  remoteBasePath: string
}

interface DeployPackage {
  label: string
  remoteZipName: string
  zipBuffer: Buffer
}

function getDistRelativePath(filePath: string): string {
  return path.relative(distPath, filePath).split(path.sep).join('/')
}

function collectDistFiles(currentPath: string): string[] {
  return fs.readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      return collectDistFiles(entryPath)
    }

    return entry.isFile() ? [entryPath] : []
  })
}

function getDelayedDeployFiles(): string[] {
  return collectDistFiles(distPath)
    .map(getDistRelativePath)
    .filter(relativePath => relativePath.endsWith('.html') || delayedDeployFileNames.has(relativePath))
}

function createDeployPackages(): DeployPackage[] {
  const delayedDeployFiles = getDelayedDeployFiles()
  const delayedDeployFileSet = new Set(delayedDeployFiles)
  const assetsZip = new Zip()
  assetsZip.addLocalFolder(distPath, '', filename => !delayedDeployFileSet.has(getDistRelativePath(filename)))

  const delayedZip = new Zip()
  for (const relativeFilePath of delayedDeployFiles) {
    const localFilePath = path.join(distPath, relativeFilePath)
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`部署文件不存在：${localFilePath}`)
    }

    const zipDirectory = path.posix.dirname(relativeFilePath)
    delayedZip.addLocalFile(localFilePath, zipDirectory === '.' ? '' : zipDirectory)
  }

  return [
    {
      label: '资源文件',
      remoteZipName: 'dist-assets.zip',
      zipBuffer: assetsZip.toBuffer(),
    },
    {
      label: '延后文件',
      remoteZipName: 'dist-delayed.zip',
      zipBuffer: delayedZip.toBuffer(),
    },
  ]
}

function uploadPackage(
  conn: Client,
  remoteBasePath: string,
  deployPackage: DeployPackage,
): Promise<void> {
  const zipFilePath = `/${deployPackage.remoteZipName}`

  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err)
        return
      }

      let bytesWritten = 0
      const totalSize = deployPackage.zipBuffer.length
      vfs.writeFileSync(zipFilePath, deployPackage.zipBuffer)

      const readStream = vfs.createReadStream(zipFilePath)
      const remoteZipPath = `${remoteBasePath}/${deployPackage.remoteZipName}`
      const writeStream = sftp.createWriteStream(remoteZipPath)

      writeStream.on('close', () => {
        conn.exec(`cd ${remoteBasePath} && unzip -o ./${deployPackage.remoteZipName}`, (execErr, stream) => {
          if (execErr) {
            reject(execErr)
            return
          }

          stream
            .on('close', () => {
              process.stdout.write('\n')
              console.log('\x1B[34m%s\x1B[0m', `${deployPackage.label}解压完毕`)
              vfs.unlinkSync(zipFilePath)
              resolve()
            })
            .on('data', () => {
              process.stdout.write(`\x1B[34m正在解压${deployPackage.label}...\x1B[0m \r`)
            })

          stream.stderr.on('data', (stderr) => {
            reject(new Error(stderr.toString()))
          })
        })
      })

      readStream.on('data', (chunk) => {
        bytesWritten += chunk.length
        const progress = `[${deployPackage.label}] 上传：${((bytesWritten / totalSize) * 100).toFixed(2)}%`
        process.stdout.write(`\x1B[34m${progress}\x1B[0m \r`)
        if (bytesWritten === totalSize) {
          process.stdout.write('\n')
        }
      })

      readStream.on('error', reject)

      writeStream.on('error', reject)

      readStream.pipe(writeStream)
    })
  })
}

function deployToServer(server: DeployServer, deployPackages: DeployPackage[], index: number, total: number): Promise<void> {
  const { host, port = 22, username, password, remoteBasePath } = server
  console.log(`上传到 ${host} (${index + 1}/${total}) …`)

  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('error', reject)

    conn.on('ready', () => {
      ;(async () => {
        try {
          for (const deployPackage of deployPackages) {
            console.log(`开始上传${deployPackage.label}：${host}`)
            await uploadPackage(conn, remoteBasePath, deployPackage)
          }

          console.log('\x1B[34m%s\x1B[0m', `部署完毕：${host}`)
          conn.end()
          resolve()
        }
        catch (error) {
          conn.end()
          reject(error)
        }
      })()
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
          host: '8.218.38.36',
          username: 'root',
          password: 'K9#b$mP2*vQ',
          remoteBasePath: isWhitelist ? '/var/www/roxybrowser/dist-whitelist' : '/var/www/roxybrowser/dist',
        },
      ]

  const deployPackages = createDeployPackages()

  for (let i = 0; i < servers.length; i++) {
    await deployToServer(servers[i], deployPackages, i, servers.length)
  }

  console.log('\x1B[32m%s\x1B[0m', '全部服务器部署完成！')
}
