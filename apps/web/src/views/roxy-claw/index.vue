<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useThemeStore } from '/@/stores/theme'

const [showToast] = useResponseToast()
const roxyClawStore = useRoxyClawStore()
const themeStore = useThemeStore()
const router = useRouter()

const clawLogo = computed(() => themeStore.realTheme === 'dark'
  ? '/images/roxy-claw/roxyclaw-dark.png'
  : '/images/roxy-claw/roxyclaw-light.png')

const IMStatus = {
  Checking: 0,
  Connected: 1,
  Disconnected: 2,
  NotConfigured: 3,
} as const

const integrations = ref([
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '/images/roxy-claw/telegram.svg',
    status: IMStatus.NotConfigured,
    routeName: 'roxy-claw-telegram',
  },
  {
    id: 'lark',
    name: $t('飞书 / Lark'),
    icon: '/images/roxy-claw/lark.png',
    status: IMStatus.NotConfigured,
    routeName: 'roxy-claw-lark',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '/images/roxy-claw/discord.svg',
    status: IMStatus.NotConfigured,
    routeName: 'roxy-claw-discord',
    isComingSoon: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '/images/roxy-claw/slack.svg',
    status: IMStatus.NotConfigured,
    routeName: 'roxy-claw-slack',
    isComingSoon: true,
  },
  {
    id: 'wechat',
    name: $t('微信'),
    icon: '/images/roxy-claw/wechat.svg',
    status: IMStatus.NotConfigured,
    routeName: 'roxy-claw-wechat',
    isComingSoon: true,
  },
])

// 页面加载时检测连接状态（每次进入页面都检测）
onMounted(async () => {
  await roxyClawStore.fetchConfig()

  // 获取 RoxyClaw 状态
  if (globalThis.electronAPI) {
    try {
      const status = await globalThis.electronAPI.send('mcp:roxyClawStatus')
      await roxyClawStore.updateConfig({ enabled: status.enabled })
    }
    catch (error) {
      console.error('Failed to get RoxyClaw status:', error)
    }
  }

  // 先设置所有状态为 NotConfigured
  integrations.value.forEach((integration) => {
    if (!integration.isComingSoon) {
      integration.status = IMStatus.NotConfigured
    }
  })

  // 并行检测所有平台连接状态
  const testPromises: Promise<void>[] = []

  // 检测 Telegram
  if (roxyClawStore.telegramConfigured) {
    const telegramIndex = integrations.value.findIndex(item => item.id === 'telegram')
    if (telegramIndex !== -1) {
      integrations.value[telegramIndex].status = IMStatus.Checking
      testPromises.push((async () => {
        const result = await roxyClawStore.testTelegram(roxyClawStore.config.tg_bot_token)
        integrations.value[telegramIndex].status = result.success ? IMStatus.Connected : IMStatus.Disconnected
      })())
    }
  }

  // 检测 Lark
  if (roxyClawStore.larkConfigured) {
    const larkIndex = integrations.value.findIndex(item => item.id === 'lark')
    if (larkIndex !== -1) {
      integrations.value[larkIndex].status = IMStatus.Checking
      testPromises.push((async () => {
        const result = await roxyClawStore.testLark(
          roxyClawStore.config.lark_app_id,
          roxyClawStore.config.lark_app_secret,
        )
        integrations.value[larkIndex].status = result.success ? IMStatus.Connected : IMStatus.Disconnected
      })())
    }
  }

  // 检测 Slack
  if (roxyClawStore.slackConfigured) {
    const slackIndex = integrations.value.findIndex(item => item.id === 'slack')
    if (slackIndex !== -1) {
      integrations.value[slackIndex].status = IMStatus.Checking
      testPromises.push((async () => {
        const result = await roxyClawStore.testSlack(roxyClawStore.config.slack_bot_token)
        integrations.value[slackIndex].status = result.success ? IMStatus.Connected : IMStatus.Disconnected
      })())
    }
  }

  // 检测 Discord
  if (roxyClawStore.discordConfigured) {
    const discordIndex = integrations.value.findIndex(item => item.id === 'discord')
    if (discordIndex !== -1) {
      integrations.value[discordIndex].status = IMStatus.Checking
      testPromises.push((async () => {
        const result = await roxyClawStore.testDiscord(roxyClawStore.config.discord_bot_token)
        integrations.value[discordIndex].status = result.success ? IMStatus.Connected : IMStatus.Disconnected
      })())
    }
  }

  if (roxyClawStore.wechatConfigured) {
    const index = integrations.value.findIndex(item => item.id === 'wechat')
    if (index !== -1) {
      integrations.value[index].status = IMStatus.Connected
    }
  }

  await Promise.all(testPromises)
})

async function toggleRoxyClaw() {
  if (roxyClawStore.isEnabled) {
    await roxyClawStore.updateConfig({ enabled: false })
    const { success, message } = await roxyClawStore.stopRoxyClaw()
    if (success) {
      showToast(0, message || 'RoxyClaw has been stopped successfully')
    }
    else {
      showToast(1, message || 'Failed to stop RoxyClaw')
    }
  }
  else {
    await roxyClawStore.updateConfig({ enabled: true })
    const { success, message } = await roxyClawStore.startRoxyClaw()
    if (success) {
      showToast(0, message || 'RoxyClaw has been started successfully')
    }
    else {
      showToast(1, message || 'Failed to start RoxyClaw')
    }
  }
}

function handleIntegrationClick(integration: any) {
  if (integration.routeName) {
    router.push({ name: integration.routeName })
  }
}
</script>

<template>
  <div class="relative size-full overflow-y-auto">
    <!-- Background gradient -->
    <div class="absolute inset-0 bg-[linear-gradient(180deg,var(--pattern-roxyclaw-bg)_-48.41%,var(--colors-background-bg-page)_27.3%)]" />

    <!-- Content -->
    <div class="relative z-10 flex h-full w-full flex-col items-center pt-10">
      <!-- Header section with logo and title -->
      <div class="flex flex-col items-center gap-3 mb-12">
        <!-- Logo with claw -->
        <img :src="clawLogo" alt="claw" class="w-16 object-contain select-none" draggable="false">

        <!-- Title -->
        <h1 class="font-['Archivo'] text-4xl font-bold text-[var(--colors-text-text-primary)] my-0 leading-none">
          RoxyClaw
        </h1>

        <!-- Subtitle -->
        <p class="text-center text-sm text-[var(--colors-text-text-tertiary)] font-[Inter] my-0">
          {{ $t('手机端 Roxy AI Agent，随心远程驾驭客户端') }}
        </p>
      </div>

      <!-- Active status card -->
      <div class="mb-11 flex w-[708px] items-center justify-between rounded-2xl border-solid border border-[var(--colors-border-border-subtle)] bg-[var(--colors-background-bg-action)] p-6">
        <div class="flex items-start gap-[13px]">
          <div class="mt-[3px]">
            <svg v-if="roxyClawStore.isEnabled" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="6" fill="#1DC94D" />
              <circle cx="10" cy="10" r="8" stroke="#1CC94D" stroke-opacity="0.4" stroke-width="4" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="6" fill="#7D8387" />
            </svg>
          </div>
          <div class="flex flex-col gap-[6px]">
            <div class="text-base font-bold text-[var(--colors-text-text-primary)]">
              {{ roxyClawStore.isEnabled ? $t('RoxyClaw 已启动') : $t('RoxyClaw 未启动') }}
            </div>
            <div class="text-xs font-normal text-[var(--colors-text-text-secondary)]">
              {{ roxyClawStore.isEnabled
                ? $t('您现在可以通过手机深度控制 Roxy 浏览器')
                : $t('点击 "启动 RoxyClaw" 开始通过手机控制 Roxy 浏览器') }}
            </div>
          </div>
        </div>
        <RxButton
          :severity="roxyClawStore.isEnabled ? 'danger' : 'primary'"
          size="lg"
          :icon="roxyClawStore.isEnabled ? 'base/rx_ic_pause' : 'base/rx_ic_play'"
          :label="roxyClawStore.isEnabled ? $t('停止 RoxyClaw') : $t('启动 RoxyClaw')"
          @click="toggleRoxyClaw"
        />
      </div>

      <!-- Integration section title -->
      <div class="w-[708px] mb-4 flex flex-col gap-2">
        <h2 class="text-xl font-bold text-[var(--colors-text-text-primary)] my-0">
          {{ $t('集成到您的工作场景') }}
        </h2>
        <p class="text-xs text-[var(--colors-text-text-tertiary)] my-0">
          {{ $t('选择您偏好的方式连接至 RoxyBrowser，支持同时连接多个即时通讯 App。') }}
        </p>
      </div>

      <!-- Integration cards grid -->
      <div class="grid w-[708px] grid-cols-2 gap-2">
        <div
          v-for="integration in integrations"
          :key="integration.id"
          class="flex h-[79px] items-center rounded-2xl bg-[var(--colors-background-bg-block)] px-[18px] py-[21px]"
        >
          <!-- Icon -->
          <div
            class="relative mr-4 flex size-[37px] items-center justify-center rounded-full overflow-hidden"
          >
            <img :src="integration.icon" class="size-9 select-none" draggable="false">
          </div>

          <!-- Name and status -->
          <div class="flex flex-1 flex-col gap-1">
            <div class="text-sm font-bold text-[var(--colors-text-text-primary)]">
              {{ integration.name }}
            </div>
            <!-- Connected 状态 -->
            <div v-if="!integration.isComingSoon && integration.status === IMStatus.Connected" class="flex items-center gap-1">
              <SvgIcon
                name="status/rx_ic_check_fill"
                size="14"
                class="text-[var(--colors-text-text-success)]"
              />
              <span class="text-[var(--colors-text-text-success)] text-3">{{ $t('连接正常') }}</span>
            </div>
            <!-- Disconnected 状态 -->
            <div v-if="!integration.isComingSoon && integration.status === IMStatus.Disconnected" class="flex items-center gap-1">
              <span class="text-[var(--colors-text-text-warning)] text-3">{{ $t('连接失败') }}</span>
            </div>
            <!-- Checking 状态 -->
            <div v-if="!integration.isComingSoon && integration.status === IMStatus.Checking" class="flex items-center gap-1">
              <span class="text-[var(--colors-text-text-inactive)] text-3">{{ $t('连接中...') }}</span>
            </div>
            <!-- NotConfigured 状态 -->
            <div v-if="!integration.isComingSoon && integration.status === IMStatus.NotConfigured" class="flex items-center gap-1">
              <span class="text-[var(--colors-text-text-inactive)] text-3">{{ $t('未配置') }}</span>
            </div>
          </div>

          <RxButton
            v-if="!integration.isComingSoon"
            severity="secondary"
            size="xxs"
            outlined
            icon="base/rx_ic_edit"
            :label="$t('配置')"
            @click="handleIntegrationClick(integration)"
          />

          <!-- Coming soon text -->
          <span
            v-else
            class="text-xs text-[var(--colors-text-text-inactive)]"
          >
            {{ $t('即将上线') }}
          </span>
        </div>
      </div>

      <div class="mt-2 text-left text-[var(--colors-text-text-tertiary)] w-[708px] text-3">
        {{ $t('* 我们推荐您使用 /new 指令来开始新任务，以提升 Roxy AI Agent 的表现') }}
      </div>
    </div>
  </div>
</template>
