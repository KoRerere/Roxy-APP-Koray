<script setup lang="tsx">
import { getImage } from '/@/utils/basic'
import ConfigBase from './components/config-base.vue'
import { useRouter } from 'vue-router'
import { useRoxyClawStore } from '/@/stores/roxy-claw'
import { useResponseToast } from '/@/hooks/useResponseToast'

const roxyClawStore = useRoxyClawStore()
const [showToast] = useResponseToast()
const router = useRouter()

// 本地状态
const testLoading = ref(false)
const larkEnvironment = ref<'lark' | 'feishu'>('feishu')
const appId = ref('')
const appSecret = ref('')
const environmentOptions = [
  { label: 'Lark', value: 'lark' },
  { label: $t('飞书'), value: 'feishu' },
]

// 从 store 加载数据
onMounted(() => {
  larkEnvironment.value = roxyClawStore.config.lark_environment || 'feishu'
  appId.value = roxyClawStore.config.lark_app_id
  appSecret.value = roxyClawStore.config.lark_app_secret
})

// setupFields 响应式
const setupFields = computed(() => [
  {
    field: 'environment',
    label: $t('平台'),
    type: 'select',
    options: environmentOptions,
    value: larkEnvironment.value,
    required: true,
  },
  {
    field: 'appId',
    label: 'App ID',
    placeholder: '123456789',
    value: appId.value,
    required: true,
  },
  {
    field: 'appSecret',
    label: 'App Secret',
    placeholder: '123456789:AaBbCcDdEe...',
    hasTestButton: true,
    testButtonText: 'Test',
    value: appSecret.value,
    loading: testLoading.value,
    type: 'password',
    required: true,
  },
])

const permissions = [
  'im:message',
  'im:message.p2p_msg:readonly',
  'im:message.group_at_msg:readonly',
  'im:message:send_as_bot',
  'im:message:update',
]

function Step3() {
  return (
    <div class="flex flex-col gap-2 mb-3">
      {$t('在「权限管理」→「开通权限」申请下方的所需的权限')}
      <div class="content-start flex flex-wrap gap-[4px_10px] items-start relative shrink-0 w-full">
        {
          permissions.map((permission) => {
            return (
              <div
                class="bg-[var(--colors-background-bg-action)] border border-[var(--colors-border-border-subtle)] border-solid content-stretch flex items-center justify-center px-2 py-1 relative rounded-1 "
              >
                <div class="flex flex-col font-['JetBrains_Mono'] font-normal justify-center relative  text-[14px] text-[var(--colors-text-text-primary)] whitespace-nowrap text-3">
                  { permission }
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

const steps = [
  { text: $t('访问飞书开放平台，点击「创建企业自建应用」') },
  { text: $t('在「添加应用能力」中找到机器人，点击「添加」') },
  { component: Step3 },
  { text: $t('在「事件与回调」→点击「订阅方式」，选择「使用长连接接收事件」，点击「保存」') },
  { text: $t('在下方点击「添加事件」→ 搜索「接收信息」，选择「im.message.receive_v1」，点击「添加」→ 选择「确认开通权限」') },
  { text: $t('在「版本管理与发布」→ 点击「创建版本」，输入应用版本号和更新说明，点击「保存」→ 选择「确认发布」') },
  { text: $t('在「凭证与基础信息」页复制 App ID 和 App Secret 粘贴到下方的配置框中 → 点击「测试」') },
  { text: $t('启动「RoxyClaw」，发送一条消息给你的飞书机器人，出现回复即可成功') },
]

/**
 * 处理字段值变化（只更新本地状态，不调用接口）
 */
function handleFieldUpdate(field: string, value: string) {
  if (field === 'environment') {
    larkEnvironment.value = value as 'lark' | 'feishu'
  }
  else if (field === 'appId') {
    appId.value = value
  }
  else if (field === 'appSecret') {
    appSecret.value = value
  }
}

/**
 * 处理删除配置
 */
async function handleDelete() {
  try {
    await roxyClawStore.updateConfig({
      lark_app_id: '',
      lark_app_secret: '',
      lark_allowed_chat_ids: [],
    })
    roxyClawStore.connectionStatus.lark = { checked: false, status: null }

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
 * 处理保存按钮点击（调用接口更新所有配置）
 */
async function handleSave() {
  try {
    await roxyClawStore.updateConfig({
      lark_environment: larkEnvironment.value,
      lark_app_id: appId.value,
      lark_app_secret: appSecret.value,
    })

    // 重置连接状态，下次进入主页面时重新检测
    roxyClawStore.connectionStatus.lark = { checked: false, status: null }

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
 * 处理测试
 */
async function handleTest(field: string) {
  if (field === 'appSecret') {
    testLoading.value = true
    try {
      const result = await roxyClawStore.testLark(appId.value, appSecret.value, larkEnvironment.value)
      showToast(result.success ? 0 : 1, result.message || 'Unknown error')
    }
    catch (error) {
      showToast(1, 'Network error')
    }
    finally {
      testLoading.value = false
    }
  }
}
</script>

<template>
  <ConfigBase
    :title="$t('集成到 Lark/飞书 机器人')"
    :icon="getImage('roxy-claw/lark.png')"
    bg-color="#78d5b9"
    :steps="steps"
    :setup-fields="setupFields"
    :permissions="permissions"
    @update:field-value="handleFieldUpdate"
    @test="handleTest"
    @save="handleSave"
    @delete="handleDelete"
  />
</template>
