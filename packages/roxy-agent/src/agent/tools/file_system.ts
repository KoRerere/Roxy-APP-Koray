import { DynamicStructuredTool } from '@langchain/core/tools'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { env } from '../../config'

export const fileSystemTools = [
  new DynamicStructuredTool({
    name: 'roxy_download',
    description: 'download any static resources from a webpage as long as you provide the direct links to those resources (e.g., images, videos, fonts, JS/CSS, ZIP files, etc.).',
    schema: z.object({
      url: z.string().url().describe('The URL of the file to download'),
      // 存储路径
      path: z.string().optional().default(env.DOWNLOADS_DIR).describe('The path to save the downloaded file (can be absolute or relative)'),
      // 存储文件名
      filename: z.string().optional().describe('The name of the downloaded file (can be absolute or relative)'),
    }),
    func: async ({ url, path: _path, filename }: { url: string, path?: string, filename?: string }) => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          return `Error downloading file: HTTP ${response.status} ${response.statusText}`
        }

        // 使用 arrayBuffer 支持二进制文件（如图片）
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const _filename = filename || path.basename(new URL(url).pathname) || 'download'
        if (_path) {
          // 确保目录存在
          await fs.mkdir(_path, { recursive: true })
          const filePath = path.join(_path, _filename)
          await fs.writeFile(filePath, buffer)
          return `File ${_filename} has been downloaded and saved to ${filePath}`
        }
        // 没有下载到文件
        return `File ${_filename} has not been downloaded (no path specified)`
      }
      catch (error) {
        return `Error downloading file: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }),
  new DynamicStructuredTool({
    name: 'roxy_read_file',
    description: 'Read the contents of a file from the local filesystem.',
    schema: z.object({
      filePath: z.string().describe('The path to the file to read (can be absolute or relative)'),
    }),
    func: async ({ filePath }: { filePath: string }) => {
      try {
        // 检查文件是否存在
        const stats = await fs.stat(filePath)

        // 检查文件大小 128kb 限制
        if (stats.size > 128 * 1024) {
          return `Error: File size (${(stats.size / 1024).toFixed(2)}KB) exceeds the maximum allowed size (128KB)`
        }

        // 检查是否是文件（不是目录）
        if (!stats.isFile()) {
          return `Error: ${filePath} is not a file`
        }

        // 读取文件内容
        const content = await fs.readFile(filePath, 'utf-8')
        return `File content from ${filePath}:\n\n${content}`
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return `Error: File not found: ${filePath}`
        }
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }),

  /** 当用户只给了目录时，我们使用这个工具把目录下的文件扫一遍，然后拼接成完成路径返回即可 */
  new DynamicStructuredTool({
    name: 'roxy_ls',
    description: 'list all files and directories in a directory, similar to ls command. Shows file type, size, and modification time. Note: To construct full paths, join the directory path above with individual file names.',
    schema: z.object({
      directory: z.string().describe('The directory to list files from'),
    }),
    func: async ({ directory }: { directory: string }) => {
      try {
        // 检查目录是否存在
        const dirStats = await fs.stat(directory)
        if (!dirStats.isDirectory()) {
          return `Error: ${directory} is not a directory`
        }

        // 读取目录内容
        const entries = await fs.readdir(directory)

        // 获取每个条目的详细信息
        const entriesWithStats = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(directory, entry)
            try {
              /** 使用 lstat 避免跟随符号链接 */
              const stats = await fs.lstat(fullPath)
              return {
                name: entry,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                isSymbolicLink: stats.isSymbolicLink(),
                size: stats.size,
                modifiedTime: stats.mtime,
                stats,
              }
            }
            catch (error) {
              // 如果无法获取统计信息（如权限问题），仍然返回基本信息
              return {
                name: entry,
                isDirectory: false,
                isFile: false,
                isSymbolicLink: false,
                size: 0,
                modifiedTime: new Date(),
                error: error instanceof Error ? error.message : String(error),
              }
            }
          }),
        )

        /** 格式化文件大小（人类可读格式） */
        const formatSize = (bytes: number): string => {
          if (bytes === 0)
            return '0 B'
          const k = 1024
          const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
          const i = Math.floor(Math.log(bytes) / Math.log(k))
          return `${(bytes / (k ** i)).toFixed(2)} ${sizes[i]}`
        }

        /** 格式化日期时间 */
        const formatDate = (date: Date): string => {
          return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
        }

        /** 分离目录和文件，目录在前 */
        const directories = entriesWithStats.filter(e => e.isDirectory)
        const files = entriesWithStats.filter(e => e.isFile)
        const symlinks = entriesWithStats.filter(e => e.isSymbolicLink)
        const others = entriesWithStats.filter(e => !e.isDirectory && !e.isFile && !e.isSymbolicLink)

        /** 按名称排序 */
        const sortByName = (a: typeof entriesWithStats[0], b: typeof entriesWithStats[0]) => {
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        }

        directories.sort(sortByName)
        files.sort(sortByName)
        symlinks.sort(sortByName)
        others.sort(sortByName)

        /** 构建输出 */
        const results: string[] = []
        results.push(`## Directory Listing: ${directory}`)
        results.push('')
        results.push(`Total: ${entries.length} entries`)
        results.push('')

        /** 格式化条目信息 */
        const formatEntry = (entry: typeof entriesWithStats[0]) => {
          const icon = entry.isDirectory ? '📁' : entry.isSymbolicLink ? '🔗' : '📄'
          const type = entry.isDirectory ? 'DIR' : entry.isSymbolicLink ? 'LNK' : 'FILE'
          const size = entry.isDirectory ? '-' : formatSize(entry.size)
          const modified = formatDate(entry.modifiedTime)
          const error = entry.error ? ` ⚠️ ${entry.error}` : ''

          return `${icon} ${entry.name.padEnd(40)} ${type.padEnd(4)} ${size.padStart(10)} ${modified}${error}`
        }

        /** 输出目录 */
        if (directories.length > 0) {
          results.push('### Directories:')
          directories.forEach(entry => results.push(formatEntry(entry)))
          results.push('')
        }

        /** 输出文件 */
        if (files.length > 0) {
          results.push('### Files:')
          files.forEach(entry => results.push(formatEntry(entry)))
          results.push('')
        }

        /** 输出符号链接 */
        if (symlinks.length > 0) {
          results.push('### Symbolic Links:')
          symlinks.forEach(entry => results.push(formatEntry(entry)))
          results.push('')
        }

        /** 输出其他类型 */
        if (others.length > 0) {
          results.push('### Other:')
          others.forEach(entry => results.push(formatEntry(entry)))
          results.push('')
        }

        /** 如果没有内容 */
        if (entries.length === 0) {
          results.push('(empty directory)')
        }

        return results.join('\n')
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return `Error: Directory not found: ${directory}`
        }
        return `Error listing directory: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }),
  // 校验目录是否正常，是否存在，是否可读可写，是否需要创建出来
  new DynamicStructuredTool({
    name: 'roxy_check_directory',
    description: 'check if a directory is normal, whether it exists, whether it is readable and writable, and whether it needs to be created',
    schema: z.object({
      directory: z.string().describe('The directory to check'),
    }),
    func: async ({ directory }: { directory: string }) => {
      try {
        const results: string[] = []
        let exists = false
        let isDirectory = false
        let readable = false
        let writable = false
        let created = false

        // 检查目录是否存在
        try {
          const stats = await fs.stat(directory)
          exists = true
          isDirectory = stats.isDirectory()

          if (!isDirectory) {
            return `Error: ${directory} exists but is not a directory`
          }
        }
        catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            exists = false
            // 目录不存在，尝试创建
            try {
              await fs.mkdir(directory, { recursive: true })
              created = true
              exists = true
              isDirectory = true
              results.push(`✅ Directory created: ${directory}`)
            }
            catch (createError) {
              return `Error: Directory does not exist and cannot be created: ${createError instanceof Error ? createError.message : String(createError)}`
            }
          }
          else {
            return `Error checking directory: ${error instanceof Error ? error.message : String(error)}`
          }
        }

        // 检查可读性
        try {
          await fs.readdir(directory)
          readable = true
        }
        catch (error) {
          readable = false
        }

        // 检查可写性（尝试写入一个临时文件）
        try {
          const testFile = path.join(directory, `.test_write_${Date.now()}.tmp`)
          await fs.writeFile(testFile, 'test')
          await fs.unlink(testFile)
          writable = true
        }
        catch (error) {
          writable = false
        }

        // 构建返回结果
        results.push(`## Directory Check Results: ${directory}`)
        results.push('')
        results.push(`- **Exists**: ${exists ? '✅ Yes' : '❌ No'}`)
        results.push(`- **Is Directory**: ${isDirectory ? '✅ Yes' : '❌ No'}`)
        results.push(`- **Readable**: ${readable ? '✅ Yes' : '❌ No'}`)
        results.push(`- **Writable**: ${writable ? '✅ Yes' : '❌ No'}`)
        if (created) {
          results.push(`- **Created**: ✅ Yes (directory was created)`)
        }

        const allOk = exists && isDirectory && readable && writable
        results.push('')
        results.push(`**Status**: ${allOk ? '✅ Directory is ready to use' : '⚠️ Directory has issues'}`)

        return results.join('\n')
      }
      catch (error) {
        return `Error checking directory: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }),
  // 将内容存入指定文件
  new DynamicStructuredTool({
    name: 'roxy_write_file',
    description: 'write content to a file. If the directory does not exist, it will be created automatically.',
    schema: z.object({
      filePath: z.string().describe('The path to the file to write to (can be absolute or relative)'),
      content: z.string().describe('The content to write to the file'),
    }),
    func: async ({ filePath, content }: { filePath: string, content: string }) => {
      try {
        // 获取文件的父目录
        const dir = path.dirname(filePath)

        // 确保父目录存在
        try {
          await fs.mkdir(dir, { recursive: true })
        }
        catch (error) {
          // 如果目录已存在，忽略错误
          if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
            return `Error creating directory: ${error.message}`
          }
        }

        // 检查父目录是否可写
        try {
          const testFile = path.join(dir, `.test_write_${Date.now()}.tmp`)
          await fs.writeFile(testFile, 'test')
          await fs.unlink(testFile)
        }
        catch (error) {
          return `Error: Directory ${dir} is not writable: ${error instanceof Error ? error.message : String(error)}`
        }

        // 检查文件是否已存在
        let fileExists = false
        let previousSize = 0
        try {
          const stats = await fs.stat(filePath)
          fileExists = true
          previousSize = stats.size

          // 如果路径存在但不是文件，返回错误
          if (!stats.isFile()) {
            return `Error: ${filePath} exists but is not a file`
          }
        }
        catch (error) {
          // 文件不存在，这是正常的
          if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
            return `Error checking file: ${error instanceof Error ? error.message : String(error)}`
          }
        }

        // 写入文件
        await fs.writeFile(filePath, content, 'utf-8')

        // 获取写入后的文件信息
        const stats = await fs.stat(filePath)
        const fileSize = stats.size
        const contentSize = Buffer.byteLength(content, 'utf-8')

        // 构建返回结果
        const results: string[] = []
        results.push(`## File Write Result: ${filePath}`)
        results.push('')
        results.push(`- **Status**: ✅ File written successfully`)
        results.push(`- **File Existed**: ${fileExists ? 'Yes' : 'No'}`)
        if (fileExists) {
          results.push(`- **Previous Size**: ${previousSize} bytes`)
        }
        results.push(`- **Content Size**: ${contentSize} bytes`)
        results.push(`- **File Size**: ${fileSize} bytes`)
        results.push(`- **Directory**: ${dir}`)

        return results.join('\n')
      }
      catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  }),
]
