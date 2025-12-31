<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openPath, openUrl } from '@tauri-apps/plugin-opener'
import { computed, onMounted, ref } from 'vue'
import type { RoxyConfig, WebSocketMessage, WebSocketMessageMap } from './types'
import { isMacOS } from './utils'

const isDev = import.meta.hot
const isZh = navigator.language.includes('zh')
const isMac = isMacOS()
const roxyConfig = ref<RoxyConfig | null>(null)
const launchBrowserMessage = ref<WebSocketMessageMap['browser:launch-process-message']>({
  type: 'browser:launch-process-message',
  dirId: '',
  percent: 0,
  message: 'Preparing to launch…',
  warningMessages: [],
})

const isLaunching = ref(true)

const progressWidth = computed(() => `${launchBrowserMessage.value.percent}%`)

function getErrorMessage(e: unknown) {
  if (e instanceof Error)
    return e.message
  if (typeof e === 'string')
    return e
  try {
    return JSON.stringify(e)
  }
  catch {
    return String(e)
  }
}

async function closeLauncherWindow() {
  // 优先走后端退出逻辑（生产环境会强制退出，避免后台残留）
  try {
    await invoke('exit_app')
    return
  }
  catch {
    // ignore
  }

  // 开发环境 / invoke 失败时兜底：仅关闭当前窗口
  try {
    const win = getCurrentWindow()
    await win.close()
  }
  catch {
    // ignore
  }
}

async function loadRoxyDefaultBrowserConfig() {
  try {
    roxyConfig.value = await invoke('read_roxy_default_browser_config')
    console.debug('roxyConfig', roxyConfig.value)
    await launchBrowser()
  }
  catch (e) {
    console.error('Failed to load Roxy default browser config:', e)
    launchBrowserMessage.value.message = getErrorMessage(e)
    isLaunching.value = false
    await exitApp()
  }
}

loadRoxyDefaultBrowserConfig()

async function showMainWindow() {
  try {
    if (isDev) {
      await invoke('show_main_window')
    }
  }
  catch (e) {
    console.error('Failed to show main window:', e)
  }
}

async function exitApp() {
  if (isDev) {
    return
  }

  try {
    await invoke('exit_app')
  }
  catch (e) {
    console.error('Failed to exit app:', e)
  }
}

async function launchBrowser() {
  if (!roxyConfig.value) {
    exitApp()
    return
  }

  const {
    defaultBrowserDirId,
    defaultBrowserWorkspaceId,
    currentDirId,
    currentWorkspace,
    appWsPort,
    appWsToken,
  } = roxyConfig.value

  const dirId = currentDirId || defaultBrowserDirId
  const workspaceId = (typeof currentWorkspace === 'number' ? currentWorkspace : undefined) ?? defaultBrowserWorkspaceId

  async function launchAPP() {
    const searchParams = new URLSearchParams({
      dirId,
      workspaceId: String(workspaceId),
    })
    await openUrl(`roxybrowser${import.meta.env.DEV ? '-dev' : ''}://open-browser-failed?${searchParams}`)
  }

  if (isDev) {
    showMainWindow()
  }

  const wsUrl = `ws://127.0.0.1:${appWsPort}?token=${appWsToken}`
  const ws = new WebSocket(wsUrl)

  const sendMessage = (message: Pick<WebSocketMessage, 'type' | 'dirId'> & Record<string, any>) => {
    ws.send(JSON.stringify(message))
  }

  const openUrls = async () => {
    try {
      const targets = await invoke<string[]>('get_open_targets')
      console.debug('open targets', targets)
      targets.filter(Boolean).forEach((target) => {
        sendMessage({
          type: 'browser:open-url',
          dirId: defaultBrowserDirId,
          url: target,
        })
      })
    }
    catch (error) {
      console.error('Failed to open URLs:', error)
    }
    finally {
      setTimeout(() => {
        exitApp()
      }, 3000)
    }
  }

  setTimeout(async () => {
    await openUrls().finally(() => {
      exitApp()
    })
  }, 2 * 60 * 1000)

  ws.onopen = () => {
    console.debug('WebSocket connected')
    sendMessage({
      type: 'browser:is-opened',
      dirId,
    })
  }

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage
      console.debug('ws:onmessage', message.type)
      // 只处理当前窗口的消息
      if (message.dirId === dirId) {
        if (message.type === 'app:login-required') {
          showMainWindow()
          launchBrowserMessage.value.message = isZh ? '请先登录 RoxyBrowser 客户端' : 'Please login to RoxyBrowser client'
          await exitApp()
          return
        }

        // 浏览器拉起过程中的消息
        if (message.type === 'browser:launch-process-message') {
          launchBrowserMessage.value = message
          if (message.percent >= 100) {
            await openUrls()
          }
        }
        // 浏览器是否已打开
        if (message.type === 'browser:is-opened') {
          if (message.opened) {
            console.debug('browser already opened')
            await openUrls()
          }
          else {
            console.debug('browser not opened')
            showMainWindow()
            sendMessage({
              type: 'browser:open-window',
              dirId,
              workspaceId,
            })
          }
        }

        // 浏览器拉起失败
        if (message.type === 'browser:open-window') {
          console.debug('browser:open-window failed', message)
          launchBrowserMessage.value.message = message.message
          isLaunching.value = false
          if (!message.success) {
            await exitApp()
          }
        }
      }
    }
    catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }

  ws.onerror = async (event) => {
    console.error('Failed to connect to WebSocket:', event)
    launchBrowserMessage.value.message = isZh ? '请确保 APP 已启动并且已登录' : 'Please ensure the APP is started and logged in'
    isLaunching.value = false
    showMainWindow()
    await launchAPP().finally(() => {
      exitApp()
    })
  }
}
</script>

<template>
  <div class="launcher-root" :class="{ 'is-mac': isMac }">
    <div class="background-blobs">
      <div class="blob blob-1" />
      <div class="blob blob-2" />
      <div class="blob blob-3" />
    </div>

    <!-- 无边框窗口拖拽区域（窗口顶部） -->
    <div class="drag-region-top" data-tauri-drag-region />

    <!-- Windows / Linux：自绘右上角关闭按钮（macOS 用系统交通灯） -->
    <button
      v-if="!isMac"
      class="window-close-btn"
      type="button"
      aria-label="Close"
      @click="closeLauncherWindow"
    >
      ✕
    </button>

    <main class="launcher-container">
      <div class="glass-card">
        <div class="logo-section">
          <div class="app-icon">
            <svg viewBox="0 0 100 100" class="browser-svg">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect x="10" y="20" width="80" height="60" rx="12" fill="url(#grad)" />
              <rect x="15" y="35" width="70" height="40" rx="4" fill="white" fill-opacity="0.2" />
              <circle cx="25" cy="27" r="2.5" fill="white" />
              <circle cx="35" cy="27" r="2.5" fill="white" />
              <circle cx="45" cy="27" r="2.5" fill="white" />
            </svg>
          </div>
          <h1>Roxy Browser</h1>
        </div>

        <div class="status-section">
          <div class="status-header">
            <span class="status-text">{{ launchBrowserMessage.message }}</span>
            <span class="percent-text">{{ launchBrowserMessage.percent.toFixed(0) }}%</span>
          </div>

          <div class="progress-wrapper">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressWidth }">
                <div class="progress-glow" />
              </div>
            </div>
          </div>

          <div v-if="launchBrowserMessage.warningMessages.length > 0" class="warning-area">
            <div v-for="(msg, idx) in launchBrowserMessage.warningMessages" :key="idx" class="warning-item">
              <span class="warning-icon">⚠️</span>
              {{ msg }}
            </div>
          </div>
        </div>

        <!-- <div class="footer-note">
          正在为您准备最佳的浏览环境
        </div> -->
      </div>
    </main>
  </div>
</template>

  <style>
  :root {
  --primary: #6366f1;
  --secondary: #a855f7;
  --bg-dark: #0f172a;
  --glass: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.1);
  --text-main: #f8fafc;
  --text-dim: #94a3b8;
}

body {
  margin: 0;
  padding: 0;
  /* 窗口透明（Tauri macOSPrivateApi + transparent）时，必须让 body 透明，圆角外侧才能透出桌面 */
  background: transparent;
  color: var(--text-main);
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  user-select: none;
  -webkit-user-select: none;
}

#app {
  height: 100%;
}

.launcher-root {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg-dark);
}

/* Background Blobs */
.background-blobs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 0;
}

.blob {
  position: absolute;
  filter: blur(80px);
  border-radius: 50%;
  opacity: 0.4;
  animation: move 20s infinite alternate;
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: var(--primary);
  top: -100px;
  left: -100px;
}

.blob-2 {
  width: 350px;
  height: 350px;
  background: var(--secondary);
  bottom: -50px;
  right: -50px;
  animation-delay: -5s;
}

.blob-3 {
  width: 300px;
  height: 300px;
  background: #3b82f6;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -10s;
}

@keyframes move {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(50px, 50px) scale(1.1);
  }
}

/* Launcher Container */
.launcher-container {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
}

.glass-card {
  position: relative;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  padding: 40px 40px 30px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
}

.drag-region-top {
  position: absolute;
  top: 0;
  /* 避开 macOS 左上角系统交通灯区域，避免遮挡点击/悬浮触发 */
  left: 0;
  right: 60px;
  height: 44px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  z-index: 30;
}

.is-mac {
  .drag-region-top {
    left: 60px;
    right: 0;
  }
}

.drag-region-top:active {
  cursor: grabbing;
}

.window-close-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 36px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  z-index: 40;
  /* 避免被拖拽区域影响点击 */
  -webkit-app-region: no-drag;
}

.window-close-btn:hover {
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
}

.window-close-btn:active {
  transform: translateY(1px);
}

.fade-out {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
}

.app-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.4));
}

.browser-svg {
  width: 100%;
  height: 100%;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.02em;
}

/* Status Section */
.status-section {
  margin-bottom: 30px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}

.status-text {
  font-size: 15px;
  color: var(--text-main);
  font-weight: 500;
}

.percent-text {
  font-size: 14px;
  color: var(--text-dim);
  font-family: 'JetBrains Mono', monospace;
}

.progress-wrapper {
  position: relative;
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  width: 100%;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  transition: width 0.4s cubic-bezier(0.1, 0.7, 1, 0.1);
  position: relative;
}

.progress-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 100%;
  background: white;
  filter: blur(5px);
  opacity: 0.5;
}

.warning-area {
  margin-top: 20px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.warning-item {
  font-size: 13px;
  color: #fbbf24;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning-item:last-child {
  margin-bottom: 0;
}

.footer-note {
  font-size: 13px;
  color: var(--text-dim);
  text-align: center;
  opacity: 0.8;
}
</style>
