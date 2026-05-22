<script setup lang="tsx">
import { getImage } from '/@/utils/basic'
import ConfigBase from './components/config-base.vue'
import { useRouter } from 'vue-router'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { I18nT } from 'vue-i18n'
import { useSimpleLocale } from '/@/stores/locale'
import RxTooltip from '/@/components/rx-tooltip'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'

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
  botToken.value = roxyClawStore.config.tg_bot_token
  whitelistString.value = roxyClawStore.config.tg_allowed_chat_ids.join(', ')
})

function WhitelistHelperText() {
  return (
    <I18nT tag="p" keypath={$t('如何获取您的 Chat ID：向您的 Bot 发送任何消息，然后在浏览器中打开 {link}，在响应中查找 message.chat.id。{icon}', { link: '{link}', icon: '{icon}' })} class="my-0">
      {{
        link: () => {
          return botToken.value
            ? (
                <a class="decoration-solid text-[var(--colors-text-text-brand)] underline" href={`https://api.telegram.org/bot${botToken.value}/getUpdates`} target="_blank">
                  https://api.telegram.org/bot
                  {botToken.value}
                  /getUpdates
                </a>
              )
            : (
                <span>
                  https://api.telegram.org/bot
                  {'{TOKEN}'}
                  /getUpdates
                </span>
              )
        },
        icon: () => {
          return (
            <RxTooltip>
              {{
                content: () => <img src={getImage('roxy-claw/bot.png')} class="w-240px h-181px" />,
                default: () => (
                  <p class="my-0 translate-y-0.5">
                    <SvgIcon name="base/rx_ic_info" size="12" />
                  </p>
                ),
              }}
            </RxTooltip>
          )
        },
      }}
    </I18nT>
  )
}

// setupFields 响应式
const setupFields = computed(() => [
  {
    field: 'botToken',
    label: 'Bot token:',
    placeholder: '123456789:AaBbCcDdEe...',
    helperText: $t('通过发送 /newbot 到 {a}BotFather 获取', { a: '@' }),
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

/**
 * 自定义步骤组件
 */
function Step1Component() {
  return (
    <p class="leading-[21px] my-0">
      <I18nT keypath={$t('打开「Telegram」→搜索 {BotFather}', { BotFather: '{BotFather}' })}>
        {{
          BotFather: () => {
            return <a class="decoration-solid text-[var(--colors-text-text-brand)] underline" href="https://telegram.me/BotFather" target="_blank">@BotFather</a>
          },
        }}
      </I18nT>
    </p>
  )
}

function Step2Component() {
  return (
    <p class="leading-[21px] my-0">
      <I18nT keypath={$t('发送「{newbot}」→ 输入 机器人名称 和 用户名', { newbot: '{newbot}' })}>
        {{
          newbot: () => {
            return <span class="font-['JetBrains_Mono'] font-normal text-[var(--colors-text-text-tertiary)]">/newbot</span>
          },
        }}
      </I18nT>
    </p>
  )
}

const steps = [
  { component: Step1Component },
  { component: Step2Component },
  { text: $t('复制「{a}BotFather」返回的 Token （格式：数字:字符串）') },
  { text: $t('将「Token」粘贴到下方的配置框中 → 点击「测试」') },
  { text: $t('发送一条消息给你的 Telegram 机器人，点击「允许白名单连接」下方链接 → 获取 message.chat.id 中「id」') },
  { text: $t('启动「RoxyClaw」，发送一条消息给你的 Telegram 机器人，出现回复即可成功') },
]

/**
 * 处理字段值变化（只更新本地状态，不调用接口）
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
 * 处理保存按钮点击（调用接口更新所有配置）
 */
async function handleSave() {
  try {
    await roxyClawStore.updateConfig({
      tg_bot_token: botToken.value,
      tg_allowed_chat_ids: whitelistString.value.split(',').map(id => id.trim()).filter(Boolean),
    })

    // 重置连接状态，下次进入主页面时重新检测
    roxyClawStore.connectionStatus.telegram = { checked: false, status: null }

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
      tg_bot_token: '',
      tg_allowed_chat_ids: [],
    })
    roxyClawStore.connectionStatus.telegram = { checked: false, status: null }

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
      const result = await roxyClawStore.testTelegram(botToken.value)
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
    :title="$t('集成到 Telegram Bot')"
    :icon="getImage('roxy-claw/telegram.svg')"
    bg-color="#44b6ef"
    :steps="steps"
    :setup-fields="setupFields"
    :is-integrate="locale.siteLocale === 'zh-CN'"
    @update:field-value="handleFieldUpdate"
    @test="handleTest"
    @save="handleSave"
    @delete="handleDelete"
  />
</template>
