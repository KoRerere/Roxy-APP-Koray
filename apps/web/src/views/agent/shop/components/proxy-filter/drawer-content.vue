<script setup lang="ts">
import MInputRadio from '/@/views/lab/components/form/m-input-radio.vue'
import type { ProxyFilterFieldValue, ProxyFilterOption, ProxyFilterValues, useProxyFilter } from './useProxyFilter'

const { filter } = defineProps<{
  filter: ReturnType<typeof useProxyFilter>
}>()

const emit = defineEmits<{
  apply: []
}>()

function updateGroupValue(groupKey: keyof ProxyFilterValues, value: ProxyFilterFieldValue) {
  filter.updateDraftField(groupKey, value)
}

function toggleGroupOption(groupKey: keyof ProxyFilterValues, option: ProxyFilterOption) {
  filter.toggleDraftFieldOption(groupKey, option.value)
}
</script>

<template>
  <div class="proxy-filter-drawer flex flex-col h-full min-w-120">
    <div class="proxy-filter-drawer__body flex-1 overflow-y-auto">
      <div v-for="group in filter.filterGroups" :key="group.key" class="proxy-filter-drawer__group">
        <div class="proxy-filter-drawer__group-label">
          {{ group.label }}
        </div>

        <MInputRadio v-if="!group.multiple" :model-value="filter.draft.value[group.key]" :name="group.key" size="md" :options="group.options"
                     @update:model-value="updateGroupValue(group.key, $event)"
        />

        <div v-else class="proxy-filter-drawer__checkbox-group md">
          <label v-for="option in group.options" :key="`${group.key}_${option.value}`" :for="`${group.key}_${option.value}`" class="proxy-filter-drawer__checkbox-item"
                 :class="{ 'is-checked': filter.isDraftOptionSelected(group.key, option.value) }"
          >
            <RxCheckbox icon-class="font-500 !size-4" :input-id="`${group.key}_${option.value}`" :name="group.key" binary :model-value="filter.isDraftOptionSelected(group.key, option.value)"
                        @update:model-value="toggleGroupOption(group.key, option)"
            />
            <div class="proxy-filter-drawer__checkbox-text">{{ option.label }}</div>
          </label>
        </div>
      </div>
    </div>

    <div class="proxy-filter-drawer__footer flex items-center justify-between gap-3 shrink-0">
      <RxButton size="sm" variant="outlined" severity="secondary" :label="$t('重置')" @click="filter.resetDraft()" />
      <RxButton size="sm" :label="$t('应用筛选')" @click="emit('apply')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxy-filter-drawer {
  background: var(--colors-background-bg-page);

  &__body {
    padding: 16px;
  }

  &__group + &__group {
    margin-top: 20px;
  }

  &__group-label {
    margin-bottom: 10px;
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
  }

  &__checkbox-group {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;

    &.md {
      --checkbox-padding: 8px 8px 8px 10px;
      --checkbox-gap: 6px;
      --checkbox-font-size: 13px;
      --checkbox-line-height: 20px;
    }
  }

  &__checkbox-item {
    display: flex;
    align-items: center;
    min-width: 100px;
    padding: var(--checkbox-padding);
    gap: var(--checkbox-gap);
    border-radius: 8px;
    border: 3px solid var(--colors-background-bg-page);
    box-shadow: inset 0px 0px 0px 1px var(--colors-border-border-base);
    background: var(--colors-background-bg-action);
    transition: all 0.3s;
    cursor: pointer;

    &:not(.is-checked):hover {
      background: var(--colors-background-bg-action-hover);
    }

    &.is-checked {
      border-color: var(--colors-border-border-brand);
      background: var(--pattern-pay-gradient-selected-start);
      box-shadow: none;

      .proxy-filter-drawer__checkbox-text {
        color: var(--colors-text-text-brand);
        font-weight: 600;
      }
    }
  }

  &__checkbox-text {
    color: var(--colors-text-text-primary);
    font-size: var(--checkbox-font-size);
    line-height: var(--checkbox-line-height);
    user-select: none;
  }

  &__footer {
    padding: 12px 16px 16px;
    border-top: 0.5px solid var(--colors-border-divider);
  }
}
</style>
