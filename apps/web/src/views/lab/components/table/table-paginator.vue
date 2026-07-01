<script setup lang="ts">
import type { PageState } from 'primevue/paginator'
import type { SelectChangeEvent } from 'primevue/select'

const { cacheKey = '', totalRecords = 0 } = defineProps<{
  cacheKey?: string
  totalRecords?: number
}>()

const emit = defineEmits<{
  (e: 'update'): void
}>()

const paginatorFirst = defineModel<number>('first', { default: 0 })
const paginatorRows = defineModel<number>('rows', { default: 10 })

const paginatorRowOptions = [5, 10, 20, 50, 100, 500].map(count => ({
  label: $t('{count} 条/页', { count }),
  value: count,
}))

function onChangePage(_event: PageState) {
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
  <Paginator v-model:first="paginatorFirst" class="paginator" :rows="paginatorRows" :total-records="totalRecords" :page-link-size="5" template="JumpToPageInput PrevPageLink PageLinks NextPageLink"
             @page="onChangePage"
  >
    <template #start>
      <div class="flex flex-1 items-center paginator-jump">
        <div>{{ $t('总计 {total} 个', { total: totalRecords }) }}</div>
        <RxInputSelect v-model="paginatorRows" class="!w-fit" name="rowsPerPage" :options="paginatorRowOptions" option-value="value" size="xxs" :filter="false" @change="onChangeRows" />
        <div class="flex-1 flex items-center gap-2 justify-end">
          {{ $t('跳转页数至') }}
        </div>
      </div>
    </template>
  </Paginator>
</template>

<style scoped lang="scss">
.paginator {
  &-jump {
    display: flex;
    gap: var(--spacing-lg, 8px);
    color: var(--colors-text-text-secondary, #b2b6b8);
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
    color: var(--colors-text-text-primary, #171c1f);
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
    color: var(--colors-text-text-brand, #12a3fc);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--colors-border-border-brand, #12a3fc);
    background: var(--component-button-ghost-bg, #fff);
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  }

  :deep(.p-inputtext) {
    padding: 4px 4px 4px 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
    background: var(--colors-background-bg-action, #fff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    color: var(--colors-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  :deep(.p-select) {
    padding: 4px 4px 4px 6px;
    gap: 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
    background: var(--colors-background-bg-action, #fff);
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
