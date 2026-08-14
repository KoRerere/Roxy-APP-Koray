<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import type {
  TaskDialogInitialValues,
  TaskDialogPayload,
  TaskTemplateOption,
  TaskWindowOption,
} from '../../task-manager'
import type { TaskWindowOptionsPage } from '../../task-window-options'
import type { TaskScheduleFrequency } from '../../task-schedule'
import DatePicker from 'primevue/datepicker'
import { API } from '/@/api'
import {
  buildTaskSchedulePlan,
  createTaskScheduleDraft,
  isValidTaskCron,
} from '../../task-schedule'
import {
  getDefaultTaskConcurrency,
  isTaskWindowSelectionValid,
} from '../../task-manager'
import AgentBadge from '../form/AgentBadge.vue'
import AgentCheckbox from '../form/AgentCheckbox.vue'
import AgentFormField from '../form/AgentFormField.vue'
import AgentInput from '../form/AgentInput.vue'
import AgentSelect from '../form/AgentSelect.vue'
import OverflowTooltip from '../OverflowTooltip.vue'
import './agent-dialog.scss'

interface SelectOption<T = string> {
  label: string
  value: T
}

interface CreateTaskDialogData {
  initialValues?: Partial<TaskDialogInitialValues>
  templateOptions?: TaskTemplateOption[]
  windowOptions?: TaskWindowOption[]
  loadWindowOptions?: (
    pageIndex: number,
    keyword: string,
    projectId: string,
  ) => Promise<TaskWindowOptionsPage>
  lockTemplate?: boolean
  onCancel?: () => void | Promise<void>
  onSave?: (payload: TaskDialogPayload) => boolean | void | Promise<boolean | void>
}

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const router = useRouter()

function getDialogData(): CreateTaskDialogData {
  return (dialogRef?.value.data ?? {}) as CreateTaskDialogData
}

const dialogData = getDialogData()
const ALL_PROJECTS_VALUE = '__all__'
const initialValues = dialogData.initialValues ?? {}
const templateOptions = dialogData.templateOptions ?? []
const initialWindowOptions = dialogData.windowOptions ?? []
const pagedWindowOptions = ref<TaskWindowOption[]>([])
const editing = Boolean(initialValues.id)
const templateLocked = editing || Boolean(dialogData.lockTemplate)
const initialSchedule = createTaskScheduleDraft(initialValues, 'daily')

const taskName = ref(initialValues.name ?? '')
const selectedTemplateId = ref<number | undefined>(initialValues.userTemplateId)
const selectedWindowIds = ref(new Set(initialValues.windowIds ?? []))
const searchKeyword = ref('')
const concurrencyEnabled = ref(initialValues.concurrency !== null)
const taskConcurrency = ref<string | number>(
  initialValues.concurrency ?? getDefaultTaskConcurrency(),
)
const projectOptions = ref<SelectOption[]>([
  { label: $t('全部项目'), value: ALL_PROJECTS_VALUE },
])
const selectedProjectId = ref(ALL_PROJECTS_VALUE)
const projectOptionsLoading = ref(true)
const scheduleEnabled = ref(
  initialValues.planType === 'once' || initialValues.planType === 'cron',
)
const planEnabled = ref(initialSchedule.enabled)
const scheduleFrequency = ref<TaskScheduleFrequency>(initialSchedule.frequency)
const scheduleTime = ref(initialSchedule.scheduleTime ?? new Date())
const monthlyDay = ref(initialSchedule.monthlyDay)
const weekday = ref(initialSchedule.weekday)
const saving = ref(false)
const windowOptionsLoading = ref(Boolean(dialogData.loadWindowOptions))
const windowOptionsLoadingMore = ref(false)
const windowOptionsError = ref('')
const windowPageIndex = ref(0)
const windowOptionsHasMore = ref(Boolean(dialogData.loadWindowOptions))
const formError = ref('')
let windowRequestSequence = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const selectedTemplateKind = computed(() => templateOptions
  .find(item => item.value === selectedTemplateId.value)
  ?.kind)

const scheduleFrequencyOptions = computed<SelectOption<TaskScheduleFrequency>[]>(() => [
  { label: $t('单次执行'), value: 'once' },
  { label: $t('每天'), value: 'daily' },
  { label: $t('每周'), value: 'weekly' },
  { label: $t('每月'), value: 'monthly' },
])

const monthlyDayOptions = computed(() => Array.from({ length: 31 }, (_, index) => ({
  label: $t('每月 {day} 日', { day: index + 1 }),
  value: index + 1,
})))

const weekdayOptions = computed(() => [
  { label: $t('周一'), value: 1 },
  { label: $t('周二'), value: 2 },
  { label: $t('周三'), value: 3 },
  { label: $t('周四'), value: 4 },
  { label: $t('周五'), value: 5 },
  { label: $t('周六'), value: 6 },
  { label: $t('周日'), value: 0 },
])

function formatWindowOptionLabel(item: TaskWindowOption) {
  return [item.code, item.name, item.remark].filter(Boolean).join(' · ')
}

const filteredWindows = computed(() => {
  const keyword = searchKeyword.value.trim().toLocaleLowerCase()
  const projectId = selectedProjectId.value === ALL_PROJECTS_VALUE
    ? ''
    : selectedProjectId.value
  const projectFilteredInitialOptions = projectId
    ? initialWindowOptions.filter(item => item.projectId === projectId)
    : initialWindowOptions
  const initialOptions = keyword
    ? projectFilteredInitialOptions.filter(item => `${item.code} ${item.name} ${item.remark}`.toLocaleLowerCase().includes(keyword))
    : projectFilteredInitialOptions
  const byId = new Map(initialOptions.map(item => [item.id, item]))
  pagedWindowOptions.value.forEach(item => byId.set(item.id, item))
  return Array.from(byId.values())
})

async function loadProjectOptions() {
  projectOptionsLoading.value = true
  try {
    const response = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
    if (response.code !== 0)
      throw new Error(response.msg || 'Failed to load projects')

    const seen = new Set<string>()
    projectOptions.value = [
      { label: $t('全部项目'), value: ALL_PROJECTS_VALUE },
      ...(response.data?.rows ?? []).flatMap((item) => {
        const value = item.project_id?.toString()
        if (!value || seen.has(value))
          return []

        seen.add(value)
        return [{
          label: item.projectName || (item.projectDefault ? $t('默认项目') : value),
          value,
        }]
      }),
    ]
  }
  catch (error) {
    console.error('Failed to load task projects', error)
    projectOptions.value = [{ label: $t('全部项目'), value: ALL_PROJECTS_VALUE }]
  }
  finally {
    projectOptionsLoading.value = false
  }
}

async function loadWindowOptions(reset = false) {
  if (!dialogData.loadWindowOptions)
    return
  if (!reset && (windowOptionsLoading.value || windowOptionsLoadingMore.value || !windowOptionsHasMore.value))
    return

  const requestSequence = reset ? ++windowRequestSequence : windowRequestSequence
  const nextPageIndex = reset ? 1 : windowPageIndex.value + 1
  if (reset) {
    windowOptionsLoading.value = true
    windowOptionsLoadingMore.value = false
    windowOptionsError.value = ''
    windowPageIndex.value = 0
    pagedWindowOptions.value = []
    windowOptionsHasMore.value = true
  }
  else {
    windowOptionsLoadingMore.value = true
    windowOptionsError.value = ''
  }

  try {
    const projectId = selectedProjectId.value === ALL_PROJECTS_VALUE
      ? ''
      : selectedProjectId.value
    const page = await dialogData.loadWindowOptions(
      nextPageIndex,
      searchKeyword.value.trim(),
      projectId,
    )
    if (requestSequence !== windowRequestSequence)
      return

    if (reset) {
      pagedWindowOptions.value = page.items
    }
    else {
      const byId = new Map(pagedWindowOptions.value.map(item => [item.id, item]))
      page.items.forEach(item => byId.set(item.id, item))
      pagedWindowOptions.value = Array.from(byId.values())
    }
    windowPageIndex.value = nextPageIndex
    windowOptionsHasMore.value = page.hasMore
  }
  catch (error) {
    if (requestSequence !== windowRequestSequence)
      return
    console.error('Failed to load task window options', error)
    windowOptionsError.value = error instanceof Error ? error.message : $t('获取窗口信息失败')
  }
  finally {
    if (requestSequence === windowRequestSequence) {
      windowOptionsLoading.value = false
      windowOptionsLoadingMore.value = false
    }
  }
}

function retryLoadWindowOptions() {
  void loadWindowOptions(windowPageIndex.value === 0)
}

function onWindowListScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  if (element.scrollHeight - element.scrollTop - element.clientHeight <= 24)
    void loadWindowOptions()
}

function setWindowSelected(id: string, selected: boolean) {
  const nextIds = new Set(selectedWindowIds.value)
  if (selected)
    nextIds.add(id)
  else
    nextIds.delete(id)
  selectedWindowIds.value = nextIds
}

async function closeDialog() {
  await dialogData.onCancel?.()
  dialogRef?.value.close()
}

async function openTemplateStore() {
  await closeDialog()
  await router.push({ name: 'agent-console-template-store' })
}

async function saveTask() {
  if (windowOptionsLoading.value)
    return

  formError.value = ''
  const name = taskName.value.trim()
  const userTemplateId = selectedTemplateId.value
  const schedulePlan = buildTaskSchedulePlan({
    frequency: scheduleFrequency.value,
    scheduleDate: scheduleTime.value,
    scheduleTime: scheduleTime.value,
    monthlyDay: monthlyDay.value,
    weekday: weekday.value,
    enabled: planEnabled.value,
  }, scheduleEnabled.value)

  if (!name) {
    formError.value = $t('请输入任务名称')
    return
  }
  if (!userTemplateId) {
    formError.value = $t('请选择任务模板')
    return
  }
  if (!isTaskWindowSelectionValid(selectedTemplateKind.value, selectedWindowIds.value.size)) {
    formError.value = $t('脚本任务至少需要选择一个浏览器窗口')
    return
  }

  let concurrency: number | null = null
  if (selectedTemplateKind.value === 'script' && concurrencyEnabled.value) {
    concurrency = Number(taskConcurrency.value)
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      formError.value = $t('请输入有效的并发数量')
      return
    }
  }

  if (schedulePlan.planType === 'once' && !schedulePlan.executeAt) {
    formError.value = $t('请选择有效的单次执行时间')
    return
  }
  if (schedulePlan.planType === 'cron' && (!schedulePlan.cron || !isValidTaskCron(schedulePlan.cron))) {
    formError.value = $t('请输入有效的五段 cron 表达式')
    return
  }

  saving.value = true
  try {
    const shouldClose = await dialogData.onSave?.({
      name,
      userTemplateId,
      windowIds: [...selectedWindowIds.value],
      concurrency,
      ...schedulePlan,
    })
    if (shouldClose !== false)
      dialogRef?.value.close()
  }
  finally {
    saving.value = false
  }
}

watch(searchKeyword, () => {
  if (!dialogData.loadWindowOptions)
    return
  if (searchTimer)
    clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadWindowOptions(true), 300)
})

watch(selectedProjectId, () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }
  void loadWindowOptions(true)
})

onMounted(() => {
  void loadProjectOptions()
  void loadWindowOptions(true)
})
onBeforeUnmount(() => {
  if (searchTimer)
    clearTimeout(searchTimer)
  windowRequestSequence++
})
</script>

<template>
  <div class="agent-console-dialog__shell create-task-dialog">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">
        {{ editing ? $t('编辑任务') : $t('创建任务') }}
      </h2>
      <button class="agent-console-dialog__close" type="button" :aria-label="$t('关闭任务弹窗')" @click="closeDialog" />
    </header>

    <main class="agent-console-dialog__body create-task-dialog__body">
      <AgentFormField :label="$t('任务名称')">
        <AgentInput v-model="taskName" type="text" :placeholder="$t('请输入任务名称')" :disabled="saving" />
      </AgentFormField>

      <AgentFormField :label="$t('任务模板')">
        <div class="template-picker-row">
          <AgentSelect
            v-model="selectedTemplateId"
            class="template-select"
            :options="templateOptions"
            :placeholder="$t('请选择任务模板')"
            :disabled="templateLocked || saving"
          />
          <button
            v-if="!editing"
            class="template-more-button"
            type="button"
            @click="openTemplateStore"
          >
            <SvgIcon name="roxy-agent/rx-ic-templates-store" size="18" />
            <span>{{ $t('更多模板') }}</span>
          </button>
        </div>
        <p v-if="editing" class="field-hint">
          {{ $t('任务创建后不可更换来源模板。') }}
        </p>
        <p v-else-if="templateLocked" class="field-hint">
          {{ $t('此任务将使用已选择的模板。') }}
        </p>
      </AgentFormField>

      <AgentFormField :label="$t('关联窗口')">
        <div class="window-picker">
          <div class="window-filter-row">
            <AgentSelect
              v-model="selectedProjectId"
              class="window-project-select"
              :options="projectOptions"
              :aria-label="$t('项目')"
              :disabled="saving || projectOptionsLoading"
            />

            <AgentInput
              v-model="searchKeyword"
              class="window-search"
              type="search"
              pre-icon="base/rx_ic_magnify"
              :placeholder="$t('搜索窗口')"
              :disabled="saving"
            />
          </div>

          <div
            class="window-list"
            :aria-busy="windowOptionsLoading || windowOptionsLoadingMore"
            @scroll.passive="onWindowListScroll"
          >
            <div v-if="windowOptionsLoading" class="window-loading" role="status">
              <i class="pi pi-spin pi-spinner" aria-hidden="true" />
              <span>{{ $t('加载中...') }}</span>
            </div>

            <div v-else-if="windowOptionsError && windowPageIndex === 0" class="window-load-error" role="alert">
              <span>{{ windowOptionsError }}</span>
              <button type="button" :disabled="saving" @click="retryLoadWindowOptions">
                {{ $t('重试') }}
              </button>
            </div>

            <template v-else>
              <AgentCheckbox
                v-for="item in filteredWindows"
                :key="item.id"
                :model-value="selectedWindowIds.has(item.id)"
                class="window-row"
                :class="{ selected: selectedWindowIds.has(item.id) }"
                :input-id="`create-task-window-${item.id}`"
                :disabled="saving"
                @update:model-value="setWindowSelected(item.id, $event)"
              >
                <SvgIcon
                  class="window-flag"
                  :name="item.iconName || 'base/rx_ic_route2'"
                  fallback="base/rx_ic_route2"
                  size="16"
                  color="var(--colors-icon-icon-tertiary)"
                  aria-hidden="true"
                />
                <OverflowTooltip
                  class="window-info"
                  :content="formatWindowOptionLabel(item)"
                  :z-index="1300"
                >
                  <span v-if="item.code" class="window-code">{{ item.code }}</span>
                  <span v-if="item.name" class="window-display-name">
                    {{ item.code ? ' · ' : '' }}{{ item.name }}
                  </span>
                  <span v-if="item.remark" class="window-remark">
                    {{ item.code || item.name ? ' · ' : '' }}{{ item.remark }}
                  </span>
                </OverflowTooltip>
                <AgentBadge v-if="item.isOpen" class="window-open-badge" type="open" :label="$t('窗口已打开')" />
              </AgentCheckbox>

              <p v-if="!filteredWindows.length" class="window-empty">
                {{ $t('暂无匹配窗口') }}
              </p>

              <div v-if="windowOptionsLoadingMore" class="window-loading window-loading--more" role="status">
                <i class="pi pi-spin pi-spinner" aria-hidden="true" />
                <span>{{ $t('加载中...') }}</span>
              </div>

              <div v-else-if="windowOptionsError" class="window-load-error window-load-error--more" role="alert">
                <span>{{ windowOptionsError }}</span>
                <button type="button" :disabled="saving" @click="retryLoadWindowOptions">
                  {{ $t('重试') }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </AgentFormField>

      <AgentFormField v-if="selectedTemplateKind === 'script'">
        <div class="concurrency-control">
          <AgentCheckbox v-model="concurrencyEnabled" class="concurrency-toggle" :disabled="saving">
            {{ $t('并发数量') }}
          </AgentCheckbox>

          <AgentInput
            v-if="concurrencyEnabled"
            v-model="taskConcurrency"
            class="concurrency-input"
            type="number"
            min="1"
            max="256"
            step="1"
            :aria-label="$t('并发数量')"
            :placeholder="$t('请输入并发数量')"
            :disabled="saving"
          />
        </div>
      </AgentFormField>

      <AgentFormField>
        <AgentCheckbox v-model="scheduleEnabled" class="schedule-toggle" :disabled="saving">
          <span>{{ $t('计划执行') }} <em>{{ $t('（可选）') }}</em></span>
        </AgentCheckbox>

        <div v-if="scheduleEnabled" class="schedule-controls">
          <div class="schedule-control-row">
            <AgentSelect
              v-model="scheduleFrequency"
              class="schedule-frequency-select"
              :options="scheduleFrequencyOptions"
              :disabled="saving"
            />

            <AgentSelect
              v-if="scheduleFrequency === 'weekly'"
              v-model="weekday"
              class="schedule-detail-select"
              overlay-class="agent-schedule-select-overlay"
              :options="weekdayOptions"
              :disabled="saving"
            />

            <AgentSelect
              v-else-if="scheduleFrequency === 'monthly'"
              v-model="monthlyDay"
              class="schedule-detail-select"
              overlay-class="agent-schedule-select-overlay"
              :options="monthlyDayOptions"
              :disabled="saving"
            />

            <DatePicker
              v-model="scheduleTime"
              class="schedule-datepicker"
              panel-class="agent-schedule-datepicker-panel"
              date-format="yy/mm/dd"
              :time-only="scheduleFrequency !== 'once'"
              :show-time="scheduleFrequency === 'once'"
              hour-format="24"
              show-icon
              icon-display="input"
              fluid
              :disabled="saving"
              :manual-input="false"
            >
              <template #inputicon="slotProps">
                <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="slotProps.class" @click.stop="slotProps.clickCallback" />
              </template>
            </DatePicker>
          </div>

          <AgentCheckbox v-model="planEnabled" class="plan-enabled" :disabled="saving">
            {{ $t('启用此计划') }}
          </AgentCheckbox>
        </div>
      </AgentFormField>

      <p v-if="formError" class="form-error" role="alert">
        {{ formError }}
      </p>
    </main>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions">
        <button class="agent-console-dialog__button" type="button" :disabled="saving" @click="closeDialog">
          {{ $t('取消') }}
        </button>
        <button class="agent-console-dialog__button dark" type="button" :disabled="saving || windowOptionsLoading" @click="saveTask">
          {{ saving ? $t('保存中...') : $t('保存') }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.create-task-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-hint,
.window-empty,
.form-error {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
}

.template-picker-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.template-select {
  min-width: 0;
  flex: 1 1 0;
}

.template-more-button {
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #ee46bc;
  border-radius: 10px;
  color: #ee46bc;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: #fce7f6;
  }
}

:global(html[data-theme='dark'] .template-more-button:hover),
:global(html.app-dark .template-more-button:hover) {
  background: #300f27;
}

.field-hint,
.window-empty {
  color: var(--color-text-quaternary);
}

.form-error {
  color: #f04438;
}

.window-picker {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-primary);
}

.window-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.window-project-select {
  width: calc((100% - 8px) / 3);
  flex: 0 0 calc((100% - 8px) / 3);

  :deep(.p-select-label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.window-search {
  min-width: 0;
  flex: 2 1 0;
}

.window-list {
  display: flex;
  height: 176px;
  flex: none;
  flex-direction: column;
  gap: 2px;
  overflow: auto;
  scrollbar-gutter: stable;
}

.window-row {
  display: flex;
  width: 100% !important;
  min-width: 0;
  min-height: 36px;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border-radius: 8px;

  &:hover,
  &.selected {
    background: var(--color-bg-quaternary);
  }

  :deep(.agent-checkbox__label) {
    display: flex;
    min-width: 0;
    flex: 1 1 0;
    align-items: center;
    gap: 9px;
    font-weight: 400;
  }
}

.window-info {
  display: inline-flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: var(--color-text-disabled, #a3a3a3);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.window-code,
.window-display-name {
  flex: none;
  color: var(--color-text-primary);
}

.window-remark {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--color-text-disabled, #a3a3a3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-open-badge {
  flex: none;
}

.window-flag {
  width: 16px;
  height: 16px;
  flex: none;
}

.window-empty {
  display: flex;
  height: 100%;
  align-items: center;
  box-sizing: border-box;
  justify-content: center;
  padding: 0 8px;
  text-align: center;
}

.window-loading,
.window-load-error {
  display: flex;
  height: 100%;
  min-height: 0;
  align-items: center;
  box-sizing: border-box;
  justify-content: center;
  gap: 8px;
  padding: 12px 8px;
  color: var(--color-text-quaternary);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}

.window-loading .pi {
  font-size: 16px;
}

.window-loading--more,
.window-load-error--more {
  height: auto;
  min-height: 40px;
  padding: 8px;
}

.window-load-error {
  flex-direction: column;

  button {
    padding: 4px 10px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    cursor: pointer;
  }
}

.schedule-toggle,
.plan-enabled,
.concurrency-toggle {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
}

.concurrency-control {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.concurrency-toggle {
  flex: 0 0 auto;
  white-space: nowrap;
}

.concurrency-input {
  width: 88px;
  max-width: 88px;
  flex: 0 0 88px;
}

.schedule-toggle {
  font-weight: 500;

  em {
    color: var(--color-text-quaternary);
    font-style: normal;
  }
}

.schedule-controls {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.schedule-control-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.schedule-frequency-select {
  width: 120px;
  flex: 0 0 120px;
}

.schedule-detail-select,
.schedule-datepicker {
  min-width: 0;
  flex: 1 1 0;
}

.schedule-datepicker {
  height: 32px;

  :deep(.p-datepicker-input) {
    width: 100%;
    height: 32px;
    padding: 5px 28px 5px 10px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 10px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    box-shadow: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;

    &:focus {
      border-color: var(--color-border-primary-inverse);
    }
  }

  :deep(.p-datepicker-input-icon-container) {
    right: 10px;
    left: auto;
  }
}

.agent-console-dialog__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 520px) {
  .schedule-control-row {
    align-items: stretch;
    flex-direction: column;
  }

  .schedule-frequency-select,
  .schedule-detail-select,
  .schedule-datepicker {
    width: 100%;
    flex-basis: auto;
  }
}
</style>
