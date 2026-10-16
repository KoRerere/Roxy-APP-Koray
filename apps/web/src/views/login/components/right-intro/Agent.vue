<script setup lang="tsx">
import { getImage } from '/@/utils/basic'
import { defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import type { VNode } from 'vue'
import { motion } from 'motion-v'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()
const isDark = computed(() => themeStore.realTheme === 'dark')

// 动画编排结构
interface SendTextItem {
  type: 'text'
  text: string
  duration: number
}

interface ReceiveRenderProps {
  currentTime: number
  /** 该段已结束、展示最终态时为 true，此时用 displayDuration 展示时长如 1.5s */
  isCompleted?: boolean
  displayDuration?: number
}

interface ReceiveRenderItem {
  type: 'planning' | 'tool_call' | 'thinking'
  duration: number
  render: (props?: ReceiveRenderProps) => VNode
}

interface ReceiveContentItem {
  type: 'content'
  duration: number
  text: string
  /** 可选：为内容容器添加自定义 class */
  class?: string
}

type ReceiveMessageItem = ReceiveRenderItem | ReceiveContentItem

const animate = [
  {
    type: 'send',
    message: [
      {
        text: 'Help me create a new browser profile, add a Singapore proxy, and then open Google.',
        type: 'text',
        duration: 1600,
      },
    ] as SendTextItem[],
  },
  {
    type: 'receive',
    /** 用户消息进入动画时长（ms），此段时间后才展示 AI 回复块并开始 receive 时间线 */
    entranceDelay: 400,
    message: [
      {
        type: 'content',
        duration: 800,
        text: 'I\'ll create a new window with a Singapore proxy and open Google for you.',
        class: 'bg-[var(--colors-background-bg-action-hover)] rounded-1.5 px-2.5 py-1.5 w-fit',
      },
      {
        type: 'planning',
        duration: 1500,
        render: (props: ReceiveRenderProps) => (
          <div class="flex items-center gap-1.5 text-3">
            {props.isCompleted && props.displayDuration != null
              ? (
                  <span class="flex items-center gap-1">
                    Planning
                    <span>
                      {props.displayDuration}
                      s
                    </span>
                  </span>
                )
              : (
                  <>
                    <span>Planning...</span>
                    <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" size="14" color="var(--colors-icon-icon-tertiary)" />
                  </>
                )}
          </div>
        ),
      },
      {
        type: 'tool_call',
        duration: 300,
        render: (props?: ReceiveRenderProps) => (
          <div class="max-w-70 bg-[var(--colors-background-bg-action-hover)] rounded-1.5 flex justify-between items-center px-2.5 py-1.5 text-3">
            <div class="flex items-center gap-1.5">
              <RxSvgIcon name="base/rx_ic_browser_hammer" />
              load_skills
            </div>
            {props?.isCompleted
              ? <RxSvgIcon name="base/rx_ic_check" color="var(--colors-icon-icon-success)" />
              : <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" size="14" color="var(--colors-icon-icon-tertiary)" />}
          </div>
        ),
      },
      {
        type: 'thinking',
        duration: 2300,
        render: (props: ReceiveRenderProps) => (
          <div class="flex items-center gap-1.5 text-3">
            {props.isCompleted && props.displayDuration != null
              ? (
                  <span class="flex items-center gap-1">
                    Thinking
                    <span>
                      {props.displayDuration}
                      s
                    </span>

                    <RxSvgIcon name="base/rx_ic_chevron_right" size="14" />
                  </span>
                )
              : (
                  <>
                    <span>Thinking...</span>
                    <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" size="14" color="var(--colors-icon-icon-tertiary)" />
                  </>
                )}
          </div>
        ),
      },
      {
        type: 'tool_call',
        duration: 2000,
        render: (props?: ReceiveRenderProps) => (
          <div class="max-w-70 bg-[var(--colors-background-bg-action-hover)] rounded-1.5 flex justify-between items-center px-2.5 py-1.5">
            <div class="flex items-center gap-1.5 text-3">
              <RxSvgIcon name="base/rx_ic_browser_hammer" />
              roxy_create_browser
            </div>
            {props?.isCompleted
              ? <RxSvgIcon name="base/rx_ic_check" color="var(--colors-icon-icon-success)" />
              : <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" size="14" color="var(--colors-icon-icon-tertiary)" />}
          </div>
        ),
      },
      {
        type: 'content',
        duration: 6000,
        text: 'I\'ve created a new browser window for you with a Singapore proxy. The window is ready with an isolated environment and fingerprint. Google is opening in that window now — you can start your session right away. Need another region or more proxies? Just ask.',
      },
    ] as ReceiveMessageItem[],
  },
]

// ---------- 播放状态 ----------
type Phase = 'idle' | 'send' | 'receive' | 'done'
const phase = ref<Phase>('idle')
const playbackStartTime = ref(0)
const receiveStartTime = ref(0)
let rafId: number | null = null

// send 阶段：输入框内逐词显示
const sendStep = animate[0]
const sendTextItem = sendStep.message[0] as SendTextItem
const sendWords = sendTextItem.text.split(/\s+/)
const sendDisplayedText = ref('')
/** 发送后的用户消息文案，用于在回复区第一条展示 */
const sentMessageText = ref('')
/** 输入完成后停顿时长（ms），再执行发送 */
const SEND_PAUSE_MS = 1200
/** 输入完成、开始停顿时的时间戳，用于停顿 1.2s 后再发送 */
let sendPauseStartTime: number | null = null

// receive 阶段：用户消息进入动画结束后才启动时间线
const receiveStep = animate[1] as { type: string, entranceDelay?: number, message: ReceiveMessageItem[] }
const receivePhaseEnterTime = ref(0)
const receiveTimelineStarted = ref(false)
const receiveCompletedNodes = ref<VNode[]>([])
const receiveCurrentIndex = ref(0)
const receiveCurrentVNode = ref<VNode | null>(null)
let startTimeout: ReturnType<typeof setTimeout> | null = null

function getReceiveSegmentEnd(index: number): number {
  let end = 0
  for (let i = 0; i <= index; i++)
    end += receiveStep.message[i].duration
  return end
}
function getReceiveSegmentStart(index: number): number {
  return index <= 0 ? 0 : getReceiveSegmentEnd(index - 1)
}
/** 时间格式化为保留 1 位小数，如 0.1、0.2、0.3 */
function formatTime(t: number): number {
  return Number(t.toFixed(1))
}

function tick() {
  const now = performance.now()
  if (phase.value === 'send') {
    const elapsed = now - playbackStartTime.value
    const duration = sendTextItem.duration
    if (sendPauseStartTime !== null) {
      // 输入已完成，处于停顿期；停顿够 1.2s 后再发送
      if (now - sendPauseStartTime >= SEND_PAUSE_MS) {
        sentMessageText.value = sendTextItem.text
        sendDisplayedText.value = ''
        phase.value = 'receive'
        receivePhaseEnterTime.value = performance.now()
        receiveStartTime.value = 0
        receiveTimelineStarted.value = false
        receiveCurrentIndex.value = 0
        sendPauseStartTime = null
      }
    }
    else if (elapsed >= duration) {
      // 刚输入完：保持全文显示，进入停顿
      sendDisplayedText.value = sendTextItem.text
      sendPauseStartTime = now
    }
    else {
      const progress = Math.min(1, elapsed / duration)
      const wordIndex = Math.floor(progress * sendWords.length)
      sendDisplayedText.value = sendWords.slice(0, wordIndex).join(' ')
      if (sendDisplayedText.value.length < sendTextItem.text.length && wordIndex === sendWords.length)
        sendDisplayedText.value = sendTextItem.text
    }
  }

  if (phase.value === 'receive') {
    const entranceDelay = receiveStep.entranceDelay ?? 400
    if (!receiveTimelineStarted.value) {
      if (now - receivePhaseEnterTime.value >= entranceDelay) {
        receiveStartTime.value = now
        receiveTimelineStarted.value = true
      }
    }
    if (!receiveTimelineStarted.value) {
      rafId = requestAnimationFrame(tick)
      return
    }
    const messages = receiveStep.message
    const receiveElapsed = now - receiveStartTime.value
    const totalDuration = messages.reduce((acc, m) => acc + m.duration, 0)

    if (receiveElapsed >= totalDuration) {
      // 结束前把尚未加入 completed 的段落（含最后一帧 content）都补进去，再停止
      while (receiveCurrentIndex.value < messages.length) {
        const seg = messages[receiveCurrentIndex.value]
        if (seg.type === 'content') {
          const contentClass = ['receive-content', seg.class].filter(Boolean).join(' ')
          receiveCompletedNodes.value = [...receiveCompletedNodes.value, h('div', { class: contentClass }, seg.text)]
        }
        else {
          const displayDuration = formatTime(seg.duration / 1000)
          receiveCompletedNodes.value = [...receiveCompletedNodes.value, (seg as ReceiveRenderItem).render({ currentTime: displayDuration, isCompleted: true, displayDuration })]
        }
        receiveCurrentIndex.value++
      }
      phase.value = 'done'
      receiveCurrentVNode.value = null
      rafId != null && cancelAnimationFrame(rafId)
      rafId = null
      return
    }

    // 可能连续跨多段结束，先补齐 completed
    while (receiveCurrentIndex.value < messages.length && receiveElapsed >= getReceiveSegmentEnd(receiveCurrentIndex.value)) {
      const seg = messages[receiveCurrentIndex.value]
      if (seg.type === 'content') {
        const contentClass = ['receive-content', seg.class].filter(Boolean).join(' ')
        receiveCompletedNodes.value = [...receiveCompletedNodes.value, h('div', { class: contentClass }, seg.text)]
      }
      else {
        const displayDuration = formatTime(seg.duration / 1000)
        receiveCompletedNodes.value = [...receiveCompletedNodes.value, (seg as ReceiveRenderItem).render({ currentTime: displayDuration, isCompleted: true, displayDuration })]
      }
      receiveCurrentIndex.value++
    }

    if (receiveCurrentIndex.value >= messages.length) {
      receiveCurrentVNode.value = null
      rafId != null && cancelAnimationFrame(rafId)
      rafId = null
      return
    }

    const seg = messages[receiveCurrentIndex.value]
    const segmentElapsed = receiveElapsed - getReceiveSegmentStart(receiveCurrentIndex.value)
    const segmentDuration = seg.duration

    if (seg.type === 'content') {
      const progress = Math.min(1, segmentElapsed / segmentDuration)
      const contentText = seg.text
      const len = Math.floor(progress * (contentText.length + 1))
      const contentClass = ['receive-content', seg.class].filter(Boolean).join(' ')
      receiveCurrentVNode.value = h('div', { class: contentClass }, contentText.slice(0, len))
    }
    else {
      const currentTime = formatTime(Math.min(segmentDuration / 1000, segmentElapsed / 1000))
      receiveCurrentVNode.value = (seg as ReceiveRenderItem).render({ currentTime, isCompleted: false })
    }
  }

  rafId = requestAnimationFrame(tick)
}

function startPlayback() {
  phase.value = 'send'
  playbackStartTime.value = performance.now()
  sendDisplayedText.value = ''
  sentMessageText.value = ''
  sendPauseStartTime = null
  receiveTimelineStarted.value = false
  receiveCompletedNodes.value = []
  receiveCurrentIndex.value = 0
  receiveCurrentVNode.value = null
  rafId = requestAnimationFrame(tick)
}

// 用于模板中渲染任意 VNode 的占位组件
const VNodeRenderer = defineComponent({
  props: { vnode: { type: [Object, null] as any, default: null } },
  setup(props) {
    return () => props.vnode ?? null
  },
})

onMounted(() => {
  startTimeout = setTimeout(startPlayback, 600)
})
onUnmounted(() => {
  if (startTimeout)
    clearTimeout(startTimeout)
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})

const agentBg = computed(() => isDark.value ? getImage('mcp/agent-bg-dark.png') : getImage('mcp/agent-bg.png'))
</script>

<template>
  <div class="flex flex-col justify-between h-120 w-160 rounded-4 relative overflow-hidden  left-1/2 -translate-x-1/2 top-134px p-5 color-[var(--colors-text-text-primary)] bg-[var(--colors-background-bg-page)]">
    <!-- 未发送时：展示标题 + 简介 + 标签，底部为输入框（含打字动画） -->
    <template v-if="phase === 'idle' || phase === 'send'">
      <img class="block  top-0 left-1/2 -translate-x-1/2 absolute z-0" :src="agentBg">

      <div class="py-2 flex justify-between items-center z-1 relative">
        <div class="text-4 font-600 font-[Archivo] color-[var(--colors-text-text-primary)]">
          Roxy AI Agent
        </div>
        <div class="flex items-center gap-5">
          <RxSvgIcon name="base/rx_ic_browser_dialog" />
          <RxSvgIcon name="base/rx_ic_clock_rotate" />
          <RxSvgIcon name="base/rx_ic_more-h" />
        </div>
      </div>

      <div class="py-6 z-1 relative">
        <div class="agent-title">
          {{ $t('欢迎使用 Roxy  ') }}
        </div>
        <p class="agent-desc mt-1.5">
          {{ $t('您可以尝试打开多个浏览器窗口，并为它们设置不同的项目、平台账号、代理 IP 等') }}
        </p>
        <div class="flex gap-2 items-center">
          <div v-for="item in [
            { text: $t('创建窗口'), icon: 'base/rx_ic_browser_add', color: 'var(--colors-icon-icon-warning)' },
            { text: $t('TikTok 养号'), icon: 'base/rx_ic_browsers_line', color: 'var(--colors-icon-icon-success)' },
            { text: $t('竞品分析'), icon: 'base/rx_ic_chat_question', color: 'var(--colors-icon-icon-info)' },
            { text: $t('网页爬虫'), icon: 'base/rx_ic_insect', color: '#C084FC' },
          ]" :key="item.text" class="agent-tags-item"
          >
            <RxSvgIcon :name="(item.icon as any)" :color="item.color" size="16" />
            <span class="text-3">{{ item.text }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- AI 回复区域：先展示我们发送的那条，再展示 AI 回复 -->
    <div v-else class="receive-area flex flex-col gap-6 z-1 relative">
      <motion.div
        class="flex items-center gap-3 flex-row-reverse"
        :initial="{ opacity: 0, y: -100 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: (receiveStep.entranceDelay ?? 400) / 1000, ease: [0, 0.71, 0.2, 1.01] }"
      >
        <RxSvgIcon name="base/logo" size="32" />
        <div class="text-[var(--colors-text-text-primary)] font-Inter text-13px font-500 leading-20px px-3 py-2 max-w-115 rounded-2 bg-[var(--colors-background-bg-action-hover)]">
          {{ sentMessageText }}
        </div>
      </motion.div>

      <div v-if="receiveTimelineStarted" class="w-full">
        <div class="flex gap-3">
          <img draggable="false" class="_image_miopt_1" :src="getImage('mcp/agent_avatar.png')" style="width: 32px; height: 32px; line-height: 32px; font-size: 16px; border-radius: 50%;">
          <div class="flex flex-col gap-2 w-full">
            <VNodeRenderer v-for="(node, i) in receiveCompletedNodes" :key="i" :vnode="node" />
            <VNodeRenderer v-if="receiveCurrentVNode" :vnode="receiveCurrentVNode" />
          </div>
        </div>
      </div>
    </div>

    <div class="z-1 relative flex flex-col gap-2">
      <div class="agent-textarea">
        <p class="my-0 flex flex-wrap items-baseline text-3.5">
          <span v-if="sendDisplayedText">{{ sendDisplayedText }}</span>
          <span v-else class="agent-placeholder">Ask Roxy AI Agent</span>
          <span v-if="phase === 'send'" class="agent-caret" />
        </p>

        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-1.5">
            <RxToggleSwitch />
            <span class="cursor-pointer text-13px font-500 leading-18px text-[var(--colors-text-text-primary)]">
              Multi-task
            </span>
          </div>
          <!-- 未发送：发送图标；已发送：停止图标 -->
          <RxSvgIcon :name="phase === 'idle' || phase === 'send' ? 'base/rx_ic_browser_send' : 'base/rx_ic_browser_stop'" size="24" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.agent-title {
  color: var(--colors-text-text-primary, #111213);
  font-family: Archivo;
  font-size: 20px;
  font-style: normal;
  font-weight: 700;
  line-height: var(--Line-Height-display-xs, 32px);
}

.agent-desc {
  color: var(--colors-text-text-secondary, #34393d);
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-lg, 20px); /* 153.846% */
}

.agent-tags-item {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-inactive, #e2e9ee);
  background: var(--colors-background-bg-action, #fff);
  display: flex;
  padding: 8px 12px;
  align-items: center;
  gap: 6px;
}

.agent-textarea {
  border-radius: 10px;
  border: 1px solid var(--colors-border-border-brand, #11a3fd);
  background: var(--colors-background-bg-page, #fff);
  display: flex;
  height: 120px;
  padding: 12px;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  align-self: stretch;
}

.agent-placeholder {
  color: var(--colors-text-text-inactive);
}

.receive-content {
  color: var(--colors-text-text-primary, #111213);
  font-size: 13px;
  line-height: 1.5;
}

.agent-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 4px;
  opacity: 0.2;
  background: #000;
  animation: agent-caret-blink 1s step-end infinite;
  vertical-align: center;
}

@keyframes agent-caret-blink {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0;
  }
}
</style>
