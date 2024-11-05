import { exec } from 'node:child_process'

/**
 * 关闭指定进程名称的进程
 */
export function killProcessByName(processName: string) {
  const platform = process.platform

  let command
  if (platform === 'win32') {
    // Windows 系统
    command = `taskkill /F /IM ${processName}.exe`
  }
  else {
    // Unix 系统 (Linux, macOS)
    command = `pkill -f ${processName}`
  }

  try {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error killing process ${processName}:`, error)
        return
      }
      if (stderr) {
        console.error(`Error output:`, stderr)
        return
      }
      console.log(`Process ${processName} killed successfully.`)
    })
  }
  catch (error) {
    console.error(`Error killing process ${processName}:`, error)
  }
}
/** 根据执行路径获取进程 IDs */
export function getProcessIdsByExePath(processPath: string) {
  const { promise, resolve, reject } = Promise.withResolvers<number[]>()
  exec('wmic process get ExecutablePath,ProcessId', (error, stdout, stderr) => {
    if (error) {
      reject(stderr)
      console.error(`Error: ${error.message}`)
      return
    }
    if (stderr) {
      reject(stderr)
      console.error(`Stderr: ${stderr}`)
      return
    }
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '' && line.trim() !== 'ExecutablePath  ProcessId')
    /**
     * 获取进程ID
     */
    const matchingProcesses = lines
      .map(line => line.trim().split(/\s{2,}/)) // 分割每行，获取执行路径和进程ID
      .filter(parts => parts[0] === processPath) // 过滤出匹配指定路径的进程
      .map(parts => Number(parts[1]))

    if (matchingProcesses.length > 0) {
      console.log(`Process IDs with executable path ${processPath}:`)
      resolve(matchingProcesses)
    }
    else {
      resolve([])
      console.log(`No processes found with executable path ${processPath}`)
    }
  })

  return promise
}
