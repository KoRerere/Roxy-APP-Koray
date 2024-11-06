<script setup lang="tsx">
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon/'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { findInputByName, setInputValue } from '/@/utils'
import { copyText } from '/@/utils/'

const role = useRoleStore()
const toast = useToast()
const confirm = useConfirm()
const [showToast] = useResponseToast()

const illustrate = [
  {
    title: $t('功能概述'),
    content: () => $t('用户可以通过 API 的方式来读写账号配置信息、创建、打开和管理环境，还可以配合 Selenium、Puppeteer 和 Playwright 等自动化框架实现浏览器操作的自动化'),
  },
  {
    title: $t('API 接口限制'),
    content: () => $t('API 请求频率限制：100 次 / 分钟'),
  },
  {
    title: $t('API 使用说明'),
    content: () => (
      <I18nT keypath={$t('更多 API 功能和使用方法, 请参考 {link}', { link: '{link}' })}>
        {{
          link: () => (
            <a class="decoration-underline" target="__blank" href="https://www.roxybrowser.com/api/v2">
              {$t('API 文档')}
            </a>
          ),
        }}
      </I18nT>
    ),
  },
]

const original = ref()
const apiConfig = ref({
  apiKey: '',
  port: '',
  open: false,
})
const hasOccupy = ref(false)

const updateApiKeys = useDebounceFn(async () => {
  const hasChange = Object.entries(apiConfig.value).some(([key, value]) => original.value[key] !== value)
  if (hasChange) {
    const { code, msg } = await API.base.userSetUserApiCreate(apiConfig.value)
    showToast(code, msg)
    if (code === 0) {
      // 开关或端口改变时 重启 API 服务
      if (original.value.open !== apiConfig.value.open || original.value.port !== apiConfig.value.port) {
        electronAPI.send('app:restartAPIServer')
      }

      original.value = { ...apiConfig.value }
    }
  }
}, 300)

const inputs = ref([
  {
    type: 'number',
    placeholder: '127.0.0.1',
    disabled: true,
  },
  { separator: true },
  {
    type: 'number',
    name: 'port',
    placeholder: '0~65535',
    onblur: async () => {
      const input = findInputByName(inputs.value, 'port')

      if (input.value < 1 || input.value > 65535) {
        input.invalid = true
        input.errorMsg = $t('端口范围 1~65535')
        return
      }

      const port = await electronAPI.send('util:checkPort', input.value)
      console.log(port, input.value)
      if (port !== Number(input.value)) {
        input.invalid = true
        input.errorMsg = $t('端口已被占用')
        return
      }

      hasOccupy.value = false
      apiConfig.value.port = input.value
      updateApiKeys()
    },
  },
])

async function getApiKeys() {
  const { data } = await API.base.userGetUserApiList()
  original.value = { ...data }
  apiConfig.value = { ...data }
  const _port = Number(apiConfig.value.port)
  setInputValue(inputs.value, 'port', _port)
  const port = await electronAPI.send('util:checkPort', _port)
  console.log(port, _port)
  hasOccupy.value = port !== _port
}

async function resetApiKey() {
  confirm.require({
    header: $t('重置 API 密钥'),
    message: $t('您确认要重置 API 密钥吗？此操作会导致所有使用原 API 密钥的客户端无法正常工作'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      apiConfig.value.apiKey = await window.electronAPI.send('util:genApiKey')
      updateApiKeys()
    },
  })
}

async function onCopy() {
  copyText(apiConfig.value.apiKey)
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('复制成功'), life: 2500 })
}

onBeforeMount(() => {
  getApiKeys()
})
</script>

<template>
  <div class="flex flex-col w-full h-full api">
    <ViewsHeader class="api-header" :title="($route.meta.title as string)" />
    <div class="flex-1 w-full overflow-auto api-body">
      <div class="w-1/2 mx-auto">
        <div class="api-usage">
          <div>{{ $t('API 启用状态') }}</div>
          <rxToggleSwitch v-model="apiConfig.open" :label="apiConfig.open ? $t('启用') : $t('关闭')" @change="updateApiKeys" />
        </div>
        <template v-if="apiConfig.open">
          <div class="api-content">
            <div class="api-content-reset">
              <div>{{ $t('API 密钥') }}</div>
              <RxButton severity="secondary" outlined size="xxs" icon="base/rx_ic_refresh" :label="$t('重置 API 密钥')" @click="resetApiKey" />
            </div>
            <div v-if="!role.isOwner" class="api-content-desc">
              <RxSvgIcon name="base/rx_ic_info_fill" color="#FC9D12" />
              <div class="flex-1">
                {{ $t('重要提示: 使用此 API 密钥可执行的操作与您当前在该工作空间内的操作权限相关。') }}
              </div>
            </div>
            <div class="api-content-key">
              <div class="flex items-center justify-between">
                <div class="api-content-key-value">
                  {{ apiConfig.apiKey }}
                </div>
                <RxButton severity="secondary" text size="xxs" icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy" />
              </div>
              <div class="api-content-key-desc">
                * {{ $t('请确保您的 API 密钥安全保存') }}
              </div>
            </div>
            <div class="api-content-proxy">
              <div>
                <div>
                  {{ $t('端口设置') }}
                </div>
              </div>
              <inputNumberGroup :inputs="inputs" />
            </div>
            <RxAlert v-model:visible="hasOccupy" class="!w-full mt-4" type="error" :closable="false" :title="$t('端口已被占用')"
              :content="$t('我们检测到你当前设置的端口 {port} 已被占用，请修改端口以正常使用 API 服务', { port: apiConfig.port })" />
          </div>
        </template>

        <div class="api-illustrate">
          <div v-for="item in illustrate" :key="item.title">
            <div class="api-illustrate-title">
              {{ item.title }}
            </div>
            <div class="api-illustrate-content">
              <component :is="item.content" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.api {
  &-header {
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-body::-webkit-scrollbar {
    display: none;
  }

  &-usage {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2xl, 16px) var(--spacing-xl, 12px);

    color: #000;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: 24px;

    border-bottom: 0.5px solid var(--Colors-Border-border-subtle, #e4e8eb);
  }

  &-content {
    padding: var(--spacing-2xl, 16px) 0px;
    border-bottom: 0.5px solid var(--Colors-Border-border-subtle, #e4e8eb);

    &-reset {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0px var(--spacing-xl, 12px);

      color: #000;
      font-family: Inter;
      font-size: 12px;
      font-weight: 500;
      line-height: 24px;
    }

    &-desc {
      display: flex;
      margin-top: var(--spacing-md, 6px);
      padding: 12px;
      gap: 8px;
      border-radius: var(--radius-md, 6px);
      background: var(--Color-yellow-100, #fff5e6);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      line-height: 18px;
    }

    &-key {
      display: flex;
      flex-direction: column;
      margin-top: var(--spacing-md, 6px);
      padding: var(--spacing-xl, 12px);
      gap: var(--spacing-xl, 12px);
      border-radius: var(--radius-md, 6px);
      border: 1px solid var(--Color-neutrals-900, #171c1f);
      background: var(--Color-neutrals-800, #252a2e);

      &-value {
        color: #fff;
        font-family: 'JetBrains Mono';
        font-size: 14px;
        font-weight: 500;
        line-height: 16px;
      }

      &-desc {
        color: var(--Color-neutrals-300, #c7cdd1);
        font-family: Inter;
        font-size: 12px;
        line-height: 16px;
      }
    }

    &-proxy {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: var(--spacing-4xl, 24px);
      padding: 0px var(--spacing-xl, 12px);
      gap: 30px;

      color: #000;
      font-family: Inter;
      font-size: 12px;
      font-weight: 500;
      line-height: 24px;

      &-desc {
        color: var(--Colors-Text-text-tertiary, #7c8387);
        font-weight: 400;
        line-height: var(--Line-Height-text-xs, 16px);
      }
    }
  }

  &-illustrate {
    display: flex;
    flex-direction: column;
    padding: var(--spacing-4xl, 24px) var(--spacing-xl, 12px);
    gap: var(--spacing-4xl, 24px);

    &-title {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: 16px;
    }

    &-content {
      margin-top: var(--spacing-xl, 12px);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}
</style>
