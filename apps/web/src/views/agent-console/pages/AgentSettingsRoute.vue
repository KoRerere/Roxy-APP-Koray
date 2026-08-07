<script setup lang="ts">
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { UserMcpServerConfig } from '../agentSettingsApi'
import { useAgentSettingsApi } from '../agentSettingsApi'
import { getMcpConfigErrorMessage, isValidMcpHttpUrl } from '../mcpErrorMessage'
import AgentInput from '../components/form/AgentInput.vue'

type McpCreateMode = 'stdio' | 'http' | 'json'
type McpServerType = 'stdio' | 'http'

interface KeyValueRow {
  id: number
  key: string
  value: string
}

interface McpServer {
  id: string
  name: string
  enabled: boolean
  config: UserMcpServerConfig
  status?: { success?: boolean, error?: string }
  builtin?: boolean
}

interface McpModeConfig {
  label: string
  title: string
  namePlaceholder?: string
  mainField?: {
    key: 'command' | 'url'
    label: string
    placeholder: string
    wide?: boolean
  }
  pairLabel?: string
}

const modeConfigs: Record<McpCreateMode, McpModeConfig> = {
  stdio: {
    label: $t('通过命令行创建 MCP'),
    title: $t('通过命令行创建 MCP'),
    namePlaceholder: $t('输入服务名称'),
    mainField: {
      key: 'command',
      label: $t('命令'),
      placeholder: 'node /path/to/server.js',
    },
    pairLabel: $t('环境变量'),
  },
  http: {
    label: $t('HTTP 请求'),
    title: $t('通过 HTTP 请求创建 MCP'),
    namePlaceholder: $t('输入服务名称'),
    mainField: {
      key: 'url',
      label: $t('URL'),
      placeholder: 'https://...',
      wide: true,
    },
    pairLabel: $t('HTTP 请求头'),
  },
  json: {
    label: $t('JSON'),
    title: $t('从剪贴板导入 JSON'),
  },
}

const modeOrder: McpCreateMode[] = ['stdio', 'http', 'json']
const {
  listMcpServers,
  enableMcpServer,
  disableMcpServer,
  deleteMcpServer,
  upsertMcpServer,
  testMcpServer,
  importMcpServers,
} = useAgentSettingsApi()
const [showToast, onlyErrorToast] = useResponseToast()

function getMcpServerType(config: UserMcpServerConfig): McpServerType {
  return config.type === 'http' || config.url ? 'http' : 'stdio'
}

function showMcpValidationError(error: unknown, type: McpServerType) {
  onlyErrorToast(-1, getMcpConfigErrorMessage(error, type), { summary: $t('验证失败') })
}

function showMcpSaveError(error: unknown, type: McpServerType) {
  onlyErrorToast(-1, getMcpConfigErrorMessage(error, type, 'save'), { summary: $t('保存失败') })
}

const servers = ref<McpServer[]>([])
const loading = ref(false)
const isCreating = ref(false)
const activeMode = ref<McpCreateMode>('stdio')
const openServerMenuId = ref<string | null>(null)
const editMode = ref(false)
const editingServer = ref<McpServer | null>(null)
const form = reactive({
  name: '',
  command: '',
  url: '',
})
const envRows = ref<KeyValueRow[]>([
  { id: 1, key: '', value: '' },
])
const headerRows = ref<KeyValueRow[]>([
  { id: 1, key: '', value: '' },
])
let nextRowId = 2

const activeModeConfig = computed(() => modeConfigs[activeMode.value])
const activePairRows = computed({
  get: () => activeMode.value === 'stdio' ? envRows.value : headerRows.value,
  set: (rows: KeyValueRow[]) => {
    if (activeMode.value === 'stdio')
      envRows.value = rows
    else
      headerRows.value = rows
  },
})
const activeType = computed<McpServerType>(() => activeMode.value === 'http' ? 'http' : 'stdio')

function createEmptyRow() {
  return { id: nextRowId++, key: '', value: '' }
}

function rowsFromRecord(record?: Record<string, string>) {
  const entries = Object.entries(record || {})
  return entries.length > 0
    ? entries.map(([key, value]) => ({ id: nextRowId++, key, value }))
    : [createEmptyRow()]
}

function recordFromRows(rows: KeyValueRow[]) {
  return Object.fromEntries(rows.filter(row => row.key).map(row => [row.key, row.value]))
}

function resetForm() {
  activeMode.value = 'stdio'
  form.name = ''
  form.command = ''
  form.url = ''
  envRows.value = [createEmptyRow()]
  headerRows.value = [createEmptyRow()]
  editMode.value = false
  editingServer.value = null
}

async function loadServers() {
  loading.value = true
  try {
    const res = await listMcpServers()
    if (res.code === 0) {
      servers.value = (res.data || []).map((server: any) => ({
        id: server.name,
        name: server.name,
        enabled: server.enabled,
        config: server.config || {},
        status: server.status,
        builtin: server.builtin,
      }))
      openServerMenuId.value = null
    }
    else {
      onlyErrorToast(-1, $t('MCP 服务加载失败，请稍后重试'))
    }
  }
  catch (error) {
    console.error('Failed to load MCP servers:', error)
    onlyErrorToast(-1, $t('MCP 服务加载失败，请稍后重试'))
  }
  finally {
    loading.value = false
  }
}

function showCreate(mode: McpCreateMode = 'stdio') {
  resetForm()
  activeMode.value = mode
  isCreating.value = true
}

function backToList() {
  isCreating.value = false
  openServerMenuId.value = null
  resetForm()
}

function toggleServerMenu(serverId: string) {
  openServerMenuId.value = openServerMenuId.value === serverId ? null : serverId
}

function closeServerMenuOnOutsideClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element))
    return

  if (target.closest('[data-mcp-server-menu]'))
    return

  openServerMenuId.value = null
}

function addPairRow() {
  activePairRows.value = [...activePairRows.value, createEmptyRow()]
}

function removePairRow(rowId: number) {
  if (activePairRows.value.length === 1) {
    activePairRows.value = [createEmptyRow()]
    return
  }

  activePairRows.value = activePairRows.value.filter(row => row.id !== rowId)
}

function buildConfig() {
  const type = activeType.value
  const config: UserMcpServerConfig = { type }

  if (type === 'stdio') {
    config.command = form.command.trim()
    config.env = recordFromRows(envRows.value)
  }
  else {
    config.url = form.url.trim()
    config.headers = recordFromRows(headerRows.value)
  }

  return config
}

function validateForm() {
  if (!form.name.trim()) {
    onlyErrorToast(-1, $t('名称必须填写'))
    return false
  }

  if (activeMode.value === 'stdio' && !form.command.trim()) {
    onlyErrorToast(-1, $t('命令必须填写'))
    return false
  }

  if (activeMode.value === 'http' && !form.url.trim()) {
    onlyErrorToast(-1, $t('URL 必须填写'))
    return false
  }

  if (activeMode.value === 'http' && !isValidMcpHttpUrl(form.url)) {
    onlyErrorToast(-1, $t('URL格式有误，必须以 http:// 或 https:// 开头'))
    return false
  }

  return true
}

function showEdit(server: McpServer) {
  editMode.value = true
  editingServer.value = server
  form.name = server.name
  activeMode.value = server.config.type === 'http' || server.config.url ? 'http' : 'stdio'
  form.command = ''
  form.url = ''

  if (server.config.command) {
    const argsList = server.config.args ?? []
    form.command = argsList.length > 0
      ? [server.config.command, ...argsList].map(part => part.includes(' ') ? `"${part}"` : part).join(' ')
      : server.config.command
  }

  if (server.config.url)
    form.url = server.config.url

  envRows.value = rowsFromRecord(server.config.env)
  headerRows.value = rowsFromRecord(server.config.headers)
  isCreating.value = true
  openServerMenuId.value = null
}

async function saveServer() {
  if (!validateForm())
    return

  try {
    const res = await upsertMcpServer(form.name.trim(), buildConfig(), editMode.value ? editingServer.value?.name : undefined)
    if (res.code !== 0)
      return showMcpSaveError(res, activeType.value)

    await loadServers()
    backToList()
  }
  catch (error) {
    console.error('Failed to save server:', error)
    showMcpSaveError(error, activeType.value)
  }
}

async function verifyServer() {
  if (!validateForm())
    return

  try {
    const res = await testMcpServer(form.name.trim(), buildConfig())
    if (res.code === 0 && res.data?.success)
      showToast(0, $t('验证成功'))
    else
      showMcpValidationError(res.data?.error || res.msg || res.message, activeType.value)
  }
  catch (error) {
    console.error('Validation failed:', error)
    showMcpValidationError(error, activeType.value)
  }
}

async function toggleServer(server: McpServer) {
  try {
    if (server.enabled) {
      const res = await disableMcpServer(server.name)
      if (res.code !== 0)
        return onlyErrorToast(-1, $t('MCP 服务状态更新失败，请稍后重试'))
      server.enabled = false
      return
    }

    const res = await enableMcpServer(server.name)
    if (res.code === 0) {
      server.enabled = !!res.data?.success
      server.status = res.data
      if (!res.data?.success)
        showMcpValidationError(res.data?.error, getMcpServerType(server.config))
    }
    else {
      showMcpValidationError(res, getMcpServerType(server.config))
    }
  }
  catch (error) {
    console.error('Failed to toggle server:', error)
    onlyErrorToast(-1, $t('MCP 服务状态更新失败，请稍后重试'))
  }
}

async function removeServer(server: McpServer) {
  try {
    const res = await deleteMcpServer(server.name)
    if (res.code !== 0)
      return onlyErrorToast(-1, $t('MCP 服务删除失败，请稍后重试'))
    await loadServers()
  }
  catch (error) {
    console.error('Failed to delete server:', error)
    onlyErrorToast(-1, $t('MCP 服务删除失败，请稍后重试'))
  }
}

async function importJsonFromClipboard() {
  try {
    const clipboardText = await navigator.clipboard.readText()
    const parsed = JSON.parse(clipboardText)

    if (!parsed || typeof parsed !== 'object')
      return onlyErrorToast(-1, $t('剪贴板内容不是有效的 JSON'))

    const rawMcpServers = parsed.mcpServers || parsed
    if (!rawMcpServers || typeof rawMcpServers !== 'object')
      return onlyErrorToast(-1, $t('剪贴板内容格式不正确'))

    const mcpServers: Record<string, UserMcpServerConfig> = {}

    for (const [name, rawConfig] of Object.entries(rawMcpServers)) {
      if (!name || typeof name !== 'string')
        continue
      if (!rawConfig || typeof rawConfig !== 'object')
        continue

      const config = rawConfig as Record<string, any>
      const hasCommand = typeof config.command === 'string'
      const hasUrl = typeof config.url === 'string'

      if (!hasCommand && !hasUrl)
        continue

      const cleanedConfig: UserMcpServerConfig = {}

      if (config.type === 'stdio' || config.type === 'http')
        cleanedConfig.type = config.type
      else if (hasCommand)
        cleanedConfig.type = 'stdio'
      else if (hasUrl)
        cleanedConfig.type = 'http'

      if (hasCommand) {
        const argsList: string[] = Array.isArray(config.args)
          ? config.args.filter((arg: any) => typeof arg === 'string')
          : []
        cleanedConfig.command = [config.command, ...argsList]
          .map((part: string) => part.includes(' ') ? `"${part}"` : part)
          .join(' ')
      }

      if (config.env && typeof config.env === 'object') {
        cleanedConfig.env = {}
        for (const [key, value] of Object.entries(config.env)) {
          if (typeof key === 'string' && typeof value === 'string')
            cleanedConfig.env[key] = value
        }
      }

      if (hasUrl)
        cleanedConfig.url = config.url

      if (config.headers && typeof config.headers === 'object') {
        cleanedConfig.headers = {}
        for (const [key, value] of Object.entries(config.headers)) {
          if (typeof key === 'string' && typeof value === 'string')
            cleanedConfig.headers[key] = value
        }
      }

      mcpServers[name] = cleanedConfig
    }

    if (Object.keys(mcpServers).length === 0)
      return onlyErrorToast(-1, $t('剪贴板内容格式不正确'))

    const res = await importMcpServers(mcpServers)
    if (res.code !== 0)
      return onlyErrorToast(-1, $t('MCP 服务导入失败，请检查 JSON 配置后重试'))

    await loadServers()
    backToList()
  }
  catch (error) {
    console.error('Failed to import MCP servers:', error)
    onlyErrorToast(-1, $t('MCP 服务导入失败，请检查 JSON 配置后重试'))
  }
}

watch(activeMode, (mode) => {
  if (mode === 'json')
    return
  if (activePairRows.value.length === 0)
    activePairRows.value = [createEmptyRow()]
})

onMounted(() => {
  loadServers()
  document.addEventListener('click', closeServerMenuOnOutsideClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', closeServerMenuOnOutsideClick, true)
})
</script>

<template>
  <div class="agent-settings">
    <header v-if="!isCreating" class="agent-settings__header">
      <h1>{{ $t('MCP 服务') }}</h1>
      <button
        class="agent-settings-button agent-settings-button--primary"
        type="button"
        @click="showCreate('stdio')"
      >
        <SvgIcon name="base/rx_ic_plus" size="18" />
        <span>{{ $t('新建') }}</span>
      </button>
    </header>

    <section v-if="!isCreating" class="mcp-server-list" :aria-label="$t('MCP 服务列表')">
      <article
        v-for="server in servers"
        :key="server.id"
        class="mcp-server-row"
      >
        <span>{{ server.name }}</span>
        <div v-if="!server.builtin" class="mcp-server-row__actions">
          <button
            class="mcp-icon-button"
            type="button"
            :aria-label="$t('更多操作')"
            data-mcp-server-menu
            @click="toggleServerMenu(server.id)"
          >
            <SvgIcon name="base/rx_ic_more-h" size="18" />
          </button>
          <button
            class="mcp-switch"
            :class="{ 'mcp-switch--checked': server.enabled }"
            type="button"
            role="switch"
            :aria-checked="server.enabled"
            @click="toggleServer(server)"
          >
            <span />
          </button>
        </div>

        <div v-if="!server.builtin && openServerMenuId === server.id" class="mcp-server-menu" data-mcp-server-menu>
          <button type="button" @click="showEdit(server)">
            <SvgIcon name="base/rx_ic_agent_edit" size="16" aria-hidden="true" />
            <span>{{ $t('编辑') }}</span>
          </button>
          <button class="danger" type="button" @click="removeServer(server)">
            <SvgIcon name="roxy-agent/rx-ic-mcp-delete" size="16" aria-hidden="true" />
            <span>{{ $t('删除') }}</span>
          </button>
        </div>
      </article>

      <div v-if="loading" class="mcp-server-state">
        {{ $t('加载中...') }}
      </div>
      <div v-else-if="servers.length === 0" class="mcp-server-state">
        {{ $t('暂无 MCP') }}
      </div>
    </section>

    <section v-else class="mcp-create">
      <button class="mcp-back-button" type="button" @click="backToList">
        <SvgIcon name="base/rx_ic_arrow_left" size="18" />
        <span>{{ $t('返回 MCP 列表') }}</span>
      </button>

      <div class="mcp-create__intro">
        <div class="mcp-create__copy">
          <h2>{{ editMode ? $t('编辑 MCP Server') : $t('新建') }}</h2>
          <p>{{ $t('关于 MCP 的信息与配置方法，请访问 {MCP}', { MCP: 'MCP' }) }}</p>
        </div>

        <div class="mcp-mode-tabs" role="tablist" :aria-label="$t('MCP 服务类型')">
          <button
            v-for="mode in modeOrder"
            :key="mode"
            class="mcp-mode-tabs__item"
            :class="{ active: activeMode === mode }"
            type="button"
            role="tab"
            :aria-selected="activeMode === mode"
            @click="activeMode = mode"
          >
            {{ modeConfigs[mode].label }}
          </button>
        </div>
      </div>

      <form class="mcp-create-card" @submit.prevent="saveServer">
        <h3>{{ activeModeConfig.title }}</h3>

        <template v-if="activeMode !== 'json'">
          <div class="mcp-create-card__fields">
            <label class="mcp-field mcp-field--narrow">
              <span class="mcp-field__label">
                {{ $t('名称（帮助你识别工具）') }} <b>*</b>
              </span>
              <AgentInput v-model="form.name" :placeholder="activeModeConfig.namePlaceholder" />
            </label>

            <label
              v-if="activeModeConfig.mainField"
              class="mcp-field"
              :class="{ 'mcp-field--narrow': !activeModeConfig.mainField.wide }"
            >
              <span class="mcp-field__label">
                {{ activeModeConfig.mainField.label }}<b>*</b>
              </span>
              <AgentInput
                v-model="form[activeModeConfig.mainField.key]"
                :placeholder="activeModeConfig.mainField.placeholder"
              />
            </label>

            <div class="mcp-field mcp-field--wide">
              <div class="mcp-field__label mcp-field__label--split">
                <span>{{ activeModeConfig.pairLabel }}</span>
                <button type="button" @click="addPairRow">
                  {{ $t('+ 添加') }}
                </button>
              </div>

              <div
                v-for="row in activePairRows"
                :key="row.id"
                class="mcp-pair-row"
              >
                <AgentInput v-model="row.key" :placeholder="$t('键')" />
                <AgentInput v-model="row.value" :placeholder="$t('值')" />
                <button
                  class="mcp-delete-button"
                  type="button"
                  :aria-label="$t('移除此行')"
                  @click="removePairRow(row.id)"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M9.5 16.5V10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M14.5 16.5V10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="mcp-create-card__actions">
            <button class="agent-settings-button agent-settings-button--secondary" type="button" @click="backToList">
              {{ $t('取消') }}
            </button>
            <button class="agent-settings-button agent-settings-button--secondary" type="button" @click="verifyServer">
              {{ $t('验证') }}
            </button>
            <button class="agent-settings-button agent-settings-button--primary" type="submit">
              {{ $t('保存') }}
            </button>
          </div>
        </template>

        <div v-else class="mcp-json-import">
          <button
            class="agent-settings-button agent-settings-button--primary"
            type="button"
            @click="importJsonFromClipboard"
          >
            {{ $t('从剪贴板导入 JSON') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.agent-settings {
  display: flex;
  width: min(100%, 800px);
  min-width: 0;
  flex-direction: column;
  margin: 0 auto;
  color: var(--color-text-primary, var(--color-text-primary));
}

.agent-settings__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 500;
    line-height: 32px;
  }
}

.agent-settings-button {
  display: inline-flex;
  min-width: 0;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:focus-visible {
    outline: 2px solid rgb(15 15 15 / 20%);
    outline-offset: 2px;
  }
}

.agent-settings-button--primary {
  color: var(--color-text-primary-inverse, var(--color-bg-primary));
  background: var(--color-bg-primary-inverse, var(--color-bg-primary));
}

.agent-settings-button--secondary {
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  color: var(--color-text-primary, var(--color-text-primary));
  background: var(--color-bg-primary, var(--color-bg-primary));
}

.mcp-server-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 36px;
}

.mcp-server-row {
  position: relative;
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 16px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 10px;
  color: var(--color-text-primary, var(--color-text-primary));
  font-size: 14px;
  line-height: 20px;
}

.mcp-server-state {
  padding: 24px 16px;
  color: var(--color-text-quaternary, #737373);
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

.mcp-server-menu {
  position: absolute;
  top: -74px;
  right: 40px;
  z-index: 1;
  display: flex;
  width: 140px;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 16px;
  background: var(--color-bg-primary, var(--color-bg-primary));
  box-shadow:
    0 4px 30px rgb(0 0 0 / 12%),
    0 3px 17px rgb(0 0 0 / 4%),
    0 2px 8px rgb(0 0 0 / 4%),
    0 1px 1px rgb(0 0 0 / 4%);

  button {
    display: flex;
    height: 32px;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: 8px;
    color: var(--color-text-primary, var(--color-text-primary));
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    line-height: 20px;
    text-align: left;

    &:hover {
      background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
    }
  }

  .danger {
    color: var(--color-text-error-primary, #f04438);
  }
}

.mcp-server-row__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.mcp-icon-button,
.mcp-delete-button {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  color: var(--color-text-primary, var(--color-text-primary));
  background: transparent;
  cursor: pointer;
}

.mcp-delete-button {
  width: 16px;
  height: 32px;
  color: var(--color-text-disabled, #a3a3a3);
}

.mcp-switch {
  display: inline-flex;
  width: 32px;
  height: 18px;
  align-items: center;
  justify-content: flex-start;
  padding: 1px;
  border: 0;
  border-radius: 9999px;
  background: var(--color-border-secondary);
  cursor: pointer;
  transition: background 0.15s ease;

  span {
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: #fff;
    transition: transform 0.15s ease;
  }
}

.mcp-switch--checked {
  background: #17b26a;

  span {
    transform: translateX(14px);
  }
}

.mcp-create {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.mcp-back-button {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  color: var(--color-text-quaternary, #737373);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 20px;

  &:hover {
    color: var(--color-text-primary, var(--color-text-primary));
    background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
  }

  &:focus-visible {
    outline: 2px solid rgb(15 15 15 / 20%);
    outline-offset: 2px;
  }
}

.mcp-create__intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.mcp-create__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 18px;
    font-weight: 500;
    line-height: 24px;
  }

  p {
    color: var(--color-text-quaternary, #737373);
    font-size: 14px;
    line-height: 20px;
  }
}

.mcp-mode-tabs {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 6px;
}

.mcp-mode-tabs__item {
  height: 28px;
  padding: 4px 10px;
  border: 0;
  border-radius: 4px;
  color: var(--color-text-tertiary, var(--color-text-tertiary));
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;

  &.active {
    color: var(--color-text-primary, var(--color-text-primary));
    background: var(--color-bg-quaternary, var(--color-border-secondary));
    font-weight: 500;
  }
}

.mcp-create-card {
  display: flex;
  min-height: 298px;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 16px;
  background: var(--color-bg-secondary, #fafafa);

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
}

.mcp-create-card__fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mcp-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.mcp-field--narrow {
  width: min(100%, 366px);
}

.mcp-field--wide {
  width: 100%;
}

.mcp-field__label {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-primary, var(--color-text-primary));
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;

  b {
    color: #f04438;
    font-weight: 500;
  }
}

.mcp-field__label--split {
  justify-content: space-between;

  button {
    padding: 0;
    border: 0;
    color: var(--color-text-primary, var(--color-text-primary));
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-weight: 400;
  }
}

.mcp-pair-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 16px;
  align-items: center;
  gap: 6px;
}

.mcp-create-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

.mcp-json-import {
  position: relative;
  display: flex;
  min-height: 214px;
  align-items: center;
  justify-content: center;
}

@media (max-width: 760px) {
  .agent-settings {
    width: 100%;
  }

  .mcp-create__intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .mcp-mode-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .mcp-pair-row {
    grid-template-columns: minmax(0, 1fr) 16px;
  }

  .mcp-pair-row :deep(.agent-input:nth-child(2)) {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .mcp-delete-button {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
