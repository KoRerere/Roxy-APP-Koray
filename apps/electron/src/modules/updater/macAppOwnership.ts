import type { ChildProcess } from 'node:child_process'
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { access, cp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isMac, isPackaged } from '/@/constants/common'

/**
 * 「修复待确认」标记文件路径：修复前写入、重启后据此判断修复结果并提示。
 * 放在 userData 目录（不会被 applet 清理临时副本时一并删除）。
 */
function getFixPendingMarkerPath() {
  return path.join(app.getPath('userData'), '.mac-ownership-fix-pending')
}

/**
 * 以 Promise 形式执行命令并等待退出，非 0 退出码视为失败。
 */
function spawnWait(command: string, args: string[], options: Parameters<typeof spawn>[2] = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, options as any) as unknown as ChildProcess
    let stderr = ''
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(`[macAppOwnership] ${command} exited code=${code} signal=${signal ?? ''} ${stderr.trim()}`.trim()))
      }
    })
  })
}

/** 转义用于单引号包裹的 shell 字符串 */
function escapeForSingleQuotes(s: string) {
  return s.replace(/'/g, `'\"'\"'`)
}

/**
 * 从当前进程可执行文件路径推导出 .app bundle 根目录。
 * 例如：/Applications/RoxyBrowser.app/Contents/MacOS/RoxyBrowser -> /Applications/RoxyBrowser.app
 */
function resolveAppBundlePath(): string | null {
  const exePath = process.execPath
  const marker = '.app/'
  const idx = exePath.indexOf(marker)
  if (idx === -1) {
    return null
  }
  return exePath.slice(0, idx + marker.length - 1)
}

/**
 * 编译并 ad-hoc 签名一个 AppleScript applet，使其授权弹窗显示应用名/图标。
 */
async function buildSignedApplet(appleScript: string, appletPath: string, scriptPath: string) {
  await writeFile(scriptPath, appleScript)
  // osacompile -o 要求目标 app 路径不存在
  await rm(appletPath, { recursive: true, force: true })
  await spawnWait('osacompile', ['-o', appletPath, scriptPath])

  // 设置图标用于授权弹窗展示（失败不影响主流程）
  const iconPath = path.join(import.meta.dirname, '..', 'resources/launcher.icns')
  await cp(iconPath, path.join(appletPath, 'Contents/Resources/applet.icns')).catch(() => undefined)
  await cp(iconPath, path.join(appletPath, 'Contents/Resources/droplet.icns')).catch(() => undefined)
  await rm(path.join(appletPath, 'Contents/Resources/Assets.car')).catch(() => undefined)

  // ad-hoc 重新签名
  await spawnWait('codesign', ['--force', '--deep', '-s', '-', appletPath])
}

/**
 * 检测是否需要修复 .app 属主，并消费「修复后重启」的待确认标记，供渲染进程在加载完成后查询。
 *
 * 背景：旧版本 PKG 未在 postinstall 中执行 chown，导致 .app 归属 root:wheel。
 * 这类存量用户每次自动升级（Squirrel.Mac 原地替换）都会弹「添加帮助程序工具」授权窗，
 * 且实测 Squirrel 更新后新 bundle 仍是 root，无法自愈。
 *
 * 为什么不能用 chown 修复（实测结论）：
 * macOS 会「封存」已签名+公证的 App bundle，对 bundle 内被签名覆盖的文件（如
 * Contents/CodeResources、Contents/_CodeSignature/CodeResources）的属主修改会被内核拒绝
 * （Operation not permitted）——即使 App 已完全退出、即使是真正的 root、即使没有 SIP
 * restricted 标志也一样。因此唯一可行解是 copy-replace（见 confirmMacAppOwnershipFix）。
 *
 * 返回：
 * - needFix：bundle 属主非当前用户，需要弹窗引导用户授权修复；
 * - justFixed：存在待确认标记且 bundle 现已归属当前用户，说明上一次修复成功（提示成功）。
 *   无论结果如何，标记都只消费一次（读取后即删除）。
 */
export async function getMacAppOwnershipFixStatus(): Promise<{ needFix: boolean, justFixed: boolean }> {
  const result = { needFix: false, justFixed: false }

  if (!isMac || !isPackaged) {
    return result
  }

  const currentUid = typeof process.getuid === 'function' ? process.getuid() : undefined
  // root 身份运行时无需修复
  if (currentUid === undefined || currentUid === 0) {
    return result
  }

  const appBundlePath = resolveAppBundlePath()
  // 仅处理安装在 /Applications 下的标准安装场景
  if (!appBundlePath || !appBundlePath.startsWith('/Applications/')) {
    return result
  }

  const bundleStat = await stat(appBundlePath).catch(() => null)
  if (!bundleStat) {
    return result
  }
  const isUserOwned = bundleStat.uid === currentUid

  // 消费「修复后重启」标记：存在即删除，仅消费一次
  const markerPath = getFixPendingMarkerPath()
  const hasMarker = await access(markerPath).then(() => true).catch(() => false)
  if (hasMarker) {
    await rm(markerPath, { force: true }).catch(() => undefined)
  }

  result.justFixed = hasMarker && isUserOwned
  result.needFix = !isUserOwned
  return result
}

/**
 * 用户在渲染进程弹窗中点击「授权并继续」后调用：以 copy-replace 修复 .app 属主，并自动重启。
 *
 * copy-replace 原理：
 * - 用户身份 `ditto` 出来的副本归当前用户所有、且尚未被封存，可自由处置；
 * - 同卷 `mv`（rename）会保留 inode 属主，因此把用户副本搬进 /Applications 后属主仍是用户。
 *
 * 实现：编译一个独立 AppleScript applet 并以「分离进程」启动（主进程退出后它仍存活），随后主动退出 App：
 * a. 普通用户身份等待 bundle 全部进程退出，再 `ditto` 出一份归当前用户、未封存的副本
 *    （拷贝失败则放弃，不做任何破坏性操作）；
 * b. 仅在副本就绪后，用管理员权限（仅此一步弹一次系统密码）原子替换：
 *    旧 bundle 改名挪走 -> 用户副本搬入原路径 -> chown -R 兜底 -> 删除旧 bundle；
 * c. 替换成功后以当前用户身份 `open` 重新拉起 App。
 *
 * 退出前写入「待确认」标记，重启后由 getMacAppOwnershipFixStatus 据此提示修复结果。
 */
export async function confirmMacAppOwnershipFix(): Promise<void> {
  if (!isMac || !isPackaged) {
    return
  }

  const currentUid = typeof process.getuid === 'function' ? process.getuid() : undefined
  if (currentUid === undefined || currentUid === 0) {
    return
  }

  const appBundlePath = resolveAppBundlePath()
  if (!appBundlePath || !appBundlePath.startsWith('/Applications/')) {
    return
  }

  const bundleStat = await stat(appBundlePath).catch(() => null)
  // 属主已是当前用户，无需修复
  if (!bundleStat || bundleStat.uid === currentUid) {
    return
  }

  const owner = os.userInfo().username
  const displayName = isPackaged ? app.getName() : 'RoxyBrowser'

  const bundleName = path.basename(appBundlePath)
  // 临时副本放在用户家目录缓存（始终可写），且与 /Applications 同卷，保证后续 mv 是 rename 而非跨卷拷贝
  const copyParent = path.join(os.homedir(), 'Library/Caches', 'roxy_ownerfix')
  const copyPath = path.join(copyParent, bundleName)
  // 旧 bundle 临时改名（同目录，rename 速度快，替换窗口仅毫秒级）
  const oldPath = `${appBundlePath}.ownerfix-old`

  const bundleEsc = escapeForSingleQuotes(appBundlePath)
  const ownerEsc = escapeForSingleQuotes(owner)
  const copyParentEsc = escapeForSingleQuotes(copyParent)
  const copyEsc = escapeForSingleQuotes(copyPath)
  const oldEsc = escapeForSingleQuotes(oldPath)

  const ts = Date.now()
  const scriptPath = path.join(os.tmpdir(), `roxy_owner_fix_${ts}.scpt`)
  const appletPath = path.join(os.tmpdir(), `${displayName}.app`)

  // a. 普通用户身份：等待 bundle 全部进程退出（pgrep 匹配 bundle/Contents/ 下主进程 + 各 Helper，
  //    最多约 180s 兜底），再清理残留并 ditto 出一份「归当前用户、未封存」的副本。
  const waitCmd = `i=0; while /usr/bin/pgrep -f '${bundleEsc}/Contents/' >/dev/null 2>&1; do /bin/sleep 0.3; i=$((i+1)); if [ $i -gt 600 ]; then break; fi; done; /bin/sleep 1`
  const copyCmd = `${waitCmd}; /bin/rm -rf '${copyParentEsc}'; /bin/mkdir -p '${copyParentEsc}'; /usr/bin/ditto '${bundleEsc}' '${copyEsc}'`
  // b. 管理员权限（仅此一步弹一次密码）：原子替换。chown -R 仅作兜底（同卷 mv 已保留用户属主，
  //    若极端情况下 mv 退化为跨卷拷贝则由它纠正；新 bundle 未被封存，chown 可成功）。
  const swapCmd = `/bin/mv '${bundleEsc}' '${oldEsc}' && /bin/mv '${copyEsc}' '${bundleEsc}' && /usr/sbin/chown -R '${ownerEsc}:staff' '${bundleEsc}' && /bin/rm -rf '${oldEsc}'`
  // c. 替换成功后以普通用户身份重新拉起 App
  const relaunchCmd = `/usr/bin/open '${bundleEsc}'`
  // ditto 失败则不进入破坏性替换，避免把 /Applications 搞坏；用户取消授权也不弹系统错误框
  const appleScript = [
    `set copyOK to false`,
    `try`,
    `\tdo shell script "${copyCmd}"`,
    `\tset copyOK to true`,
    `end try`,
    `if copyOK then`,
    `\tset swapOK to false`,
    `\ttry`,
    `\t\tdo shell script "${swapCmd}" with administrator privileges`,
    `\t\tset swapOK to true`,
    `\tend try`,
    `\tif swapOK then`,
    `\t\ttry`,
    `\t\t\tdo shell script "${relaunchCmd}"`,
    `\t\tend try`,
    `\tend if`,
    `end if`,
  ].join('\n')

  try {
    await buildSignedApplet(appleScript, appletPath, scriptPath)

    // 以分离进程启动 applet：unref 后即使主进程退出，applet 仍会继续「等待退出 -> 拷贝 -> 替换 -> 重启」
    const child = spawn('open', ['-n', appletPath], { detached: true, stdio: 'ignore' })
    child.unref()

    // applet 启动后才能删脚本；applet 自身留在临时目录，由系统清理（删除会影响其运行）
    await rm(scriptPath, { force: true }).catch(() => undefined)
    // 写入「待确认」标记：重启后据此判断修复是否成功并给出提示
    await writeFile(getFixPendingMarkerPath(), String(Date.now())).catch(() => undefined)
    console.log(`[macAppOwnership] 用户已确认，调度 copy-replace 修复 .app 属主为 ${owner}（bundle 当前 uid=${bundleStat.uid}），即将退出 App`)

    // 主动退出 App，让 applet 在「App 完全退出后」执行替换并重新拉起
    setImmediate(() => app.quit())
  }
  catch (error) {
    console.error('[macAppOwnership] 调度修复失败', error)
  }
}
