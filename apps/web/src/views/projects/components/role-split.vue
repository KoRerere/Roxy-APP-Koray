<script setup lang="ts">
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'

const workspaceStore = useWorkspaceStore()
const role = (workspaceStore.currentWorkspace?.role ?? -1)

const roleModelValue = defineModel({ default: Role.VIEWER })
const items = ref([
  {
    label: $t('查看者'),
    value: Role.VIEWER,
    visible: role > Role.VIEWER,
    description: $t('只能打开或查看权限内的窗口信息'),
  },
  {
    label: $t('编辑者'),
    value: Role.EDITOR,
    visible: role > Role.EDITOR,
    description: $t('可以管理所有窗口，编辑所有查看者权限'),
  },
  {
    label: $t('管理者'),
    value: Role.MANAGER,
    visible: role > Role.MANAGER,
    description: $t('可以管理所有窗口，编辑所有查看者和编辑者权限'),
  },
].filter(item => item.visible))

const selectedRoleLabel = computed(() => {
  return items.value.find(item => item.value === roleModelValue.value)?.label
})
</script>

<template>
  <SplitButton :model="items" severity="secondary" size="small" :label="selectedRoleLabel">
    <template #item="{ item }">
      <div class="item" @click.stop>
        <RadioButton v-model="roleModelValue" :input-id="item.label + item.value" :value="item.value" />
        <label class="detail" :for="item.label + item.value">
          <div class="label">{{ item.label }}</div>
          <div class="description">{{ item.description }}</div>
        </label>
      </div>
    </template>
    <template #dropdownicon="props">
      <SvgIcon v-bind="props" name="base/rx_ic_chevron_down" />
    </template>
  </SplitButton>
</template>

<style lang="scss" scoped>
:deep(.p-splitbutton-button),
:deep(.p-splitbutton-dropdown) {
  background: var(--component-tag-bg-strong);
}

.item {
  width: 100%;
  display: flex;
  padding: var(--spacing-md, 6px);
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);

  .detail {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
    gap: var(--spacing-none, 0px);
    flex: 1 0 0;
    user-select: none;
  }

  .label {
    align-self: stretch;
    color: var(--colors-text-text-primary);
    font-family: Inter;
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
  }

  .description {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
