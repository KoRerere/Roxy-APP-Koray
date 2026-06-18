import { isWindows } from '/@/constants/common'

/** Windows CreateProcess 命令行长度上限 */
const WINDOWS_MAX_CMD_LINE_LENGTH = 32767
/** 预留安全余量，避免引号转义等导致超限 */
const CMD_LINE_SAFETY_MARGIN = 512

/** 估算 Windows 命令行总长度（executable + args） */
export function getCommandLineLength(executablePath: string, args: string[]): number {
  const formattedArgs = args.map((arg) => {
    if (arg.includes(' ') || arg.includes('"'))
      return `"${arg.replace(/"/g, '\\"')}"`
    return arg
  })
  return executablePath.length + 1 + formattedArgs.join(' ').length
}

/**
 * 将打开 URL 追加到启动参数；Windows 下超出命令行长度限制的 URL 延后到启动后通过 CDP 打开。
 */
export function appendOpenUrlsToLaunchArgs(
  executablePath: string,
  args: string[],
  urls: string[],
): { args: string[], deferredUrls: string[] } {
  if (!urls.length)
    return { args, deferredUrls: [] }

  if (!isWindows)
    return { args: [...args, ...urls], deferredUrls: [] }

  const result = [...args]
  const deferredUrls: string[] = []
  const maxLength = WINDOWS_MAX_CMD_LINE_LENGTH - CMD_LINE_SAFETY_MARGIN

  for (const url of urls) {
    const testArgs = [...result, url]
    if (getCommandLineLength(executablePath, testArgs) <= maxLength)
      result.push(url)
    else
      deferredUrls.push(url)
  }

  return { args: result, deferredUrls }
}
