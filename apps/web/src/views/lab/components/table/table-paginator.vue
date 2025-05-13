<script setup lang="ts">
import type { PageState } from 'primevue/paginator';
import { $t } from '/@/locales';
import type { SelectChangeEvent } from 'primevue/select';

const { cacheKey = '', totalRecords = 0 } = defineProps<{
  cacheKey?: string
  totalRecords?: number
}>()

const emit = defineEmits<{
  (e: 'update'): void
}>()

const paginatorFirst = defineModel<number>('first', { default: 0 })
const paginatorRows = defineModel<number>('rows', { default: 10 })

const paginatorRowOptions = [
  { label: $t('5 条/页'), value: 5 },
  { label: $t('10 条/页'), value: 10 },
  { label: $t('20 条/页'), value: 20 },
  { label: $t('50 条/页'), value: 50 },
  { label: $t('100 条/页'), value: 100 },
]

function onChangePage(event: PageState) {
  emit('update')
}

function onChangeRows(selectEvent: SelectChangeEvent) {
  if (cacheKey && selectEvent.value) {
    localStorage.setItem(`table:${cacheKey}`, selectEvent.value)
  }
  paginatorFirst.value = 0
  emit('update')
}
</script>

<template>
  <Paginator class="paginator" v-model:first="paginatorFirst" :rows="paginatorRows" :total-records="totalRecords" :page-link-size="5" template="JumpToPageInput PrevPageLink PageLinks NextPageLink"
    @page="onChangePage">
    <template #start>
      <div class="flex flex-1 items-center paginator-jump">
        <div>{{ $t('总计 {total} 个', { total: totalRecords }) }}</div>
        <RxInputSelect class="!w-fit" name="rowsPerPage" v-model="paginatorRows" :options="paginatorRowOptions" optionValue="value" size="xxs" :filter="false" @change="onChangeRows" />
        <div class="flex-1 flex items-center gap-2 justify-end">{{ $t('跳转页数至') }}</div>
      </div>
    </template>
  </Paginator>
</template>

<style scoped lang="scss">
.paginator {
  &-jump {
    display: flex;
    gap: var(--spacing-lg, 8px);
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  :deep(.p-paginator) {
    border-radius: 0;
  }

  :deep(.p-paginator-prev),
  :deep(.p-paginator-next),
  :deep(.p-paginator-page) {
    min-width: auto;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm, 4px);
  }

  :deep(.p-paginator-page) {
    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  :deep(.p-paginator-content-start) {
    flex: 1;
  }

  :deep(.p-paginator-page-selected) {
    background: none;
    color: var(--Component-Colors-Buttons-Ghost-text, #12a3fc);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-Buttons-Tertiary-border, #12a3fc);
    background: var(--Component-Colors-Buttons-Ghost-bg, #fff);
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  }

  :deep(.p-inputtext) {
    padding: 4px 4px 4px 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  :deep(.p-select) {
    padding: 4px 4px 4px 6px;
    gap: 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    .p-select-label {
      padding: 0;
    }

    .p-select-dropdown {
      width: auto;
    }
  }
}
</style>
