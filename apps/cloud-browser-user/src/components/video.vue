<script setup lang="ts">
import ResizeObserver from 'resize-observer-polyfill'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '~/plugins/i18n'
import { logger } from '~/plugins/log'
import { getClient } from '~/runtime/client'
import { useRemoteStore, useSessionStore, useSettingsStore, useUserStore, useVideoStore } from '~/store'
// @ts-expect-error legacy helper ships without modern typings
import GuacamoleKeyboard from '~/utils/guacamole-keyboard.ts'

const MAC_OS_KEYBOARD_PATTERN = /Mac|iPhone|iPod|iPad/i
// 与 neko 官方实现保持一致：首个 wheel 事件立即发送，100ms 内丢弃后续事件。
// 过短的节流会导致滚轮每秒发送过多 delta（触控板可达 60 事件/s），累计增量过大，
// 用户反馈「轻轻一滚就飘到底」，同时因为 delta 是丢弃不累加，轨迹跳跃、不跟手。
const WHEEL_THROTTLE_MS = 100
const WHEEL_LINE_HEIGHT = 19
const PASTE_SHORTCUT_KEY_PATTERN = /^v$/i
const INSERT_KEY = 'Insert'

interface PointerPosition {
  x: number
  y: number
}

const client = getClient()
const sessionStore = useSessionStore()
const remoteStore = useRemoteStore()
const settingsStore = useSettingsStore()
const userStore = useUserStore()
const videoStore = useVideoStore()

const component = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const overlay = ref<HTMLTextAreaElement | null>(null)
const aspect = ref<HTMLElement | null>(null)
const player = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const countdownInterval = ref<number | null>(null)
const now = ref(Date.now())

const keyboard = GuacamoleKeyboard()
const observer = new ResizeObserver(() => onResize())

const focused = ref(false)
const mutedOverlay = ref(true)
const lastTextAreaValue = ref('')
const wheelThrottle = ref(false)
const wheelThrottleResetTimer = ref<number | null>(null)
// mousemove 用 requestAnimationFrame 折叠到 ~60Hz：DOM mousemove 在高 DPI 鼠标/触控板
// 上可达 200~1000 次/秒，而数据通道是默认的 ordered + reliable，任何包延迟/重传都会
// 把后续 mousemove 堵在队列里，体感就是「鼠标不跟手、画面指针拖在真实鼠标后面」。
// 只保留每帧最后一次坐标即可：旧位置是垃圾，覆盖比排队更跟手。
const pendingMouseMoveEvent = ref<MouseEvent | null>(null)
const mouseMoveRafId = ref<number | null>(null)
const lastSentMouseX = ref<number | null>(null)
const lastSentMouseY = ref<number | null>(null)
const isMouseDown = ref(false)
const reqMouseDown = ref<MouseEvent | null>(null)
const reqMouseUp = ref<MouseEvent | null>(null)
// 节流窗口内被丢弃的 wheel 增量：在窗口结束时补发，避免快速滚动丢失位移
const pendingWheelDeltaX = ref(0)
const pendingWheelDeltaY = ref(0)
const videoReady = ref(false)

const controlling = computed(() => remoteStore.controlling)
const hosting = computed(() => remoteStore.hosting)
const implicitHosting = computed(() => remoteStore.implicitHosting)
const connecting = computed(() => sessionStore.connecting)
const reconnecting = computed(() => sessionStore.reconnecting)
const connected = computed(() => sessionStore.connected)
const volume = computed(() => videoStore.volume)
const muted = computed(() => videoStore.muted)
const stream = computed(() => videoStore.stream)
const playing = computed(() => videoStore.playing)
const playable = computed(() => videoStore.playable)
const autoplay = computed(() => settingsStore.autoplay)
const controlLocked = computed(() => sessionStore.isLocked('control') && !userStore.admin)
const locked = computed(() => remoteStore.locked || (controlLocked.value && (!hosting.value || implicitHosting.value)))
const scroll = computed(() => settingsStore.scroll)
const scrollInvert = computed(() => settingsStore.scroll_invert)
const width = computed(() => videoStore.width)
const height = computed(() => videoStore.height)
const vertical = computed(() => videoStore.vertical)
const horizontal = computed(() => videoStore.horizontal)
// WebRTC 首帧就绪前保持 loading，避免用户只看到黑屏。
const showLoadingOverlay = computed(() => reconnecting.value || connecting.value || (connected.value && !videoReady.value))
const loadingText = computed(() => {
  if (reconnecting.value) {
    return t('connection.reconnecting')
  }

  if (connecting.value) {
    return t('connection.connecting_video')
  }

  return t('connection.loading_video')
})
const showRemainingTime = computed(() => sessionStore.usageExpiresAt > 0)
// 固定为 HH:MM:SS，并配合 tabular-nums 与最小字符宽度，避免倒计时跳动。
const remainingUsageText = computed(() => {
  const remainingMs = Math.max(0, sessionStore.usageExpiresAt - now.value)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const paddedHours = String(hours).padStart(2, '0')
  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(seconds).padStart(2, '0')

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`
})
const remainingUsageLabel = computed(() => t('connection.remaining_time_label'))
const isTouchDevice = computed(
  () => ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches,
)

function onVolumeChanged(nextVolume: number) {
  if (video.value && video.value.volume !== nextVolume / 100) {
    video.value.volume = nextVolume / 100
  }
}

function onMutedChanged(nextMuted: boolean) {
  if (video.value && video.value.muted !== nextMuted) {
    video.value.muted = nextMuted
    if (!nextMuted) {
      mutedOverlay.value = false
    }
  }
}

function onStreamChanged(nextStream?: MediaStream) {
  // 新的视频轨道到来后先回到 loading，等首帧真正可见再切回交互态。
  videoReady.value = false
  videoStore.setPlayable(false)

  if (!video.value) {
    return
  }

  if (!nextStream) {
    video.value.pause()
    video.value.srcObject = null
    return
  }

  if (video.value.srcObject !== nextStream) {
    video.value.srcObject = nextStream
  }
}

async function onPlayingChanged(nextPlaying: boolean) {
  if (video.value && video.value.paused && nextPlaying) {
    try {
      await video.value.play()
    }
    catch (error) {
      if (video.value && !video.value.muted) {
        try {
          videoStore.setMuted(true)
          video.value.muted = true
          await video.value.play()
        }
        catch {
          videoStore.pause()
        }
      }
      else {
        videoStore.pause()
      }
    }
  }

  if (video.value && !video.value.paused && !nextPlaying) {
    pause()
  }
}

function hasMacOSKeyboard() {
  return MAC_OS_KEYBOARD_PATTERN.test(navigator.platform)
}

const keyTable = {
  XK_ISO_Level3_Shift: 0xFE03,
  XK_Mode_switch: 0xFF7E,
  XK_Control_L: 0xFFE3,
  XK_Control_R: 0xFFE4,
  XK_Meta_L: 0xFFE7,
  XK_Meta_R: 0xFFE8,
  XK_Alt_L: 0xFFE9,
  XK_Alt_R: 0xFFEA,
  XK_Super_L: 0xFFEB,
  XK_Super_R: 0xFFEC,
}

function keyMap(key: number) {
  if (hasMacOSKeyboard()) {
    switch (key) {
      case keyTable.XK_Meta_L:
        return keyTable.XK_Control_L
      case keyTable.XK_Super_L:
        return keyTable.XK_Alt_L
      case keyTable.XK_Super_R:
        return keyTable.XK_Super_L
      case keyTable.XK_Alt_L:
        return keyTable.XK_Mode_switch
      case keyTable.XK_Alt_R:
        return keyTable.XK_ISO_Level3_Shift
      default:
        return key
    }
  }

  return key
}

function canSyncClipboard() {
  return hosting.value && !locked.value
}

function isPasteShortcut(event: KeyboardEvent) {
  if (!event.altKey && (event.metaKey || event.ctrlKey)) {
    return PASTE_SHORTCUT_KEY_PATTERN.test(event.key) || event.code === 'KeyV'
  }

  if (!event.altKey && !event.metaKey && !event.ctrlKey && event.shiftKey) {
    return event.key === INSERT_KEY || event.code === 'Insert'
  }

  return false
}

function getClipboardText(event: ClipboardEvent): string | null {
  if (!event.clipboardData) {
    return null
  }

  const plainText = event.clipboardData.getData('text/plain')
  if (plainText !== '') {
    return plainText
  }

  const legacyText = event.clipboardData.getData('text')
  return legacyText !== '' ? legacyText : ''
}

async function hasGrantedClipboardReadPermission() {
  if (!navigator.clipboard?.readText || !navigator.permissions?.query) {
    return false
  }

  try {
    const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
    return permission.state === 'granted'
  }
  catch {
    return false
  }
}

async function readLocalClipboardText(logFailures = false): Promise<string | null> {
  if (!navigator.clipboard?.readText) {
    if (logFailures) {
      logger.warn('browser clipboard read API is unavailable')
    }
    return null
  }

  try {
    return await navigator.clipboard.readText()
  }
  catch (error) {
    if (logFailures) {
      logger.warn('failed to read local clipboard for remote sync', error)
    }
    return null
  }
}

async function syncLocalClipboardToRemote(
  preferredText?: string,
  { logFailures = false, requireGrantedPermission = false }: { logFailures?: boolean, requireGrantedPermission?: boolean } = {},
) {
  if (!canSyncClipboard()) {
    return
  }

  const nextClipboard = typeof preferredText === 'string'
    ? preferredText
    : await (async () => {
        if (requireGrantedPermission && !(await hasGrantedClipboardReadPermission())) {
          return null
        }

        return readLocalClipboardText(logFailures)
      })()

  if (nextClipboard === null || typeof nextClipboard === 'undefined') {
    return
  }

  remoteStore.syncClipboard(nextClipboard)
}

function onOverlayKeyDown(event: KeyboardEvent) {
  if (event.repeat || !isPasteShortcut(event)) {
    return
  }

  void syncLocalClipboardToRemote(undefined, { logFailures: true })
}

function onPaste(event: ClipboardEvent) {
  const text = getClipboardText(event)
  if (text !== null) {
    void syncLocalClipboardToRemote(text, { logFailures: true })
    return
  }

  void syncLocalClipboardToRemote(undefined, { logFailures: true })
}

function pause() {
  if (!video.value || video.value.paused || !playable.value) {
    return
  }

  video.value.pause()
}

function playAndUnmute() {
  videoStore.play()
  videoStore.setMuted(false)
}

function unmute() {
  videoStore.setMuted(false)
}

function getPointerPosition(event: MouseEvent): PointerPosition | null {
  if (!overlay.value) {
    return null
  }

  const { w, h } = videoStore.resolution
  const rect = overlay.value.getBoundingClientRect()

  return {
    x: Math.round((w / rect.width) * (event.clientX - rect.left)),
    y: Math.round((h / rect.height) * (event.clientY - rect.top)),
  }
}

function sendMousePos(position: PointerPosition) {
  // 同一坐标重复发送只会浪费数据通道带宽并加剧 head-of-line blocking。
  if (lastSentMouseX.value === position.x && lastSentMouseY.value === position.y) {
    return
  }

  lastSentMouseX.value = position.x
  lastSentMouseY.value = position.y
  client.sendData('mousemove', position)
}

function sendMousePosImmediate(event: MouseEvent) {
  const position = getPointerPosition(event)
  if (!position) {
    return
  }

  sendMousePos(position)
}

function cancelPendingMouseMove() {
  if (mouseMoveRafId.value !== null) {
    cancelAnimationFrame(mouseMoveRafId.value)
    mouseMoveRafId.value = null
  }
  pendingMouseMoveEvent.value = null
}

function flushPendingMouseMove() {
  mouseMoveRafId.value = null
  const event = pendingMouseMoveEvent.value
  pendingMouseMoveEvent.value = null

  if (!event || !hosting.value || locked.value) {
    return
  }

  sendMousePosImmediate(event)
}

function onWheel(event: WheelEvent) {
  if (!hosting.value || locked.value) {
    return
  }

  let x = event.deltaX
  let y = event.deltaY

  if (event.deltaMode !== 0) {
    x *= WHEEL_LINE_HEIGHT
    y *= WHEEL_LINE_HEIGHT
  }

  if (scrollInvert.value) {
    x *= -1
    y *= -1
  }

  x = Math.min(Math.max(x, -scroll.value), scroll.value)
  y = Math.min(Math.max(y, -scroll.value), scroll.value)

  sendMousePosImmediate(event)

  if (!wheelThrottle.value) {
    // 第一个事件：立即发送，启动节流窗口
    wheelThrottle.value = true
    pendingWheelDeltaX.value = 0
    pendingWheelDeltaY.value = 0
    client.sendData('wheel', { x, y })

    wheelThrottleResetTimer.value = window.setTimeout(() => {
      wheelThrottleResetTimer.value = null
      wheelThrottle.value = false
      // 补发窗口内累积的增量，避免快速滚动被整段丢弃导致"滚了但没到位"
      const accX = pendingWheelDeltaX.value
      const accY = pendingWheelDeltaY.value
      pendingWheelDeltaX.value = 0
      pendingWheelDeltaY.value = 0
      if ((accX !== 0 || accY !== 0) && hosting.value && !locked.value) {
        client.sendData('wheel', {
          x: Math.min(Math.max(Math.round(accX), -scroll.value), scroll.value),
          y: Math.min(Math.max(Math.round(accY), -scroll.value), scroll.value),
        })
      }
    }, WHEEL_THROTTLE_MS)
  }
  else {
    // 窗口内的后续事件：只累积，窗口到期时统一补发
    pendingWheelDeltaX.value += x
    pendingWheelDeltaY.value += y
  }
}

function onTouchHandler(event: TouchEvent) {
  const first = event.changedTouches[0]
  let type = ''

  switch (event.type) {
    case 'touchstart':
      type = 'mousedown'
      break
    case 'touchmove':
      type = 'mousemove'
      break
    case 'touchend':
      type = 'mouseup'
      break
    default:
      return
  }

  const simulatedEvent = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    screenX: first.screenX,
    screenY: first.screenY,
    clientX: first.clientX,
    clientY: first.clientY,
  })

  first.target?.dispatchEvent(simulatedEvent)
}

function onCompositionStartHandler() {
  lastTextAreaValue.value = overlay.value?.value ?? ''
}

function onCompositionEndHandler() {
  if (overlay.value) {
    overlay.value.value = lastTextAreaValue.value
  }
}

function implicitHostingRequest(event: MouseEvent) {
  if (implicitHosting.value) {
    if (event.type === 'mousedown') {
      reqMouseDown.value = event
      reqMouseUp.value = null
      remoteStore.request()
    }
    else if (event.type === 'mouseup') {
      reqMouseUp.value = event
    }
  }
}

function onMouseDown(event: MouseEvent) {
  isMouseDown.value = true

  if (locked.value) {
    return
  }

  void syncLocalClipboardToRemote(undefined, { requireGrantedPermission: true })

  if (!controlling.value) {
    implicitHostingRequest(event)
    return
  }

  // 取消挂起的 mousemove，否则点击后下一帧 RAF 还会发出旧坐标，覆盖刚才的精确落点。
  cancelPendingMouseMove()
  sendMousePosImmediate(event)
  client.sendData('mousedown', { key: event.button + 1 })
}

function onMouseUp(event: MouseEvent) {
  if (!isMouseDown.value) {
    return
  }

  isMouseDown.value = false

  if (locked.value) {
    return
  }

  if (!controlling.value) {
    implicitHostingRequest(event)
    return
  }

  cancelPendingMouseMove()
  sendMousePosImmediate(event)
  client.sendData('mouseup', { key: event.button + 1 })
}

function onControlChange(nextControlling: boolean) {
  if (nextControlling && reqMouseDown.value) {
    onMouseDown(reqMouseDown.value)
  }

  if (nextControlling && reqMouseUp.value) {
    onMouseUp(reqMouseUp.value)
  }

  reqMouseDown.value = null
  reqMouseUp.value = null
}

function onMouseMove(event: MouseEvent) {
  if (!hosting.value || locked.value) {
    return
  }

  // 仅记录最新事件，下一帧 RAF 触发时再发送；高频 mousemove 会被折叠为每帧 1 次，
  // 旧位置直接被覆盖丢弃，避免在 ordered/reliable 数据通道上排队等重传。
  pendingMouseMoveEvent.value = event
  if (mouseMoveRafId.value === null) {
    mouseMoveRafId.value = requestAnimationFrame(flushPendingMouseMove)
  }
}

function onMouseEnter(event: MouseEvent) {
  if (hosting.value) {
    remoteStore.syncKeyboardModifierState({
      capsLock: event.getModifierState('CapsLock'),
      numLock: event.getModifierState('NumLock'),
      scrollLock: event.getModifierState('ScrollLock'),
    })
  }

  focused.value = true
}

function onMouseLeave(event: MouseEvent) {
  if (hosting.value) {
    remoteStore.setKeyboardModifierState({
      capsLock: event.getModifierState('CapsLock'),
      numLock: event.getModifierState('NumLock'),
      scrollLock: event.getModifierState('ScrollLock'),
    })
  }

  cancelPendingMouseMove()
  keyboard.reset()
  focused.value = false
}

function onResize() {
  if (!component.value || !player.value || !container.value || !aspect.value) {
    return
  }

  const { offsetWidth, offsetHeight } = component.value
  player.value.style.width = `${offsetWidth}px`
  player.value.style.height = `${offsetHeight}px`
  container.value.style.maxWidth = `${(horizontal.value / vertical.value) * offsetHeight}px`
  aspect.value.style.paddingBottom = `${(vertical.value / horizontal.value) * 100}%`
}

function onFocus() {
  if (isTouchDevice.value) {
    return
  }

  if (focused.value && hosting.value && !locked.value) {
    overlay.value?.focus()
  }
}

function handleCanPlaythrough() {
  videoReady.value = true
  videoStore.setPlayable(true)
  if (autoplay.value) {
    void nextTick(() => {
      videoStore.play()
    })
  }
}

function handleLoadedData() {
  videoReady.value = true
}

function handleEnded() {
  videoReady.value = false
  videoStore.setPlayable(false)
}

function handleError(event: Event) {
  logger.error((event as ErrorEvent).error ?? new Error('Video playback error'))
  videoReady.value = false
  videoStore.setPlayable(false)
}

function handleVolumeChange() {
  if (!video.value) {
    return
  }

  videoStore.setMuted(video.value.muted)
  videoStore.setVolume(video.value.volume * 100)
}

function handlePlaying() {
  videoStore.play()
}

function handlePause() {
  videoStore.pause()
}

watch(width, onResize)
watch(height, onResize)
watch(volume, onVolumeChanged, { immediate: true })
watch(muted, onMutedChanged, { immediate: true })
watch(stream, onStreamChanged, { immediate: true })
watch(playing, onPlayingChanged)
watch(controlling, onControlChange)
watch([focused, hosting, locked], onFocus)

onMounted(() => {
  if (!component.value || !container.value || !overlay.value || !video.value) {
    return
  }

  countdownInterval.value = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)

  container.value.addEventListener('resize', onResize)
  onVolumeChanged(volume.value)
  onMutedChanged(muted.value)
  onStreamChanged(stream.value)
  onResize()
  observer.observe(component.value)

  video.value.addEventListener('canplaythrough', handleCanPlaythrough)
  video.value.addEventListener('loadeddata', handleLoadedData)
  video.value.addEventListener('ended', handleEnded)
  video.value.addEventListener('error', handleError)
  video.value.addEventListener('volumechange', handleVolumeChange)
  video.value.addEventListener('playing', handlePlaying)
  video.value.addEventListener('pause', handlePause)

  keyboard.onkeydown = (key: number) => {
    if (!hosting.value || locked.value) {
      return true
    }

    client.sendData('keydown', { key: keyMap(key) })
    return false
  }

  keyboard.onkeyup = (key: number) => {
    if (!hosting.value || locked.value) {
      return
    }

    client.sendData('keyup', { key: keyMap(key) })
  }

  keyboard.listenTo(overlay.value)
})

onBeforeUnmount(() => {
  observer.disconnect()
  videoReady.value = false
  videoStore.setPlayable(false)

  if (wheelThrottleResetTimer.value !== null) {
    clearTimeout(wheelThrottleResetTimer.value)
    wheelThrottleResetTimer.value = null
  }

  wheelThrottle.value = false
  pendingWheelDeltaX.value = 0
  pendingWheelDeltaY.value = 0

  cancelPendingMouseMove()
  lastSentMouseX.value = null
  lastSentMouseY.value = null

  if (countdownInterval.value !== null) {
    clearInterval(countdownInterval.value)
    countdownInterval.value = null
  }

  if (container.value) {
    container.value.removeEventListener('resize', onResize)
  }

  if (video.value) {
    video.value.removeEventListener('canplaythrough', handleCanPlaythrough)
    video.value.removeEventListener('loadeddata', handleLoadedData)
    video.value.removeEventListener('ended', handleEnded)
    video.value.removeEventListener('error', handleError)
    video.value.removeEventListener('volumechange', handleVolumeChange)
    video.value.removeEventListener('playing', handlePlaying)
    video.value.removeEventListener('pause', handlePause)
  }
})
</script>

<template>
  <div ref="component" class="video">
    <div ref="player" class="player">
      <div ref="container" class="player-container">
        <video ref="video" playsinline />
        <div v-if="showRemainingTime" class="session-remaining-time" aria-live="polite">
          <span class="session-remaining-time-label">{{ remainingUsageLabel }}</span>
          <span class="session-remaining-time-value">{{ remainingUsageText }}</span>
        </div>
        <textarea
          ref="overlay"
          class="overlay"
          spellcheck="false"
          tabindex="0"
          data-gramm="false"
          :style="{ pointerEvents: hosting ? 'auto' : 'none' }"
          @click.stop.prevent
          @contextmenu.stop.prevent
          @keydown.capture="onOverlayKeyDown"
          @paste="onPaste"
          @wheel.stop.prevent="onWheel"
          @mousemove.stop.prevent="onMouseMove"
          @mousedown.stop.prevent="onMouseDown"
          @mouseup.stop.prevent="onMouseUp"
          @mouseenter.stop.prevent="onMouseEnter"
          @mouseleave.stop.prevent="onMouseLeave"
          @touchmove.stop.prevent="onTouchHandler"
          @touchstart.stop.prevent="onTouchHandler"
          @touchend.stop.prevent="onTouchHandler"
          @compositionstart="onCompositionStartHandler"
          @compositionend="onCompositionEndHandler"
        />
        <div v-if="showLoadingOverlay" class="player-overlay player-overlay-loading" aria-live="polite">
          <div class="loading-indicator">
            <span class="loading-spinner" />
            <span class="loading-text">{{ loadingText }}</span>
          </div>
        </div>
        <div v-else-if="!playing && playable" class="player-overlay" @click.stop.prevent="playAndUnmute">
          <!-- <i class="fas fa-play-circle" /> -->
        </div>
        <div v-else-if="mutedOverlay && muted" class="player-overlay" @click.stop.prevent="unmute">
          <!-- <i class="fas fa-volume-up" /> -->
        </div>
        <div ref="aspect" class="player-aspect" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .video {
  width: 100%;
  height: 100%;

  .player {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #000;

    .player-container {
      position: relative;
      width: 100%;
      max-width: calc(16 / 9 * 100vh);

      video {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        display: flex;
        background: #000;

        &::-webkit-media-controls {
          display: none !important;
        }
      }

      .player-overlay,
      .overlay {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
      }

      .player-overlay {
        background: rgba($color: #000, $alpha: 0.2);
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;

        i::before {
          font-size: 120px;
          text-align: center;
        }

        &.hidden {
          display: none;
        }
      }

      .player-overlay-loading {
        cursor: progress;
        background: rgba($color: #000, $alpha: 0.6);

        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          color: #fff;
        }

        .loading-spinner {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          animation: video-loading-spin 0.9s linear infinite;
        }

        .loading-text {
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0.02em;
        }
      }

      .session-remaining-time {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(8px);
        color: #fff;
        font-size: 13px;
        line-height: 18px;
        letter-spacing: 0.02em;
        pointer-events: none;
        white-space: nowrap;
      }

      .session-remaining-time-value {
        display: inline-block;
        min-width: 8ch;
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-feature-settings: 'tnum';
      }

      .overlay {
        cursor: default;
        outline: 0;
        border: 0;
        color: transparent;
        background: transparent;
        resize: none;
      }

      .player-aspect {
        display: block;
        padding-bottom: 56.25%;
      }
    }
  }
}

@keyframes video-loading-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
