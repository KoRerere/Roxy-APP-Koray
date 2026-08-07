<script setup lang="ts">
type TaskTableVariant = 'tasks' | 'activity'

interface SkeletonColumn {
  /** 复刻真实表格 colgroup 的列宽百分比 */
  width: string
  /** 单元格内骨架条宽度 */
  cellWidth: string
  /** 表头骨架条宽度 */
  headWidth: string
  /** 单元格渲染形态：文本条 / 徽章 / 状态胶囊 / 操作区 */
  cell?: 'text' | 'badge' | 'status' | 'actions'
}

const props = withDefaults(defineProps<{
  variant?: TaskTableVariant
  rows?: number
}>(), {
  variant: 'tasks',
  rows: 5,
})

const COLUMNS: Record<TaskTableVariant, SkeletonColumn[]> = {
  tasks: [
    { width: '15%', headWidth: '56px', cellWidth: '78%' },
    { width: '15%', headWidth: '56px', cellWidth: '72%', cell: 'badge' },
    { width: '14%', headWidth: '56px', cellWidth: '60%' },
    { width: '12%', headWidth: '56px', cellWidth: '84%' },
    { width: '16%', headWidth: '56px', cellWidth: '70%' },
    { width: '13%', headWidth: '28px', cellWidth: '64px', cell: 'status' },
    { width: '15%', headWidth: '28px', cellWidth: '68px', cell: 'actions' },
  ],
  activity: [
    { width: '13%', headWidth: '28px', cellWidth: '80%' },
    { width: '12%', headWidth: '28px', cellWidth: '86%', cell: 'badge' },
    { width: '13%', headWidth: '28px', cellWidth: '58%' },
    { width: '16%', headWidth: '28px', cellWidth: '76%' },
    { width: '11%', headWidth: '56px', cellWidth: '88%' },
    { width: '11%', headWidth: '56px', cellWidth: '88%' },
    { width: '12%', headWidth: '28px', cellWidth: '64px', cell: 'status' },
    { width: '12%', headWidth: '28px', cellWidth: '68px', cell: 'actions' },
  ],
}

const columns = computed(() => COLUMNS[props.variant])
</script>

<template>
  <div
    class="task-table-skeleton"
    :class="`task-table-skeleton--${variant}`"
    role="status"
    aria-busy="true"
  >
    <span class="sr-only">{{ $t('加载中...') }}</span>

    <table class="task-table-skeleton__table" aria-hidden="true">
      <colgroup>
        <col v-for="(column, index) in columns" :key="index" :style="{ width: column.width }">
      </colgroup>
      <thead>
        <tr>
          <th v-for="(column, index) in columns" :key="index" scope="col">
            <Skeleton :width="column.headWidth" height="14px" border-radius="4px" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row">
          <td v-for="(column, index) in columns" :key="index">
            <div v-if="column.cell === 'actions'" class="task-table-skeleton__actions">
              <Skeleton :width="column.cellWidth" height="32px" border-radius="10px" />
              <Skeleton width="28px" height="28px" border-radius="8px" />
            </div>
            <Skeleton
              v-else-if="column.cell === 'status'"
              :width="column.cellWidth"
              height="24px"
              border-radius="999px"
            />
            <Skeleton
              v-else-if="column.cell === 'badge'"
              :width="column.cellWidth"
              height="24px"
              border-radius="8px"
            />
            <Skeleton v-else :width="column.cellWidth" height="14px" border-radius="4px" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss" scoped>
.task-table-skeleton {
  width: 100%;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.task-table-skeleton__table {
  width: 100%;
  min-width: 760px;
  table-layout: fixed;
  border-collapse: collapse;

  th,
  td {
    height: 58px;
    padding: 8px;
    border-bottom: 1px solid var(--color-border-secondary);
    overflow: hidden;
    text-align: left;
    vertical-align: middle;
  }

  th {
    height: 40px;
    background: var(--color-bg-tertiary);
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }
}

.task-table-skeleton--activity .task-table-skeleton__table {
  min-width: 980px;
}

.task-table-skeleton__actions {
  display: flex;
  width: max-content;
  align-items: center;
  gap: 4px;
}
</style>
