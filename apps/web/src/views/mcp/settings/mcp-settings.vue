<script setup lang="tsx">
import { useDialog } from '/@/hooks/useDialog'
import type { UseDialogInstance } from '/@/hooks/useDialog'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useAgentApi } from '../agent-api'
import type { UserMcpServerConfig } from '../agent-api'
import RxButton from '/@/components/rx-button/index.vue'
import RxToggleSwitch from '/@/components/rx-toggle-switch/index.vue'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import Empty from './components/empty.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { I18nT } from 'vue-i18n'

type McpServerType = 'stdio' | 'http'

interface McpServer {
  id: string
  name: string
  enabled: boolean
  config: UserMcpServerConfig
  status?: { success?: boolean, error?: string }
}

const { listMcpServers, enableMcpServer, disableMcpServer, deleteMcpServer, upsertMcpServer, testMcpServer, importMcpServers } = useAgentApi()
const [showModal] = useDialog()
const { showMenu } = usePopupMenu()

const servers = ref<McpServer[]>([])
const loading = ref(false)

// 表单数据
const serverType = ref<McpServerType>('stdio')
const serverName = ref('')
const command = ref('')
const url = ref('')
const envVars = ref<Array<{ key: string, value: string }>>([])
const headers = ref<Array<{ key: string, value: string }>>([])
const editMode = ref(false)
const editingServer = ref<McpServer | null>(null)
const [showToast, onlyErrorToast] = useResponseToast()

async function loadServers() {
  loading.value = true
  try {
    const res = await listMcpServers()
    if (res.code === 0) {
      servers.value = (res.data || []).map((s: any) => ({
        id: s.name,
        name: s.name,
        enabled: s.enabled,
        config: s.config,
        status: s.status,
      }))
    }
  }
  catch (e) {
    console.error('Failed to load MCP servers:', e)
  }
  finally {
    loading.value = false
  }
}

async function handleToggle(server: McpServer) {
  try {
    if (server.enabled) {
      await disableMcpServer(server.name)
      server.enabled = false
    }
    else {
      const res = await enableMcpServer(server.name)
      if (res.code === 0) {
        server.enabled = res.data.success
        server.status = res.data
      }
    }
  }
  catch (e) {
    console.error('Failed to toggle server:', e)
  }
}

function resetForm() {
  serverType.value = 'stdio'
  serverName.value = ''
  command.value = ''
  url.value = ''
  envVars.value = [{ key: '', value: '' }]
  headers.value = [{ key: '', value: '' }]
  editMode.value = false
  editingServer.value = null
}

function addEnvVar() {
  envVars.value.push({ key: '', value: '' })
}

function removeEnvVar(index: number) {
  envVars.value.splice(index, 1)
}

function addHeader() {
  headers.value.push({ key: '', value: '' })
}

function removeHeader(index: number) {
  headers.value.splice(index, 1)
}

async function importFromClipboard() {
  try {
    const clipboardText = await navigator.clipboard.readText()
    const parsed = JSON.parse(clipboardText)

    // 校验是否是 Claude Desktop 格式 (mcpServers 对象)
    if (!parsed || typeof parsed !== 'object') {
      onlyErrorToast(-1, $t('剪贴板内容不是有效的 JSON'))
    }

    // 支持直接是 mcpServers 对象，或者包含 mcpServers 字段的对象
    const rawMcpServers = parsed.mcpServers || parsed

    if (typeof rawMcpServers !== 'object') {
      onlyErrorToast(-1, $t('剪贴板内容格式不正确'))
    }

    // 过滤和清洗每个服务器配置
    const mcpServers: Record<string, UserMcpServerConfig> = {}

    for (const [name, rawConfig] of Object.entries(rawMcpServers)) {
      if (!name || typeof name !== 'string') {
        continue
      }
      if (!rawConfig || typeof rawConfig !== 'object') {
        continue
      }

      const config = rawConfig as Record<string, any>
      const hasCommand = typeof config.command === 'string'
      const hasUrl = typeof config.url === 'string'

      if (!hasCommand && !hasUrl) {
        continue
      }

      // 只保留合法字段
      const cleanedConfig: UserMcpServerConfig = {}

      // 推断类型
      if (config.type === 'stdio' || config.type === 'http') {
        cleanedConfig.type = config.type
      }
      else if (hasCommand) {
        cleanedConfig.type = 'stdio'
      }
      else if (hasUrl) {
        cleanedConfig.type = 'http'
      }

      if (hasCommand) {
        // 将 args 合并进 command 字符串（带空格的参数用引号包裹），前端只维护单一命令字符串
        const argsList: string[] = Array.isArray(config.args)
          ? config.args.filter((a: any) => typeof a === 'string')
          : []
        const parts = [config.command, ...argsList].map((p: string) =>
          p.includes(' ') ? `"${p}"` : p,
        )
        cleanedConfig.command = parts.join(' ')
      }
      if (config.env && typeof config.env === 'object') {
        cleanedConfig.env = {}
        for (const [k, v] of Object.entries(config.env)) {
          if (typeof k === 'string' && typeof v === 'string') {
            cleanedConfig.env[k] = v
          }
        }
      }
      if (hasUrl) {
        cleanedConfig.url = config.url
      }
      if (config.headers && typeof config.headers === 'object') {
        cleanedConfig.headers = {}
        for (const [k, v] of Object.entries(config.headers)) {
          if (typeof k === 'string' && typeof v === 'string') {
            cleanedConfig.headers[k] = v
          }
        }
      }

      mcpServers[name] = cleanedConfig
    }

    if (Object.keys(mcpServers).length === 0) {
      onlyErrorToast(-1, $t('剪贴板内容格式不正确'))
    }

    await importMcpServers(mcpServers)
    await loadServers()
  }
  catch (e) {
    onlyErrorToast(-1, $t('导入失败'))
  }
}

function showCreateDialog(type: McpServerType) {
  resetForm()
  serverType.value = type
  showServerDialog()
}

function showTypeDropdown(event: MouseEvent) {
  showMenu(event, {
    model: [
      {
        label: $t('命令行(stdio)'),
        command: () => showCreateDialog('stdio'),
      },
      {
        label: $t('HTTP 请求'),
        command: () => showCreateDialog('http'),
      },
      {
        label: $t('从剪贴板导入 JSON'),
        command: importFromClipboard,
      },
    ],
    menuProps: {
      popup: true,
      class: 'w-[304px]',
    },
  })
}

function showEditDialog(server: McpServer) {
  editMode.value = true
  editingServer.value = server

  serverName.value = server.name
  serverType.value = server.config.type || 'stdio'
  if (server.config.command) {
    const argsList = server.config.args ?? []
    if (argsList.length > 0) {
      // 旧格式：args 单独存储，合并显示
      const parts = [server.config.command, ...argsList].map(p =>
        p.includes(' ') ? `"${p}"` : p,
      )
      command.value = parts.join(' ')
    }
    else {
      command.value = server.config.command
    }
  }
  if (server.config.url) {
    url.value = server.config.url
  }

  // 根据类型设置默认值
  if (serverType.value === 'stdio') {
    if (server.config.env && Object.keys(server.config.env).length > 0) {
      envVars.value = Object.entries(server.config.env).map(([key, value]) => ({ key, value: value as string }))
    }
    else {
      envVars.value = [{ key: '', value: '' }]
    }
    headers.value = []
  }
  else {
    if (server.config.headers && Object.keys(server.config.headers).length > 0) {
      headers.value = Object.entries(server.config.headers).map(([key, value]) => ({ key, value: value as string }))
    }
    else {
      headers.value = [{ key: '', value: '' }]
    }
    envVars.value = []
  }

  showServerDialog()
}

async function handleDelete(server: McpServer) {
  try {
    await deleteMcpServer(server.name)
    await loadServers()
  }
  catch (e) {
    console.error('Failed to delete server:', e)
  }
}

function showServerDialog() {
  const dialogTitle = editMode.value
    ? 'Edit MCP Server'
    : serverType.value === 'stdio'
      ? $t('通过命令行创建 MCP')
      : $t('通过 HTTP 请求创建 MCP')

  showModal({
    header: dialogTitle,
    showHeader: true,
    modal: true,
    blockScroll: true,
    class: 'w-[524px]',
    okText: $t('保存'),
    cancelText: $t('取消'),
    slots: {
      default: () => (
        <div class="flex flex-col gap-4 pt-2.5 pb-5">
          {/* Name */}
          <div class="flex flex-col gap-3">
            <label class="font-['Inter'] font-medium text-[14px] text-[var(--colors-text-text-primary)]">
              {$t('名称（帮助你识别工具）')}
            </label>
            <RxInputText
              modelValue={serverName.value}
              onUpdate:modelValue={(val: string) => serverName.value = val}
              size="md"
              placeholder="Enter server name"
              class="w-full"
            />
          </div>

          {/* Command (for stdio) */}
          {serverType.value === 'stdio' && (
            <div class="flex flex-col gap-3">
              <label class="font-['Inter'] font-medium text-[14px] text-[var(--colors-text-text-primary)]">
                {$t('命令')}
              </label>
              <RxInputText
                modelValue={command.value}
                onUpdate:modelValue={(val: string) => command.value = val}
                size="md"
                placeholder="node /path/to/server.js"
                class="w-full"
              />
            </div>
          )}

          {/* URL (for http/sse) */}
          {serverType.value !== 'stdio' && (
            <div class="flex flex-col gap-3">
              <label class="font-['Inter'] font-medium text-[14px] text-[var(--colors-text-text-primary)]">
                URL
              </label>
              <RxInputText
                modelValue={url.value}
                onUpdate:modelValue={(val: string) => url.value = val}
                size="md"
                placeholder="https://..."
                class="w-full"
              />
            </div>
          )}

          {/* Environment Variables */}
          {serverType.value === 'stdio' && (
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <label class="font-['Inter'] font-medium text-[14px] text-[var(--colors-text-text-primary)]">
                  {$t('环境变量')}
                </label>
                <span
                  onClick={addEnvVar}
                  class="font-['Inter'] text-[14px] text-[#11a3fd] hover:underline cursor-pointer"
                >

                  {$t('+ 添加')}
                </span>
              </div>
              {envVars.value.map((env, index) => (
                <div key={index} class="flex items-center gap-3">
                  <RxInputText
                    modelValue={env.key}
                    onUpdate:modelValue={(val: string) => env.key = val}
                    size="md"
                    placeholder="Key"
                    iconFieldClass="!w-[140px]"
                  />
                  <RxInputText
                    modelValue={env.value}
                    onUpdate:modelValue={(val: string) => env.value = val}
                    size="md"
                    placeholder="Value"
                    iconFieldClass="!flex-1"
                  />
                  <div
                    onClick={() => removeEnvVar(index)}
                    class="size-6 p-1 flex items-center justify-center rounded hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                  >
                    <SvgIcon name="base/rx_ic_bin_1" size="16" color="var(--colors-icon-icon-inactive)" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HTTP Headers */}
          {serverType.value !== 'stdio' && (
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <label class="font-['Inter'] font-medium text-[14px] text-[var(--colors-text-text-primary)]">
                  {$t('HTTP 请求头')}
                </label>
                <span
                  onClick={addHeader}
                  class="font-['Inter'] text-[14px] text-[#11a3fd] hover:underline cursor-pointer"
                >

                  {$t('+ 添加')}
                </span>
              </div>
              {headers.value.map((header, index) => (
                <div key={index} class="flex items-center gap-3">
                  <RxInputText
                    modelValue={header.key}
                    onUpdate:modelValue={(val: string) => header.key = val}
                    size="md"
                    placeholder="Key"
                    iconFieldClass="!w-[140px]"
                  />
                  <RxInputText
                    modelValue={header.value}
                    onUpdate:modelValue={(val: string) => header.value = val}
                    size="md"
                    placeholder="Value"
                    iconFieldClass="!flex-1"
                  />
                  <div
                    onClick={() => removeHeader(index)}
                    class="size-6 p-1 flex items-center justify-center rounded hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                  >
                    <SvgIcon name="base/rx_ic_bin_1" size="16" color="var(--colors-icon-icon-inactive)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      footer: (instance: UseDialogInstance) => (
        <div class="flex items-center justify-between w-full">
          <RxButton
            label={$t('取消')}
            class="p-button-outlined p-button-secondary"
            size="md"
            onClick={() => instance.handleCancel()}
          />
          <div class="flex items-center gap-2">
            <RxButton
              label={$t('验证')}
              class="p-button-outlined p-button-secondary"
              size="md"
              onClick={async () => {
                const config: UserMcpServerConfig = {
                  type: serverType.value,
                  ...(serverType.value === 'stdio'
                    ? {
                        command: command.value,
                        env: Object.fromEntries(envVars.value.filter(e => e.key).map(e => [e.key, e.value])),
                      }
                    : {
                        url: url.value,
                        headers: Object.fromEntries(headers.value.filter(e => e.key).map(e => [e.key, e.value])),
                      }),
                }
                try {
                  const result = await testMcpServer(serverName.value, config)
                  if (result.code === 0 && result.data.success) {
                    showToast(0, $t('验证成功'))
                  }
                  else {
                    onlyErrorToast(-1, $t('验证失败'))
                  }
                }
                catch (e) {
                  console.error('Validation failed:', e)
                }
              }}
            />

            <RxButton label={$t('保存')} size="md" onClick={() => instance.handleOk()}></RxButton>
          </div>
        </div>
      ),
    },
    handleCancel: resetForm,
    async handleOk() {
      const config: UserMcpServerConfig = {
        type: serverType.value,
        ...(serverType.value === 'stdio'
          ? {
              command: command.value,
              env: Object.fromEntries(envVars.value.filter(e => e.key).map(e => [e.key, e.value])),
            }
          : {
              url: url.value,
              headers: Object.fromEntries(headers.value.filter(e => e.key).map(e => [e.key, e.value])),
            }),
      }

      try {
        await upsertMcpServer(serverName.value, config, editMode.value ? editingServer.value?.name : undefined)
        resetForm()
        await loadServers()
      }
      catch (e) {
        console.error('Failed to save server:', e)
        return Promise.reject(e)
      }
    },
  })
}

onMounted(() => {
  loadServers()
})
</script>

<template>
  <div class="h-full" style="will-change: transform;">
    <!-- 标题和添加按钮 -->
    <div class="flex items-center justify-between mb-5">
      <div class="font-['Archivo'] font-semibold text-[var(--colors-text-text-primary)] text-6">
        MCP
      </div>
      <div class="relative">
        <RxButton
          :label="$t('新建')"
          icon="base/rx_ic_plus"
          size="md"
          @click="showTypeDropdown"
        />
      </div>
    </div>

    <!-- MCP Servers 列表 -->
    <div class="flex flex-col gap-4 overflow-y-auto h-[calc(100%-38px)]">
      <div
        v-for="server in servers"
        :key="server.id"
        class="bg-[var(--colors-background-bg-block)] rounded-1.5 py-10px px-4 flex items-center gap-3"
      >
        <!-- Server Name -->
        <div class="flex-1 font-['Inter'] text-[14px] text-[var(--colors-text-text-primary)] leading-[20px]">
          {{ server.name }}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <!-- Edit Button -->
          <button
            class="size-6 flex items-center justify-center rounded bg-transparent outline-none border-none  cursor-pointer"
            @click="showEditDialog(server)"
          >
            <SvgIcon name="base/rx_ic_edit" size="16" color="var(--colors-text-text-secondary)" />
          </button>

          <!-- Delete Button -->
          <button
            class="size-6 flex items-center justify-center rounded bg-transparent outline-none border-none  cursor-pointer"
            @click="handleDelete(server)"
          >
            <SvgIcon name="base/rx_ic_bin_1" size="16" color="var(--colors-text-text-secondary)" />
          </button>

          <!-- Toggle Switch -->
          <div :style="{ '--toggleswitch-height': '16px', '--toggleswitch-width': '22px', '--toggleswitch-handle-size': '10px', '--toggleswitch-gap': '3px' }">
            <RxToggleSwitch
              :model-value="server.enabled"
              @update:model-value="handleToggle(server)"
            />
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center text-sm text-gray-500 py-2">
        Loading...
      </div>

      <Empty
        v-else-if="servers.length === 0"
        icon="base/rx_ic_mcp"
        :title="$t('暂无 MCP')"
      >
        <I18nT :keypath="$t('关于 MCP 的信息与配置方法，请访问 {MCP}', { MCP: '{MCP}' })">
          <template #MCP>
            <a href="https://modelcontextprotocol.io/docs/getting-started/intro" target="_barnk" class="text-[var(--colors-text-text-brand)] underline">
              {{ $t('MCP 介绍') }}
            </a>
          </template>
        </I18nT>
      </Empty>
    </div>
  </div>
</template>
