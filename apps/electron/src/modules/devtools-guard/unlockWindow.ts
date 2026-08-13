import { BrowserWindow } from 'electron'

/**
 * 口令弹窗不接入渲染层与 preload：既避免依赖可独立热更新的 Web 版本，也不必新增 IPC 通道。
 * 页面通过主进程 executeJavaScript 注入的 resolve 回调回传结果；用户在回调注入前就提交时，
 * 先暂存到 __roxyPending，由注入脚本兜底读取。
 */
const SUBMIT_HOOK = '__roxyUnlockSubmit'
const PENDING_KEY = '__roxyUnlockPending'

function buildPromptHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Diagnostics</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 20px;
    font: 13px/1.5 -apple-system, "Segoe UI", sans-serif;
    background: #1f2126;
    color: #e6e6e6;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  label { color: #9aa0a6; }
  input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #3a3d44;
    border-radius: 6px;
    background: #14161a;
    color: #e6e6e6;
    outline: none;
  }
  input:focus { border-color: #5b8cff; }
  .option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #9aa0a6;
  }
  .option input {
    width: auto;
    margin: 2px 0 0;
    padding: 0;
  }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button {
    padding: 7px 16px;
    border: 1px solid #3a3d44;
    border-radius: 6px;
    background: #2a2d34;
    color: #e6e6e6;
    cursor: pointer;
  }
  button.primary { background: #3b6cf6; border-color: #3b6cf6; }
</style>
</head>
<body>
  <label for="secret">Diagnostics access key</label>
  <input id="secret" type="password" autocomplete="off" autofocus>
  <label class="option">
    <input id="network" type="checkbox">
    <span>Enable network inspection (restarts app)</span>
  </label>
  <div class="actions">
    <button id="cancel" type="button">Cancel</button>
    <button id="submit" class="primary" type="button">OK</button>
  </div>
<script>
  var input = document.getElementById('secret')
  var network = document.getElementById('network')
  function done(secret) {
    var result = { secret: secret, networkInspection: secret ? network.checked : false }
    if (typeof window['${SUBMIT_HOOK}'] === 'function') {
      window['${SUBMIT_HOOK}'](result)
    }
    else {
      window['${PENDING_KEY}'] = result
    }
  }
  document.getElementById('submit').addEventListener('click', function () { done(input.value) })
  document.getElementById('cancel').addEventListener('click', function () { done('') })
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') done(input.value)
    if (event.key === 'Escape') done('')
  })
</script>
</body>
</html>`
}

/** 口令弹窗的提交结果 */
export interface UnlockPromptResult {
  /** 用户输入的口令，取消或关窗时为空字符串 */
  secret: string
  /** 是否勾选了主进程网络抓包（需要重启应用才能生效） */
  networkInspection: boolean
}

/** 取消或关窗时的结果 */
const CANCELLED: UnlockPromptResult = { secret: '', networkInspection: false }

/**
 * 弹出口令输入窗，返回用户输入的口令与网络抓包选项；取消或直接关窗返回空口令。
 */
export function promptDevToolsSecret(): Promise<UnlockPromptResult> {
  return new Promise<UnlockPromptResult>((resolve) => {
    const win = new BrowserWindow({
      width: 340,
      height: 240,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      title: 'Diagnostics',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: false,
        spellcheck: false,
      },
    })

    win.setMenu(null)

    let settled = false
    const settle = (value: UnlockPromptResult) => {
      if (settled) {
        return
      }
      settled = true
      resolve(value)
      if (!win.isDestroyed()) {
        win.destroy()
      }
    }

    win.webContents.once('did-finish-load', () => {
      // executeJavaScript 会等待返回的 Promise，页面提交时即 resolve
      win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if ('${PENDING_KEY}' in window) {
            resolve(window['${PENDING_KEY}'])
          }
          else {
            window['${SUBMIT_HOOK}'] = resolve
          }
        })
      `).then((value) => {
        settle(typeof value?.secret === 'string'
          ? { secret: value.secret, networkInspection: Boolean(value.networkInspection) }
          : CANCELLED)
      }).catch(() => {
        // 窗口被关闭时 executeJavaScript 会 reject，由 closed 事件收口
      })
    })

    win.on('closed', () => settle(CANCELLED))

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildPromptHtml())}`)
      .catch((error) => {
        console.error('[DevToolsGuard] failed to load unlock prompt:', error)
        settle(CANCELLED)
      })
  })
}
