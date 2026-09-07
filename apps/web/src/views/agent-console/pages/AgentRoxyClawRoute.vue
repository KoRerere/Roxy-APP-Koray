<script setup lang="ts">
import { useRouter } from 'vue-router'
import { getImage } from '/@/utils/basic'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import AgentConsolePageLayout from '../components/AgentConsolePageLayout.vue'

type IntegrationStatus = 'checking' | 'connected' | 'disconnected' | 'not-configured'
type RoxyClawActionIcon = 'connect' | 'disconnect' | 'setup'

defineProps<{
  activeConversationId?: string
  routeTitle?: string | symbol
  thinking?: boolean
}>()

defineEmits<{
  send: []
}>()

const actionIconPaths: Record<RoxyClawActionIcon, string[]> = {
  connect: [
    getImage('roxy-claw/actions/connect-main.svg'),
    getImage('roxy-claw/actions/connect-line.svg'),
  ],
  setup: [
    getImage('roxy-claw/actions/setup-main.svg'),
    getImage('roxy-claw/actions/setup-line.svg'),
    getImage('roxy-claw/actions/setup-badge.svg'),
  ],
  disconnect: [
    getImage('roxy-claw/actions/disconnect-a.svg'),
    getImage('roxy-claw/actions/disconnect-b.svg'),
    getImage('roxy-claw/actions/disconnect-c.svg'),
    getImage('roxy-claw/actions/disconnect-d.svg'),
  ],
}

interface RoxyClawIntegration {
  id: 'wechat' | 'telegram' | 'lark' | 'discord'
  name: string
  icon: string
  routeName: string
  status: IntegrationStatus
}

defineModel<string>('prompt')

const router = useRouter()
const roxyClawStore = useRoxyClawStore()
const [showToast] = useResponseToast()
const [showModal] = useDialog()
const clawToggling = ref(false)
const integrationDeleting = ref<RoxyClawIntegration['id'] | null>(null)

const integrations = ref<RoxyClawIntegration[]>([
  {
    id: 'wechat',
    name: $t('微信'),
    icon: getImage('roxy-claw/wechat.svg'),
    routeName: 'agent-console-roxyclaw-wechat',
    status: 'not-configured',
  },
  {
    id: 'telegram',
    name: $t('Telegram'),
    icon: getImage('roxy-claw/telegram.svg'),
    routeName: 'agent-console-roxyclaw-telegram',
    status: 'not-configured',
  },
  {
    id: 'lark',
    name: $t('飞书 / Lark'),
    icon: getImage('roxy-claw/lark.png'),
    routeName: 'agent-console-roxyclaw-lark',
    status: 'not-configured',
  },
  {
    id: 'discord',
    name: $t('Discord'),
    icon: getImage('roxy-claw/discord.svg'),
    routeName: 'agent-console-roxyclaw-discord',
    status: 'not-configured',
  },
])

const unsupportedRouteNames = new Set<string>(['agent-console-roxyclaw-discord'])

function setIntegrationStatus(id: RoxyClawIntegration['id'], status: IntegrationStatus) {
  const integration = integrations.value.find(item => item.id === id)
  if (integration)
    integration.status = status
}

function isUnsupported(integration: RoxyClawIntegration) {
  return unsupportedRouteNames.has(integration.routeName)
}

function isActive(integration: RoxyClawIntegration) {
  return !isUnsupported(integration) && integration.status === 'connected'
}

function isConfigured(integration: RoxyClawIntegration) {
  switch (integration.id) {
    case 'wechat':
      return roxyClawStore.wechatConfigured
    case 'telegram':
      return roxyClawStore.telegramConfigured
    case 'lark':
      return roxyClawStore.larkConfigured
    case 'discord':
      return roxyClawStore.discordConfigured
  }
}

function isDirectDeletion(integration: RoxyClawIntegration) {
  return isConfigured(integration) && integration.id !== 'telegram'
}

function getActionIconType(integration: RoxyClawIntegration): RoxyClawActionIcon {
  if (isDirectDeletion(integration))
    return 'disconnect'
  if (integration.id === 'wechat' || integration.id === 'lark')
    return 'connect'

  return 'setup'
}

function getActionIconPaths(integration: RoxyClawIntegration) {
  return actionIconPaths[getActionIconType(integration)]
}

function getActionLabel(integration: RoxyClawIntegration) {
  if (isUnsupported(integration))
    return $t('即将上线')
  if (isDirectDeletion(integration))
    return $t('断开连接')

  if (integration.id === 'wechat' || integration.id === 'lark')
    return $t('连接')

  return $t('设置')
}

function getStatusLabel(integration: RoxyClawIntegration) {
  if (isActive(integration))
    return $t('已连接')
  if (integration.status === 'checking')
    return $t('连接中')
  if (integration.status === 'disconnected')
    return $t('连接失败')

  if (integration.id === 'wechat')
    return $t('未连接')

  return $t('未配置')
}

function handleIntegrationAction(integration: RoxyClawIntegration) {
  if (isUnsupported(integration))
    return

  if (isDirectDeletion(integration)) {
    showModal({
      header: $t('删除配置'),
      modal: true,
      okText: $t('确认删除'),
      okProps: { severity: 'danger' },
      slots: {
        default: () => h('p', {
          class: 'text-[var(--colors-text-text-secondary)] text-[14px] leading-[1.6] my-0',
        }, $t('此操作将清空 {title} 的所有配置，确认继续？', { title: integration.name })),
      },
      handleOk: () => deleteIntegrationConfig(integration),
    })
    return
  }

  router.push({ name: integration.routeName })
}

async function deleteIntegrationConfig(integration: RoxyClawIntegration) {
  integrationDeleting.value = integration.id

  try {
    switch (integration.id) {
      case 'wechat':
        await roxyClawStore.updateConfig({ wechat_bot_token: '' })
        break
      case 'telegram':
        await roxyClawStore.updateConfig({ tg_bot_token: '', tg_allowed_chat_ids: [] })
        break
      case 'lark':
        await roxyClawStore.updateConfig({ lark_app_id: '', lark_app_secret: '', lark_allowed_chat_ids: [] })
        break
      case 'discord':
        await roxyClawStore.updateConfig({ discord_bot_token: '', discord_allowed_user_ids: [] })
        break
    }

    if (isConfigured(integration)) {
      throw new Error(`Failed to delete ${integration.id} configuration`)
    }

    setIntegrationStatus(integration.id, 'not-configured')
    showToast(0, roxyClawStore.isEnabled
      ? $t('配置已删除，RoxyClaw 正在重启中...')
      : $t('配置已删除'))
  }
  catch (error) {
    console.error('Failed to delete RoxyClaw integration config:', error)
    showToast(1, $t('配置删除失败'))
  }
  finally {
    integrationDeleting.value = null
  }
}

async function handleRoxyClawToggle() {
  clawToggling.value = true

  try {
    const result = roxyClawStore.isEnabled
      ? await roxyClawStore.stopRoxyClaw()
      : await roxyClawStore.startRoxyClaw()

    showToast(result.success ? 0 : 1, result.message || $t('操作失败'))
  }
  finally {
    clawToggling.value = false
  }
}

async function refreshIntegrationStatuses() {
  await roxyClawStore.fetchConfig()

  integrations.value.forEach((integration) => {
    if (!isUnsupported(integration))
      integration.status = 'not-configured'
  })

  const checks: Promise<void>[] = []

  if (roxyClawStore.wechatConfigured)
    setIntegrationStatus('wechat', 'connected')

  if (roxyClawStore.telegramConfigured) {
    setIntegrationStatus('telegram', 'checking')
    checks.push(
      (async () => {
        const result = await roxyClawStore.testTelegram(roxyClawStore.config.tg_bot_token)
        setIntegrationStatus('telegram', result.success ? 'connected' : 'disconnected')
      })(),
    )
  }

  if (roxyClawStore.larkConfigured) {
    setIntegrationStatus('lark', 'checking')
    checks.push(
      (async () => {
        const result = await roxyClawStore.testLark(
          roxyClawStore.config.lark_app_id,
          roxyClawStore.config.lark_app_secret,
          roxyClawStore.config.lark_environment,
        )
        setIntegrationStatus('lark', result.success ? 'connected' : 'disconnected')
      })(),
    )
  }

  if (roxyClawStore.discordConfigured) {
    setIntegrationStatus('discord', 'checking')
    checks.push(
      (async () => {
        const result = await roxyClawStore.testDiscord(roxyClawStore.config.discord_bot_token)
        setIntegrationStatus('discord', result.success ? 'connected' : 'disconnected')
      })(),
    )
  }

  await Promise.allSettled(checks)
}

onMounted(() => {
  void refreshIntegrationStatuses()
})
</script>

<template>
  <AgentConsolePageLayout :show-profile-monitor-toggle="false" overflow="auto" padding="110px 24px 48px" mobile-padding="72px 16px 32px">
    <div class="hero">
      <div class="claw-mark">
        <img
          class="claw-mark__image"
          :src="getImage('roxy-claw/logo/roxyclaw-logo.svg')"
          alt=""
          draggable="false"
        >
      </div>
      <h1>RoxyClaw</h1>
      <p>
        {{ $t('手机端 Roxy AI Agent，随心远程驾驭客户端') }}
      </p>
    </div>

    <section class="standby-card" :class="{ active: roxyClawStore.isEnabled }">
      <div class="standby-copy">
        <span v-if="roxyClawStore.isEnabled" class="live-dot" aria-hidden="true">
          <span />
        </span>
        <div>
          <h2>{{ roxyClawStore.isEnabled ? $t('RoxyClaw 已启动') : $t('RoxyClaw 未启动') }}</h2>
          <p>
            {{
              roxyClawStore.isEnabled
                ? $t('您现在可以通过手机深度控制 Roxy浏览器')
                : $t('点击 "启动 RoxyClaw" 开始通过手机控制 Roxy浏览器')
            }}
          </p>
        </div>
      </div>

      <button
        class="claw-toggle"
        :class="{ danger: roxyClawStore.isEnabled }"
        type="button"
        :disabled="clawToggling"
        @click="handleRoxyClawToggle"
      >
        <i v-if="clawToggling" class="i-svg-spinners:180-ring-with-bg" />
        <svg
          v-else-if="roxyClawStore.isEnabled"
          class="claw-toggle__stop-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" />
          <path d="M9.38886 15.1629C9.89331 15.5 10.5955 15.5 12 15.5C13.4045 15.5 14.1067 15.5 14.6111 15.1629C14.8295 15.017 15.017 14.8295 15.1629 14.6111C15.5 14.1067 15.5 13.4045 15.5 12C15.5 10.5955 15.5 9.89331 15.1629 9.38886C15.017 9.17048 14.8295 8.98298 14.6111 8.83706C14.1067 8.5 13.4045 8.5 12 8.5C10.5955 8.5 9.89331 8.5 9.38886 8.83706C9.17048 8.98298 8.98298 9.17048 8.83706 9.38886C8.5 9.89331 8.5 10.5955 8.5 12C8.5 13.4045 8.5 14.1067 8.83706 14.6111C8.98298 14.8295 9.17048 15.017 9.38886 15.1629Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-else class="claw-toggle__icon" aria-hidden="true">
          <img :src="getImage('roxy-claw/actions/start-roxyclaw.svg')" alt="" draggable="false">
        </span>
        <span>{{ roxyClawStore.isEnabled ? $t('停止 RoxyClaw') : $t('启动 RoxyClaw') }}</span>
      </button>
    </section>

    <div class="integration-section">
      <header class="integration-heading">
        <h2>{{ $t('RoxyClaw 集成') }}</h2>
      </header>

      <div class="integration-grid">
        <article
          v-for="integration in integrations"
          :key="integration.id"
          class="integration-card"
          :class="{ unsupported: isUnsupported(integration) }"
        >
          <div class="integration-main">
            <span class="integration-icon">
              <img :src="integration.icon" alt="" draggable="false">
            </span>

            <div class="integration-copy">
              <h3>{{ integration.name }}</h3>
              <div v-if="isActive(integration)" class="status-row active">
                <SvgIcon name="base/rx_ic_check_fill" size="14" />
                <span>{{ getStatusLabel(integration) }}</span>
              </div>
              <div v-else-if="integration.status === 'checking'" class="status-row muted">
                <span>{{ getStatusLabel(integration) }}</span>
              </div>
              <div v-else-if="integration.status === 'disconnected'" class="status-row warning">
                <span>{{ getStatusLabel(integration) }}</span>
              </div>
              <div v-else-if="!isUnsupported(integration)" class="status-row muted">
                <span>{{ getStatusLabel(integration) }}</span>
              </div>
            </div>
          </div>

          <span v-if="isUnsupported(integration)" class="coming-soon">{{ $t('即将上线') }}</span>

          <button
            v-else
            class="integration-action"
            :class="{
              connected: isActive(integration),
              disconnect: isDirectDeletion(integration),
            }"
            type="button"
            :disabled="integrationDeleting === integration.id"
            @click="handleIntegrationAction(integration)"
          >
            <i v-if="integrationDeleting === integration.id" class="i-svg-spinners:180-ring-with-bg" />
            <span
              v-else
              class="integration-action__icon"
              :class="`integration-action__icon--${getActionIconType(integration)}`"
              aria-hidden="true"
            >
              <img
                v-for="iconPath in getActionIconPaths(integration)"
                :key="iconPath"
                :src="iconPath"
                alt=""
                draggable="false"
              >
            </span>
            <span>{{ getActionLabel(integration) }}</span>
          </button>
        </article>
      </div>

      <p class="integration-recommendation">
        {{ $t('* 我们推荐您使用 /new 指令来开始新任务，以提升 Roxy AI Agent 的表现') }}
      </p>
    </div>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
.hero {
  display: flex;
  width: min(100%, 720px);
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 0 auto 26px;
  text-align: center;
}

.claw-mark {
  position: relative;
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
}

.claw-mark__image {
  position: absolute;
  top: -17px;
  left: 50%;
  display: block;
  width: 81px;
  max-width: none;
  height: 81px;
  transform: translateX(-50%);
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  color: var(--color-text-primary);
  font-family: Archivo, Inter, system-ui, sans-serif;
  font-size: 24px;
  font-weight: 700;
  line-height: 28px;
}

.hero p {
  max-width: 704px;
  color: var(--color-text-tertiary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.standby-card {
  display: flex;
  width: min(100%, 720px);
  min-height: 88px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 auto 36px;
  padding: 24px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.standby-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;

  h2 {
    margin: 0 0 6px;
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 700;
    line-height: normal;
  }

  p {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: 12px;
    font-weight: 400;
    line-height: normal;
  }
}

.live-dot {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 40px;
  background: #abefc6;

  span {
    width: 6px;
    height: 6px;
    border-radius: 30px;
    background: #17b26a;
  }
}

.claw-toggle {
  box-sizing: border-box;
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  color: var(--color-text-primary-inverse, #fcfcfc);
  background: var(--color-bg-primary-inverse, #0f0f0f);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-primary-inverse-hover, #292929);
  }

  &.danger {
    color: #fff;
    background: #f04438;

    &:hover {
      background: #d92d20;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.claw-toggle__stop-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.claw-toggle__icon {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  overflow: hidden;

  img {
    position: absolute;
    top: 2.625px;
    left: 3px;
    width: 12px;
    height: 12.75px;
  }
}

:global([data-theme='dark'] .claw-toggle__icon img),
:global(.app-dark .claw-toggle__icon img) {
  filter: brightness(0);
}

.integration-section {
  width: min(100%, 720px);
  margin: 0 auto;
}

.integration-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;

  h2 {
    color: var(--color-text-primary);
    font-size: 20px;
    font-weight: 500;
    line-height: normal;
  }

  p {
    color: var(--color-text-tertiary, #525252);
    font-size: 12px;
    font-weight: 400;
    line-height: normal;
  }
}

.integration-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.integration-recommendation {
  margin-top: 12px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}

.integration-card {
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  height: 84px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 20px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.integration-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 12px;
}

.integration-icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  overflow: hidden;

  img {
    width: 36px;
    height: 36px;
    object-fit: contain;
    user-select: none;
  }
}

.integration-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;

  h3 {
    max-width: 132px;
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
    overflow-wrap: anywhere;
  }
}

.status-row {
  display: inline-flex;
  min-height: 14px;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;

  &.active {
    color: #17b26a;
  }

  &.muted {
    color: var(--color-text-quaternary, #737373);
  }

  &.warning {
    color: #dc6803;
  }
}

.coming-soon {
  flex: 0 0 auto;
  color: var(--color-text-disabled, #a3a3a3);
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  white-space: nowrap;
}

.integration-action {
  box-sizing: border-box;
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  color: var(--color-text-primary);
  box-shadow: none;
  border: var(--border-width-border, 1px) solid var(--color-border-secondary);
  background: var(--color-bg-primary);

  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-tertiary, #f5f5f5);
  }

  &.connected {
    border-color: var(--color-border-secondary);
    color: var(--color-text-primary);
    background: var(--color-bg-primary);

    &:hover {
      background: var(--color-bg-quaternary);
    }
  }

  &.disconnect:hover:not(:disabled) {
    border-color: var(--color-border-secondary);
    color: var(--color-text-error-primary, #f04438);
    background: var(--color-bg-primary);

    .integration-action__icon {
      filter: brightness(0) saturate(100%) invert(37%) sepia(88%) saturate(2225%) hue-rotate(341deg) brightness(104%)
        contrast(88%);
    }
  }

  &:disabled {
    border-color: var(--color-border-secondary);
    color: var(--color-text-quaternary);
    background: var(--color-bg-quaternary);
    cursor: not-allowed;
  }
}

.integration-action__icon {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  overflow: hidden;

  img {
    position: absolute;
    display: block;
  }

  &--connect {
    img:nth-child(1) {
      top: 4.5px;
      left: 0.75px;
      width: 16.5px;
      height: 9px;
    }

    img:nth-child(2) {
      top: 8.25px;
      left: 5.625px;
      width: 6.75px;
      height: 1.5px;
    }
  }

  &--setup {
    img:nth-child(1) {
      top: 1.5px;
      left: 1.5px;
      width: 15px;
      height: 15px;
    }

    img:nth-child(2) {
      top: 15px;
      left: 8.25px;
      width: 6px;
      height: 1.5px;
    }

    img:nth-child(3) {
      top: 3.375px;
      left: 10.125px;
      width: 4.5px;
      height: 4.5px;
    }
  }

  &--disconnect {
    img:nth-child(1) {
      top: 2.25px;
      left: 6.75px;
      width: 9px;
      height: 9.75px;
    }

    img:nth-child(2) {
      top: 6px;
      left: 2.25px;
      width: 9px;
      height: 9.75px;
    }

    img:nth-child(3) {
      top: 11.25px;
      left: 11.25px;
      width: 5.25px;
      height: 5.25px;
    }

    img:nth-child(4) {
      top: 1.5px;
      left: 1.5px;
      width: 5.25px;
      height: 5.25px;
    }
  }
}

:global([data-theme='dark'] .integration-action__icon),
:global(.app-dark .integration-action__icon) {
  filter: brightness(0) invert(1);
}

.integration-card.unsupported {
  opacity: 1;
}

@media (max-width: 760px) {
  .hero {
    margin-bottom: 24px;
  }

  .standby-card {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 32px;
  }

  .claw-toggle {
    width: 100%;
  }

  .integration-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .integration-card {
    height: auto;
    min-height: 84px;
    padding: 16px;
  }
}
</style>
