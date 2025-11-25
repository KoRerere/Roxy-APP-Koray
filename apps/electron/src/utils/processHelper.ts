import { exec } from 'node:child_process'
import { normalize } from 'node:path'
import { appConfig } from '/@/constants'
import os from 'node:os'

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
      .filter(parts => {
        const exePath = normalize(String.raw`${parts[0]}`).toLocaleLowerCase()
        console.log("exePath", exePath, processPath.toLocaleLowerCase())
        return exePath.includes(processPath.toLocaleLowerCase())
      }) // 过滤出匹配指定路径的进程
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

/** 判断进程是否存在 */
export async function isProcessExists(pids: number[]): Promise<boolean[]> {
  const { promise, resolve } = Promise.withResolvers<boolean[]>()
  const platform = process.platform;

  // windows: tasklist | findstr /i /c:" 6880 " /c:" 18112 " /c:" 112 "
  // linux: ps -p 6880 18112 112
  const command = platform === 'win32'
    ? `tasklist | findstr /i /c:${pids.map(pid => `" ${pid} "`).join(' /c:')}`
    : `ps -p ${pids.join(' -p ')}`;

  exec(command, (error, stdout) => {
    // 使用正则表达式精确匹配 PID，确保只匹配完整的 PID 而不是其中的部分数字
    resolve(pids.map(pid => !error && new RegExp(`\\b${pid}\\b`).test(stdout)))
  })

  return promise
}


export function isProcessRunning(pid: number) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    return false; // 无效 PID
  }

  try {
    // process.kill(pid, 0) 的第二个参数 0 表示不发送任何信号，仅仅用于检查进程是否存在。
    // 如果进程存在，process.kill 会执行成功，try 代码块中的 return true; 会被执行。
    // 如果进程不存在，process.kill 会抛出异常，catch 代码块中的 return false; 会被执行
    process.kill(pid, 0);  // 不会真的杀进程
    // 没抛异常说明存在
    return true;
  } catch (e: any) {
    if (e.code === 'ERR_INVALID_ARG_TYPE') {
      // 针对 `process.kill` 的错误，表示 pid 不是数字或超出范围
      return false;
    }
    if (e.code === 'EPERM') {
      // 权限不足（但进程可能存在）
      return true;
    }
    if (e.code === 'ESRCH') {
      // 进程不存在
      return false;
    }
    if (e.code === 'EINVAL') {
      // 无效的信号
      return false;
    }
    // 其他未知错误，保守起见返回 false
    return false;
  }
}


/**
 * 查找占用某个句柄的进程
 *
 * 示例：查找占用 `test.txt` 句柄的进程
 *
 * findProcessByHandle('test.txt')
 *   .then(processes => console.log(processes))
 *   .catch(err => console.error(err));
 *
 * */
export function findProcessByHandle(handleName: string) {
  const { promise, resolve, reject } = Promise.withResolvers<{ name: string; pid: number }[] | null>()

  let command;
  if (os.platform() === 'win32') {
    command = `${appConfig.handleExePath} /accepteula ${handleName}`;
  } else {
    // 在 Unix/Linux/macOS 上使用 lsof
    command = `lsof | grep ${handleName}`;
  }

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Failed to get process:', stderr);
      return reject(error);
    }

    const lines = stdout.split('\n');
    const processes: { name: string; pid: number }[] = [];

    lines.forEach(line => {
      let match;
      if (os.platform() === 'win32') {
        match = line.match(/^(.+?)\s+pid:\s+(\d+)/);
      } else {
        match = line.match(/^(\S+)\s+(\d+)/); // 解析 lsof 输出
      }

      if (match) {
        const processName = match[1].trim();
        const pid = parseInt(match[2], 10);

        if (!ignoredProcesses.includes(processName.toLowerCase())) {
          processes.push({ name: processName, pid });
        }
      }
    });

    resolve(processes.length ? processes : null);
  });

  return promise
}


// 过滤掉系统关键进程，不尝试终止这些重要的系统进程
const ignoredProcesses = [
  // Windows 系统进程
  'explorer.exe',      // Windows 资源管理器
  'system',            // Windows 系统进程
  'smss.exe',          // Windows 会话管理器
  'csrss.exe',         // Windows 客户端/服务器运行时子系统
  'wininit.exe',       // Windows 初始化进程
  'services.exe',      // Windows 服务控制管理器
  'lsass.exe',         // Windows 本地安全认证服务
  'winlogon.exe',      // Windows 登录进程
  'svchost.exe',       // Windows 服务主机
  'taskmgr.exe',       // Windows 任务管理器
  'dwm.exe',           // Windows 桌面窗口管理器
  'taskhost.exe',      // Windows 任务主机
  'conhost.exe',       // Windows 控制台窗口主机
  'ctfmon.exe',        // Windows CTF监视器
  'rundll32.exe',      // Windows 运行DLL
  'dllhost.exe',       // Windows DLL主机
  'sihost.exe',        // Windows Shell基础设施主机
  'fontdrvhost.exe',   // Windows 字体驱动主机
  'SearchHost.exe',    // Windows 搜索主机
  'SearchApp.exe',     // Windows 搜索应用
  'ShellExperienceHost.exe',  // Windows Shell体验主机
  'StartMenuExperienceHost.exe', // Windows 开始菜单体验主机
  'RuntimeBroker.exe', // Windows 运行时代理

  // macOS 系统进程
  'launchd',           // macOS 系统初始化进程
  'kernel_task',       // macOS 内核任务
  'WindowServer',      // macOS 窗口服务器
  'Finder',            // macOS 文件管理器
  'Dock',              // macOS 程序坞
  'SystemUIServer',    // macOS 系统UI服务器
  'loginwindow',       // macOS 登录窗口
  'coreaudiod',        // macOS 核心音频
  'mds',               // macOS 元数据服务器
  'opendirectoryd',    // macOS 开放目录服务
  'powerd',            // macOS 电源管理
  'securityd',         // macOS 安全服务
  'syslogd',           // macOS 系统日志
  'distnoted',         // macOS 分布式通知中心
  'cfprefsd',          // macOS 核心基础配置数据

  // 通用/跨平台进程
  'chrome.exe',        // Google Chrome 浏览器（可能被用作系统浏览器）
  'firefox.exe',       // Firefox 浏览器
  'msedge.exe',        // Microsoft Edge 浏览器
  'safari',            // Safari 浏览器
  'antivirus',         // 通用防病毒软件名称匹配
  'defender',          // Windows Defender
  'firewall'           // 防火墙程序
];

/**
 * @internal
 */
export interface ErrorLike extends Error {
  name: string;
  message: string;
}

/**
 * @internal
 */
export function isErrorLike(obj: unknown): obj is ErrorLike {
  return (
    typeof obj === 'object' && obj !== null && 'name' in obj && 'message' in obj
  );
}
/**
 * @internal
 */
export function isErrnoException(obj: unknown): obj is NodeJS.ErrnoException {
  return (
    isErrorLike(obj) &&
    ('errno' in obj || 'code' in obj || 'path' in obj || 'syscall' in obj)
  );
}

export function pidExists(pid: number): boolean {
  try {
    return process.kill(pid, 0);
  } catch (error) {
    if (isErrnoException(error)) {
      if (error.code && error.code === 'ESRCH') {
        return false;
      }
    }
    throw error;
  }
}