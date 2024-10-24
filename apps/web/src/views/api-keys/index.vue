<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { z } from 'zod'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import { $t } from '/@/locales'
import { getFormData, setInputFieldByInputKey, setInputValue } from '/@/utils'
import { copyText } from '/@/utils/'

const toast = useToast()
const confirm = useConfirm()

const illustrate = [
  {
    title: $t('功能概述'),
    content: $t('用户可以通过 API 的方式来读写账号配置信息、创建、打开和管理环境，还可以配合 Selenium、Puppeteer 和 Playwright 等自动化框架实现浏览器操作的自动化'),
  },
  {
    title: $t('API 接口限制'),
    content: $t('API 请求频率限制：100 次 / 分钟'),
  },
  {
    title: $t('API 使用说明'),
    content: $t('更多 API 功能和使用方法, 请参考<a class="decoration-underline" target="__blank" href="https://lumibrowser.com/api/v2">API 文档</a>'),
  },
]

const apiKey = ref()
const open = ref()
const port = ref()

const updateApiKeys = useDebounceFn(() => {
  API.base.userSetUserApiCreate({
    apiKey: apiKey.value,
    open: open.value,
    port: port.value,
  }).then(({ msg }) => {
    toast.add({ severity: 'success', summary: $t('Success'), detail: msg, life: 5000 })
  })
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
    onblur: () => {
      const formData = getFormData(inputs.value)
      const result = z.number().min(0).max(65535).safeParse(formData.port)
      if (result.error) {
        setInputFieldByInputKey(inputs.value, 'port', 'errorMsg', $t('端口应设置在 0~65535 之间'))
      }
      else {
        port.value = formData.port
        updateApiKeys()
      }
    },
  },
])

async function getApiKeys() {
  const { data } = await API.base.userGetUserApiList()
  apiKey.value = data.apiKey
  open.value = data.open
  port.value = data.port
  setInputValue(inputs.value, 'port', port.value)
}

async function resetApiKey() {
  confirm.require({
    header: $t('Are you sure to reset the API Key?'),
    message: $t('Projects using this key will be affected.?'),
    rejectProps: {
      label: $t('Cancel'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('Reset'),
      severity: 'info',
    },
    accept: async () => {
      apiKey.value = await window.electronAPI.send('util:genApiKey')
      updateApiKeys()
    },
  })
}

async function onCopy() {
  copyText(apiKey.value)
  toast.add({ severity: 'success', summary: $t('Success'), detail: $t('Copied successfully'), life: 5000 })
}

onBeforeMount(() => {
  getApiKeys()
})
</script>

<template>
  <div class="flex flex-col w-full h-full api">
    <div class="api-header">
      <RxSvgIcon name="base/rx_ic_doc_code" />
      <span>{{ $route.meta.title }}</span>
    </div>
    <div class="flex-1 w-1/2 mx-auto">
      <div class="api-usage">
        <div>{{ $t('API 启用状态') }}</div>
        <rxToggleSwitch v-model="open" :label="open ? $t('启用') : $t('关闭')" @change="updateApiKeys" />
      </div>
      <template v-if="open">
        <div class="api-content">
          <div class="api-content-reset">
            <div>{{ $t('API 秘钥') }}</div>
            <RxButton severity="secondary" outlined size="sm" icon="base/rx_ic_refresh" :label="$t('重置 API 秘钥')" @click="resetApiKey" />
          </div>
          <div class="api-content-desc">
            <RxSvgIcon name="base/rx_ic_info_fill" color="#FC9D12" />
            <div class="flex-1">
              {{ $t('重要提示: 使用此 API 密钥可执行的操作与您当前在该工作空间内的操作权限相关。') }}
            </div>
          </div>
          <div class="api-content-key">
            <div class="flex items-center justify-between">
              <div class="api-content-key-value">
                {{ apiKey }}
              </div>
              <RxButton severity="secondary" size="sm" icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy" />
            </div>
            <div class="api-content-key-desc">
              * {{ $t('请确保您的 API 秘钥安全保存') }}
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
        </div>
      </template>

      <div class="api-illustrate">
        <div v-for="item in illustrate" :key="item.title">
          <div class="api-illustrate-title">
            {{ item.title }}
          </div>
          <div class="api-illustrate-content" v-html="item.content" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.api {
  &-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
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
        color: var(--Color-neutrals-500, #7c8387);
        font-family: Inter;
        font-size: 10px;
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
