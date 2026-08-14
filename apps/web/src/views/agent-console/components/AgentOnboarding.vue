<script setup lang="ts">
import { useWorkspaceStore } from '/@/stores/workspace'
import { grantAgentOnboardingGuidePoints } from '../onboarding-gift'
import AgentTooltip from './AgentTooltip.vue'
import OnboardingSendGuide from './OnboardingSendGuide.vue'

type OnboardingScenarioId = 'create' | 'publish' | 'nurture' | 'analytics'

interface OnboardingScenario {
  id: OnboardingScenarioId
  icon: string
  title: string
  description: string
  demoPrompt: string
}

const props = defineProps<{
  sessionKey: number
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  experience: [scenario: OnboardingScenarioId]
}>()

const workspaceStore = useWorkspaceStore()

const scenarios: OnboardingScenario[] = [
  {
    id: 'create',
    icon: 'roxy-agent/rx-ic-browser-control',
    title: $t('批量创建窗口'),
    description: $t('批量创建窗口并自动配置代理和平台账号'),
    demoPrompt: $t('帮我新建3个窗口环境，配置好代理，绑定好平台账号'),
  },
  {
    id: 'publish',
    icon: 'roxy-agent/rx-ic-attachment',
    title: $t('AI 批量发布视频'),
    description: $t('在指定窗口中自动发布视频'),
    demoPrompt: $t('在这些窗口中发布视频'),
  },
  {
    id: 'nurture',
    icon: 'roxy-agent/rx-ic-scripts',
    title: $t('AI 全自动养号'),
    description: $t('在指定窗口中自动执行TikTok拟真人养号流程'),
    demoPrompt: $t('在选择的窗口中运行 TikTok推荐页养号'),
  },
  {
    id: 'analytics',
    icon: 'roxy-agent/rx-ic-templates',
    title: $t('AI 数据分析'),
    description: $t('自动查看TikTok评论区并AI分析客户意向等'),
    demoPrompt: $t('在选择的窗口中运行 TikTok带货评论分析'),
  },
]

const page = ref<1 | 2 | 3 | 4>(1)
const welcomeGiftVisible = ref(false)
let welcomeGiftRequestVersion = 0
const selectedId = ref<OnboardingScenarioId>('create')
const draft = ref('')
const typing = ref(false)
const promptRichVisible = ref(false)
const promptTemplateVisible = ref(false)
const promptProfileVisible = ref(false)
const readyToSend = ref(false)
const sendGuideVisible = ref(false)
const submitted = ref(false)
const completed = ref(false)
const completionCredits = ref(0)
const progress = ref(0)
const createExecutionText = ref('')
const publishExecutionText = ref('')
const nurtureExecutionText = ref('')
const analyticsExecutionText = ref('')
const publishPickerVisible = ref(false)
const publishSelectedCount = ref(0)
const publishConfirming = ref(false)
const publishToolbarAnimating = ref(false)
const autoCursorVisible = ref(false)
const autoCursorPressing = ref(false)
const autoCursorPosition = reactive({ left: 0, top: 0 })
const status = ref($t('准备指令'))
const onboardingMainRef = ref<HTMLElement | null>(null)
const demoComposerRef = ref<HTMLElement | null>(null)
const selectWindowButtonRef = ref<HTMLElement | null>(null)
const sendButtonRef = ref<HTMLButtonElement | null>(null)
const selected = computed(() => scenarios.find(item => item.id === selectedId.value) ?? scenarios[0]!)
const createdProfiles = [
  { id: '001', name: 'Roxy-TikTok-01', proxy: 'US · 192.168.1.101' },
  { id: '002', name: 'Roxy-TikTok-02', proxy: 'US · 192.168.1.102' },
  { id: '003', name: 'Roxy-TikTok-03', proxy: 'US · 192.168.1.103' },
]
const createdProfileCount = computed(() => Math.min(3, Math.floor(progress.value / 25)))
const visibleCreatedProfiles = computed(() => createdProfiles.slice(0, createdProfileCount.value))
const createExecutionLines = [
  $t('正在读取批量创建配置…'),
  ...createdProfiles.map((profile, index) => $t('{order} {name} 已创建，独立代理 {proxy} 已配置。', {
    order: [$t('第一个窗口'), $t('第二个窗口'), $t('第三个窗口')][index],
    name: profile.name,
    proxy: profile.proxy,
  })),
  $t('创建完成：3 个窗口均已创建，并已配置独立代理。'),
]
const publishProfiles = ['TikTok-1', 'TikTok-2', 'TikTok-3', 'TikTok-4']
const publishExecutionLines = [
  $t('收到，已链接 4 个窗口'),
  $t('4 个窗口开始上传视频'),
  $t('正在填写信息'),
  $t('视频发布完成 4/4'),
]
const publishStage = computed(() => Math.min(4, Math.floor(progress.value / 25)))
const nurtureExecutionLines = [
  $t('收到，已连接 4 个窗口'),
  $t('开始浏览推荐内容'),
  $t('执行点赞、收藏和停留操作'),
  $t('本轮养号完成，共计 20 项互动行为'),
]
const nurtureStage = computed(() => Math.min(4, Math.floor(progress.value / 25)))
const analyticsExecutionLines = [
  $t('收到，已连接4个窗口'),
  $t('开始收集四个账号的评论信息'),
  $t('归纳用户痛点、购买意向、常见问题和负面反馈'),
  $t('正在生成 CSV 文件'),
  $t('分析完成'),
]
const analyticsStage = computed(() => Math.min(5, Math.floor(progress.value / 20)))
const analyticsComments = [
  { user: 'mila_shop', text: $t('尺码偏小吗？平时穿 M 应该选什么码？'), time: $t('{minutes}分钟前', { minutes: 12 }) },
  { user: 'dailyfinds', text: $t('已经回购第二次了，包装和物流都不错。'), time: $t('{minutes}分钟前', { minutes: 5 }) },
  { user: 'amy_review', text: $t('有没有其他颜色？想要深色款。'), time: $t('{minutes}分钟前', { minutes: 8 }) },
  { user: 'leo_2026', text: $t('价格有点高，活动期间会有优惠吗？'), time: $t('{minutes}分钟前', { minutes: 12 }) },
  { user: 'goodthings', text: $t('实际效果和视频里一样吗？'), time: $t('{minutes}分钟前', { minutes: 18 }) },
  { user: 'tina_home', text: $t('希望可以再详细介绍一下使用方法。'), time: $t('{minutes}分钟前', { minutes: 22 }) },
]
const analyticsCommentLoop = [...analyticsComments, ...analyticsComments]
const CREATE_CHARACTER_DELAY = 18
const CREATE_PROFILE_INTERVAL = 1000

const timers = new Set<ReturnType<typeof setTimeout>>()

function schedule(callback: () => void, delay: number) {
  const timer = setTimeout(() => {
    timers.delete(timer)
    if (!props.visible)
      return
    callback()
  }, delay)
  timers.add(timer)
}

function clearTimers() {
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()
}

function playCompletionCreditsCountUp() {
  completionCredits.value = 0

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    completionCredits.value = 200
    return
  }

  schedule(() => {
    const startedAt = performance.now()
    const duration = 1000
    const updateCredits = () => {
      const elapsed = performance.now() - startedAt
      const ratio = Math.min(1, elapsed / duration)
      const easedRatio = 1 - (1 - ratio) ** 3
      completionCredits.value = Math.round(200 * easedRatio)

      if (ratio < 1)
        schedule(updateCredits, 16)
    }

    updateCredits()
  }, 620)
}

function resetDemo() {
  clearTimers()
  draft.value = ''
  typing.value = false
  promptRichVisible.value = false
  promptTemplateVisible.value = false
  promptProfileVisible.value = false
  readyToSend.value = false
  sendGuideVisible.value = false
  submitted.value = false
  completed.value = false
  progress.value = 0
  createExecutionText.value = ''
  publishExecutionText.value = ''
  nurtureExecutionText.value = ''
  analyticsExecutionText.value = ''
  publishPickerVisible.value = false
  publishSelectedCount.value = 0
  publishConfirming.value = false
  publishToolbarAnimating.value = false
  autoCursorVisible.value = false
  autoCursorPressing.value = false
  status.value = $t('准备指令')
}

function resetOnboarding() {
  resetDemo()
  page.value = 1
  selectedId.value = 'create'
  welcomeGiftVisible.value = false
  void refreshWelcomeGift()
}

async function refreshWelcomeGift() {
  const requestVersion = ++welcomeGiftRequestVersion
  const workspaceId = workspaceStore.currentWorkspace?.id
  if (!workspaceId)
    return

  try {
    const response = await grantAgentOnboardingGuidePoints(workspaceId)
    if (
      requestVersion !== welcomeGiftRequestVersion
      || workspaceStore.currentWorkspace?.id !== workspaceId
      || !props.visible
    ) {
      return
    }

    welcomeGiftVisible.value = response.code === 0 && !response.data.alreadyGifted
  }
  catch (error) {
    console.error('[agent-console] Failed to grant onboarding guide points', error)
  }
}

function chooseScenario(id: OnboardingScenarioId) {
  selectedId.value = id
}

function openDemo() {
  resetDemo()
  page.value = 3
  status.value = $t('正在填写指令')
  typing.value = true
  const text = selected.value.id === 'publish'
    ? $t('在这些窗口中发布视频')
    : selected.value.id === 'nurture' || selected.value.id === 'analytics'
      ? $t('在选择的窗口中运行')
      : selected.value.demoPrompt
  let index = 0
  const typeNext = () => {
    if (index < text.length) {
      draft.value += text[index++]
      schedule(typeNext, 80)
      return
    }
    typing.value = false
    if (selected.value.id === 'publish' || selected.value.id === 'nurture' || selected.value.id === 'analytics') {
      promptRichVisible.value = true
      promptTemplateVisible.value = selected.value.id === 'nurture' || selected.value.id === 'analytics'
      schedule(playPublishWindowSelection, promptTemplateVisible.value ? 700 : 420)
      return
    }
    makeReadyToSend()
  }
  schedule(typeNext, 300)
}

function makeReadyToSend() {
  status.value = $t('等待发送')
  readyToSend.value = true
  sendGuideVisible.value = true
}

function moveAutoCursorTo(target: Element | null, fromOffset?: { x: number, y: number }) {
  const composer = demoComposerRef.value
  if (!composer || !target)
    return

  const composerRect = composer.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const left = targetRect.left - composerRect.left + targetRect.width / 2 - 12
  const top = targetRect.top - composerRect.top + targetRect.height / 2 - 9

  if (fromOffset) {
    autoCursorPosition.left = left + fromOffset.x
    autoCursorPosition.top = top + fromOffset.y
    autoCursorVisible.value = true
    schedule(() => {
      autoCursorPosition.left = left
      autoCursorPosition.top = top
    }, 40)
    return
  }

  autoCursorPosition.left = left
  autoCursorPosition.top = top
}

function getPickerTarget(selector: string) {
  return demoComposerRef.value?.querySelector(selector) ?? null
}

function playPublishWindowSelection() {
  status.value = $t('选择窗口')
  publishToolbarAnimating.value = true
  nextTick(() => moveAutoCursorTo(selectWindowButtonRef.value, { x: 32, y: 18 }))
  schedule(() => {
    autoCursorPressing.value = true
  }, 470)
  schedule(() => {
    autoCursorPressing.value = false
    publishToolbarAnimating.value = false
    publishPickerVisible.value = true
    nextTick(() => {
      moveAutoCursorTo(getPickerTarget('.demo-window-picker__list > div:first-child .demo-checkbox'))
      let index = 0
      const chooseNext = () => {
        moveAutoCursorTo(getPickerTarget(`.demo-window-picker__list > div:nth-child(${index + 1}) .demo-checkbox`))
        schedule(() => {
          autoCursorPressing.value = true
          schedule(() => {
            autoCursorPressing.value = false
          }, 160)
          publishSelectedCount.value = index + 1
          index += 1
          if (index < publishProfiles.length) {
            schedule(chooseNext, 440)
            return
          }

          moveAutoCursorTo(getPickerTarget('.demo-window-picker__footer .primary'))
          schedule(() => {
            autoCursorPressing.value = true
            publishConfirming.value = true
            schedule(() => {
              autoCursorPressing.value = false
              autoCursorVisible.value = false
              promptProfileVisible.value = true
              publishPickerVisible.value = false
              publishConfirming.value = false
              makeReadyToSend()
            }, 480)
          }, 580)
        }, 520)
      }
      schedule(chooseNext, 440)
    })
  }, 720)
}

function playExecution() {
  if (!readyToSend.value || completed.value)
    return

  readyToSend.value = false
  sendGuideVisible.value = false
  page.value = 4
  submitted.value = true
  status.value = $t('Agent 执行中')

  if (selected.value.id === 'create') {
    playCreateExecution()
    return
  }

  if (selected.value.id === 'publish') {
    playPublishExecution()
    return
  }

  if (selected.value.id === 'nurture') {
    playNurtureExecution()
    return
  }

  if (selected.value.id === 'analytics') {
    playAnalyticsExecution()
    return
  }

  let step = 0
  const tick = () => {
    step += 1
    progress.value = step * 25
    if (step < 4) {
      schedule(tick, 680)
      return
    }

    status.value = $t('演示完成')
    completed.value = true
  }
  schedule(tick, 520)
}

function streamCreateLine(lineIndex: number) {
  const line = createExecutionLines[lineIndex]
  if (!line)
    return

  if (createExecutionText.value)
    createExecutionText.value += '\n'

  let characterIndex = 0
  const typeNextCharacter = () => {
    createExecutionText.value += line[characterIndex++]
    if (characterIndex < line.length) {
      schedule(typeNextCharacter, CREATE_CHARACTER_DELAY)
      return
    }

    if (lineIndex < createExecutionLines.length - 1) {
      schedule(() => streamCreateLine(lineIndex + 1), lineIndex === 0 ? 260 : 360)
      return
    }

    progress.value = 100
    status.value = $t('演示完成')
    completed.value = true
  }

  schedule(typeNextCharacter, CREATE_CHARACTER_DELAY)
}

function playCreateExecution() {
  createExecutionText.value = ''
  createdProfiles.forEach((_, index) => {
    schedule(() => {
      progress.value = (index + 1) * 25
    }, (index + 1) * CREATE_PROFILE_INTERVAL)
  })
  streamCreateLine(0)
}

function streamPublishLine(lineIndex: number) {
  const line = publishExecutionLines[lineIndex]
  if (!line)
    return

  if (publishExecutionText.value)
    publishExecutionText.value += '\n'

  let characterIndex = 0
  const typeNextCharacter = () => {
    publishExecutionText.value += line[characterIndex++]
    if (characterIndex < line.length) {
      schedule(typeNextCharacter, 30)
      return
    }

    progress.value = (lineIndex + 1) * 25
    if (lineIndex < publishExecutionLines.length - 1) {
      schedule(() => streamPublishLine(lineIndex + 1), 600)
      return
    }

    status.value = $t('演示完成')
    completed.value = true
  }

  schedule(typeNextCharacter, 30)
}

function playPublishExecution() {
  publishExecutionText.value = ''
  streamPublishLine(0)
}

function streamNurtureLine(lineIndex: number) {
  const line = nurtureExecutionLines[lineIndex]
  if (!line)
    return

  if (nurtureExecutionText.value)
    nurtureExecutionText.value += '\n'

  let characterIndex = 0
  const typeNextCharacter = () => {
    nurtureExecutionText.value += line[characterIndex++]
    if (characterIndex < line.length) {
      schedule(typeNextCharacter, 30)
      return
    }

    progress.value = (lineIndex + 1) * 25
    if (lineIndex < nurtureExecutionLines.length - 1) {
      const stageDelay = [900, 1800, 6600][lineIndex] ?? 900
      schedule(() => streamNurtureLine(lineIndex + 1), stageDelay)
      return
    }

    status.value = $t('演示完成')
    completed.value = true
  }

  schedule(typeNextCharacter, 30)
}

function playNurtureExecution() {
  nurtureExecutionText.value = ''
  streamNurtureLine(0)
}

function streamAnalyticsLine(lineIndex: number) {
  const line = analyticsExecutionLines[lineIndex]
  if (!line)
    return

  if (analyticsExecutionText.value)
    analyticsExecutionText.value += '\n'

  let characterIndex = 0
  const typeNextCharacter = () => {
    analyticsExecutionText.value += line[characterIndex++]
    if (characterIndex < line.length) {
      schedule(typeNextCharacter, 30)
      return
    }

    progress.value = (lineIndex + 1) * 20
    if (lineIndex < analyticsExecutionLines.length - 1) {
      const stageDelay = [700, 1800, 2400, 1400][lineIndex] ?? 700
      schedule(() => streamAnalyticsLine(lineIndex + 1), stageDelay)
      return
    }

    status.value = $t('演示完成')
    completed.value = true
  }

  schedule(typeNextCharacter, 30)
}

function playAnalyticsExecution() {
  analyticsExecutionText.value = ''
  streamAnalyticsLine(0)
}

function backToChoose() {
  resetDemo()
  page.value = 2
}

function close() {
  clearTimers()
  emit('close')
}

function experience() {
  if (page.value !== 4 || !completed.value)
    return

  clearTimers()
  emit('experience', selected.value.id)
}

const ScenarioPrompt = defineComponent({
  name: 'ScenarioPrompt',
  props: {
    scenarioId: { type: String as PropType<OnboardingScenarioId>, required: true },
    text: { type: String, required: true },
    compact: Boolean,
    showProfile: { type: Boolean, default: true },
    showTemplate: { type: Boolean, default: true },
  },
  setup(scenarioProps) {
    return () => {
      if (scenarioProps.scenarioId === 'create')
        return h('span', scenarioProps.text)

      const profile = h('span', { class: 'demo-token demo-token--profile' }, [
        h('span', { class: 'demo-token__prefix' }, `${$t('窗口')}`),
        h('span', { class: 'demo-token__detail' }, $t(`{'@'}TikTok-1 · TikTok-2 · TikTok-3等4个`)),
      ])

      if (scenarioProps.scenarioId === 'publish') {
        const content = [h('span', {}, $t('在这些窗口中发布视频'))]
        if (scenarioProps.showProfile)
          content.push(profile)
        return h('span', { class: 'scenario-prompt' }, content)
      }

      const templateName = scenarioProps.scenarioId === 'nurture' ? $t('TikTok推荐页养号') : $t('TikTok带货评论分析')
      const script = h('span', { class: 'demo-token demo-token--script' }, `${templateName}`)
      const content = [h('span', {}, $t('在选择的窗口中运行'))]
      if (scenarioProps.showTemplate)
        content.push(script)
      if (scenarioProps.showProfile)
        content.push(profile)
      return h('span', { class: 'scenario-prompt' }, content)
    }
  },
})

onBeforeUnmount(() => {
  clearTimers()
})

watch(() => props.visible, (visible) => {
  if (!visible) {
    welcomeGiftRequestVersion += 1
    welcomeGiftVisible.value = false
    clearTimers()
  }
})

watch(completed, (isCompleted) => {
  completionCredits.value = 0
  if (isCompleted)
    playCompletionCreditsCountUp()
}, { flush: 'sync' })

watch(() => props.sessionKey, resetOnboarding, { flush: 'sync' })
</script>

<template>
  <Teleport to="body">
    <section v-show="visible" class="agent-onboarding" role="dialog" aria-modal="true" :aria-label="$t('Roxy Agent 新手引导')">
      <header class="onboarding-header">
        <div class="onboarding-brand">
          <SvgIcon name="roxy-agent/rx-ic-logo" size="32" />
          <strong>Roxy AI Agent</strong>
          <span>{{ $t('新手引导') }}</span>
        </div>
        <button class="icon-button" type="button" :aria-label="$t('关闭新手引导')" @click="close">
          <SvgIcon name="roxy-agent/rx-ic-close" size="20" color="currentColor" />
        </button>
      </header>

      <main ref="onboardingMainRef" class="onboarding-main">
        <section v-if="page === 1" class="welcome-page">
          <SvgIcon class="welcome-logo" name="roxy-agent/rx-ic-logo" size="64" />
          <h1>{{ $t('20 秒，快速了解 AI 如何工作') }}</h1>
          <p>{{ $t('选择一个常用场景，体验在真实 Agent 对话界面中下达指令、查看执行进度并获得结果。') }}</p>

          <div class="welcome-flow" aria-label="onboarding steps">
            <span><i>1</i>{{ $t('选择场景') }}</span>
            <b><img class="flow-arrow-icon" src="/images/agent-onboarding/icons/arrow-right.svg" alt=""></b>
            <span><i>2</i>{{ $t('发送指令') }}</span>
            <b><img class="flow-arrow-icon" src="/images/agent-onboarding/icons/arrow-right.svg" alt=""></b>
            <span><i>3</i>{{ $t('查看执行演示') }}</span>
          </div>

          <div v-if="welcomeGiftVisible" class="welcome-gift" role="status" aria-live="polite">
            <span class="welcome-gift-icon" aria-hidden="true">🎁</span>
            <span class="welcome-gift-copy">
              <strong>{{ $t('新手礼包已发放') }}</strong>
              <small>{{ $t('200积分已到账，演示后即可体验') }}</small>
            </span>
            <b>+200</b>
          </div>

          <button class="primary-action welcome-action" type="button" @click="page = 2">
            <span><strong>{{ $t('查看演示') }}</strong></span>
            <i><img class="action-arrow-icon" src="/images/agent-onboarding/icons/arrow-right.svg" alt=""></i>
          </button>
        </section>

        <template v-else-if="page === 2">
          <div class="page-title">
            <div>
              <h1>{{ $t('1.选择一个演示场景') }}</h1>
            </div>
          </div>

          <div class="choose-workspace">
            <div class="scenario-list">
              <button
                v-for="scenario in scenarios"
                :key="scenario.id"
                class="scenario-card"
                :class="{ selected: scenario.id === selectedId }"
                type="button"
                @click="chooseScenario(scenario.id)"
              >
                <span class="scenario-icon">
                  <SvgIcon :name="scenario.icon" size="20" color="currentColor" />
                </span>
                <span class="scenario-copy">
                  <strong>{{ scenario.title }}</strong>
                  <small>{{ scenario.description }}</small>
                </span>
                <span class="scenario-radio" />
              </button>
            </div>
          </div>

          <div class="page-actions">
            <button class="secondary-action" type="button" @click="page = 1">
              {{ $t('上一步') }}
            </button>
            <button class="primary-action compact" type="button" @click="openDemo">
              {{ $t('下一步') }} <span><img class="button-arrow-icon" src="/images/agent-onboarding/icons/arrow-right.svg" alt=""></span>
            </button>
          </div>
        </template>

        <template v-else>
          <div class="demo-header">
            <div>
              <h1>{{ submitted ? $t('3.{title} - 流程演示', { title: selected.title }) : $t('2.{title}', { title: selected.title }) }}</h1>
            </div>
          </div>

          <section
            class="agent-product-frame"
            :class="{
              'agent-product-frame--pre-send': !submitted,
              'agent-product-frame--create': selected.id === 'create' && submitted,
              'agent-product-frame--publish': selected.id === 'publish' && submitted,
              'agent-product-frame--nurture': selected.id === 'nurture' && submitted,
              'agent-product-frame--analytics': selected.id === 'analytics' && submitted,
            }"
          >
            <Transition name="browser-main-reveal">
              <section v-if="selected.id === 'create' && submitted" class="browser-main-demo">
                <aside class="browser-sidebar-demo">
                  <div class="browser-logo-demo">
                    <SvgIcon name="base/logo" size="30" />
                    <img src="/images/roxybrowser_text_light_zh-CN.svg" alt="RoxyBrowser">
                  </div>
                  <div class="browser-create-actions">
                    <button type="button">
                      <SvgIcon name="base/rx_ic_browser_add" size="16" color="currentColor" />
                      {{ $t('创建窗口') }}
                    </button>
                  </div>
                  <nav class="browser-nav-demo">
                    <div class="browser-menu-item active">
                      <SvgIcon name="base/rx_ic_browser" size="17" color="currentColor" />
                      {{ $t('全部窗口') }}
                    </div>
                    <div class="browser-menu-item">
                      <SvgIcon name="base/rx_ic_stack" size="17" color="currentColor" />
                      {{ $t('项目管理') }}
                    </div>
                    <div class="browser-menu-item">
                      <SvgIcon name="base/rx_ic_internet" size="17" color="currentColor" />
                      {{ $t('代理 IP') }}
                    </div>
                    <div class="browser-menu-item">
                      <SvgIcon name="base/rx_ic_keys" size="17" color="currentColor" />
                      {{ $t('平台账号') }}
                    </div>
                    <small>{{ $t('AI & 自动化') }}</small>
                    <div class="browser-menu-item browser-agent-menu-item">
                      <SvgIcon name="roxy-agent/rx-ic-logo" size="17" />
                      <strong>AI Agent</strong>
                    </div>
                    <div class="browser-menu-item">
                      <SvgIcon name="roxy-agent/rx-ic-templates-store" size="17" color="currentColor" />
                      {{ $t('模板商城') }}
                    </div>
                    <div class="browser-menu-item">
                      <SvgIcon name="roxy-agent/rx-ic-task-manager" size="17" color="currentColor" />
                      {{ $t('任务管理') }}
                    </div>
                    <div class="browser-menu-item">
                      <SvgIcon name="roxy-agent/rx-ic-templates" size="17" color="currentColor" />
                      {{ $t('我的模板') }}
                    </div>
                  </nav>
                  <div class="browser-sidebar-footer">
                    <SvgIcon name="base/rx_ic_books" size="17" color="currentColor" />
                    {{ $t('新手教程') }}
                  </div>
                </aside>

                <div class="browser-window-page">
                  <header class="browser-page-topbar">
                    <div class="browser-network-demo">
                      <span class="browser-header-icon"><SvgIcon name="base/rx_ic_location" size="14" color="currentColor" /></span>
                      <strong>US/New York</strong>
                      <small>(192.168.1.10)</small>
                    </div>
                    <i class="browser-header-divider" />
                    <span class="browser-header-icon"><SvgIcon name="base/rx_ic_refresh" size="14" color="currentColor" /></span>
                    <span class="browser-header-icon"><SvgIcon name="base/rx_ic_mail" size="14" color="currentColor" /></span>
                    <i class="browser-header-divider" />
                    <div class="browser-workspace-demo">
                      <span class="browser-workspace-logo">R</span>
                      <strong>Roxy</strong>
                      <SvgIcon name="base/rx_ic_chevron_down" size="10" color="currentColor" />
                    </div>
                  </header>

                  <div class="browser-main-content-demo">
                    <div class="browser-list-content">
                      <div class="browser-tabs-demo">
                        <strong>{{ $t('全部窗口') }}</strong>
                        <span>{{ $t('收藏') }}</span>
                        <span>{{ $t('已打开') }}</span>
                        <span class="browser-tabs-spacer" />
                        <span>{{ $t('转移中') }}</span>
                        <span>{{ $t('回收站') }}</span>
                        <SvgIcon name="base/rx_ic_gear" size="16" color="currentColor" />
                      </div>

                      <div class="browser-filterbar-demo">
                        <span class="browser-search-demo">
                          <SvgIcon name="roxy-agent/rx-ic-search" size="15" color="currentColor" />
                          {{ $t('搜索 Ctrl + F') }}
                        </span>
                        <span class="browser-list-count">{{ $t('已创建 {count}/3', { count: createdProfileCount }) }}</span>
                        <SvgIcon name="base/rx_ic_refresh" size="16" color="currentColor" />
                      </div>

                      <div class="browser-table-demo">
                        <div class="browser-table-head">
                          <span><i /></span>
                          <span>{{ $t('编号') }}</span>
                          <span>{{ $t('窗口名称') }}</span>
                          <span>{{ $t('操作') }}</span>
                          <span>{{ $t('备注') }}</span>
                          <span>{{ $t('标签') }}</span>
                          <span>{{ $t('项目') }}</span>
                          <span>{{ $t('其他') }}</span>
                        </div>

                        <TransitionGroup name="profile-row" tag="div" class="browser-table-body">
                          <div v-for="profile in visibleCreatedProfiles" :key="profile.id" class="browser-profile-row">
                            <span><i class="browser-checkbox" /></span>
                            <span class="browser-profile-number">{{ profile.id }}</span>
                            <span class="browser-profile-name">
                              <i><SvgIcon name="base/rx_ic_browser" size="14" color="currentColor" /></i>
                              <b>{{ profile.name }}</b>
                            </span>
                            <span><button class="browser-open-button" type="button">{{ $t('打开') }}</button></span>
                            <span class="browser-note-cell"><SvgIcon name="base/rx_ic_doc_add" size="14" color="currentColor" /></span>
                            <span class="browser-tags-cell">--</span>
                            <span><em>{{ $t('默认项目') }}</em></span>
                            <span class="browser-row-actions">
                              <SvgIcon name="base/rx_ic_bookmark" size="14" color="currentColor" />
                              <SvgIcon name="base/rx_ic_more-v" size="16" color="currentColor" />
                            </span>
                          </div>
                        </TransitionGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </Transition>

            <Transition name="publish-grid-reveal">
              <section v-if="selected.id === 'publish' && submitted" class="publish-window-grid">
                <article v-for="(profile, index) in publishProfiles" :key="profile" class="publish-browser-window" :class="{ complete: completed }">
                  <header>
                    <span><i /><i /><i /></span>
                    <strong>{{ profile }}</strong>
                    <em>{{ completed ? $t('已完成') : $t('执行中') }}</em>
                  </header>
                  <div class="tiktok-publish-screen" :class="`stage-${publishStage}`">
                    <aside class="tiktok-demo-sidebar">
                      <img src="/images/agent-onboarding/tiktok.svg" alt="TikTok">
                    </aside>
                    <main>
                      <div class="tiktok-demo-title">
                        <strong>{{ $t('上传视频') }}</strong>
                      </div>
                      <div class="tiktok-upload-card">
                        <div class="tiktok-upload-preview">
                          <span class="upload-icon"><img src="/images/agent-onboarding/icons/upload.svg" alt=""></span>
                          <i class="upload-progress" :style="{ '--window-delay': `${index * 70}ms` }" />
                          <strong>{{ publishStage < 2 ? $t('正在上传') : $t('上传完成') }}</strong>
                        </div>
                        <div class="tiktok-form-demo">
                          <label>{{ $t('文案') }}</label>
                          <span class="tiktok-form-line long" />
                          <span class="tiktok-form-line" />
                          <button type="button" :class="{ active: publishStage >= 4 }">
                            {{ publishStage >= 4 ? $t('发布成功') : $t('发布') }}
                          </button>
                        </div>
                      </div>
                    </main>
                    <div v-if="publishStage >= 4" class="tiktok-success-layer">
                      <span><img src="/images/agent-onboarding/icons/check.svg" alt=""></span><strong>{{ $t('视频发布成功') }}</strong>
                    </div>
                  </div>
                </article>
              </section>
            </Transition>

            <Transition name="nurture-grid-reveal">
              <section v-if="selected.id === 'nurture' && submitted" class="nurture-window-grid">
                <article v-for="profile in publishProfiles" :key="profile" class="nurture-browser-window" :class="{ complete: completed }">
                  <header>
                    <span><i /><i /><i /></span>
                    <strong>{{ profile }}</strong>
                    <em>{{ completed ? $t('已完成') : $t('执行中') }}</em>
                  </header>
                  <div class="douyin-feed-screen" :class="`stage-${nurtureStage}`">
                    <div class="douyin-brand">
                      <img src="/images/agent-onboarding/tiktok.svg" alt="TikTok">
                      <span>{{ $t('推荐') }}</span>
                    </div>
                    <div class="douyin-video-stack">
                      <div class="douyin-video-card card-back">
                        <i /><i />
                      </div>
                      <div class="douyin-video-card card-front">
                        <span class="douyin-play"><i /></span>
                        <div class="douyin-caption">
                          <b>@daily_vibes</b>
                        </div>
                      </div>
                    </div>
                    <div class="douyin-actions">
                      <span class="douyin-avatar"><i /></span>
                      <span class="douyin-like"><i class="douyin-action-icon douyin-action-icon--heart" /><small>2.4K</small></span>
                      <span class="douyin-comment"><i class="douyin-action-icon douyin-action-icon--comment" /><small>128</small></span>
                      <span class="douyin-favorite"><i class="douyin-action-icon douyin-action-icon--favorite" /><small>326</small></span>
                    </div>
                    <div v-if="nurtureStage >= 4" class="douyin-complete-layer">
                      <span><img src="/images/agent-onboarding/icons/check.svg" alt=""></span><strong>{{ $t('养号任务完成') }}</strong>
                      <small>{{ $t('5 项互动行为') }}</small>
                    </div>
                  </div>
                </article>
              </section>
            </Transition>

            <Transition name="analytics-grid-reveal">
              <section v-if="selected.id === 'analytics' && submitted" class="analytics-window-grid">
                <article v-for="(profile, profileIndex) in publishProfiles" :key="profile" class="analytics-browser-window" :class="{ complete: completed }">
                  <header>
                    <span><i /><i /><i /></span>
                    <strong>{{ profile }}</strong>
                    <em>{{ completed ? $t('已完成') : $t('采集中') }}</em>
                  </header>
                  <div class="analytics-tiktok-screen" :class="[`stage-${analyticsStage}`, { complete: completed }]">
                    <div class="douyin-brand">
                      <img src="/images/agent-onboarding/tiktok.svg" alt="TikTok">
                      <span>{{ $t('推荐') }}</span>
                    </div>
                    <div class="analytics-video-scene" :class="`scene-${profileIndex + 1}`">
                      <span class="douyin-play"><i /></span>
                      <div class="douyin-caption">
                        <b>@shop_review_{{ profileIndex + 1 }}</b>
                      </div>
                    </div>
                    <div class="douyin-actions analytics-actions">
                      <span class="douyin-avatar"><i /></span>
                      <span><i class="douyin-action-icon douyin-action-icon--heart" /><small>{{ 1800 + profileIndex * 326 }}</small></span>
                      <span class="analytics-comment-active"><i class="douyin-action-icon douyin-action-icon--comment" /><small>{{ 128 + profileIndex * 17 }}</small></span>
                      <span><i class="douyin-action-icon douyin-action-icon--favorite" /><small>{{ 326 + profileIndex * 31 }}</small></span>
                    </div>
                    <section class="analytics-comment-sheet">
                      <header>
                        <strong>{{ $t('{count} 条评论', { count: 128 + profileIndex * 17 }) }}</strong>
                        <span><img src="/images/agent-onboarding/icons/close.svg" alt=""></span>
                      </header>
                      <div class="analytics-comment-viewport">
                        <div class="analytics-comment-track">
                          <article v-for="(comment, commentIndex) in analyticsCommentLoop" :key="`${profile}-${commentIndex}`">
                            <i>{{ comment.user.slice(0, 1).toUpperCase() }}</i>
                            <p><strong>{{ comment.user }}</strong><span>{{ comment.text }}</span></p>
                            <b><img src="/images/agent-onboarding/icons/heart-comment.svg" alt=""></b>
                          </article>
                        </div>
                      </div>
                    </section>
                  </div>
                </article>
              </section>
            </Transition>

            <div class="product-header" :class="{ 'product-header--home': !submitted }">
              <span v-if="submitted">{{ selected.title }}</span>
              <span v-else aria-hidden="true" />
            </div>

            <div
              class="product-body"
              :class="{
                'product-body--create-agent': submitted && selected.id === 'create',
                'product-body--publish-agent': submitted && selected.id === 'publish',
                'product-body--nurture-agent': submitted && selected.id === 'nurture',
                'product-body--analytics-agent': submitted && selected.id === 'analytics',
              }"
            >
              <div class="product-chat">
                <div v-if="!submitted" class="agent-greeting-message">
                  <span class="agent-greeting-avatar">
                    <SvgIcon name="roxy-agent/rx-ic-logo" size="22" />
                  </span>
                  <div>
                    <strong>Roxy Agent</strong>
                    <p>{{ $t('你好，我是 Roxy Agent，请问有什么我能帮你的吗？') }}</p>
                  </div>
                </div>

                <div v-else class="conversation-demo">
                  <div class="agent-greeting-message agent-greeting-message--inline">
                    <span class="agent-greeting-avatar">
                      <SvgIcon name="roxy-agent/rx-ic-logo" size="22" />
                    </span>
                    <div>
                      <strong>Roxy Agent</strong>
                      <p>{{ $t('你好，我是 Roxy Agent，请问有什么我能帮你的吗？') }}</p>
                    </div>
                  </div>

                  <div class="user-message">
                    <ScenarioPrompt :scenario-id="selected.id" :text="selected.demoPrompt" compact />
                  </div>

                  <div v-if="selected.id === 'create'" class="agent-greeting-message agent-greeting-message--inline agent-result-message">
                    <span class="agent-greeting-avatar">
                      <SvgIcon name="roxy-agent/rx-ic-logo" size="22" />
                    </span>
                    <div>
                      <strong>Roxy Agent</strong>
                      <p>
                        {{ createExecutionText }}<span v-if="!completed" class="streaming-cursor" aria-hidden="true" />
                      </p>
                    </div>
                  </div>

                  <div v-else-if="selected.id === 'publish'" class="agent-greeting-message agent-greeting-message--inline agent-result-message">
                    <span class="agent-greeting-avatar">
                      <SvgIcon name="roxy-agent/rx-ic-logo" size="22" />
                    </span>
                    <div>
                      <strong>Roxy Agent</strong>
                      <p>
                        {{ publishExecutionText }}<span v-if="!completed" class="streaming-cursor" aria-hidden="true" />
                      </p>
                    </div>
                  </div>

                  <div v-else-if="selected.id === 'nurture'" class="agent-greeting-message agent-greeting-message--inline agent-result-message">
                    <span class="agent-greeting-avatar">
                      <SvgIcon name="roxy-agent/rx-ic-logo" size="22" />
                    </span>
                    <div>
                      <strong>Roxy Agent</strong>
                      <p>
                        {{ nurtureExecutionText }}<span v-if="!completed" class="streaming-cursor" aria-hidden="true" />
                      </p>
                    </div>
                  </div>

                  <div v-else-if="selected.id === 'analytics'" class="agent-greeting-message agent-greeting-message--inline agent-result-message">
                    <span class="agent-greeting-avatar">
                      <SvgIcon name="roxy-agent/rx-ic-logo" size="22" />
                    </span>
                    <div>
                      <strong>Roxy Agent</strong>
                      <p>
                        {{ analyticsExecutionText }}<span v-if="!completed" class="streaming-cursor" aria-hidden="true" />
                      </p>
                      <div v-if="completed" class="analytics-file-card">
                        <span class="analytics-file-icon">CSV</span>
                        <span><strong>{{ $t('抖音评论信息分析报告.csv') }}</strong><small>{{ $t('评论分析报告 · CSV 文件') }}</small></span>
                        <button type="button" aria-disabled="true" @click.prevent.stop>
                          <SvgIcon name="base/rx_ic_download" size="15" color="currentColor" />
                          {{ $t('下载') }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  ref="demoComposerRef"
                  class="roxy-composer demo-composer"
                  :class="{
                    'is-waiting': readyToSend,
                    'is-collapsed': submitted,
                  }"
                >
                  <Transition name="picker-pop">
                    <div v-if="publishPickerVisible && (selected.id === 'publish' || selected.id === 'nurture' || selected.id === 'analytics') && !submitted" class="demo-window-picker">
                      <div class="demo-window-picker__header">
                        <span>{{ $t('选择窗口') }}</span>
                        <strong>{{ $t('已选择{count}项', { count: publishSelectedCount }) }}</strong>
                      </div>
                      <div class="demo-window-picker__tools">
                        <span class="demo-checkbox" />
                        <span>{{ $t('全选') }}</span>
                        <button type="button">
                          {{ $t('全部项目') }}
                        </button>
                        <label><SvgIcon name="base/rx_ic_magnify" size="14" />{{ $t('搜索窗口') }}</label>
                      </div>
                      <div class="demo-window-picker__list">
                        <div v-for="(profile, index) in publishProfiles" :key="profile" :class="{ selected: index < publishSelectedCount }">
                          <span class="demo-checkbox"><i><img src="/images/agent-onboarding/icons/check.svg" alt=""></i></span>
                          <SvgIcon name="base/rx_ic_route2" size="15" color="var(--colors-icon-icon-tertiary)" />
                          <strong>{{ $t('窗口{index}:', { index: index + 1 }) }} {{ profile }}</strong>
                        </div>
                      </div>
                      <div class="demo-window-picker__footer">
                        <button type="button">
                          {{ $t('取消') }}
                        </button>
                        <button class="primary" :class="{ confirming: publishConfirming }" type="button">
                          {{ $t('完成') }} ({{ publishSelectedCount }})
                        </button>
                      </div>
                    </div>
                  </Transition>
                  <div class="composer-content" :class="{ typing }">
                    <ScenarioPrompt
                      v-if="promptRichVisible && !submitted"
                      :scenario-id="selected.id"
                      :text="selected.demoPrompt"
                      :show-profile="promptProfileVisible"
                      :show-template="promptTemplateVisible"
                    />
                    <span v-else-if="!submitted">{{ draft }}</span>
                    <span v-else class="composer-placeholder-text">{{ $t("直接对我说出您的需求，输入 {'@'} 选择窗口，/ 使用模板") }}</span>
                  </div>
                  <div class="composer-toolbar-row">
                    <div class="composer-tools">
                      <span ref="selectWindowButtonRef" :class="{ 'toolbar-auto-click': publishToolbarAnimating && (selected.id === 'publish' || selected.id === 'nurture' || selected.id === 'analytics') }"><SvgIcon name="roxy-agent/rx-ic-at" size="15" />{{ $t('选窗口') }}</span>
                      <span><SvgIcon name="roxy-agent/rx-ic-slash" size="15" />{{ $t('选模板') }}</span>
                      <span><SvgIcon name="roxy-agent/rx-ic-attachment" size="15" />{{ $t('传文件') }}</span>
                    </div>
                    <button
                      ref="sendButtonRef"
                      class="send-button-real"
                      :class="{ 'send-button-attention': readyToSend }"
                      type="button"
                      :disabled="!readyToSend"
                      :aria-label="$t('点击发送')"
                      @click.stop="playExecution"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M7.333 12.667V4.492C6.951 4.835 6.521 5.295 6.108 5.77C5.684 6.259 5.291 6.749 5.003 7.119A.667.667 0 0 1 3.463 6.938C4.358 5.722 6.876 2.667 8 2.667s3.642 3.055 4.537 4.27a.667.667 0 0 1-1.075.792c-.518-.703-1.819-2.312-2.795-3.237v8.175a.667.667 0 1 1-1.334 0Z" fill="white" />
                      </svg>
                    </button>
                  </div>
                  <span
                    v-show="autoCursorVisible"
                    class="demo-auto-cursor"
                    :class="{ pressing: autoCursorPressing }"
                    :style="{ left: `${autoCursorPosition.left}px`, top: `${autoCursorPosition.top}px` }"
                    aria-hidden="true"
                  ><img src="/images/agent-onboarding/icons/hand-pointer.svg" alt=""></span>
                </div>
              </div>
            </div>
          </section>

          <div class="page-actions demo-actions">
            <button class="secondary-action" type="button" @click="backToChoose">
              {{ $t('上一步') }}
            </button>
          </div>

          <Transition name="completion-dialog">
            <div v-if="completed" class="onboarding-completion-mask">
              <section class="onboarding-completion-dialog" role="dialog" aria-modal="true" :aria-labelledby="`onboarding-completion-title-${sessionKey}`">
                <div class="onboarding-completion-visual" aria-hidden="true">
                  <i v-for="index in 18" :key="index" class="onboarding-completion-particle" />
                  <span class="onboarding-completion-orbit onboarding-completion-orbit--outer" />
                  <span class="onboarding-completion-orbit onboarding-completion-orbit--inner" />
                  <span class="onboarding-completion-icon">
                    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                      <path d="M8.5 18.5L13.2 23.2L25.8 10.8" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                </div>

                <div class="onboarding-completion-copy">
                  <h2 :id="`onboarding-completion-title-${sessionKey}`">
                    {{ $t('新手引导已完成') }}
                  </h2>
                  <p class="onboarding-completion-subtitle">
                    {{ $t('你已经了解 Agent 的基本使用方式') }}
                  </p>
                  <div class="onboarding-completion-reward">
                    <span class="onboarding-completion-reward-medal" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.5 13C19.0899 13 22 12.1046 22 11C22 9.89543 19.0899 9 15.5 9C11.9101 9 9 9.89543 9 11C9 12.1046 11.9101 13 15.5 13Z" stroke="white" stroke-width="2" />
                        <path d="M22 15.5C22 16.6046 19.0899 17.5 15.5 17.5C11.9101 17.5 9 16.6046 9 15.5" stroke="white" stroke-width="2" />
                        <path d="M22 11V19.8C22 21.015 19.0899 22 15.5 22C11.9101 22 9 21.015 9 19.8V11" stroke="white" stroke-width="2" />
                        <path d="M8.5 6C12.0899 6 15 5.10457 15 4C15 2.89543 12.0899 2 8.5 2C4.91015 2 2 2.89543 2 4C2 5.10457 4.91015 6 8.5 6Z" stroke="white" stroke-width="2" />
                        <path d="M6 11C4.10819 10.7698 2.36991 10.1745 2 9M6 16C4.10819 15.7698 2.36991 15.1745 2 14" stroke="white" stroke-width="2" stroke-linecap="round" />
                        <path d="M6 21C4.10819 20.7698 2.36991 20.1745 2 19V4" stroke="white" stroke-width="2" stroke-linecap="round" />
                        <path d="M15 6V4" stroke="white" stroke-width="2" stroke-linecap="round" />
                      </svg>
                    </span>
                    <span class="onboarding-completion-reward-copy">
                      <span class="onboarding-completion-reward-main">
                        <strong class="onboarding-completion-credits">+{{ completionCredits }}</strong>
                        <span class="onboarding-completion-credits-label">{{ $t('积分已到账') }}</span>
                      </span>
                      <small>
                        <span>{{ $t('含新用户100积分，约可执行50+次AI任务') }}</span>
                        <AgentTooltip placement="top" :offset="8" :z-index="2147483001">
                          <button class="onboarding-completion-task-info" type="button" :aria-label="$t('约可执行50+次AI任务')">
                            <SvgIcon name="base/rx_ic_info" size="12" color="currentColor" />
                          </button>
                          <template #content>
                            <span class="onboarding-completion-task-tooltip">
                              <span>{{ $t('单任务视频发布约 {n} 次', { n: 50 }) }}</span>
                              <span>{{ $t('竞品数据采集约 {n} 次', { n: 20 }) }}</span>
                              <span>{{ $t('单窗口账号养号约 {n} 次', { n: 20 }) }}</span>
                              <span>{{ $t('执行自动化脚本约 {n} 次', { n: 84 }) }}</span>
                            </span>
                          </template>
                        </AgentTooltip>
                      </small>
                    </span>
                  </div>
                </div>

                <div class="onboarding-completion-actions">
                  <button class="secondary-action" type="button" @click="backToChoose">
                    {{ $t('重新选择场景') }}
                  </button>
                  <button class="primary-action compact" type="button" @click="experience">
                    {{ $t('立即使用') }} <span><img class="button-arrow-icon" src="/images/agent-onboarding/icons/arrow-right.svg" alt=""></span>
                  </button>
                </div>
              </section>
            </div>
          </Transition>
        </template>
      </main>

      <OnboardingSendGuide
        :container="onboardingMainRef"
        :label="$t('点击发送，看看 Agent 如何执行')"
        :target="sendButtonRef"
        :visible="sendGuideVisible"
      />
    </section>
  </Teleport>
</template>

<style lang="scss" scoped>
.agent-onboarding {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  width: 100vw;
  height: 100vh;
  height: 100svh;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.onboarding-header {
  display: flex;
  height: 56px;
  flex: 0 0 56px;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border-secondary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
}

.onboarding-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: Archivo, Inter, sans-serif;
  font-size: 16px;
}

.onboarding-brand > span:last-child {
  margin-left: 4px;
  color: var(--color-text-tertiary);
  font-family: Inter, sans-serif;
  font-size: 12px;
  font-weight: 400;
}

.icon-button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
}

.icon-button:hover {
  background: var(--color-bg-tertiary-hover, var(--color-bg-tertiary));
}

.onboarding-main {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: clamp(18px, 3vw, 32px);
  overflow: auto;
  box-sizing: border-box;
}

.welcome-page {
  width: min(640px, 100%);
  margin: auto;
  text-align: center;
}

.welcome-logo {
  display: block;
  margin: 0 auto 20px;
}

.page-kicker {
  color: #c11574;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.8px;
}

.welcome-page h1 {
  margin: 14px 0 12px;
  font-family: Archivo, Inter, sans-serif;
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.25;
}

.welcome-page > p {
  margin: 0 auto;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.8;
}

.welcome-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 28px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.welcome-flow span {
  display: flex;
  align-items: center;
  gap: 7px;
}

.welcome-flow i {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 50%;
  color: #c11574;
  background: var(--color-bg-primary);
  font-style: normal;
}

.welcome-flow b {
  color: var(--color-text-disabled);
}

.flow-arrow-icon,
.button-arrow-icon,
.action-arrow-icon {
  display: block;
  width: 16px;
  height: 16px;
}

.welcome-action .action-arrow-icon,
.primary-action .button-arrow-icon {
  filter: invert(1);
}

.primary-action,
.secondary-action {
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 0;
  color: var(--agent-gradient-foreground, #fff);
  background: var(--agent-gradient);
}

.primary-action:hover {
  filter: brightness(0.96);
}

.welcome-action {
  width: min(390px, 100%);
  min-height: 64px;
  padding: 10px 14px 10px 20px;
  text-align: left;
  box-shadow: 0 10px 28px rgba(243, 89, 220, 0.18);
}

.welcome-gift {
  display: flex;
  width: min(390px, 100%);
  min-height: 64px;
  align-items: center;
  gap: 11px;
  margin: 0 auto 12px;
  padding: 10px 16px;
  border: 1px solid #e9d9a8;
  border-radius: 12px;
  box-sizing: border-box;
  background: linear-gradient(110deg, #fffaf0, #fff);
  box-shadow: 0 7px 18px rgba(170, 132, 45, 0.08);
  pointer-events: none;
  text-align: left;
}

.welcome-gift-icon {
  flex: 0 0 auto;
  font-size: 24px;
  line-height: 1;
}

.welcome-gift-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.welcome-gift-copy strong {
  color: #72561c;
  font-size: 13px;
  line-height: 17px;
}

.welcome-gift-copy small {
  color: #aa9460;
  font-size: 11px;
  line-height: 15px;
}

.welcome-gift > b {
  display: flex;
  align-self: stretch;
  align-items: center;
  color: #e39b20;
  font-size: 20px;
  line-height: 1;
  white-space: nowrap;
}

.welcome-action > span {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.welcome-action strong {
  font-size: 16px;
}

.welcome-action small {
  color: rgba(255, 255, 255, 0.78);
}

.welcome-action > i {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 20px;
  font-style: normal;
}

.primary-action.compact,
.secondary-action {
  min-height: 40px;
  padding: 0 18px;
  font-weight: 500;
}

.secondary-action {
  border: 1px solid var(--color-border-secondary);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

.secondary-action:hover {
  background: var(--color-bg-quaternary);
}

.page-title,
.demo-header {
  display: flex;
  width: min(1080px, 100%);
  align-items: center;
  justify-content: space-between;
  margin: 0 auto 20px;
}

.page-title h1,
.demo-header h1 {
  margin: 0;
  font-family: Archivo, Inter, sans-serif;
  font-size: 24px;
  line-height: 32px;
}

.page-title p,
.demo-header p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.page-title > span {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.choose-workspace {
  display: grid;
  width: min(1080px, 100%);
  min-height: 0;
  flex: 1;
  align-items: center;
  grid-template-columns: minmax(0, 1fr);
  margin: 0 auto;
}

.scenario-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 116px;
  gap: 14px;
}

.scenario-card {
  display: flex;
  min-height: 116px;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s,
    box-shadow 0.16s;
}

.scenario-card:hover,
.scenario-card.selected {
  border-color: #f359dc;
  box-shadow: 0 0 0 3px rgba(243, 89, 220, 0.08);
}

.scenario-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  place-items: center;
  border-radius: 10px;
  color: #c11574;
  background: var(--agent-gradient-soft);
}

.scenario-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.scenario-copy strong {
  font-size: 15px;
  font-weight: 500;
}

.scenario-copy small {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-radio {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border: 2px solid var(--color-border-primary);
  border-radius: 50%;
  box-sizing: border-box;
}

.scenario-card.selected .scenario-radio {
  border: 5px solid #e34899;
}

.roxy-composer {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  padding: 14px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.08);
}

.composer-content {
  min-height: 28px;
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 24px;
}

.composer-content.typing::after {
  display: inline-block;
  width: 1.5px;
  height: 16px;
  margin-left: 2px;
  background: #f359dc;
  content: '';
  vertical-align: -3px;
  animation: cursor-blink 0.7s step-end infinite;
}

.composer-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.composer-tools {
  display: flex;
  min-width: 0;
  gap: 4px;
}

.composer-tools > span {
  display: inline-flex;
  height: 28px;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 0 8px 0 7px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  box-sizing: border-box;
  color: var(--color-text-primary);
  font-size: 12px;
  white-space: nowrap;
}

.composer-tools > span.toolbar-auto-click {
  border-color: #11a3fd;
  color: #11a3fd;
  background: rgba(17, 163, 253, 0.1);
  animation: toolbar-click 0.65s ease both;
}

@keyframes toolbar-click {
  45% {
    box-shadow: 0 0 0 5px rgba(17, 163, 253, 0.16);
    transform: scale(0.95);
  }
}

.send-button-mock,
.send-button-real {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(101deg, #3faaf6 10.13%, #f359dc 44.94%, #f28fb0 100%);
}

.send-button-mock i {
  font-size: 16px;
  font-style: normal;
}

.page-actions {
  display: flex;
  width: min(1080px, 100%);
  align-items: center;
  justify-content: space-between;
  margin: 20px auto 0;
}

.demo-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  color: #c11574;
  background: var(--color-bg-primary);
  font-size: 12px;
}

.demo-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: status-pulse 1s infinite;
}

.demo-status.complete {
  color: #17b26a;
}

.agent-product-frame {
  position: relative;
  display: flex;
  width: min(1120px, 100%);
  min-height: 450px;
  flex: 1;
  flex-direction: column;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
}

.agent-product-frame--pre-send {
  min-width: 720px;
  flex-shrink: 0;
}

.agent-product-frame--create {
  display: grid;
  width: min(1160px, 100%);
  grid-template-columns: minmax(0, 1fr) 440px;
  grid-template-rows: 54px minmax(0, 1fr);
  column-gap: 10px;
  padding: 10px;
  background: var(--color-bg-secondary);
}

.agent-product-frame--publish {
  display: grid;
  width: min(1160px, 100%);
  grid-template-columns: minmax(0, 1fr) 440px;
  grid-template-rows: 54px minmax(0, 1fr);
  column-gap: 10px;
  padding: 10px;
  background: var(--color-bg-secondary);
}

.agent-product-frame--publish .publish-window-grid {
  grid-row: 1 / 3;
  grid-column: 1;
}

.agent-product-frame--publish > .product-header {
  grid-row: 1;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.agent-product-frame--publish > .product-body {
  grid-row: 2;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-top: 0;
  border-radius: 0 0 12px 12px;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.publish-window-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.publish-browser-window {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 5px 16px rgba(15, 15, 15, 0.08);
}

.publish-browser-window > header {
  display: flex;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border-bottom: 1px solid #e7e7e7;
  color: #454545;
  background: #f6f6f6;
  box-sizing: border-box;
}

.publish-browser-window > header > span {
  display: flex;
  gap: 3px;
}

.publish-browser-window > header > span i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #b8b8b8;
}

.publish-browser-window > header strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publish-browser-window > header em {
  color: #11a3fd;
  font-size: 10px;
  font-style: normal;
}

.publish-browser-window.complete > header em {
  color: #17b26a;
}

.tiktok-publish-screen {
  position: relative;
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 42px minmax(0, 1fr);
  color: #161823;
  background: #fff;
}

.tiktok-demo-sidebar {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 14px;
  padding-top: 11px;
  border-right: 1px solid #efefef;
  background: #fff;
}

.tiktok-demo-sidebar img {
  display: block;
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.tiktok-demo-sidebar span {
  width: 16px;
  height: 4px;
  border-radius: 3px;
  background: #d8d8d8;
}

.tiktok-publish-screen > main {
  min-width: 0;
  padding: 12px 14px;
}

.tiktok-demo-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.tiktok-demo-title strong {
  font-size: 14px;
}

.tiktok-upload-card {
  display: grid;
  grid-template-columns: 40% minmax(0, 1fr);
  gap: 8px;
}

.tiktok-upload-preview {
  position: relative;
  display: flex;
  min-height: 116px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  border: 1px dashed #d5d5d5;
  border-radius: 5px;
  background: #fafafa;
}

.upload-icon {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}

.upload-icon img {
  width: 18px;
  height: 18px;
}

.tiktok-upload-preview strong {
  color: #6a6a6a;
  font-size: 10px;
}

.upload-progress {
  width: 56%;
  height: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: #e2e2e2;
}

.upload-progress::after {
  display: block;
  width: 15%;
  height: 100%;
  border-radius: inherit;
  background: #fe2c55;
  content: '';
  transition: width 0.6s ease var(--window-delay);
}

.stage-2 .upload-progress::after {
  width: 100%;
}

.tiktok-form-demo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.tiktok-form-demo label {
  color: #555;
  font-size: 10px;
  font-weight: 600;
}

.tiktok-form-line {
  width: 70%;
  height: 5px;
  border-radius: 3px;
  background: #e7e7e7;
  transition: background 0.35s ease;
}

.tiktok-form-line.long {
  width: 100%;
}

.stage-3 .tiktok-form-line,
.stage-4 .tiktok-form-line {
  background: linear-gradient(90deg, #d3d3d3 0 72%, #fe2c55 72% 80%, #d3d3d3 80%);
}

.tiktok-form-demo button {
  width: 68px;
  height: 27px;
  margin-top: auto;
  border: 0;
  border-radius: 4px;
  color: #fff;
  background: #fe2c55;
  font-size: 10px;
}

.tiktok-form-demo button.active {
  background: #17b26a;
}

.tiktok-success-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  color: #161823;
  background: rgba(255, 255, 255, 0.9);
  animation: message-in 0.3s ease both;
}

.tiktok-success-layer span {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #17b26a;
  font-size: 14px;
}

.tiktok-success-layer span img,
.douyin-complete-layer > span img {
  width: 18px;
  height: 18px;
  filter: invert(1);
}

.tiktok-success-layer strong {
  font-size: 12px;
}

.publish-grid-reveal-enter-active {
  transition:
    opacity 0.42s ease,
    transform 0.62s cubic-bezier(0.22, 1, 0.36, 1);
}

.publish-grid-reveal-enter-from {
  opacity: 0;
  transform: translateX(-44px) scale(0.985);
}

.agent-product-frame--nurture {
  display: grid;
  width: min(1160px, 100%);
  grid-template-columns: minmax(0, 1fr) 440px;
  grid-template-rows: 54px minmax(0, 1fr);
  column-gap: 10px;
  padding: 10px;
  background: var(--color-bg-secondary);
}

.agent-product-frame--nurture .nurture-window-grid {
  grid-row: 1 / 3;
  grid-column: 1;
}

.agent-product-frame--nurture > .product-header {
  grid-row: 1;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.agent-product-frame--nurture > .product-body {
  grid-row: 2;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-top: 0;
  border-radius: 0 0 12px 12px;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.nurture-window-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.nurture-browser-window {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: #101010;
  box-shadow: 0 5px 16px rgba(15, 15, 15, 0.14);
}

.nurture-browser-window > header {
  display: flex;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border-bottom: 1px solid #303030;
  color: #e8e8e8;
  background: #202020;
  box-sizing: border-box;
}

.nurture-browser-window > header > span {
  display: flex;
  gap: 3px;
}

.nurture-browser-window > header > span i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #666;
}

.nurture-browser-window > header strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nurture-browser-window > header em {
  color: #3faaf6;
  font-size: 10px;
  font-style: normal;
}

.nurture-browser-window.complete > header em {
  color: #17b26a;
}

.douyin-feed-screen {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  color: #fff;
  background: #080808;
}

.douyin-brand {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
}

.douyin-brand img {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: #fff;
  filter: invert(1);
}

.douyin-video-stack {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.douyin-video-card {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 68% 28%, rgba(255, 190, 105, 0.8) 0 5%, transparent 6%),
    linear-gradient(145deg, #385568 0%, #d3765a 42%, #1d232f 100%);
}

.douyin-video-card.card-back {
  transform: translateY(100%);
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 238, 169, 0.75) 0 7%, transparent 8%),
    linear-gradient(145deg, #273f31, #498a78 50%, #17221c);
}

.douyin-video-card.card-back i {
  position: absolute;
  display: block;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.douyin-video-card.card-back i:first-child {
  top: 32%;
  left: 20%;
  width: 70px;
  height: 70px;
}

.douyin-video-card.card-back i:last-child {
  right: 12%;
  bottom: 14%;
  width: 46px;
  height: 46px;
}

.douyin-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.douyin-play i {
  display: block;
  width: 24px;
  height: 24px;
  background: #fff;
  mask: url('/images/agent-onboarding/icons/play.svg') center / contain no-repeat;
  opacity: 0.88;
}

.douyin-caption {
  position: absolute;
  right: 42px;
  bottom: 12px;
  left: 9px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-shadow: 0 1px 3px #000;
}

.douyin-caption b {
  font-size: 11px;
}

.douyin-actions {
  position: absolute;
  right: 8px;
  bottom: 11px;
  z-index: 4;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 8px;
  text-shadow: 0 1px 4px #000;
}

.douyin-actions > span {
  display: flex;
  align-items: center;
  flex-direction: column;
  color: #fff;
  font-size: 15px;
  transition:
    color 0.25s ease,
    transform 0.25s ease;
}

.douyin-action-icon {
  display: block;
  width: 19px;
  height: 19px;
  background: currentColor;
}

.douyin-action-icon--heart {
  mask: url('/images/agent-onboarding/icons/heart.svg') center / contain no-repeat;
}

.douyin-action-icon--comment {
  mask: url('/images/agent-onboarding/icons/comment.svg') center / contain no-repeat;
}

.douyin-action-icon--favorite {
  mask: url('/images/agent-onboarding/icons/favorite.svg') center / contain no-repeat;
}

.douyin-actions small {
  margin-top: 2px;
  font-size: 9px;
}

.douyin-avatar i {
  display: block;
  width: 21px;
  height: 21px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: linear-gradient(145deg, #fb8e71, #5b68b8);
}

.stage-3 .douyin-video-card.card-front {
  animation: nurture-front-video 6s linear both;
}

.stage-3 .douyin-video-card.card-back {
  animation: nurture-back-video 6s linear both;
}

.stage-3 .douyin-like {
  animation: nurture-like-action 6s linear both;
}

.stage-3 .douyin-favorite {
  animation: nurture-favorite-action 6s linear both;
}

.stage-4 .douyin-video-card.card-front {
  transform: translateY(0);
}

.stage-4 .douyin-video-card.card-back {
  transform: translateY(100%);
}

.stage-4 .douyin-like {
  color: #fe2c55;
}

.stage-4 .douyin-favorite {
  color: #fff;
}

.douyin-complete-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  color: #fff;
  background: rgba(5, 5, 5, 0.78);
  animation: message-in 0.3s ease both;
}

.douyin-complete-layer > span {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: #17b26a;
  font-size: 13px;
}

.douyin-complete-layer strong {
  font-size: 12px;
}

.douyin-complete-layer small {
  color: #c8c8c8;
  font-size: 10px;
}

.nurture-grid-reveal-enter-active {
  transition:
    opacity 0.42s ease,
    transform 0.62s cubic-bezier(0.22, 1, 0.36, 1);
}

.nurture-grid-reveal-enter-from {
  opacity: 0;
  transform: translateX(-44px) scale(0.985);
}

@keyframes nurture-front-video {
  0%,
  25% {
    transform: translateY(0);
  }

  34%,
  59% {
    transform: translateY(-100%);
  }

  59.1% {
    transform: translateY(100%);
  }

  68%,
  100% {
    transform: translateY(0);
  }
}

@keyframes nurture-back-video {
  0%,
  25% {
    transform: translateY(100%);
  }

  34%,
  59% {
    transform: translateY(0);
  }

  68% {
    transform: translateY(-100%);
  }

  68.1%,
  100% {
    transform: translateY(100%);
  }
}

@keyframes nurture-like-action {
  0%,
  12%,
  28%,
  79% {
    color: #fff;
    transform: scale(1);
  }

  16%,
  83% {
    color: #fe2c55;
    transform: scale(1.32);
  }

  20%,
  25%,
  87%,
  100% {
    color: #fe2c55;
    transform: scale(1);
  }

  28.1%,
  78.9% {
    color: #fff;
    transform: scale(1);
  }
}

@keyframes nurture-favorite-action {
  0%,
  47% {
    color: #fff;
    transform: scale(1);
  }

  51% {
    color: #ffd447;
    transform: scale(1.32);
  }

  55%,
  59% {
    color: #ffd447;
    transform: scale(1);
  }

  62%,
  100% {
    color: #fff;
    transform: scale(1);
  }
}

.agent-product-frame--analytics {
  display: grid;
  width: min(1160px, 100%);
  grid-template-columns: minmax(0, 1fr) 440px;
  grid-template-rows: 54px minmax(0, 1fr);
  column-gap: 10px;
  padding: 10px;
  background: var(--color-bg-secondary);
}

.agent-product-frame--analytics .analytics-window-grid {
  grid-row: 1 / 3;
  grid-column: 1;
}

.agent-product-frame--analytics > .product-header {
  grid-row: 1;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.agent-product-frame--analytics > .product-body {
  grid-row: 2;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-top: 0;
  border-radius: 0 0 12px 12px;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.analytics-window-grid {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.analytics-browser-window {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: #101010;
  box-shadow: 0 5px 16px rgba(15, 15, 15, 0.14);
}

.analytics-browser-window > header {
  display: flex;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border-bottom: 1px solid #303030;
  color: #e8e8e8;
  background: #202020;
  box-sizing: border-box;
}

.analytics-browser-window > header > span {
  display: flex;
  gap: 3px;
}

.analytics-browser-window > header > span i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #666;
}

.analytics-browser-window > header strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analytics-browser-window > header em {
  color: #3faaf6;
  font-size: 10px;
  font-style: normal;
}

.analytics-browser-window.complete > header em {
  color: #17b26a;
}

.analytics-tiktok-screen {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  color: #fff;
  background: #080808;
}

.analytics-video-scene {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 68% 28%, rgba(255, 190, 105, 0.72) 0 5%, transparent 6%),
    linear-gradient(145deg, #385568 0%, #d3765a 42%, #1d232f 100%);
}

.analytics-video-scene.scene-2 {
  background: linear-gradient(145deg, #263f55, #94639a 48%, #171e2b);
}

.analytics-video-scene.scene-3 {
  background: linear-gradient(145deg, #374e38, #bd8660 48%, #1e251c);
}

.analytics-video-scene.scene-4 {
  background: linear-gradient(145deg, #55442d, #a75e64 48%, #22191c);
}

.analytics-actions {
  transition: opacity 0.4s ease;
}

.analytics-comment-active {
  color: #fff !important;
}

.analytics-comment-sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 7;
  height: 82%;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
  color: #161823;
  background: #fff;
  box-shadow: 0 -5px 18px rgba(0, 0, 0, 0.24);
  transform: translateY(105%);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.analytics-tiktok-screen.stage-2 .analytics-comment-sheet,
.analytics-tiktok-screen.stage-3 .analytics-comment-sheet,
.analytics-tiktok-screen.stage-4 .analytics-comment-sheet,
.analytics-tiktok-screen.stage-5 .analytics-comment-sheet {
  transform: translateY(0);
}

.analytics-comment-sheet > header {
  display: flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #f0f0f0;
  box-sizing: border-box;
}

.analytics-comment-sheet > header strong {
  font-size: 11px;
}

.analytics-comment-sheet > header span {
  position: absolute;
  right: 10px;
  color: #777;
  font-size: 14px;
}

.analytics-comment-sheet > header span img {
  display: block;
  width: 14px;
  height: 14px;
}

.analytics-comment-viewport {
  height: calc(100% - 32px);
  overflow: hidden;
}

.analytics-comment-track {
  animation: analytics-comments-scroll 8s linear infinite;
}

.analytics-tiktok-screen.stage-1 .analytics-comment-track,
.analytics-tiktok-screen.complete .analytics-comment-track {
  animation-play-state: paused;
}

.analytics-comment-track article {
  display: flex;
  min-height: 48px;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 9px;
  box-sizing: border-box;
}

.analytics-comment-track article > i {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(145deg, #ff8b73, #6875c8);
  font-size: 10px;
  font-style: normal;
}

.analytics-comment-track article > p {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  margin: 0;
}

.analytics-comment-track article > p strong {
  color: #8a8a8a;
  font-size: 9px;
  font-weight: 400;
}

.analytics-comment-track article > p span {
  overflow: hidden;
  font-size: 10px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analytics-comment-track article > b {
  font-weight: 400;
}

.analytics-comment-track article > b img {
  display: block;
  width: 15px;
  height: 15px;
}

.analytics-grid-reveal-enter-active {
  transition:
    opacity 0.42s ease,
    transform 0.62s cubic-bezier(0.22, 1, 0.36, 1);
}

.analytics-grid-reveal-enter-from {
  opacity: 0;
  transform: translateX(-44px) scale(0.985);
}

@keyframes analytics-comments-scroll {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(-50%);
  }
}

.agent-product-frame--create .browser-main-demo {
  grid-row: 1 / 3;
  grid-column: 1;
}

.agent-product-frame--create > .product-header {
  grid-row: 1;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.agent-product-frame--create > .product-body {
  grid-row: 2;
  grid-column: 2;
  border: 1px solid var(--color-border-secondary);
  border-top: 0;
  border-radius: 0 0 12px 12px;
  background: var(--color-bg-primary);
  animation: agent-panel-shift 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.browser-main-demo {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: 150px minmax(0, 1fr);
  overflow: hidden;
  border-radius: 12px;
  background: var(--colors-background-bg-base, var(--color-bg-secondary));
  box-shadow: 0 8px 24px rgba(15, 15, 15, 0.05);
}

.browser-sidebar-demo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 9px;
  padding: 10px 11px;
  background-color: var(--colors-background-bg-base, var(--color-bg-secondary));
  background-image: url('/images/bg_capella.svg');
  background-position: bottom -130px right -130px;
  background-repeat: no-repeat;
  background-size: 300px;
  box-sizing: border-box;
}

.browser-logo-demo {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.browser-logo-demo img {
  display: block;
  width: 92px;
  height: 17px;
  object-fit: contain;
  object-position: left center;
}

.browser-create-actions {
  display: block;
}

.browser-create-actions button {
  display: inline-flex;
  width: 100%;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid #11a3fd;
  border-radius: 6px;
  color: #fff;
  background: #11a3fd;
  box-sizing: border-box;
  font-size: 10px;
  font-weight: 600;
}

.browser-nav-demo {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.browser-menu-item {
  display: flex;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 10px;
  font-weight: 500;
}

.browser-menu-item.active {
  color: #11a3fd;
  background: var(--pattern-sidenav-bg-active, rgba(17, 163, 253, 0.1));
  font-weight: 600;
}

.browser-nav-demo small {
  padding: 9px 0 3px;
  color: var(--color-text-quaternary);
  font-size: 8px;
  font-weight: 600;
}

.browser-agent-menu-item strong {
  background: linear-gradient(103.72deg, #3faaf6 10.6%, #f359dc 55.3%, #f28fb0 100%);
  background-clip: text;
  font-weight: 600;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.browser-sidebar-footer {
  display: flex;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  color: var(--color-text-secondary);
  font-size: 10px;
}

.browser-window-page {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.browser-page-topbar {
  display: flex;
  height: 46px;
  flex: 0 0 46px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 12px 0 0;
  box-sizing: border-box;
}

.browser-network-demo {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
  font-size: 8px;
}

.browser-network-demo strong {
  color: var(--color-text-primary);
  font-size: 9px;
  font-weight: 500;
}

.browser-network-demo small {
  color: var(--color-text-tertiary);
  font-size: 8px;
}

.browser-header-icon {
  display: inline-flex;
  width: 25px;
  height: 25px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-primary);
  border-radius: 5px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
}

.browser-header-divider,
.browser-filter-divider {
  display: block;
  width: 1px;
  height: 17px;
  background: var(--color-border-secondary);
}

.browser-workspace-demo {
  display: flex;
  height: 26px;
  align-items: center;
  gap: 5px;
  padding: 0 4px;
  color: var(--color-text-primary);
}

.browser-workspace-logo {
  display: inline-flex;
  width: 21px;
  height: 21px;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: #fff;
  background: #11a3fd;
  font-size: 10px;
  font-weight: 700;
}

.browser-workspace-demo strong {
  font-size: 9px;
  font-weight: 600;
}

.browser-main-content-demo {
  min-height: 0;
  flex: 1;
  margin: 0 10px 10px 0;
  overflow: hidden;
  border: 1px solid var(--colors-border-border-inactive, var(--color-border-secondary));
  border-radius: 5px;
  background: var(--colors-background-bg-page, var(--color-bg-primary));
}

.browser-list-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 0;
}

.browser-tabs-demo {
  display: flex;
  height: 43px;
  flex: 0 0 43px;
  align-items: center;
  gap: 14px;
  padding: 0 10px;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-tertiary);
  font-size: 9px;
}

.browser-tabs-demo strong {
  position: relative;
  color: var(--color-text-primary);
  font-size: 11px;
}

.browser-tabs-demo strong::after {
  position: absolute;
  right: 0;
  bottom: -15px;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: #11a3fd;
  content: '';
}

.browser-tabs-spacer {
  flex: 1;
}

.browser-filterbar-demo {
  display: flex;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
}

.browser-search-demo {
  display: flex;
  width: 154px;
  height: 27px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid var(--color-border-primary);
  border-radius: 6px;
  color: var(--color-text-quaternary);
  box-sizing: border-box;
  font-size: 8px;
}

.browser-filterbar-demo button {
  height: 27px;
  padding: 0 8px;
  border: 1px solid var(--color-border-primary);
  border-radius: 6px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  font-size: 8px;
}

.browser-list-count {
  margin-left: auto;
  color: #11a3fd;
  font-size: 9px;
  font-weight: 600;
}

.browser-table-demo {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  border-top: 1px solid var(--color-border-secondary);
  scrollbar-color: var(--color-border-primary) transparent;
  scrollbar-width: thin;
}

.browser-table-demo::-webkit-scrollbar {
  height: 6px;
}

.browser-table-demo::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--color-border-primary);
}

.browser-table-demo::-webkit-scrollbar-track {
  background: transparent;
}

.browser-table-head,
.browser-profile-row {
  display: grid;
  width: max-content;
  min-width: 100%;
  grid-template-columns: 25px 38px 100px 50px 35px 42px 62px 42px;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
}

.browser-table-head {
  height: 36px;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-tertiary);
  background: var(--datatable-header-cell-background, var(--color-bg-secondary));
  font-size: 8px;
  font-weight: 600;
}

.browser-table-head span:first-child i,
.browser-checkbox {
  display: block;
  width: 11px;
  height: 11px;
  border: 1px solid var(--color-border-primary);
  border-radius: 3px;
  box-sizing: border-box;
}

.browser-profile-row {
  min-height: 58px;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
  font-size: 9px;
}

.browser-profile-number {
  color: var(--color-text-primary);
  font-weight: 500;
}

.browser-profile-name {
  position: relative;
  z-index: 2;
  display: flex;
  width: max-content;
  min-width: 160px;
  align-items: center;
  gap: 7px;
  padding-right: 8px;
  background: var(--colors-background-bg-page, var(--color-bg-primary));
  box-sizing: border-box;
}

.browser-profile-name > i {
  display: inline-flex;
  width: 25px;
  height: 25px;
  flex: 0 0 25px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #11a3fd;
  background: rgba(17, 163, 253, 0.1);
}

.browser-profile-name b {
  color: var(--color-text-primary);
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.browser-open-button {
  height: 25px;
  padding: 0 10px;
  border: 1px solid #11a3fd;
  border-radius: 6px;
  color: #11a3fd;
  background: transparent;
  font-size: 8px;
}

.browser-note-cell,
.browser-tags-cell {
  color: var(--color-text-tertiary);
  text-align: center;
}

.browser-profile-row em {
  display: inline-flex;
  width: auto;
  padding: 3px 6px;
  overflow: hidden;
  border-radius: 4px;
  color: #11a3fd;
  background: rgba(17, 163, 253, 0.1);
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browser-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: var(--color-text-tertiary);
}

.browser-creating-empty {
  position: absolute;
  inset: 36px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  background: var(--color-bg-primary);
  font-size: 10px;
}

.profile-row-enter-active {
  transition:
    opacity 0.32s ease,
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.8s ease;
}

.profile-row-enter-from {
  opacity: 0;
  background: rgba(17, 163, 253, 0.14);
  transform: translateY(-14px);
}

.browser-main-reveal-enter-active {
  transition:
    opacity 0.42s ease,
    transform 0.62s cubic-bezier(0.22, 1, 0.36, 1);
}

.browser-main-reveal-enter-from {
  opacity: 0;
  transform: translateX(-44px) scale(0.985);
}

.product-body--create-agent {
  grid-template-columns: minmax(0, 1fr);
}

.product-body--publish-agent {
  grid-template-columns: minmax(0, 1fr);
}

.product-body--nurture-agent {
  grid-template-columns: minmax(0, 1fr);
}

.product-body--analytics-agent {
  grid-template-columns: minmax(0, 1fr);
}

.product-body--create-agent .product-chat,
.product-body--publish-agent .product-chat,
.product-body--nurture-agent .product-chat,
.product-body--analytics-agent .product-chat {
  min-height: 0;
}

.product-body--create-agent .conversation-demo,
.product-body--publish-agent .conversation-demo,
.product-body--nurture-agent .conversation-demo,
.product-body--analytics-agent .conversation-demo {
  gap: 14px;
  padding: 20px 18px 68px;
}

.product-body--create-agent .demo-composer,
.product-body--publish-agent .demo-composer,
.product-body--nurture-agent .demo-composer,
.product-body--analytics-agent .demo-composer {
  right: 14px;
  bottom: 14px;
  left: 14px;
  min-height: 96px;
}

.analytics-file-card {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-secondary);
  box-sizing: border-box;
  animation: message-in 0.32s ease both;
}

.analytics-file-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 8px;
  color: #fff;
  background: #17a66a;
  font-size: 8px;
  font-weight: 700;
}

.analytics-file-card > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.analytics-file-card > span:nth-child(2) strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analytics-file-card > span:nth-child(2) small {
  color: var(--color-text-tertiary);
  font-size: 9px;
}

.analytics-file-card button {
  display: inline-flex;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid var(--color-border-primary);
  border-radius: 7px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  cursor: default;
  font-size: 10px;
}

@keyframes agent-panel-shift {
  from {
    opacity: 0.5;
    transform: translateX(-22%);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.product-header {
  display: flex;
  height: 54px;
  flex: 0 0 54px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--color-border-secondary);
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 500;
}

.product-header--home {
  border-bottom-color: transparent;
}

.monitor-toggle {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  box-sizing: border-box;
  font-size: 13px;
  font-weight: 400;
}

.product-body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  transition: grid-template-columns 0.3s ease;
}

.product-chat {
  position: relative;
  min-width: 0;
  min-height: 394px;
  overflow: hidden;
}

.agent-greeting-message {
  position: absolute;
  top: 28px;
  left: 28px;
  display: flex;
  max-width: min(460px, calc(100% - 56px));
  align-items: flex-start;
  gap: 10px;
  animation: message-in 0.28s ease both;
}

.agent-greeting-message--inline {
  position: static;
  max-width: min(460px, 82%);
  flex: 0 0 auto;
}

.agent-greeting-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--agent-gradient-soft);
}

.agent-greeting-message > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.agent-greeting-message strong {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.agent-greeting-message p {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 4px 12px 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  font-size: 13px;
  line-height: 20px;
}

.agent-result-message p {
  white-space: pre-line;
}

.conversation-demo {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 28px 150px;
  box-sizing: border-box;
  overflow: auto;
}

.user-message {
  width: fit-content;
  max-width: 82%;
  align-self: flex-end;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  font-size: 13px;
  line-height: 24px;
  animation: message-in 0.28s ease both;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid transparent;
  border-top-color: var(--color-text-primary);
  border-left-color: var(--color-text-primary);
  border-radius: 999px;
  box-sizing: border-box;
  animation: spin 0.9s linear infinite;
}

.streaming-cursor {
  display: inline-block;
  width: 1.5px;
  height: 1em;
  margin-left: 2px;
  background: currentColor;
  vertical-align: -0.12em;
  animation: streaming-cursor-blink 0.8s steps(1, end) infinite;
}

@keyframes streaming-cursor-blink {
  50% {
    opacity: 0;
  }
}

.demo-composer {
  position: absolute;
  right: 24px;
  bottom: 22px;
  left: 24px;
  z-index: 4;
  min-height: 108px;
  overflow: visible;
  transition:
    right 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    min-height 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.42s ease,
    gap 0.42s ease,
    border-color 0.3s ease,
    background-color 0.3s ease,
    box-shadow 0.3s ease;
}

.demo-composer .composer-content,
.demo-composer .composer-tools {
  opacity: 1;
  transition:
    opacity 0.2s ease,
    transform 0.35s ease;
}

.demo-composer.is-collapsed {
  height: 52px;
  min-height: 52px !important;
  justify-content: center;
  gap: 0;
  padding: 9px 12px;
}

.demo-composer.is-collapsed .composer-content,
.demo-composer.is-collapsed .composer-tools {
  position: absolute;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px) scale(0.96);
}

.demo-composer.is-collapsed .composer-toolbar-row {
  width: 100%;
  height: 32px;
  justify-content: flex-end;
  gap: 0;
}

.demo-composer.is-collapsed .send-button-real {
  transform: scale(1);
}

.demo-composer.is-collapsed .send-button-real:disabled {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}

.demo-window-picker {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  left: 0;
  z-index: 8;
  display: flex;
  max-height: 330px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: 0 14px 42px rgba(15, 15, 15, 0.16);
}

.demo-window-picker__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-quaternary);
  box-sizing: border-box;
  font-size: 13px;
}

.demo-window-picker__header strong {
  color: var(--color-text-primary);
  font-weight: 400;
}

.demo-window-picker__tools {
  display: flex;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 4px;
  box-sizing: border-box;
  font-size: 12px;
}

.demo-window-picker__tools button,
.demo-window-picker__tools label {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  color: var(--color-text-quaternary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
  font-size: 11px;
}

.demo-window-picker__tools button {
  margin-left: 6px;
  color: var(--color-text-primary);
}

.demo-window-picker__tools label {
  min-width: 0;
  flex: 1;
}

.demo-checkbox {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-primary);
  border-radius: 4px;
  box-sizing: border-box;
  color: #fff;
  font-size: 10px;
}

.demo-window-picker__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 12px 10px;
}

.demo-window-picker__list > div {
  display: flex;
  min-height: 35px;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 13px;
  transition: background 0.22s ease;
}

.demo-window-picker__list > div.selected {
  background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
}

.demo-window-picker__list > div.selected .demo-checkbox {
  border-color: #11a3fd;
  background: #11a3fd;
}

.demo-window-picker__list .demo-checkbox i {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  opacity: 0;
  font-style: normal;
}

.demo-window-picker__list .demo-checkbox img {
  width: 12px;
  height: 12px;
  filter: invert(1);
}

.demo-window-picker__list > div.selected .demo-checkbox i {
  opacity: 1;
}

.demo-window-picker__list strong {
  font-weight: 400;
}

.demo-window-picker__footer {
  display: flex;
  min-height: 55px;
  align-items: center;
  gap: 5px;
  padding: 10px 20px;
  border-top: 1px solid var(--color-border-secondary);
  box-sizing: border-box;
}

.demo-window-picker__footer button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  font-size: 12px;
}

.demo-window-picker__footer button.primary {
  border-color: #11a3fd;
  color: #fff;
  background: #11a3fd;
}

.demo-window-picker__footer button.primary.confirming {
  box-shadow: 0 0 0 4px rgba(17, 163, 253, 0.2);
  transform: scale(0.97);
}

.demo-auto-cursor {
  position: absolute;
  z-index: 12;
  color: var(--color-text-primary);
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
  font-size: 22px;
  pointer-events: none;
  transition:
    top 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.18s ease;
}

.demo-auto-cursor img {
  display: block;
  width: 33px;
  height: 33px;
}

.demo-auto-cursor.pressing {
  transform: scale(0.82);
}

.picker-pop-enter-active,
.picker-pop-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.composer-placeholder-text {
  color: var(--color-text-tertiary);
}

.send-button-real {
  position: relative;
  z-index: 2;
  cursor: pointer;
}

.send-button-real:disabled {
  cursor: default;
  opacity: 0.45;
}

.send-button-real.send-button-attention {
  animation: send-button-attention 1.65s ease-in-out infinite;
}

.send-button-real.send-button-attention::after {
  position: absolute;
  inset: -4px;
  border: 2px solid rgba(243, 89, 220, 0.56);
  border-radius: inherit;
  content: '';
  pointer-events: none;
  animation: send-button-attention-ring 1.65s ease-out infinite;
}

@keyframes send-button-attention {
  0%,
  38%,
  100% {
    transform: translateX(0) scale(1);
  }

  48% {
    transform: translateX(-2px) scale(1.08);
  }

  55% {
    transform: translateX(2px) scale(1.08);
  }

  62% {
    transform: translateX(-1px) scale(1.08);
  }

  70% {
    transform: translateX(0) scale(1.04);
  }
}

@keyframes send-button-attention-ring {
  0%,
  35% {
    opacity: 0;
    transform: scale(0.88);
  }

  48% {
    opacity: 0.85;
  }

  82%,
  100% {
    opacity: 0;
    transform: scale(1.38);
  }
}

.demo-actions {
  justify-content: space-between;
  gap: 12px;
}

.onboarding-completion-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(circle at 50% 42%, rgba(225, 83, 197, 0.13), transparent 38%), rgba(12, 10, 14, 0.54);
  backdrop-filter: blur(5px);
  box-sizing: border-box;
}

.onboarding-completion-dialog {
  position: relative;
  isolation: isolate;
  display: flex;
  width: min(460px, 100%);
  align-items: center;
  flex-direction: column;
  padding: 38px 36px 32px;
  overflow: hidden;
  border: 1px solid rgba(218, 84, 190, 0.2);
  border-radius: 24px;
  background: var(--color-bg-primary);
  box-shadow:
    0 34px 90px rgba(15, 15, 15, 0.28),
    0 8px 28px rgba(211, 69, 181, 0.12);
  box-sizing: border-box;
  text-align: center;
}

.onboarding-completion-dialog::before {
  position: absolute;
  z-index: -1;
  top: -190px;
  left: 50%;
  width: 430px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(238, 82, 205, 0.15), rgba(157, 106, 255, 0.07) 44%, transparent 72%);
  content: '';
  transform: translateX(-50%);
  animation: completion-ambient-glow 3.2s ease-in-out 0.5s infinite alternate;
}

.onboarding-completion-dialog::after {
  position: absolute;
  top: 0;
  right: 34px;
  left: 34px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(241, 107, 211, 0.62), transparent);
  content: '';
}

.onboarding-completion-visual {
  position: relative;
  display: grid;
  width: 180px;
  height: 132px;
  flex: 0 0 auto;
  place-items: center;
}

.onboarding-completion-orbit {
  position: absolute;
  border: 1px solid rgba(225, 78, 194, 0.2);
  border-radius: 50%;
  opacity: 0;
  animation: completion-orbit-expand 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.onboarding-completion-orbit--outer {
  width: 124px;
  height: 124px;
  animation-delay: 0.18s;
}

.onboarding-completion-orbit--inner {
  width: 98px;
  height: 98px;
  border-color: rgba(157, 106, 255, 0.3);
  animation-delay: 0.26s;
}

.onboarding-completion-icon {
  position: relative;
  z-index: 2;
  display: grid;
  width: 76px;
  height: 76px;
  border: 4px solid rgba(255, 255, 255, 0.94);
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #5c8dff 0%, #875cf5 48%, #e24fc1 100%);
  box-shadow:
    0 14px 36px rgba(135, 92, 245, 0.42),
    0 0 28px rgba(226, 79, 193, 0.2),
    inset 0 1px rgba(255, 255, 255, 0.35);
  box-sizing: border-box;
  opacity: 0;
  transform: scale(0.3) rotate(-18deg);
  animation: completion-icon-pop 0.82s cubic-bezier(0.2, 1.55, 0.35, 1) 0.16s forwards;
}

.onboarding-completion-icon::after {
  position: absolute;
  inset: -7px;
  border: 1px solid rgba(228, 80, 197, 0.22);
  border-radius: inherit;
  content: '';
  opacity: 0;
  animation: completion-success-pulse 1.8s ease-out 0.7s infinite;
}

.onboarding-completion-icon svg {
  display: block;
  overflow: visible;
}

.onboarding-completion-icon path {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: completion-check-draw 0.52s ease-out 0.68s forwards;
}

.onboarding-completion-particle {
  --particle-x: 0px;
  --particle-y: 0px;
  --particle-rotate: 0deg;
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #e84fbd;
  box-shadow: 0 2px 6px rgba(87, 47, 142, 0.16);
  opacity: 0;
  animation: completion-particle-burst 1.24s cubic-bezier(0.16, 1, 0.3, 1) 0.22s forwards;
}

.onboarding-completion-particle:nth-child(2n) {
  border-radius: 50%;
  background: #9d6aff;
}

.onboarding-completion-particle:nth-child(3n) {
  width: 5px;
  height: 14px;
  background: #f5aa32;
}

.onboarding-completion-particle:nth-child(4n) {
  background: #5b8dff;
  animation-delay: 0.28s;
}

.onboarding-completion-particle:nth-child(5n) {
  border-radius: 1px;
  background: #43cdb2;
  animation-delay: 0.34s;
}

.onboarding-completion-particle:nth-child(1) {
  --particle-x: -78px;
  --particle-y: -40px;
  --particle-rotate: -28deg;
}

.onboarding-completion-particle:nth-child(2) {
  --particle-x: -49px;
  --particle-y: -68px;
  --particle-rotate: 18deg;
}

.onboarding-completion-particle:nth-child(3) {
  --particle-x: -14px;
  --particle-y: -82px;
  --particle-rotate: 36deg;
}

.onboarding-completion-particle:nth-child(4) {
  --particle-x: 25px;
  --particle-y: -78px;
  --particle-rotate: 58deg;
}

.onboarding-completion-particle:nth-child(5) {
  --particle-x: 59px;
  --particle-y: -61px;
  --particle-rotate: 82deg;
}

.onboarding-completion-particle:nth-child(6) {
  --particle-x: 83px;
  --particle-y: -29px;
  --particle-rotate: 118deg;
}

.onboarding-completion-particle:nth-child(7) {
  --particle-x: 88px;
  --particle-y: 9px;
  --particle-rotate: 154deg;
}

.onboarding-completion-particle:nth-child(8) {
  --particle-x: 72px;
  --particle-y: 48px;
  --particle-rotate: 198deg;
}

.onboarding-completion-particle:nth-child(9) {
  --particle-x: 40px;
  --particle-y: 75px;
  --particle-rotate: 234deg;
}

.onboarding-completion-particle:nth-child(10) {
  --particle-x: 5px;
  --particle-y: 85px;
  --particle-rotate: 276deg;
}

.onboarding-completion-particle:nth-child(11) {
  --particle-x: -35px;
  --particle-y: 78px;
  --particle-rotate: 306deg;
}

.onboarding-completion-particle:nth-child(12) {
  --particle-x: -68px;
  --particle-y: 55px;
  --particle-rotate: 338deg;
}

.onboarding-completion-particle:nth-child(13) {
  --particle-x: -88px;
  --particle-y: 22px;
  --particle-rotate: 372deg;
}

.onboarding-completion-particle:nth-child(14) {
  --particle-x: -86px;
  --particle-y: -11px;
  --particle-rotate: 404deg;
}

.onboarding-completion-particle:nth-child(15) {
  --particle-x: -59px;
  --particle-y: -52px;
  --particle-rotate: 436deg;
}

.onboarding-completion-particle:nth-child(16) {
  --particle-x: 66px;
  --particle-y: 24px;
  --particle-rotate: 468deg;
}

.onboarding-completion-particle:nth-child(17) {
  --particle-x: 20px;
  --particle-y: 62px;
  --particle-rotate: 502deg;
}

.onboarding-completion-particle:nth-child(18) {
  --particle-x: -31px;
  --particle-y: 57px;
  --particle-rotate: 536deg;
}

.onboarding-completion-copy {
  display: flex;
  width: 100%;
  align-items: center;
  flex-direction: column;
}

.onboarding-completion-dialog h2 {
  margin: 10px 0 7px;
  color: var(--color-text-primary);
  font-family: Archivo, Inter, sans-serif;
  font-size: 24px;
  line-height: 32px;
  opacity: 0;
  animation: completion-content-rise 0.48s ease-out 0.48s forwards;
}

.onboarding-completion-dialog p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 22px;
}

.onboarding-completion-subtitle {
  opacity: 0;
  animation: completion-content-rise 0.48s ease-out 0.56s forwards;
}

.onboarding-completion-reward {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 84px;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  margin-top: 18px;
  padding: 14px 20px;
  border: 1px solid rgba(151, 99, 224, 0.18);
  border-radius: 16px;
  box-sizing: border-box;
  background: linear-gradient(105deg, rgba(241, 239, 255, 0.8), rgba(255, 242, 250, 0.72));
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  animation: completion-reward-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.64s forwards;
}

.onboarding-completion-reward-medal {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  place-items: center;
  border: 3px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(145deg, #ffd164, #ff9c54);
  box-shadow: 0 7px 16px rgba(241, 145, 68, 0.22);
  box-sizing: border-box;
}

.onboarding-completion-reward-medal svg {
  display: block;
  width: 24px;
  height: 24px;
}

.onboarding-completion-reward-copy {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  flex-direction: column;
}

.onboarding-completion-reward-main {
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}

.onboarding-completion-credits {
  min-width: 86px;
  color: #dc3caf;
  background: var(--agent-gradient);
  background-clip: text;
  filter: drop-shadow(0 5px 12px rgba(133, 83, 224, 0.16));
  font-family: Archivo, Inter, sans-serif;
  font-size: 29px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 34px;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: completion-credits-pop 0.72s cubic-bezier(0.2, 1.5, 0.35, 1) 0.62s both;
}

.onboarding-completion-credits-label {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.onboarding-completion-reward small {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 1px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.onboarding-completion-task-info {
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: default;
}

.onboarding-completion-task-info:hover,
.onboarding-completion-task-info:focus-visible {
  color: var(--color-text-primary);
}

.onboarding-completion-task-tooltip {
  display: grid;
  min-width: 196px;
  gap: 3px;
  white-space: nowrap;
}

.onboarding-completion-actions {
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 12px;
  margin-top: 22px;
  opacity: 0;
  animation: completion-content-rise 0.48s ease-out 0.74s forwards;
}

.onboarding-completion-actions button {
  flex: 1;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    filter 0.2s ease;
}

.onboarding-completion-actions button:hover {
  transform: translateY(-2px);
}

.onboarding-completion-actions .primary-action {
  box-shadow: 0 9px 22px rgba(218, 61, 175, 0.22);
}

.completion-dialog-enter-active,
.completion-dialog-leave-active {
  transition:
    opacity 0.32s ease,
    backdrop-filter 0.32s ease;
}

.completion-dialog-enter-active .onboarding-completion-dialog,
.completion-dialog-leave-active .onboarding-completion-dialog {
  transition:
    opacity 0.36s ease,
    filter 0.48s ease,
    transform 0.58s cubic-bezier(0.16, 1, 0.3, 1);
}

.completion-dialog-enter-from,
.completion-dialog-leave-to,
.completion-dialog-enter-from .onboarding-completion-dialog,
.completion-dialog-leave-to .onboarding-completion-dialog {
  opacity: 0;
}

.completion-dialog-enter-from .onboarding-completion-dialog,
.completion-dialog-leave-to .onboarding-completion-dialog {
  filter: blur(8px);
  transform: translateY(24px) scale(0.9);
}

@keyframes completion-icon-pop {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-18deg);
  }

  70% {
    opacity: 1;
    transform: scale(1.13) rotate(3deg);
  }

  100% {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}

@keyframes completion-check-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes completion-orbit-expand {
  0% {
    opacity: 0;
    transform: scale(0.55);
  }

  55% {
    opacity: 0.75;
  }

  100% {
    opacity: 0.25;
    transform: scale(1);
  }
}

@keyframes completion-success-pulse {
  0% {
    opacity: 0.55;
    transform: scale(0.86);
  }

  75%,
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@keyframes completion-particle-burst {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(0) scale(0.25);
  }

  22%,
  68% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--particle-x)), calc(-50% + var(--particle-y))) rotate(var(--particle-rotate))
      scale(1);
  }
}

@keyframes completion-content-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes completion-reward-in {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes completion-credits-pop {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.72);
  }

  68% {
    opacity: 1;
    transform: translateY(-2px) scale(1.08);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes completion-ambient-glow {
  from {
    opacity: 0.65;
    transform: translateX(-50%) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) scale(1.08);
  }
}

:deep(.scenario-prompt) {
  display: inline;
}

:deep(.demo-token) {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  margin: 0 3px;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 18px;
  vertical-align: middle;
  white-space: nowrap;
}

:deep(.demo-token--profile) {
  gap: 0;
  color: var(--color-text-tag-purple);
}

:deep(.demo-token__prefix),
:deep(.demo-token__detail) {
  min-height: 24px;
  padding: 2px 6px;
  box-sizing: border-box;
}

:deep(.demo-token__prefix) {
  border-radius: 8px 0 0 8px;
  background: var(--color-bg-tag-purple);
}

:deep(.demo-token__detail) {
  border-radius: 0 8px 8px 0;
  background: var(--color-bg-tag-purple-hover);
}

:deep(.demo-token--script) {
  padding: 2px 7px;
  color: var(--color-text-tag-blue);
  background: var(--color-bg-tag-blue);
}

@keyframes cursor-blink {
  50% {
    opacity: 0;
  }
}

@keyframes status-pulse {
  50% {
    opacity: 0.4;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (max-width: 900px) {
  .browser-main-demo {
    grid-template-columns: 116px minmax(0, 1fr);
  }

  .browser-sidebar-demo {
    padding-right: 7px;
    padding-left: 7px;
  }

  .composer-tools > span:nth-child(3) {
    display: none;
  }
}

@media (max-width: 760px) {
  .choose-workspace {
    grid-template-columns: 1fr;
  }

  .scenario-card {
    gap: 10px;
    padding: 12px;
  }

  .scenario-icon {
    width: 40px;
    height: 40px;
    flex-basis: 40px;
  }

  .browser-main-demo {
    grid-template-columns: 1fr;
  }

  .browser-sidebar-demo {
    display: none;
  }

  .browser-filterbar-demo button {
    display: none;
  }

  .welcome-flow {
    gap: 7px;
  }

  .onboarding-completion-mask {
    padding: 16px;
  }

  .onboarding-completion-dialog {
    padding: 32px 24px 24px;
    border-radius: 20px;
  }
}

@media (max-width: 420px) {
  .onboarding-completion-actions {
    flex-direction: column-reverse;
  }

  .onboarding-completion-actions button {
    width: 100%;
    flex: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-product-frame--create > .product-header,
  .agent-product-frame--create > .product-body,
  .agent-product-frame--publish > .product-header,
  .agent-product-frame--publish > .product-body,
  .agent-product-frame--nurture > .product-header,
  .agent-product-frame--nurture > .product-body,
  .agent-product-frame--analytics > .product-header,
  .agent-product-frame--analytics > .product-body,
  .browser-main-reveal-enter-active,
  .publish-grid-reveal-enter-active,
  .nurture-grid-reveal-enter-active,
  .analytics-grid-reveal-enter-active,
  .profile-row-enter-active,
  .spinner,
  .demo-status i,
  .send-button-real,
  .composer-content.typing::after,
  .onboarding-completion-dialog::before,
  .onboarding-completion-orbit,
  .onboarding-completion-icon,
  .onboarding-completion-icon::after,
  .onboarding-completion-icon path,
  .onboarding-completion-particle,
  .onboarding-completion-dialog h2,
  .onboarding-completion-subtitle,
  .onboarding-completion-reward,
  .onboarding-completion-credits,
  .onboarding-completion-actions {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
}
</style>
