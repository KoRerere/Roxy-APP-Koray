import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isLinux, isPackaged } from '/@/constants/common'

export async function syncAutoStart(enable: boolean) {
  if (!isPackaged) {
    console.debug('[auto-start] skip auto-start sync in non-packaged build', enable)
    return
  }

  if (!app.isReady()) {
    await app.whenReady()
  }

  if (isLinux) {
    await syncLinuxAutoStart(enable)
    return
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
    })
  }
  catch (error) {
    console.error('[auto-start] failed to sync auto-start setting', error)
  }
}

async function syncLinuxAutoStart(enable: boolean) {
  const appName = app.getName()
  const autostartDir = join(app.getPath('home'), '.config/autostart')
  const desktopFile = join(autostartDir, `${appName}.desktop`)

  if (!enable) {
    try {
      await unlink(desktopFile)
    }
    catch (error) {
      console.debug('[auto-start] failed to delete desktop file', error)
    }
    return
  }

  if (!existsSync(autostartDir)) {
    await mkdir(autostartDir, { recursive: true })
  }

  const desktopFileContent = `
[Desktop Entry]
Type=Application
Name=${appName}
Comment=Start ${appName} on login
Exec=${app.getPath('exe')} --no-sandbox --disable-setuid-sandbox
X-GNOME-Autostart-enabled=true
Terminal=false
`

  await writeFile(desktopFile, desktopFileContent)
}
