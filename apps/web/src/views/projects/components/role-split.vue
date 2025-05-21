<script setup lang="ts">
import { $t } from '/@/locales'
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
    description: $t('只能打开或查看权限内的窗口信息。'),
  },
  {
    label: $t('编辑者'),
    value: Role.EDITOR,
    visible: role > Role.EDITOR,
    description: $t('可以管理所有窗口，并管理所有查看者权限。'),
  },
  {
    label: $t('管理者'),
    value: Role.MANAGER,
    visible: role > Role.MANAGER,
    description: $t('可以管理所有窗口，包括所有查看者和编辑者权限。'),
  },
].filter(item => item.visible))

const selectedRoleLabel = computed(() => {
  return items.value.find(item => item.value === roleModelValue.value)?.label
})
</script>

<template>
  <SplitButton :model="items" severity="secondary" size="small">
    {{ selectedRoleLabel }}
    <template #item="{ item }">
      <div class="item" @click.stop>
        <RadioButton v-model="roleModelValue" :input-id="item.label + item.value" :value="item.value" />
        <div class="detail">
          <label :for="item.label + item.value" class="label">{{ item.label }}</label>
          <div class="description">
            {{ item.description }}
          </div>
        </div>
      </div>
    </template>
  </SplitButton>
</template>

<style lang="scss" scoped>
.item {
  width: 100%;
  display: flex;
  padding: var(--spacing-md, 6px);
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  background: var(--Colors-Background-bg-body, #fff);

  .detail {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
    gap: var(--spacing-none, 0px);
    flex: 1 0 0;
  }

  .label {
    align-self: stretch;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-weight: 600;
    line-height: var(--Line-Height-text-md, 20px);
  }

  .description {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
