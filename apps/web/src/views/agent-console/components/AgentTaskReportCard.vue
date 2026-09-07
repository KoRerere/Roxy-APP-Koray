<script setup lang="ts">
import type { AgentTaskReportProcessEvent, AgentTaskReportSaveRequest } from '../types'
import type { TaskReportWindowInfo } from '../task-report-window-info'
import type { SvgNames } from '/@/components/rx-icon'
import { useProfileMonitor } from '../composables/useProfileMonitor'
import { formatTaskReportWindowNumber } from '../task-report-window-info'
import { buildTaskReportMarkdown, taskReportFileName } from '../task-report-export'

const props = defineProps<{
  conversationId: string
  event: AgentTaskReportProcessEvent
  windowInfo: ReadonlyMap<string, TaskReportWindowInfo>
}>()

const emit = defineEmits<{
  saveTemplate: [payload: AgentTaskReportSaveRequest]
}>()

type SaveState = 'idle' | 'sending' | 'completed' | 'failed'

const { taskGroupList } = useProfileMonitor()
const saveState = ref<SaveState>('idle')
const expandedFailureReasons = ref(new Set<string>())

const profileByDirId = computed(() => new Map(
  taskGroupList.value
    .flatMap(group => group.tasks)
    .flatMap(task => task.dirId ? [[task.dirId, task] as const] : []),
))

const total = computed(() => props.event.report.windows.length)
const usedWindows = computed(() => props.event.report.windows.filter(window => window.status !== 'unused'))
const used = computed(() => usedWindows.value.length)
const unused = computed(() => total.value - used.value)
const succeeded = computed(() => usedWindows.value.filter(window => window.success).length)
const successRate = computed(() => used.value === 0 ? 0 : Math.round((succeeded.value / used.value) * 100))
const canSave = computed(() => {
  return saveState.value === 'idle' || saveState.value === 'failed'
})

function parameterValue(value: string | number | boolean | null): string {
  if (value === null) {
    return $t('未设置')
  }
  return String(value)
}

function reportWindow(dirId: string) {
  return {
    ...profileByDirId.value.get(dirId),
    ...props.windowInfo.get(dirId),
  }
}

function countryLabel(dirId: string): string {
  return reportWindow(dirId).countryCode || $t('地区未知')
}

function windowLabel(dirId: string): string {
  const task = reportWindow(dirId)
  const windowNumber = formatTaskReportWindowNumber(task)
  if (windowNumber) {
    return windowNumber
  }
  return $t('窗口信息不可用')
}

function accountLabel(dirId: string): string {
  return reportWindow(dirId)?.platformUserName || $t('未关联账号')
}

function isUnused(window: AgentTaskReportProcessEvent['report']['windows'][number]): boolean {
  return window.status === 'unused'
}

function countryIcon(dirId: string): SvgNames {
  const countryCode = reportWindow(dirId)?.countryCode
  return (countryCode ? `country-code/${countryCode}` : 'base/rx_ic_earth') as SvgNames
}

function failureReasonId(index: number): string {
  return `task-report-${props.event.id}-failure-reason-${index}`
}

function isFailureReasonExpanded(dirId: string): boolean {
  return expandedFailureReasons.value.has(dirId)
}

function toggleFailureReason(dirId: string): void {
  const next = new Set(expandedFailureReasons.value)
  if (next.has(dirId)) {
    next.delete(dirId)
  }
  else {
    next.add(dirId)
  }
  expandedFailureReasons.value = next
}

watch(() => props.event.id, () => {
  expandedFailureReasons.value = new Set()
})

function saveLabel(): string {
  if (saveState.value === 'sending') {
    return $t('正在保存模板')
  }
  if (saveState.value === 'completed') {
    return $t('已提交保存')
  }
  if (saveState.value === 'failed') {
    return $t('重试保存模板')
  }
  return $t('保存为模板')
}

async function saveAsTemplate(): Promise<void> {
  if (!canSave.value) {
    return
  }

  saveState.value = 'sending'
  try {
    await new Promise<void>((resolve, reject) => {
      emit('saveTemplate', {
        conversationId: props.conversationId,
        sourceReportId: props.event.sourceReportId,
        report: props.event.report,
        resolve,
        reject,
      })
    })
    saveState.value = 'completed'
  }
  catch {
    saveState.value = 'failed'
  }
}

function downloadReport(): void {
  const markdown = buildTaskReportMarkdown(
    props.event.report,
    props.event.report.windows.map(window => ({
      window: windowLabel(window.dirId),
      country: countryLabel(window.dirId),
      account: accountLabel(window.dirId),
      result: window.status === 'unused' ? $t('未使用') : window.success ? $t('成功') : $t('失败'),
      failureReason: window.status === 'unused' ? $t('未使用') : window.failureReason,
    })),
    {
      total: String(total.value),
      used: String(used.value),
      succeeded: String(succeeded.value),
      unused: String(unused.value),
      successRate: `${successRate.value}%`,
    },
    {
      title: $t('执行报告'),
      taskName: $t('任务名称'),
      reportStatus: $t('报告状态'),
      completed: $t('已完成'),
      parameters: $t('任务参数'),
      noParameters: $t('无参数'),
      parameterKey: $t('参数键'),
      parameterName: $t('参数名称'),
      parameterValue: $t('参数值'),
      windows: $t('执行窗口'),
      window: $t('窗口'),
      country: $t('地区'),
      account: $t('账号'),
      result: $t('结果'),
      failureReason: $t('失败原因'),
      summary: $t('汇总'),
      total: $t('总数'),
      used: $t('使用数'),
      succeeded: $t('成功数'),
      unused: $t('未使用数'),
      successRate: $t('成功率'),
    },
  )
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = taskReportFileName(props.event.report.taskName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="task-report-card">
    <header class="task-report-card__header">
      <div>
        <h3>{{ event.report.taskName }}</h3>
        <p>{{ $t('执行报告') }}</p>
      </div>
      <span class="report-status report-status--accepted">
        {{ $t('已完成') }}
      </span>
    </header>

    <section v-if="event.report.params.length" class="report-section report-section--params">
      <div class="report-section__heading">
        <h4>{{ $t('任务参数') }}</h4>
        <span>{{ $t('{count} 项', { count: event.report.params.length }) }}</span>
      </div>
      <dl class="report-params">
        <div v-for="parameter in event.report.params" :key="parameter.key" class="report-param">
          <dt>{{ parameter.name }}</dt>
          <dd>{{ parameterValue(parameter.value) }}</dd>
        </div>
      </dl>
    </section>

    <section class="report-section report-section--windows">
      <div class="report-section__heading">
        <h4>{{ $t('执行窗口') }}</h4>
        <span>{{ $t('{count} 个目标', { count: total }) }}</span>
      </div>
      <div class="report-windows">
        <article v-for="(window, index) in event.report.windows" :key="window.dirId" class="report-window" :class="{ 'report-window--failed': !window.success && !isUnused(window), 'report-window--unused': isUnused(window) }">
          <div class="report-window__main">
            <div class="report-window__identity">
              <span class="report-window__label">{{ windowLabel(window.dirId) }}</span>
              <SvgIcon :name="countryIcon(window.dirId)" fallback="base/rx_ic_earth" size="16" aria-hidden="true" />
              <span class="report-window__country">{{ countryLabel(window.dirId) }}</span>
              <span class="report-window__account" :title="accountLabel(window.dirId)">{{ accountLabel(window.dirId) }}</span>
            </div>
            <span class="window-result" :class="isUnused(window) ? 'window-result--unused' : window.success ? 'window-result--success' : 'window-result--failed'">
              {{ isUnused(window) ? $t('未使用') : window.success ? $t('成功') : $t('失败') }}
            </span>
          </div>
          <button
            v-if="window.failureReason"
            type="button"
            class="failure-reason-toggle"
            :aria-expanded="isFailureReasonExpanded(window.dirId)"
            :aria-controls="failureReasonId(index)"
            @click="toggleFailureReason(window.dirId)"
          >
            <span>{{ isFailureReasonExpanded(window.dirId) ? $t('收起失败原因') : $t('查看失败原因') }}</span>
            <SvgIcon name="base/rx_ic_chevron_down" size="14" :class="{ 'failure-reason-toggle__icon--expanded': isFailureReasonExpanded(window.dirId) }" aria-hidden="true" />
          </button>
          <div v-if="window.failureReason && isFailureReasonExpanded(window.dirId)" :id="failureReasonId(index)" class="failure-reason-panel">
            <span class="failure-reason-panel__label">{{ $t('失败原因') }}</span>
            <p>{{ window.failureReason }}</p>
          </div>
        </article>
      </div>
    </section>

    <footer class="task-report-card__footer">
      <span>{{ $t('共 {total} 个目标，使用 {used} 个，成功 {succeeded} 个，未使用 {unused} 个，成功率 {rate}%', { total, used, succeeded, unused, rate: successRate }) }}</span>
      <div class="report-actions">
        <button type="button" @click="downloadReport">
          {{ $t('导出报告') }}
        </button>
        <button type="button" :disabled="!canSave" @click="saveAsTemplate">
          {{ saveLabel() }}
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.task-report-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  border: 1px solid var(--color-border-secondary, #e4e4e7);
  border-radius: 10px;
  background: var(--color-bg-primary, #fff);
}
.task-report-card__header,
.task-report-card__footer,
.report-actions,
.report-window__main,
.report-window__identity,
.report-section__heading {
  display: flex;
  min-width: 0;
  align-items: center;
}
.task-report-card__header,
.task-report-card__footer {
  justify-content: space-between;
  gap: 12px;
}
.task-report-card__header h3,
.task-report-card__header p,
.failure-reason-panel p {
  margin: 0;
}
.task-report-card__header h3 {
  color: var(--color-text-primary, #141414);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.task-report-card__header p,
.task-report-card__footer {
  color: var(--color-text-secondary, #737373);
  font-size: 12px;
  line-height: 18px;
}
.report-status,
.window-result {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.report-status--accepted,
.window-result--success {
  color: var(--color-text-success-primary, #0f6b3a);
  background: var(--color-bg-success-primary, #dff6e8);
}
.window-result--failed {
  color: var(--color-text-error-primary, #a12622);
  background: var(--color-bg-error-primary, #fde7e5);
}
.window-result--unused {
  color: var(--color-text-secondary, #737373);
  background: var(--color-bg-secondary, #f4f4f5);
}
.report-section {
  min-width: 0;
}
.report-section--params {
  padding: 14px 0 18px;
  border-top: 1px solid var(--color-border-secondary, #e4e4e7);
  border-bottom: 1px solid var(--color-border-secondary, #e4e4e7);
}
.report-section__heading {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.report-section__heading h4 {
  margin: 0;
  color: var(--color-text-primary, #18181b);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.report-section__heading > span {
  color: var(--color-text-quaternary, #a1a1aa);
  font-size: 12px;
  line-height: 18px;
}
.report-params {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  gap: 8px;
  margin: 0;
}
.report-param {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border-secondary, #ededf0);
  border-radius: 7px;
  background: var(--color-bg-secondary, #fafafa);
}
.report-param dt {
  color: var(--color-text-secondary, #71717a);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.report-param dd {
  margin: 2px 0 0;
  color: var(--color-text-primary, #141414);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.report-windows {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.report-window {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--color-border-secondary, #ededf0);
  border-radius: 7px;
  background: var(--color-bg-primary, #fff);
}
.report-window--failed {
  border-color: var(--color-border-error, #f2d2d0);
  background: var(--color-bg-error-primary, #fffdfd);
}
.report-window--unused {
  border-color: var(--color-border-secondary, #e4e4e7);
  background: var(--color-bg-secondary, #fafafa);
}
.report-window__main {
  justify-content: space-between;
  gap: 12px;
}
.report-window__identity {
  min-width: 0;
  gap: 8px;
}
.report-window__label {
  flex: 0 0 auto;
  color: var(--color-text-primary, #27272a);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.report-window__account {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-secondary, #52525b);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
}
.report-window__country {
  flex: 0 0 auto;
  color: var(--color-text-tertiary, #71717a);
  font-size: 12px;
  line-height: 20px;
}
.failure-reason-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  color: var(--color-text-error-primary, #a12622);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}
.failure-reason-toggle:hover {
  color: var(--color-text-error-primary, #7f1d1d);
}
.failure-reason-toggle:focus-visible,
.report-actions button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
.failure-reason-toggle__icon--expanded {
  transform: rotate(180deg);
}
.failure-reason-toggle svg {
  transition: transform 0.18s ease;
}
.failure-reason-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  color: var(--color-text-error-primary, #7f1d1d);
  background: var(--color-bg-error-primary, #fff3f2);
  font-size: 12px;
  line-height: 18px;
}
.failure-reason-panel__label {
  font-weight: 600;
}
.failure-reason-panel p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.report-error {
  margin: -4px 0 0;
  color: var(--color-text-error-primary, #a12622);
  white-space: pre-wrap;
}
.report-actions {
  gap: 8px;
}
.report-actions button {
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--color-border-primary, #d6d6d6);
  border-radius: 6px;
  color: var(--color-text-primary, #141414);
  background: var(--color-bg-primary, #fff);
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}
.report-actions button:last-child:not(:disabled) {
  border-color: var(--color-border-success, #1d7a52);
  color: var(--color-text-success-primary, #0f6b3a);
}
.report-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
@media (max-width: 640px) {
  .task-report-card {
    padding: 16px;
  }
  .task-report-card__footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .report-actions {
    width: 100%;
  }
  .report-actions button {
    flex: 1;
  }
  .report-window__main {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .report-window__identity {
    width: 100%;
  }
  .failure-reason-panel {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
