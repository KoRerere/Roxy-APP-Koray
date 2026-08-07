<script setup lang="tsx">
import { getImage } from '/@/utils/basic'
import ConfigBase from './components/config-base.vue'
import { useRouter } from 'vue-router'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'

const roxyClawStore = useRoxyClawStore()
const [showToast] = useResponseToast()
const locale = useSimpleLocale()
const router = useRouter()

// 本地状态
const botToken = ref('')
const signingSecret = ref('')
const appToken = ref('')
const whitelistString = ref('')
const testLoading = ref(false)

// 从 store 加载数据
onMounted(() => {
  botToken.value = roxyClawStore.config.slack_bot_token
  signingSecret.value = roxyClawStore.config.slack_signing_secret
  appToken.value = roxyClawStore.config.slack_app_token
  whitelistString.value = roxyClawStore.config.slack_allowed_user_ids.join(', ')
})

function WhitelistHelperText() {
  return (
    <p class="my-0">
      {$t('如何获取您的用户 ID：在 Slack 中开启开发者模式 → 右键点击您的头像 → 选择「复制成员 ID」')}
    </p>
  )
}

// setupFields 响应式
const setupFields = computed(() => [
  {
    field: 'botToken',
    label: $t('Bot Token'),
    placeholder: 'xoxb-...',
    helperText: $t('从 Slack API 网站的 OAuth & Permissions 页面获取'),
    hasTestButton: true,
    testButtonText: $t('测试'),
    value: botToken.value,
    loading: testLoading.value,
    type: 'password',
    required: true,
  },
  {
    field: 'signingSecret',
    label: $t('Signing Secret'),
    placeholder: '...',
    helperText: $t('从 Slack API 网站的 Basic Information 页面获取'),
    value: signingSecret.value,
    type: 'password',
    required: true,
  },
  {
    field: 'appToken',
    label: $t('App Token'),
    placeholder: 'xapp-...',
    helperText: $t('从 Socket Mode 页面获取，用于内网部署'),
    value: appToken.value,
    type: 'password',
    required: true,
  },
  {
    field: 'whitelist',
    label: $t('允许白名单连接'),
    placeholder: $t('123456789, 987654321（用逗号分隔。留空表示拒绝所有。）'),
    helperTextComponent: WhitelistHelperText,
    value: whitelistString.value,
  },
])

const steps = [
  { text: $t('访问 Slack API 网站，点击 「Create New App」→「From scratch」') },
  { text: $t('在 「App Home」→「Show Tabs」，开启 「Allow users to send Slash commands and messages from the messages tab」') },
  { text: $t('在 「OAuth & Permissions」→「Bot Token Scopes」，添加 「chat:write」、「im:history」、「im:read」') },
  { text: $t('在 「Event Subscriptions」，开启 「Enable Events」，添加 「message.im」事件') },
  { text: $t('点击 「Install to Workspace」，复制 Bot User OAuth Token、Signing Secret、(可选) App Token 粘贴到下方 → 点击「测试」') },
  { text: $t('在 Slack 中添加 Bot，直接发消息给 Bot，获取你的用户 ID → 配置到白名单') },
  { text: $t('启动 「RoxyClaw」，发送一条消息给你的 Slack 机器人，出现回复即可成功') },
]

/**
 * 处理字段值变化
 */
function handleFieldUpdate(field: string, value: string) {
  if (field === 'botToken') {
    botToken.value = value
  }
  else if (field === 'signingSecret') {
    signingSecret.value = value
  }
  else if (field === 'appToken') {
    appToken.value = value
  }
  else if (field === 'whitelist') {
    whitelistString.value = value
  }
}

/**
 * 处理保存按钮点击
 */
async function handleSave() {
  try {
    await roxyClawStore.updateConfig({
      slack_bot_token: botToken.value,
      slack_signing_secret: signingSecret.value,
      slack_app_token: appToken.value,
      slack_allowed_user_ids: whitelistString.value.split(',').map(id => id.trim()).filter(Boolean),
      slack_allowed_channel_ids: [],
    })

    roxyClawStore.connectionStatus.slack = { checked: false, status: null }
    const msg = roxyClawStore.isEnabled
      ? $t('配置保存成功，RoxyClaw 正在重启中...')
      : $t('配置保存成功')
    showToast(0, msg)
  }
  catch (error) {
    console.error('Save failed:', error)
    showToast(1, $t('配置保存失败'))
  }
}

/**
 * 处理删除配置
 */
async function handleDelete() {
  try {
    await roxyClawStore.updateConfig({
      slack_bot_token: '',
      slack_signing_secret: '',
      slack_app_token: '',
      slack_allowed_user_ids: [],
      slack_allowed_channel_ids: [],
    })
    roxyClawStore.connectionStatus.slack = { checked: false, status: null }

    const msg = roxyClawStore.isEnabled
      ? $t('配置已删除，RoxyClaw 正在重启中...')
      : $t('配置已删除')
    showToast(0, msg)

    router.push({ name: 'agent-console-roxyclaw' })
  }
  catch (error) {
    console.error('Delete failed:', error)
    showToast(1, $t('配置删除失败'))
  }
}

/**
 * 处理测试
 */
async function handleTest(field: string) {
  if (field === 'botToken') {
    testLoading.value = true
    try {
      const result = await roxyClawStore.testSlack(botToken.value)
      showToast(result.success ? 0 : 1, result.message || $t('未知错误'))
    }
    catch (error) {
      showToast(1, $t('网络错误'))
    }
    finally {
      testLoading.value = false
    }
  }
}
</script>

<template>
  <ConfigBase
    :title="$t('集成到 Slack')"
    :icon="getImage('roxy-claw/slack.svg')"
    bg-color="#4a154b"
    :steps="steps"
    :setup-fields="setupFields"
    :is-integrate="locale.siteLocale === 'zh-CN'"
    @update:field-value="handleFieldUpdate"
    @test="handleTest"
    @save="handleSave"
    @delete="handleDelete"
  />
</template>
