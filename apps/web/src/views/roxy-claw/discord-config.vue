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
const whitelistString = ref('')
const testLoading = ref(false)

// 从 store 加载数据
onMounted(() => {
  botToken.value = roxyClawStore.config.discord_bot_token
  whitelistString.value = roxyClawStore.config.discord_allowed_user_ids.join(', ')
})

function WhitelistHelperText() {
  return (
    <p class="my-0">
      {$t('如何获取您的用户 ID：在 Discord 中开启开发者模式 → 右键点击您的头像 → 选择「复制用户 ID」')}
    </p>
  )
}

// setupFields 响应式
const setupFields = computed(() => [
  {
    field: 'botToken',
    label: 'Bot Token',
    placeholder: 'MTIz...',
    helperText: $t('从 Discord Developer Portal 的 Bot 页面获取'),
    hasTestButton: true,
    testButtonText: $t('测试'),
    value: botToken.value,
    loading: testLoading.value,
    type: 'password',
    required: true,
  },
  {
    field: 'whitelist',
    label: $t('允许白名单连接'),
    placeholder: $t('123456789, 987654321（用逗号分隔。留空表示拒绝所有。）'),
    helperTextComponent: WhitelistHelperText,
    value: whitelistString.value,
    required: true,
  },
])

const steps = [
  { text: $t('访问 Discord Developer Portal，点击 「New Application」') },
  { text: $t('在 「Bot」页面，点击 「Add Bot」') },
  { text: $t('在 「Privileged Gateway Intents」，开启 「Presence Intent」、「Server Members Intent」、「Message Content Intent」') },
  { text: $t('点击 「Reset Token」，复制 Token 保存 → 点击 「OAuth2」→「URL Generator」') },
  { text: $t('勾选 「bot」→ 勾选 「Send Messages」、「Read Message History」、「Read Messages/View Channels」') },
  { text: $t('复制 「Generated URL」，在浏览器打开 → 选择你的服务器 → 点击「授权」') },
  { text: $t('在 Discord 中开启 「开发者模式」→ 右键点击你自己的头像 → 选择「复制用户 ID」') },
  { text: $t('将 Token 和你的用户 ID 粘贴到下方 → 点击「测试」→ 启动「RoxyClaw」') },
]

/**
 * 处理字段值变化
 */
function handleFieldUpdate(field: string, value: string) {
  if (field === 'botToken') {
    botToken.value = value
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
      discord_bot_token: botToken.value,
      discord_allowed_user_ids: whitelistString.value.split(',').map(id => id.trim()).filter(Boolean),
    })

    roxyClawStore.connectionStatus.discord = { checked: false, status: null }
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
      discord_bot_token: '',
      discord_allowed_user_ids: [],
    })
    roxyClawStore.connectionStatus.discord = { checked: false, status: null }

    const msg = roxyClawStore.isEnabled
      ? $t('配置已删除，RoxyClaw 正在重启中...')
      : $t('配置已删除')
    showToast(0, msg)

    router.push({ name: 'roxy-claw-home' })
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
      const result = await roxyClawStore.testDiscord(botToken.value)
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
    :title="$t('集成到 Discord')"
    :icon="getImage('roxy-claw/discord.svg')"
    bg-color="#5865f2"
    :steps="steps"
    :setup-fields="setupFields"
    :is-integrate="locale.siteLocale === 'zh-CN'"
    @update:field-value="handleFieldUpdate"
    @test="handleTest"
    @save="handleSave"
    @delete="handleDelete"
  />
</template>
