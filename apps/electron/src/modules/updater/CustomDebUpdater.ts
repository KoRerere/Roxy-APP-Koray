import { DebUpdater } from 'electron-updater'
import { accessSync, constants as fsConstants } from 'node:fs'
import { join } from 'node:path'

/**
 * 自定义 DebUpdater：
 * - 仅重写 Linux 下需要 root 的安装命令调用逻辑
 * - 当 sudo 命令为 pkexec 且检测到自带 wrapper 时，通过 wrapper 触发 polkit，自定义认证提示
 * - 其余行为完全保持 electron-updater 默认实现
 */
export class CustomDebUpdater extends DebUpdater {
  private getWrapperPath() {
    const resourcesRoot = process.resourcesPath || this.app.appUpdateConfigPath.replace(/\/app-update\.yml$/, '')
    const candidate = join(resourcesRoot, 'roxybrowser-update-wrapper.sh')
    try {
      accessSync(candidate, fsConstants.X_OK)
      return candidate
    } catch {
      this._logger?.debug?.(`[pkexec-wrapper] Wrapper not executable: ${candidate}`)
      return null
    }
  }

  // 覆写 LinuxUpdater.runCommandWithSudoIfNeeded 逻辑
  protected override runCommandWithSudoIfNeeded(commandWithArgs: string[]) {
    if (this.isRunningAsRoot()) {
      this._logger.info('Running as root, no need to use sudo')
      return this.spawnSyncLog(commandWithArgs[0], commandWithArgs.slice(1))
    }

    const { name } = this.app
    const installComment = `"${name} would like to update"`
    const sudo = this.sudoWithArgs(installComment)
    this._logger.info(`Running as non-root user, using sudo to install: ${sudo}`)

    // 如果是 pkexec，并且找到了我们打包进去的 wrapper，则通过 wrapper 触发自定义 polkit 提示
    if (/pkexec/i.test(sudo[0])) {
      const wrapperPath = this.getWrapperPath()
      if (wrapperPath) {
        this._logger.info(`[pkexec-wrapper] Using wrapper ${wrapperPath}`)
        return this.spawnSyncLog(sudo[0], [...(sudo.length > 1 ? sudo.slice(1) : []), wrapperPath, ...commandWithArgs])
      }
    }

    // 其他情况保持原逻辑
    let wrapper = '"'
    // some sudo commands dont want the command to be wrapped in " quotes
    if (/pkexec/i.test(sudo[0]) || sudo[0] === 'sudo') {
      wrapper = ''
    }
    return this.spawnSyncLog(sudo[0], [...(sudo.length > 1 ? sudo.slice(1) : []), `${wrapper}/bin/bash`, '-c', `'${commandWithArgs.join(' ')}'${wrapper}`])
  }
}


