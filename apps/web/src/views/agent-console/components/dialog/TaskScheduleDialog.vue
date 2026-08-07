<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import type {
  TaskScheduleFrequency,
  TaskSchedulePlan,
  TaskScheduleSource,
} from '../../task-schedule'
import DatePicker from 'primevue/datepicker'
import {
  buildTaskSchedulePlan,
  createTaskScheduleDraft,
  isValidTaskCron,
} from '../../task-schedule'
import AgentFormField from '../form/AgentFormField.vue'
import AgentSelect from '../form/AgentSelect.vue'
import './agent-dialog.scss'

interface SelectOption<T = string> {
  label: string
  value: T
}

interface TaskScheduleDialogData {
  initialValues?: TaskScheduleSource
  onCancel?: () => void | Promise<void>
  onSave?: (payload: TaskSchedulePlan) => boolean | void | Promise<boolean | void>
}

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const dialogData = (dialogRef?.value.data ?? {}) as TaskScheduleDialogData
const draft = reactive(createTaskScheduleDraft(dialogData.initialValues, 'once'))
const saving = ref(false)
const formError = ref('')

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

async function closeDialog() {
  await dialogData.onCancel?.()
  dialogRef?.value.close()
}

async function saveSchedule() {
  formError.value = ''
  const schedulePlan = buildTaskSchedulePlan(draft)

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
    const shouldClose = await dialogData.onSave?.(schedulePlan)
    if (shouldClose !== false)
      dialogRef?.value.close()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="agent-console-dialog__shell task-schedule-dialog">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">{{ $t('计划') }}</h2>
      <button class="agent-console-dialog__close" type="button" :aria-label="$t('关闭计划弹窗')" @click="closeDialog" />
    </header>

    <main class="agent-console-dialog__body task-schedule-dialog__body">
      <AgentFormField :label="$t('计划')">
        <div class="task-schedule-dialog__row">
          <AgentSelect
            v-model="draft.frequency"
            class="task-schedule-dialog__frequency"
            :options="scheduleFrequencyOptions"
            :disabled="saving"
          />

          <template v-if="draft.frequency === 'once'">
            <DatePicker
              v-model="draft.scheduleDate"
              class="task-schedule-dialog__datepicker task-schedule-dialog__date"
              panel-class="agent-schedule-datepicker-panel"
              date-format="yy-mm-dd"
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

            <DatePicker
              v-model="draft.scheduleTime"
              class="task-schedule-dialog__datepicker task-schedule-dialog__time"
              panel-class="agent-schedule-datepicker-panel"
              time-only
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
          </template>

          <AgentSelect
            v-else-if="draft.frequency === 'weekly'"
            v-model="draft.weekday"
            class="task-schedule-dialog__detail"
            overlay-class="agent-schedule-select-overlay"
            :options="weekdayOptions"
            :disabled="saving"
          />

          <AgentSelect
            v-else-if="draft.frequency === 'monthly'"
            v-model="draft.monthlyDay"
            class="task-schedule-dialog__detail"
            overlay-class="agent-schedule-select-overlay"
            :options="monthlyDayOptions"
            :disabled="saving"
          />

          <DatePicker
            v-if="draft.frequency !== 'once'"
            v-model="draft.scheduleTime"
            class="task-schedule-dialog__datepicker task-schedule-dialog__time"
            :class="{ wide: draft.frequency === 'daily' }"
            panel-class="agent-schedule-datepicker-panel"
            time-only
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
      </AgentFormField>

      <p v-if="formError" class="task-schedule-dialog__error" role="alert">{{ formError }}</p>
    </main>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions">
        <button class="agent-console-dialog__button" type="button" :disabled="saving" @click="closeDialog">
          {{ $t('取消') }}
        </button>
        <button class="agent-console-dialog__button dark" type="button" :disabled="saving" @click="saveSchedule">
          {{ saving ? $t('保存中...') : $t('保存') }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.task-schedule-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-schedule-dialog__row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.task-schedule-dialog__frequency {
  width: 120px;
  flex: 0 0 120px;
}

.task-schedule-dialog__detail,
.task-schedule-dialog__date {
  min-width: 0;
  flex: 1 1 0;
}

.task-schedule-dialog__time {
  width: 120px;
  flex: 0 0 120px;

  &.wide {
    width: auto;
    flex: 1 1 0;
  }
}

.task-schedule-dialog__datepicker {
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

.task-schedule-dialog__error {
  margin: 0;
  color: #f04438;
  font-size: 12px;
  line-height: 16px;
}

.agent-console-dialog__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 520px) {
  .task-schedule-dialog__row {
    align-items: stretch;
    flex-direction: column;
  }

  .task-schedule-dialog__frequency,
  .task-schedule-dialog__detail,
  .task-schedule-dialog__date,
  .task-schedule-dialog__time {
    width: 100%;
    flex-basis: auto;
  }
}
</style>
