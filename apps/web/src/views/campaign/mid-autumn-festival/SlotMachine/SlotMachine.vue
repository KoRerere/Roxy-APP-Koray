<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { AnimatePresence, motion, useMotionValue } from 'motion-v'

const emit = defineEmits(['stopped'])
// Must stay in sync with $item-h in <style>
const ITEM_HEIGHT = 88
const EMOJIS = ['💰', '🍒', '🍋', '🍊', '⭐', '💎']
const STRIP_REPEAT = 12
const E = EMOJIS.length
const CYCLE = E * ITEM_HEIGHT
const SPIN_SPEED = 800
const START_DELAY_STEP = 150
const STOP_DELAY_STEP = 250
const STOP_MIN_CYCLES = 0.9
const STOP_CYCLE_STEP = 0.3
const MID_REPEAT = Math.floor(STRIP_REPEAT / 2)
const RENDER_BASE_Y = -MID_REPEAT * CYCLE

const strip = Array.from({ length: STRIP_REPEAT }, () => [...EMOJIS]).flat()

const y0 = useMotionValue(RENDER_BASE_Y)
const y1 = useMotionValue(RENDER_BASE_Y)
const y2 = useMotionValue(RENDER_BASE_Y)
const yValues = [y0, y1, y2]

const gameState = ref('idle')
const resultState = ref(null)
const timers = []
const stopMeta = {
  win: false,
  completed: 0,
}

const reels = yValues.map(y => ({
  y,
  rawY: 0,
  phase: 'idle',
  velocity: SPIN_SPEED,
  rafId: null,
  stopStartRaw: 0,
  stopStartedAt: 0,
  stopInitialVelocity: SPIN_SPEED,
  stopDeceleration: 0,
  stopDuration: 0,
  stopTarget: 0,
}))

// const canStart = computed(
//   () => gameState.value === 'idle' || gameState.value === 'stopped',
// )
// const isActive = computed(
//   () => gameState.value === 'spinning' || gameState.value === 'stopping',
// )

function wrapCycle(value) {
  return ((value % CYCLE) + CYCLE) % CYCLE
}

function syncReelPosition(reel) {
  reel.y.set(RENDER_BASE_Y + wrapCycle(reel.rawY))
}

// Compute the next aligned stop position ahead of the current motion so the
/**
 * reel can keep moving forward and decelerate naturally into place.
 */
function computeStopTarget(rawY, eIdx, minCyclesAhead) {
  const base = (1 - eIdx) * ITEM_HEIGHT
  const minDistance = minCyclesAhead * CYCLE
  const minTarget = rawY + minDistance
  const cyclesAhead = Math.ceil((minTarget - base) / CYCLE)

  return base + cyclesAhead * CYCLE
}

function computeLoseTargets() {
  let indices
  do {
    indices = [0, 1, 2].map(() => Math.floor(Math.random() * E))
  } while (indices.every(i => i === 0))
  return indices
}

function clearTimers() {
  timers.forEach(clearTimeout)
  timers.length = 0
}

function stopLoop(idx) {
  const reel = reels[idx]

  if (reel.rafId) {
    cancelAnimationFrame(reel.rafId)
    reel.rafId = null
  }
}

function finishReelStop(idx) {
  const reel = reels[idx]

  reel.phase = 'stopped'
  reel.velocity = 0
  reel.rawY = wrapCycle(reel.stopTarget)
  syncReelPosition(reel)
  stopLoop(idx)

  stopMeta.completed += 1
  if (stopMeta.completed === reels.length)
    onAllStopped(stopMeta.win)
}

function runReelLoop(idx) {
  const reel = reels[idx]
  let last = performance.now()

  function frame(now) {
    const dt = (now - last) / 1000
    last = now

    if (reel.phase === 'spinning') {
      reel.rawY += reel.velocity * dt
      syncReelPosition(reel)
      reel.rafId = requestAnimationFrame(frame)
      return
    }

    if (reel.phase === 'stopping') {
      const elapsed = (now - reel.stopStartedAt) / 1000
      const clamped = Math.min(elapsed, reel.stopDuration)

      reel.rawY
        = reel.stopStartRaw
          + reel.stopInitialVelocity * clamped
          - 0.5 * reel.stopDeceleration * clamped * clamped
      reel.velocity = Math.max(
        reel.stopInitialVelocity - reel.stopDeceleration * clamped,
        0,
      )
      syncReelPosition(reel)

      if (clamped >= reel.stopDuration) {
        finishReelStop(idx)
        return
      }

      reel.rafId = requestAnimationFrame(frame)
      return
    }

    stopLoop(idx)
  }

  stopLoop(idx)
  reel.rafId = requestAnimationFrame(frame)
}

function startReelSpin(idx) {
  const reel = reels[idx]

  reel.phase = 'spinning'
  reel.velocity = SPIN_SPEED
  runReelLoop(idx)
}

function beginReelStop(idx, eIdx) {
  const reel = reels[idx]

  if (reel.phase !== 'spinning')
    return

  const minCyclesAhead = STOP_MIN_CYCLES + idx * STOP_CYCLE_STEP
  const target = computeStopTarget(reel.rawY, eIdx, minCyclesAhead)
  const distance = target - reel.rawY
  const duration = (2 * distance) / SPIN_SPEED

  reel.phase = 'stopping'
  reel.stopStartRaw = reel.rawY
  reel.stopStartedAt = performance.now()
  reel.stopInitialVelocity = SPIN_SPEED
  reel.stopTarget = target
  reel.stopDuration = duration
  reel.stopDeceleration = SPIN_SPEED / duration
}

function startSpin() {
  clearTimers()
  reels.forEach((_, idx) => stopLoop(idx))

  stopMeta.completed = 0
  resultState.value = null
  gameState.value = 'spinning'

  reels.forEach((_, idx) => {
    timers.push(setTimeout(startReelSpin, idx * START_DELAY_STEP, idx))
  })
}

function triggerStop(win) {
  if (gameState.value !== 'spinning')
    return
  gameState.value = 'stopping'
  clearTimers()

  const emojiIndices = win ? [0, 0, 0] : computeLoseTargets()

  stopMeta.win = win
  stopMeta.completed = 0

  reels.forEach((reel, idx) => {
    if (reel.phase === 'idle')
      startReelSpin(idx)
    timers.push(
      setTimeout(beginReelStop, idx * STOP_DELAY_STEP, idx, emojiIndices[idx]),
    )
  })
}

function onAllStopped(win) {
  gameState.value = 'stopped'
  resultState.value = win ? 'win' : 'lose'
  emit('stopped', win)
}

onUnmounted(() => {
  clearTimers()
  reels.forEach((_, idx) => stopLoop(idx))
})

defineExpose({
  /**
     * 是否中奖
     * @param state boolean
     */
  stop(state: boolean) {
    triggerStop(state)
  },
  /**
     * 开始抽奖
     */
  start() {
    startSpin()
  },
})
</script>

<template>
  <div class="slot-demo">
    <div class="slot-machine" :class="{ winning: resultState === 'win' }">
      <!-- Reels -->
      <div class="reels-area">
        <div class="win-line" />
        <div class="reels-row">
          <div class="reel-container">
            <motion.div class="reel-strip" :style="{ y: y0 }">
              <div
                v-for="(emoji, i) in strip"
                :key="`r0-${i}`"
                class="emoji-cell"
              >
                {{ emoji }}
              </div>
            </motion.div>
          </div>
          <div class="reel-container">
            <motion.div class="reel-strip" :style="{ y: y1 }">
              <div
                v-for="(emoji, i) in strip"
                :key="`r1-${i}`"
                class="emoji-cell"
              >
                {{ emoji }}
              </div>
            </motion.div>
          </div>
          <div class="reel-container">
            <motion.div class="reel-strip" :style="{ y: y2 }">
              <div
                v-for="(emoji, i) in strip"
                :key="`r2-${i}`"
                class="emoji-cell"
              >
                {{ emoji }}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$gold: #f5c518;
$item-h: 88px; // must match ITEM_HEIGHT in <script>
.slot-machine {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  border-radius: 24px;
  transition: box-shadow 0.5s ease;
  min-width: 360px;

  &.winning {
    box-shadow:
      0 0 60px rgba(245, 197, 24, 0.7),
      0 0 120px rgba(245, 197, 24, 0.3),
      inset 0 0 30px rgba(0, 0, 0, 0.4);
  }
}

.machine-title {
  font-size: 26px;
  font-weight: 800;
  color: $gold;
  letter-spacing: 3px;
  text-shadow: 0 0 20px rgba(245, 197, 24, 0.5);
  margin: 0;
  text-transform: uppercase;
}

.reels-area {
  position: relative;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-action);
  box-shadow: 0 0 12px 0 #c7ddec;
}

.reels-row {
  display: flex;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.reel-container {
  position: relative;
  width: 96px;
  height: $item-h * 3;
  overflow: hidden;
  background-image: url('/images/campaing/freedom/slotmachine_bg.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  border: 1.875px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.25) inset;
}

.reel-strip {
  display: flex;
  flex-direction: column;
  will-change: transform;
}

.emoji-cell {
  width: 96px;
  height: $item-h;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  user-select: none;
  flex-shrink: 0;
}

.feedback-area {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-badge {
  font-size: 20px;
  font-weight: 700;
  padding: 10px 24px;
  border-radius: 9999px;
  white-space: nowrap;
}

.win-badge {
  background: linear-gradient(90deg, $gold, #ff9800);
  color: #1a0d38;
  box-shadow: 0 0 24px rgba(245, 197, 24, 0.6);
}

.lose-badge {
  background: rgba(255, 255, 255, 0.07);
  color: #888;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-text {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 2px;
}

.controls {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn {
  font-size: 16px;
  font-weight: 700;
  padding: 12px 32px;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition:
    transform 0.1s,
    box-shadow 0.1s;

  &:hover {
    transform: translateY(-2px);
  }

  &:active {
    transform: scale(0.95);
  }
}

.btn-start {
  background: linear-gradient(90deg, $gold, #ff9800);
  color: #1a0d38;
  box-shadow: 0 4px 20px rgba(245, 197, 24, 0.4);
}

.btn-choices {
  display: flex;
  gap: 16px;
}

.btn-win {
  background: linear-gradient(90deg, #22c55e, #16a34a);
  color: #fff;
  box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
}

.btn-lose {
  background: linear-gradient(90deg, #ef4444, #dc2626);
  color: #fff;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
}
</style>
