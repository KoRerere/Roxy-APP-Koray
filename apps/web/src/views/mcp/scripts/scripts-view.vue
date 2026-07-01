<script setup lang="ts">
import type { UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import type { ScriptListItem, ScriptRunDoneEvent, ScriptRunLogEvent, ScriptRunStatus } from '/@/views/mcp/agent-api'
import SvgIcon from '/@/components/rx-icon/src/svg-icon.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useAgentApi } from '/@/views/mcp/agent-api'

type BrowserItem = UserGetWindowInfoV2ListData['data']['rows'][number]

interface LogLine {
  type: 'log'
  level?: string
  message: string
}

interface RunState {
  runId: string
  status: ScriptRunStatus | 'starting'
  logs: LogLine[]
  artifacts?: Array<{ fileName: string, size: number, fileId?: string }>
  abortController: AbortController
}

const emit = defineEmits<{
  (e: 'useScript', script: ScriptListItem): void
}>()

const agentApi = useAgentApi()
const [, onlyErrorToast] = useResponseToast()

// ── 脚本列表 ──
const scripts = ref<ScriptListItem[]>([])
const loading = ref(false)
// 打开页面时先从后端同步合并本地，期间展示「数据同步中」提示
const syncing = ref(false)

async function loadScripts() {
  loading.value = true
  syncing.value = true
  try {
    const result = await agentApi.scriptList({ sync: true })
    if (result.code === 0) {
      scripts.value = result.data?.rows ?? []
      // 同步失败不阻塞展示：仍使用本地缓存脚本，仅弹错提示
      if (result.data?.syncError) {
        onlyErrorToast(-1, $t('脚本同步失败，当前展示本地缓存：{msg}', { msg: result.data.syncError }))
      }
    }
    else {
      onlyErrorToast(-1, result.msg || $t('加载脚本失败'))
    }
  }
  catch (e: any) {
    onlyErrorToast(-1, e?.message || $t('加载脚本失败'))
  }
  finally {
    syncing.value = false
    loading.value = false
  }
}

// ── 运行状态（key = script.id） ──
const runStates = reactive<Map<string, RunState>>(new Map())

function getRunState(scriptId: string | undefined) {
  return scriptId ? runStates.get(scriptId) : undefined
}

// ── 分身选择弹窗 ──
const showBrowserDialog = ref(false)
const pendingScript = ref<ScriptListItem | null>(null)
const browserList = ref<BrowserItem[]>([])
const occupiedDirIds = ref<Set<string>>(new Set())
const selectedDirId = ref<string>('')
const browserLoading = ref(false)
const startingRun = ref(false)

async function openBrowserDialog(script: ScriptListItem) {
  pendingScript.value = script
  selectedDirId.value = script.dirId ?? ''
  showBrowserDialog.value = true
  browserLoading.value = true
  try {
    const [browseRes, occupiedRes] = await Promise.all([
      API.window.userGetWindowInfoV2List({ page_index: 1, page_size: 50, isDelete: 0 }),
      agentApi.scriptRunOccupied(),
    ])
    browserList.value = browseRes.data?.rows ?? []
    occupiedDirIds.value = new Set(occupiedRes.code === 0 ? occupiedRes.data ?? [] : [])
  }
  finally {
    browserLoading.value = false
  }
}

function closeBrowserDialog() {
  showBrowserDialog.value = false
  pendingScript.value = null
  selectedDirId.value = ''
}

async function confirmRunScript() {
  if (!pendingScript.value || !selectedDirId.value || startingRun.value)
    return

  const script = pendingScript.value
  startingRun.value = true

  try {
    const res = await agentApi.scriptRunById(script.id, selectedDirId.value)

    if (res.code !== 0) {
      onlyErrorToast(-1, res.msg || $t('运行脚本失败'))
      return
    }

    const { runId } = res.data!
    const abortController = markRaw(new AbortController())

    const existing = runStates.get(script.id)
    existing?.abortController.abort()

    const state: RunState = reactive({
      runId,
      status: 'starting',
      logs: [],
      abortController,
    })
    runStates.set(script.id, state)

    closeBrowserDialog()

    agentApi.scriptRunSubscribe(runId, {
      signal: abortController.signal,
      onLog: (evt: ScriptRunLogEvent) => {
        state.status = 'running'
        state.logs.push({ type: 'log', level: evt.level, message: evt.message })
      },
      onDone: (evt: ScriptRunDoneEvent) => {
        state.status = evt.status
        state.artifacts = evt.artifacts
      },
      onError: () => {
        if (state.status === 'starting' || state.status === 'running')
          state.status = 'failed'
      },
    })
  }
  finally {
    startingRun.value = false
  }
}

async function stopRun(scriptId: string | undefined) {
  const state = scriptId ? runStates.get(scriptId) : undefined
  if (!state || state.status !== 'running')
    return
  await agentApi.scriptRunStop(state.runId)
}

function clearRunState(scriptId: string | undefined) {
  if (!scriptId)
    return
  const state = runStates.get(scriptId)
  state?.abortController.abort()
  runStates.delete(scriptId)
}

function statusLabel(status: ScriptRunStatus | 'starting'): string {
  const map: Record<string, string> = {
    starting: $t('准备中'),
    running: $t('运行中'),
    done: $t('完成'),
    failed: $t('失败'),
    killed: $t('已停止'),
    timeout: $t('超时'),
  }
  return map[status] ?? status
}

function statusClass(status: ScriptRunStatus | 'starting'): string {
  if (status === 'done')
    return 'text-[#059669]'
  if (status === 'running' || status === 'starting')
    return 'text-[var(--colors-text-text-brand)]'
  return 'text-[var(--colors-text-text-danger)]'
}

// ── 重命名 ──
const showRenameDialog = ref(false)
const renamingScript = ref<ScriptListItem | null>(null)
const renameValue = ref('')
const renaming = ref(false)

function openRenameDialog(script: ScriptListItem) {
  renamingScript.value = script
  renameValue.value = script.name
  showRenameDialog.value = true
}

async function confirmRename() {
  if (!renamingScript.value || !renameValue.value.trim() || renaming.value)
    return
  renaming.value = true
  try {
    const res = await agentApi.scriptUpdate(renamingScript.value.id, { name: renameValue.value.trim() })
    if (res.code === 0) {
      showRenameDialog.value = false
      await loadScripts()
    }
    else {
      onlyErrorToast(-1, res.msg || $t('重命名失败'))
    }
  }
  catch (e: any) {
    onlyErrorToast(-1, e?.message || $t('重命名失败'))
  }
  finally {
    renaming.value = false
  }
}

// ── 删除 ──
const showDeleteDialog = ref(false)
const deletingScript = ref<ScriptListItem | null>(null)
const deleting = ref(false)

function openDeleteDialog(script: ScriptListItem) {
  deletingScript.value = script
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingScript.value || deleting.value)
    return
  deleting.value = true
  try {
    const res = await agentApi.scriptDelete(deletingScript.value.id)
    if (res.code === 0) {
      showDeleteDialog.value = false
      await loadScripts()
    }
    else {
      onlyErrorToast(-1, res.msg || $t('删除失败'))
    }
  }
  catch (e: any) {
    onlyErrorToast(-1, e?.message || $t('删除失败'))
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadScripts()
})

onBeforeUnmount(() => {
  for (const state of runStates.values()) {
    state.abortController.abort()
  }
})
</script>

<template>
  <div class="h-full flex flex-col rounded-4 bg-[var(--colors-background-bg-page)] pt-15">
    <!-- 顶部标题栏 -->
    <div class="w-full h-15 flex items-center px-6 border border-b-solid border-[var(--colors-border-border-inactive)] absolute top-0 left-0">
      <div class="font-['Inter'] font-semibold text-[var(--colors-text-text-primary)] text-lg">
        {{ $t('自动化脚本') }}
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto flex flex-col gap-8 p-6">
      <!-- 数据同步中提示（打开页面时先从后端拉取并合并本地） -->
      <div
        v-if="syncing"
        class="flex items-center gap-2 px-3 py-2 rounded-1.5 bg-[var(--colors-background-bg-block)] text-[12px] text-[var(--colors-text-text-secondary)]"
      >
        <span class="w-3 h-3 shrink-0 border-2 border-current border-t-transparent rounded-full animate-spin" />
        {{ $t('数据同步中…') }}
      </div>

      <!-- 空状态 -->
      <div
        v-if="!loading && scripts.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-16 text-center"
      >
        <SvgIcon name="base/rx_ic_doc_code" size="48" color="var(--colors-icon-icon-tertiary)" />
        <div class="text-[14px] font-medium text-[var(--colors-text-text-secondary)]">
          {{ $t('暂无脚本') }}
        </div>
        <div class="text-[12px] text-[var(--colors-text-text-tertiary)]">
          {{ $t('录制一次会话后，脚本将出现在这里') }}
        </div>
      </div>

      <!-- 脚本卡片网格 -->
      <div v-else class="grid grid-cols-2 gap-4">
        <div
          v-for="script in scripts"
          :key="script.id"
          class="bg-[var(--colors-background-bg-block)] rounded-1.5 p-3 flex flex-col gap-2"
        >
          <div class="flex gap-3">
            <!-- 图标 -->
            <div class="size-12 rounded-1.5 bg-[var(--colors-background-bg-page)] flex items-center justify-center shrink-0 overflow-hidden">
              <SvgIcon name="base/rx_ic_doc_code" size="32" color="var(--colors-icon-icon-tertiary)" />
            </div>

            <!-- 内容 -->
            <div class="flex-1 flex flex-col min-w-0">
              <div class="flex flex-col gap-1">
                <div class="font-['Inter'] font-700 text-[14px] text-[var(--colors-text-text-primary)] leading-20px truncate">
                  {{ script.name }}
                </div>
                <div
                  v-if="script.description"
                  class="font-['Inter'] text-[12px] text-[var(--colors-text-text-secondary)] leading-[18px] line-clamp-3"
                >
                  {{ script.description }}
                </div>
              </div>

              <!-- 底部操作 -->
              <div class="flex items-center justify-between mt-auto pt-2">
                <div class="font-['Inter'] text-[12px] text-[var(--colors-text-text-inactive)] leading-20px">
                  {{ script.createdAt?.slice(0, 10) }}
                </div>
                <div class="flex items-center gap-2">
                  <!-- 使用脚本（挂到 chat agent） -->
                  <div
                    class="flex items-center gap-1 cursor-pointer group"
                    @click="emit('useScript', script)"
                  >
                    <span class="font-['Inter'] text-[12px] text-[var(--colors-text-text-brand)] leading-20px group-hover:underline">
                      {{ $t('使用') }}
                    </span>
                    <SvgIcon name="base/rx_ic_arrow_right_2" size="16" color="var(--colors-text-text-brand)" />
                  </div>
                  <span class="text-[var(--colors-border-border-inactive)] text-xs">|</span>
                  <!-- 运行按钮 -->
                  <button
                    v-if="!getRunState(script.id) || getRunState(script.id)?.status === 'done' || getRunState(script.id)?.status === 'failed' || getRunState(script.id)?.status === 'killed' || getRunState(script.id)?.status === 'timeout'"
                    class="flex items-center gap-1 cursor-pointer group border-none bg-transparent p-0"
                    :disabled="!(script.runnable ?? !!script.ossUrl)"
                    @click="openBrowserDialog(script)"
                  >
                    <SvgIcon name="base/rx_ic_play" size="14" color="var(--colors-icon-icon-secondary)" />
                    <span class="font-['Inter'] text-[12px] text-[var(--colors-text-text-secondary)] leading-20px group-hover:text-[var(--colors-text-text-primary)]">
                      {{ $t('运行') }}
                    </span>
                  </button>
                  <!-- 停止按钮（运行中） -->
                  <button
                    v-else-if="getRunState(script.id)?.status === 'running' || getRunState(script.id)?.status === 'starting'"
                    class="flex items-center gap-1 cursor-pointer group border-none bg-transparent p-0"
                    @click="stopRun(script.id)"
                  >
                    <SvgIcon name="base/rx_ic_pause" size="14" color="var(--colors-text-text-danger)" />
                    <span class="font-['Inter'] text-[12px] text-[var(--colors-text-text-danger)] leading-20px">
                      {{ $t('停止') }}
                    </span>
                  </button>
                  <span class="text-[var(--colors-border-border-inactive)] text-xs">|</span>
                  <!-- 重命名 -->
                  <button
                    class="flex items-center gap-1 cursor-pointer group border-none bg-transparent p-0"
                    @click="openRenameDialog(script)"
                  >
                    <span class="font-['Inter'] text-[12px] text-[var(--colors-text-text-secondary)] leading-20px group-hover:text-[var(--colors-text-text-primary)]">
                      {{ $t('重命名') }}
                    </span>
                  </button>
                  <span class="text-[var(--colors-border-border-inactive)] text-xs">|</span>
                  <!-- 删除 -->
                  <button
                    class="flex items-center gap-1 cursor-pointer group border-none bg-transparent p-0"
                    @click="openDeleteDialog(script)"
                  >
                    <span class="font-['Inter'] text-[12px] text-[var(--colors-text-text-danger)] leading-20px group-hover:underline">
                      {{ $t('删除') }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 运行状态 + 内联日志 -->
          <div v-if="getRunState(script.id)" class="mt-1 rounded-1 bg-[var(--colors-background-bg-page)] p-2 flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span
                  v-if="getRunState(script.id)?.status === 'running' || getRunState(script.id)?.status === 'starting'"
                  class="w-2 h-2 rounded-full bg-[var(--colors-text-text-brand)] animate-pulse shrink-0"
                />
                <span
                  v-else-if="getRunState(script.id)?.status === 'done'"
                  class="w-2 h-2 rounded-full bg-[#059669] shrink-0"
                />
                <span v-else class="w-2 h-2 rounded-full bg-[var(--colors-text-text-danger)] shrink-0" />
                <span class="text-[11px] font-medium" :class="statusClass(getRunState(script.id)!.status)">
                  {{ statusLabel(getRunState(script.id)!.status) }}
                </span>
              </div>
              <button
                class="text-[11px] text-[var(--colors-text-text-tertiary)] cursor-pointer border-none bg-transparent p-0 hover:text-[var(--colors-text-text-secondary)]"
                @click="clearRunState(script.id)"
              >
                {{ $t('清除') }}
              </button>
            </div>
            <div
              v-if="getRunState(script.id)!.logs.length > 0"
              class="max-h-[120px] overflow-y-auto flex flex-col gap-0.5 mt-0.5"
            >
              <div
                v-for="(line, idx) in getRunState(script.id)!.logs"
                :key="idx"
                class="font-mono text-[10px] leading-4 break-all text-[var(--colors-text-text-secondary)]"
              >
                <span v-if="line.level === 'error'" class="text-[var(--colors-text-text-danger)]">[ERR] </span>
                {{ line.message }}
              </div>
            </div>
            <!-- 产物下载列表 -->
            <div
              v-if="getRunState(script.id)?.status === 'done' && getRunState(script.id)?.artifacts?.length"
              class="mt-1 flex flex-col gap-0.5"
            >
              <div class="text-[10px] font-semibold text-[var(--colors-text-text-secondary)] mb-0.5">
                {{ $t('产物文件') }}
              </div>
              <a
                v-for="artifact in getRunState(script.id)!.artifacts"
                :key="artifact.fileName"
                :href="artifact.fileId ? agentApi.getFileUrl(artifact.fileId, { download: true, fileName: artifact.fileName }) : undefined"
                :download="artifact.fileName"
                :class="artifact.fileId ? 'text-[var(--colors-text-text-brand)] hover:underline cursor-pointer' : 'text-[var(--colors-text-text-tertiary)] cursor-not-allowed'"
                class="flex items-center gap-1 text-[10px]"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12l-4-4h2.5V4h3v4H12L8 12zm-6 2h12v-1.5H2V14z" /></svg>
                {{ artifact.fileName }}
                <span class="text-[var(--colors-text-text-tertiary)]">({{ (artifact.size / 1024).toFixed(1) }}KB)</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center text-sm text-[var(--colors-text-text-secondary)] py-2">
        {{ $t('加载中...') }}
      </div>
    </div>
  </div>

  <!-- 选择浏览器分身弹窗 -->
  <Dialog
    v-model:visible="showBrowserDialog"
    modal
    :header="$t('选择浏览器分身')"
    :style="{ width: '480px' }"
    :closable="!startingRun"
    @hide="closeBrowserDialog"
  >
    <div class="flex flex-col gap-3">
      <div class="text-[13px] text-[var(--colors-text-text-secondary)]">
        {{ $t('为脚本 {name} 选择一个浏览器分身，脚本将在该浏览器中运行', { name: pendingScript?.name }) }}
      </div>

      <div v-if="browserLoading" class="text-center text-sm text-[var(--colors-text-text-secondary)] py-4">
        {{ $t('加载中...') }}
      </div>
      <div v-else-if="browserList.length === 0" class="text-center text-sm text-[var(--colors-text-text-secondary)] py-4">
        {{ $t('暂无可用浏览器分身') }}
      </div>
      <div v-else class="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
        <div
          v-for="browser in browserList"
          :key="browser.dirId"
          class="flex items-center gap-3 px-3 py-2.5 rounded-1.5 border border-solid transition-colors"
          :class="[
            occupiedDirIds.has(browser.dirId ?? '')
              ? 'border-[var(--colors-border-border-inactive)] opacity-40 cursor-not-allowed'
              : selectedDirId === browser.dirId
                ? 'border-[var(--colors-text-text-brand)] bg-[var(--colors-background-bg-action)] cursor-pointer'
                : 'border-[var(--colors-border-border-inactive)] hover:border-[var(--colors-text-text-brand)] cursor-pointer',
          ]"
          @click="!occupiedDirIds.has(browser.dirId ?? '') && (selectedDirId = browser.dirId ?? '')"
        >
          <SvgIcon name="base/rx_ic_browser" size="16" color="var(--colors-icon-icon-secondary)" />
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-[var(--colors-text-text-primary)] truncate">
              {{ browser.windowName || browser.dirId }}
            </div>
            <div v-if="occupiedDirIds.has(browser.dirId ?? '')" class="text-[11px] text-[var(--colors-text-text-danger)]">
              {{ $t('已被脚本占用') }}
            </div>
            <div v-else class="text-[11px] text-[var(--colors-text-text-tertiary)]">
              {{ browser.dirId }}
            </div>
          </div>
          <div
            v-if="selectedDirId === browser.dirId"
            class="size-4 rounded-full bg-[var(--colors-text-text-brand)] flex items-center justify-center shrink-0"
          >
            <SvgIcon name="base/rx_ic_check" size="10" color="white" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-1.5 border-none cursor-pointer bg-[var(--colors-background-bg-block)] text-[var(--colors-text-text-primary)] hover:bg-[var(--colors-background-bg-action-hover)]"
          :disabled="startingRun"
          @click="closeBrowserDialog"
        >
          {{ $t('取消') }}
        </button>
        <button
          class="px-4 py-2 text-sm rounded-1.5 border-none cursor-pointer transition-opacity"
          :class="selectedDirId && !startingRun ? 'bg-[var(--colors-text-text-brand)] text-white hover:opacity-90' : 'bg-[var(--colors-background-bg-block)] text-[var(--colors-text-text-tertiary)] cursor-not-allowed'"
          :disabled="!selectedDirId || startingRun"
          @click="confirmRunScript"
        >
          <span v-if="startingRun" class="flex items-center gap-1.5">
            <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {{ $t('启动中...') }}
          </span>
          <span v-else>{{ $t('运行') }}</span>
        </button>
      </div>
    </template>
  </Dialog>

  <!-- 重命名弹窗 -->
  <Dialog
    v-model:visible="showRenameDialog"
    modal
    :header="$t('重命名脚本')"
    :style="{ width: '400px' }"
    :closable="!renaming"
  >
    <div class="flex flex-col gap-3">
      <input
        v-model="renameValue"
        class="w-full px-3 py-2 rounded-1.5 border border-solid border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-page)] text-[var(--colors-text-text-primary)] text-[13px] focus:outline-none focus:border-[var(--colors-text-text-brand)]"
        :placeholder="$t('请输入新名称')"
        @keyup.enter="confirmRename"
      >
    </div>
    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-1.5 border-none cursor-pointer bg-[var(--colors-background-bg-block)] text-[var(--colors-text-text-primary)] hover:bg-[var(--colors-background-bg-action-hover)]"
          :disabled="renaming"
          @click="showRenameDialog = false"
        >
          {{ $t('取消') }}
        </button>
        <button
          class="px-4 py-2 text-sm rounded-1.5 border-none cursor-pointer transition-opacity"
          :class="renameValue.trim() && !renaming ? 'bg-[var(--colors-text-text-brand)] text-white hover:opacity-90' : 'bg-[var(--colors-background-bg-block)] text-[var(--colors-text-text-tertiary)] cursor-not-allowed'"
          :disabled="!renameValue.trim() || renaming"
          @click="confirmRename"
        >
          {{ $t('确认') }}
        </button>
      </div>
    </template>
  </Dialog>

  <!-- 删除确认弹窗 -->
  <Dialog
    v-model:visible="showDeleteDialog"
    modal
    :header="$t('确认删除')"
    :style="{ width: '380px' }"
    :closable="!deleting"
  >
    <div class="text-[13px] text-[var(--colors-text-text-secondary)]">
      {{ $t('确定删除脚本「{name}」吗？此操作不可恢复。', { name: deletingScript?.name }) }}
    </div>
    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          class="px-4 py-2 text-sm rounded-1.5 border-none cursor-pointer bg-[var(--colors-background-bg-block)] text-[var(--colors-text-text-primary)] hover:bg-[var(--colors-background-bg-action-hover)]"
          :disabled="deleting"
          @click="showDeleteDialog = false"
        >
          {{ $t('取消') }}
        </button>
        <button
          class="px-4 py-2 text-sm rounded-1.5 border-none cursor-pointer transition-opacity bg-[var(--colors-text-text-danger)] text-white hover:opacity-90"
          :disabled="deleting"
          @click="confirmDelete"
        >
          {{ $t('删除') }}
        </button>
      </div>
    </template>
  </Dialog>
</template>
