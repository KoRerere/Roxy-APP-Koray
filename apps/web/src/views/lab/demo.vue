<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

import { useDriverDataTableTour } from './useDriverDataTableTour'

const dtRef = useTemplateRef('dt')

const rows = ref<{ c1: string, c2: string, c3: string, c4: string, c5: string }[]>([
  { c1: 'r1c1', c2: 'r1c2', c3: 'r1c3', c4: 'r1c4', c5: 'r1c5' },
  { c1: 'r2c1', c2: 'r2c2', c3: 'r2c3', c4: 'r2c4', c5: 'r2c5' },
  { c1: 'r3c1', c2: 'r3c2', c3: 'r3c3', c4: 'r3c4', c5: 'r3c5' },
])

const { drive } = useDriverDataTableTour()

function startTour() {
  drive({
    el: dtRef.value?.$el,
    steps: [
      {
        // ✅ data 模式：自动忽略 selection 列（所以 cols[0] 仍是“业务第1列”）
        pick: { rect: { rows: [0, 2], cols: [0, 1], mode: 'data' } },
        popover: { description: '前2行×前2列（业务列）', side: 'bottom' },
      },
      {
        // ✅ selector：如果你遇到特殊表格结构，依然能完全自定义
        pick: { selector: '.p-datatable-tbody > tr > td:nth-child(3)' },
        popover: { description: '第3个 td（DOM意义）', side: 'right' },
      },
    ],
  })
}
</script>

<template>
  <div class="w-150 pa-4">
    <div class="mb-4">
      <Button label="Start Tour" @click="startTour" />
    </div>

    <DataTable ref="dt" class="my-table" :value="rows" :scrollable="true" scroll-height="240px" show-gridlines :virtual-scroller-options="{ itemSize: 60 }">
      <Column field="c1" header="C1" />
      <Column field="c2" header="C2" />
      <Column field="c3" header="C3" />
      <Column field="c4" header="C4" />
      <Column field="c5" header="C5" />
    </DataTable>
  </div>
</template>
