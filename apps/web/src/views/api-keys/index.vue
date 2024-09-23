<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from 'primevue/useconfirm'
import { z } from 'zod'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import { getFormData, setInputFieldByInputKey, setInputValue } from '/@/utils'

const confirm = useConfirm()

const illustrate = [
  {
    title: 'Introductions:',
    content: 'Users can read and write account configuration information, create, open, and manage environments via API, and also achieve browser automation by integrating with automation frameworks such as Selenium, Puppeteer, and Playwright.',
  },
  {
    title: 'Restriction:',
    content: 'API request rate limit: 100 requests per minute<br>Team API concurrent devices limit: 200',
  },
  {
    title: 'Resources:',
    content: 'For API installations and instructions, please visit: <a class="decoration-underline" href="">API Documentation.</a>',
  },
]

const apiKey = ref()
const open = ref()
const port = ref()

const updateApiKeys = useDebounceFn(() => {
  API.base.userSetUserApiCreate({ apiKey: apiKey.value, open: open.value, port: port.value })
}, 300)

const inputs = ref([
  {
    placeholder: '127.0.0.1',
    disabled: true,
  },
  { separator: true },
  {
    name: 'port',
    // value: port.value,
    placeholder: '0~65535',
    onblur: () => {
      const formData = getFormData(inputs.value)
      const result = z.number().min(0).max(65535).safeParse(formData.port)
      if (result.error) {
        setInputFieldByInputKey(inputs.value, 'port', 'errorMsg', 'between 0~65535')
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
    header: 'Are you sure to reset the API Key? ',
    message: 'Projects using this key will be affected.?',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Reset',
      severity: 'info',
    },
    accept: async () => {
      apiKey.value = await window.electronAPI.send('base:apikey')
      updateApiKeys()
    },
  })
}

onMounted(() => {
  getApiKeys()
})
</script>

<template>
  <div class="flex flex-col w-full h-full api">
    <div class="api-header">
      <RxSvgIcon name="base/rx_ic_doc_code" />
      <span>API Keys</span>
    </div>
    <div class="flex-1 w-1/2 mx-auto">
      <div class="api-usage">
        <div>API keys usage:</div>
        <rxToggleSwitch v-model="open" :label="open ? 'Active' : 'Disable'" @change="updateApiKeys" />
      </div>
      <div class="api-content">
        <div class="api-content-reset">
          <div>API keys:</div>
          <ryButton severity="secondary" outlined size="small" icon="base/rx_ic_refresh" label="Reset API Key"
            @click="resetApiKey" />
        </div>
        <div class="api-content-desc">
          <RxSvgIcon name="base/rx_ic_info_fill" color="#FC9D12" />
          <div class="flex-1">
            IMPORTANT: The content that can be accessed with this API key is related to the permissions you currently
            have
            within the workspace.
          </div>
        </div>
        <div class="api-content-key">
          <div class="flex items-center justify-between">
            <div class="api-content-key-value">
              {{ apiKey }}
            </div>
            <ryButton severity="secondary" size="small" icon="base/rx_ic_copy" label="Copy" />
          </div>
          <div class="api-content-key-desc">
            * Please keep your API keys safe and should not abuse it.
          </div>
        </div>
        <div class="api-content-proxy">
          <div>
            <div>
              Proxy port:
            </div>
            <div class="api-content-proxy-desc">
              Port should be in between 0~65535
            </div>
          </div>
          <inputNumberGroup :inputs="inputs" />
        </div>
      </div>

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
