<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import { Role } from '/@/enums'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'

defineOptions({
  inheritAttrs: false,
})

const workspaceStore = useWorkspaceStore()
const role = (workspaceStore.currentWorkspace?.role ?? -1)

const modelValue = defineModel<string>()
const roleModelValue = defineModel('role')
const items = ref([
  {
    label: $t('Viewer'),
    value: Role.VIEWER,
    visible: role > Role.VIEWER,
    description: $t('Can only open and view profiles/proxies/accounts related to selected project.'),
  },
  {
    label: $t('Editor'),
    value: Role.EDITOR,
    visible: role > Role.EDITOR,
    description: $t('Can edit and view profiles/proxies/accounts related to selected project. Can manage viewers related to selected projects.'),
  },
  {
    label: $t('Manager'),
    value: Role.MANAGER,
    visible: role > Role.MANAGER,
    description: $t('Can manage all profiles and resources in all projects. Can manage all viewers and editors.'),
  },
].filter(item => item.visible))

const selectedRoleLabel = computed(() => {
  return items.value.find(item => item.value === roleModelValue.value)?.label
})
</script>

<template>
  <IconField>
    <InputIcon>
      <RxSvgIcon name="base/rx_ic_mail" />
    </InputIcon>
    <InputText v-bind="$attrs" v-model="modelValue" :placeholder="$t('Enter email')" class="w-full" />
    <InputIcon class="position-y-center !mt-0">
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
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped>
.item {
  width: 280px;
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
    align-items: center;
    gap: var(--spacing-none, 0px);
    flex: 1 0 0;
  }

  .label {
    align-self: stretch;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }

  .description {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: 14px;
    /* 140% */
  }
}
</style>
