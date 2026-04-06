<script setup lang="tsx">
import ConfigBase from './components/config-base.vue'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { I18nT } from 'vue-i18n'
import { useSimpleLocale } from '/@/stores/locale'

const roxyClawStore = useRoxyClawStore()
const [showToast] = useResponseToast()
const locale = useSimpleLocale()

// 本地状态
const botToken = ref('')
const whitelistString = ref('')
const testLoading = ref(false)

// 从 store 加载数据
onMounted(() => {
  botToken.value = roxyClawStore.config.tg_bot_token
  whitelistString.value = roxyClawStore.config.tg_allowed_chat_ids.join(', ')
})

// setupFields 响应式
const setupFields = computed(() => [
  {
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
function handleFieldUpdate(index: number, value: string) {
  if (index === 0) {
    botToken.value = value
  }
}

/**
 * 处理白名单值变化（只更新本地状态，不调用接口）
 */
function handleWhitelistUpdate(value: string) {
  whitelistString.value = value
}

/**
 * 处理保存按钮点击（调用接口更新所有配置）
 */
async function handleSave() {
  try {
    // 保存 Bot Token
    await roxyClawStore.updateConfig({
      tg_bot_token: botToken.value,
      tg_allowed_chat_ids: whitelistString.value.split(',').map(id => id.trim()).filter(Boolean),
    })

    // // 保存白名单
    // const whitelistIds =
    // await roxyClawStore.updateConfig({ tg_allowed_chat_ids: whitelistIds })

    // 重置连接状态，下次进入主页面时重新检测
    roxyClawStore.connectionStatus.telegram = { checked: false, status: null }

    // 显示保存成功的提示
    showToast(0, $t('配置保存成功'))
  }
  catch (error) {
    console.error('Save failed:', error)
    showToast(1, $t('配置保存失败'))
  }
}

/**
 * 处理测试
 */
async function handleTest(index: number) {
  if (index === 0) {
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
    icon="/images/roxy-claw/telegram.svg"
    bg-color="#44b6ef"
    :steps="steps"
    :setup-fields="setupFields"
    :whitelist-required="true"
    :whitelist-value="whitelistString"
    :is-integrate="locale.siteLocale === 'zh-CN'"
    @update:field-value="handleFieldUpdate"
    @update:whitelist="handleWhitelistUpdate"
    @test="handleTest"
    @save="handleSave"
  >
    <template #whitelistHelperText>
      <I18nT tag="p" :keypath="$t('如何获取您的 Chat ID：向您的 Bot 发送任何消息，然后在浏览器中打开 {link}，在响应中查找 message.chat.id。{icon}', { link: '{link}', icon: '{icon}' })" class="my-0 ">
        <template #link>
          <a v-if="botToken" class="decoration-solid text-[var(--colors-text-text-brand)] underline" :href="`https://api.telegram.org/bot${botToken}/getUpdates`" target="_blank">https://api.telegram.org/bot{{ botToken }}/getUpdates</a>
          <span v-else>https://api.telegram.org/bot{TOKEN}/getUpdates</span>
        </template>

        <template #icon>
          <RxTooltip>
            <p class="my-0 translate-y-0.5">
              <SvgIcon name="base/rx_ic_info" size="12" />
            </p>
            <template #content>
              <img src="/images/roxy-claw/bot.png" class="w-240px h-181px">
            </template>
          </RxTooltip>
        </template>
      </I18nT>
    </template>
  </ConfigBase>
</template>
