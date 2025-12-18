<script setup lang="tsx">
import JsonEditor from '/@/components/Json-editor.vue'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import RxButton from '/@/components/rx-button'
import RxTabs from '/@/components/rx-tabs/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon } from '/@/components/rx-icon'
import type { SvgNames } from '/@/components/rx-icon'
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from 'primevue/useconfirm'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { findInputByName, setInputValue } from '/@/utils'
import { copyText } from '/@/utils/'
import { useUserStore } from '/@/stores/user'
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import { SubLevelEnum } from '/@/enums/pay'

const router = useRouter()
const confirm = useConfirm()
const [showToast, onlyErrorToast] = useResponseToast()
const { openTelegram, getOfficialFaqWebsite } = useSimpleLocale()
const { userPayInfo } = storeToRefs(useUserStore())
const { isOwner } = storeToRefs(useRoleStore())

const cssModule = useCssModule('text')
const original = ref()
const apiConfig = ref({
  apiKey: '',
  port: 0,
  open: false,
  apiRate: 50,
})
const hasOccupy = ref(false)

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

const apiDocUrl = computed(() => {
  return getOfficialFaqWebsite('/api-documentation/api-reference')
})

const mcpConfig = computed(() => {
  return JSON.stringify({
    mcpServers: {
      'roxybrowser-openapi': {
        command: 'npx',
        args: ['@roxybrowser/openapi@beta'],
        env: {
          ROXY_API_KEY: apiConfig.value.apiKey,
          ROXY_API_HOST: `http://127.0.0.1:${apiConfig.value.port}`,
        },
      },
      'roxybrowser-playwright-mcp': {
        command: 'npx',
        args: ['@roxybrowser/playwright-mcp@latest'],
      },
    },
  }, null, 2)
})

const apiList = computed(() => [
  {
    title: $t('API 接口限制'),
    content: () => (
      <I18nT tag="div" scope="global" keypath={$t('API 请求频率限制：{value} 次 / 分钟。{upgrade}', { value: apiConfig.value.apiRate, upgrade: '{upgrade}' })}>
        {{
          upgrade: () => isOwner.value && (
            <span
              class={`cursor-pointer ${cssModule.link}`}
              onClick={() => {
                const isSubscribe = [SubLevelEnum.Free, SubLevelEnum.Trial, SubLevelEnum.Expired].includes(userPayInfo.value.subLevel as SubLevelEnum)
                if (isSubscribe) {
                  router.push({ name: 'subscribe-plan' })
                }
                else {
                  router.push({ name: 'upgrade-plan' })
                }
              }}
            >
              {$t('升级以获得更多请求次数。')}
            </span>
          ),
        }}
      </I18nT>
    ),
  },
  {
    title: $t('API 文档'),
    content: () => (
      <div class="grid grid-cols-2 gap-2.5">
        <RxButton class="flex-1 !h-11" severity="secondary" outlined size="lg" onClick={() => window.open(apiDocUrl.value, '_blank')}>
          <div class="w-full flex items-center justify-start gap-1.5">
            <RxSvgIcon name="base/rx_ic_doc_api" color="var(--colors-icon-icon-brand)"></RxSvgIcon>
            <div class={`flex-1 text-left ${cssModule.text}`}>{$t('API 文档')}</div>
            <RxSvgIcon name="base/rx_ic_arrow_top_right" color="var(--colors-icon-icon-brand)"></RxSvgIcon>
          </div>
        </RxButton>
      </div>
    ),
  },
  {
    title: $t('集成代码示例'),
    content: () => {
      const codeExamples = [
        {
          icon: 'code/rx_code_nodejs',
          text: $t('{type} 案例', { type: 'NodeJS' }),
          url: getOfficialFaqWebsite('/api-documentation/api-endpoint.html#node-example'),
        },
        {
          icon: 'code/rx_code_python',
          text: $t('{type} 案例', { type: 'Python' }),
          url: getOfficialFaqWebsite('/api-documentation/api-endpoint.html#python-example'),
        },
      ]

      return (
        <div class="grid grid-cols-2 gap-2.5">
          {
            codeExamples.map(item => (
              <RxButton class="flex-1 !h-11" severity="secondary" outlined size="lg" onClick={() => window.open(item.url, '_blank')}>
                <div class="w-full flex items-center justify-start gap-1.5">
                  <RxSvgIcon name={item.icon as SvgNames}></RxSvgIcon>
                  <div class={`flex-1 text-left ${cssModule.text}`}>{item.text}</div>
                  <RxSvgIcon name="base/rx_ic_arrow_top_right" color="var(--colors-icon-icon-brand)"></RxSvgIcon>
                </div>
              </RxButton>
            ))
          }
        </div>
      )
    },
  },
])

const mcpList = [
  {
    title: $t('安装'),
    content: () => {
      return (
        <div class="flex flex-col gap-1.5">
          <div>{$t('标准配置适用于大多数工具')}</div>
          <div class={`relative w-full ${cssModule.copy}`}>
            <RxButton class={cssModule['copy-btn']} text size="xxs" icon="base/rx_ic_copy" label={$t('复制')} onClick={() => onCopy(mcpConfig.value)} />
            <JsonEditor class="min-h-75" modelValue={mcpConfig.value} editable={false}></JsonEditor>
          </div>
        </div>
      )
    },
  },
  {
    title: $t('需求'),
    content: () => (
      <I18nT tag="div" scope="global" keypath={$t('{link} 18 以上或最新', { link: '{link}' })}>
        {{
          link: () => <a class={`cursor-pointer ${cssModule.link}`} target="_blank" href="https://nodejs.org/en/download">Node.js</a>,
        }}
      </I18nT>
    ),
  },
  {
    title: $t('特定的客户端配置'),
    content: () => {
      const tabs = [
        {
          icon: 'websites/rx_site_claude',
          title: 'Claude Code',
          value: '1',
          render: () => (
            <div class="w-full flex flex-col">
              <div class={`pa-3 ${cssModule.platform}`}>{$t('使用 RoxyBrowser MCP 服务器来控制 Roxy 客户端:')}</div>
              <div class={`pa-3 rounded-md ${cssModule.cmd}`}>
                claude mcp add roxybrowser-openapi --env ROXY_API_KEY="
                {apiConfig.value.apiKey}
                " --env ROXY_API_HOST="http://127.0.0.1:
                {apiConfig.value.port}
                " -- npx @roxybrowser/openapi@beta
              </div>
              <div class={`pa-3 ${cssModule.platform}`}>{$t('要与 RoxyChrome 进行交互，请安装 roxybrowser-playwright-mcp:')}</div>
              <div class={`pa-3 rounded-md ${cssModule.cmd}`}>claude mcp add roxybrowser-playwright-mcp npx @roxybrowser/playwright-mcp@latest</div>
            </div>
          ),
        },
        {
          icon: 'websites/rx_site_codex',
          title: 'Codex',
          value: '2',
          render: () => (
            <div class="w-full flex flex-col">
              <div class={`pa-3 ${cssModule.platform}`}>{$t('使用 RoxyBrowser MCP 服务器来控制 Roxy 客户端:')}</div>
              <div class={`pa-3 rounded-md ${cssModule.cmd}`}>
                codex mcp add roxybrowser-openapi --env ROXY_API_KEY="
                {apiConfig.value.apiKey}
                " --env ROXY_API_HOST="http://127.0.0.1:
                {apiConfig.value.port}
                " -- npx @roxybrowser/openapi@beta
              </div>
              <div class={`pa-3 ${cssModule.platform}`}>{$t('要与 RoxyChrome 进行交互，请安装 roxybrowser-playwright-mcp:')}</div>
              <div class={`pa-3 rounded-md ${cssModule.cmd}`}>codex mcp add roxybrowser-playwright-mcp -- npx @roxybrowser/playwright-mcp@latest</div>
            </div>
          ),
        },
        {
          icon: 'websites/rx_site_cursor',
          title: 'Cursor',
          value: '3',
          render: () => (
            <div class="w-full flex flex-col">
              <div class="pa-3">{$t('前往 Cursor 设置 -> MCP -> 添加新的 MCP 服务器，然后粘贴以下内容:')}</div>
              <div class={`relative w-full ${cssModule.copy}`}>
                <RxButton class={cssModule['copy-btn']} text size="xxs" icon="base/rx_ic_copy" label={$t('复制')} onClick={() => onCopy(mcpConfig.value)} />
                <JsonEditor class="min-h-75" modelValue={mcpConfig.value} editable={false}></JsonEditor>
              </div>
            </div>
          ),
        },
        {
          icon: 'websites/rx_site_gemini',
          title: 'Gemini GLI',
          value: '4',
          render: () => (
            <div class="pa-3">
              <I18nT scope="global" keypath={$t('请遵循 MCP 安装{link}，并使用上述标准配置。', { link: '{link}' })}>
                {{
                  link: () => <a class={`cursor-pointer ${cssModule.link}`} target="_blank" href="https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson">{$t('指南')}</a>,
                }}
              </I18nT>
            </div>
          ),
        },
      ]
      return <RxTabs tabs={tabs} value="1"></RxTabs>
    },
  },
  {
    title: $t('使用 Roxy Playwright MCP 控制 RoxyChrome'),
    content: () => (
      <I18nT tag="div" scope="global" keypath={$t('PlayRoxy MCP 基于微软的 {link}，并针对 RoxyBrowser 的指纹浏览器功能进行了增强。', { link: '{link}' })}>
        {{
          link: () => <a class={`cursor-pointer ${cssModule.link}`} target="_blank" href="https://github.com/microsoft/playwright-mcp">Playwright MCP</a>,
        }}
      </I18nT>
    ),
  },
  {
    title: $t('MCP 资源'),
    content: () => {
      const resources = [
        {
          icon: 'websites/rx_site_github',
          text: 'roxybrowser-mcp-server',
          url: 'https://github.com/roxybrowserlabs/roxybrowser-mcp-server?tab=readme-ov-file#roxybrowser-mcp-server-beta',
        },
        {
          icon: 'websites/rx_site_github',
          text: 'roxybrowser-playwright-mcp',
          url: 'https://github.com/roxybrowserlabs/roxybrowser-playwright-mcp?tab=readme-ov-file#playwright-mcp',
        },
      ]
      return (
        <div class="grid grid-cols-2 gap-2.5">
          {
            resources.map(item => (
              <RxButton class="flex-1 !h-11" severity="secondary" outlined size="lg" onClick={() => window.open(item.url, '_blank')}>
                <div class="w-full flex items-center justify-start gap-1.5">
                  <RxSvgIcon name={item.icon as SvgNames}></RxSvgIcon>
                  <div class={`flex-1 text-left ${cssModule.text}`}>{item.text}</div>
                  <RxSvgIcon name="base/rx_ic_arrow_top_right" color="var(--colors-icon-icon-brand)"></RxSvgIcon>
                </div>
              </RxButton>
            ))
          }
        </div>
      )
    },
  },
  {
    title: $t('社群'),
    content: () => (
      <div class="grid grid-cols-2 gap-2.5">
        <div class="col-span-2">{$t('请向我们提供反馈，并加入我们的社区，共同创造更多价值。')}</div>
        <RxButton class="flex-1 !h-11" severity="secondary" outlined size="lg" onClick={openTelegram}>
          <div class="w-full flex items-center justify-start gap-1.5">
            <RxSvgIcon name="websites/rx_site_telegram" color="var(--colors-icon-icon-brand)"></RxSvgIcon>
            <div class={`flex-1 text-left ${cssModule.text}`}>{$t('Telegram 频道')}</div>
            <RxSvgIcon name="base/rx_ic_arrow_top_right" color="var(--colors-icon-icon-brand)"></RxSvgIcon>
          </div>
        </RxButton>
      </div>
    ),
  },
]

const updateApiKeys = useDebounceFn(async () => {
  const hasChange = Object.entries(apiConfig.value).some(([key, value]) => original.value[key] !== value)
  if (hasChange) {
    const { code, msg } = await API.base.userSetUserApiCreate(apiConfig.value)
    onlyErrorToast(code, msg)
    if (code === 0) {
      // 开关或端口改变时 重启 API 服务
      const { apiKey, open, port } = apiConfig.value
      const { apiKey: originalApiKey, open: originalOpen, port: originalPort } = original.value

      if (originalApiKey !== apiKey || originalOpen !== open || originalPort !== port) {
        electronAPI.send('app:restartAPIServer')
      }
      original.value = { ...apiConfig.value }
    }
  }
}, 300)

onBeforeMount(() => {
  getApiKeys()
})

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
      // window.electronAPI.send('app:saveSoftConfig', { apiKey: apiConfig.value.apiKey })
    },
  })
}

async function onCopy(text: string) {
  copyText(text)
  showToast(0, $t('复制成功'))
}
</script>

<template>
  <div class="flex flex-col w-full h-full api">
    <ViewsHeader :title="($route.meta.title as string)" />
    <div class="flex-1 w-full py-4 overflow-auto api-body">
      <div class="w-3/4 mx-auto">
        <div class="w-full grid grid-cols-18">
          <div class="col-span-6">
            <div class="py-2 api-title">
              {{ $t('API 设置') }}
            </div>
            <div class="api-desc">
              {{ $t('用户可以使用 API 快速创建、打开和管理窗口，并且还可以使用像 Selenium、Puppeteer 和 Playwright 这样的工具来自动化浏览器操作。') }}
            </div>
          </div>
          <div class="col-span-11 col-start-8">
            <div class="flex justify-between items-center px-3 pb-4 api-usage">
              <div>{{ $t('API 启用状态') }}</div>
              <RxToggleSwitch v-model="apiConfig.open" :label="apiConfig.open ? $t('启用') : $t('关闭')" @change="updateApiKeys" />
            </div>
            <template v-if="apiConfig.open">
              <div class="api-content">
                <div class="api-content-reset">
                  <div>{{ $t('API 密钥') }}</div>
                  <RxButton severity="secondary" outlined size="xxs" icon="base/rx_ic_refresh" :label="$t('重置 API 密钥')" @click="resetApiKey" />
                </div>
                <div class="api-content-key" :class="text.copy">
                  <div class="flex items-center justify-between">
                    <div class="api-content-key-value">
                      {{ apiConfig.apiKey }}
                    </div>
                    <RxButton :class="text['copy-btn']" text size="xxs" icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy(apiConfig.apiKey)" />
                  </div>
                  <div class="api-content-key-desc">
                    {{ $t('* 请确保您的 API 密钥安全保存') }}
                  </div>
                </div>
                <div class="flex items-center justify-between mt-6 px-3 api-content-proxy">
                  <div>{{ $t('端口设置') }}</div>
                  <inputNumberGroup class="api-content-proxy-port" :inputs="inputs" />
                </div>
                <RxAlert v-model:visible="hasOccupy" class="!w-full mt-4" type="error" :closable="false" :title="$t('端口已被占用')"
                         :content="$t('我们检测到你当前设置的端口 {port} 已被占用，请修改端口以正常使用 API 服务', { port: apiConfig.port })"
                />
              </div>
            </template>

            <div class="flex flex-col gap-8 py-6 px-3">
              <div v-for="item in apiList" :key="item.title" class="flex flex-col gap-3">
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
        <RxDivider line-only />
        <div class="w-full grid grid-cols-18">
          <div class="col-span-6">
            <div class="pt-6 pb-2 api-title">
              MCP [Beta]
            </div>
            <div class="api-desc">
              {{ $t('模型上下文协议（MCP）就像一个通用的 AI 插件系统——它让 AI 助手可以轻松连接和使用不同的应用程序、工具和数据，就像给你的浏览器添加扩展程序一样。') }}
            </div>
            <br>
            <I18nT class="api-desc" tag="div" scope="global" :keypath="$t('了解更多关于 {link}.', { link: '{link}' })">
              <template #link>
                <a class="cursor-pointer" :class="text.link" target="_blank" href="https://modelcontextprotocol.io/docs/getting-started/intro">MCP</a>
              </template>
            </I18nT>
          </div>
          <div class="col-span-11 col-start-8 flex flex-col gap-9 py-6 px-3">
            <RxAlert v-if="!apiConfig.open" class="!w-full" type="warn" :title="$t('您需要开启 API 才能正常使用 MCP 功能')" :closable="false" />
            <div v-for="item in mcpList" :key="item.title" class="flex flex-col gap-3">
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
  </div>
</template>

<style lang="scss" module="text">
.text {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: 16px;
}

.link {
  color: var(--colors-text-text-brand);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: none;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}

.platform {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 20px;
}

.cmd {
  border: 1px solid var(--primitives-netural-900);
  background: var(--pattern-editor-bg);
  color: var(--pattern-editor-code);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-weight: 500;
}

.copy {
  &:not(:hover) .copy-btn {
    display: none;
  }

  &-btn {
    position: absolute !important;
    right: 6px;
    top: 6px;
    border-color: transparent !important;
    background: #575d61 !important;
    color: white !important;
    z-index: 1;
  }
}
</style>

<style lang="scss" scoped>
:deep(.p-tablist-tab-list) {
  padding-left: 12px;
  padding-right: 12px;
}

.api {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 20px;
    font-weight: 700;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 20px;
  }

  &-body::-webkit-scrollbar {
    display: none;
  }

  &-usage {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    font-weight: 500;
    line-height: 24px;

    border-bottom: 1px solid var(--colors-border-divider);
  }

  &-content {
    padding: 16px 0px;
    border-bottom: 1px solid var(--colors-border-divider);

    &-reset {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0px var(--spacing-xl, 12px);

      color: var(--colors-text-text-primary, #fafafa);
      font-size: 12px;
      font-weight: 500;
      line-height: 24px;
    }

    &-key {
      position: relative;
      display: flex;
      flex-direction: column;
      margin-top: 6px;
      padding: 12px;
      gap: 12px;
      border-radius: 6px;
      background: var(--pattern-editor-bg);

      &-value {
        color: #fff;
        font-family: 'JetBrains Mono';
        font-size: 14px;
        font-weight: 500;
        line-height: 16px;
      }

      &-desc {
        color: var(--colors-text-text-inactive, #48555b);
        font-family: Inter;
        font-size: 12px;
        line-height: 16px;
      }
    }

    &-proxy {
      color: var(--colors-text-text-primary);
      font-size: 12px;
      font-weight: 500;
      line-height: 24px;

      &-port {
        max-width: 240px;
        font-family: 'JetBrains Mono';
      }
    }
  }

  &-illustrate {
    &-title {
      color: var(--colors-text-text-primary);
      font-size: 14px;
      font-weight: 600;
      line-height: 16px;
    }

    &-content {
      color: var(--colors-text-text-secondary);
      font-size: 12px;
      line-height: 20px;
    }
  }
}
</style>
