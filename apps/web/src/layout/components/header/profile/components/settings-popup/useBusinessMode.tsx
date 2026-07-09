import { useConfirm } from 'primevue/useconfirm'
import SelectButton from 'primevue/selectbutton'
import { WorkspaceType } from '/@/enums'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEcommerceWorkspace } from '/@/utils/workspace-mode'
import type { List } from '/@/layout/components/header/profile/type'

export function useBusinessModePanel() {
  const confirm = useConfirm()
  const roleStore = useRoleStore()
  const workspaceStore = useWorkspaceStore()

  function getBusinessModeOptions() {
    return [
      { label: $t('普通模式'), value: WorkspaceType.Private },
      { label: $t('电商模式'), value: WorkspaceType.ECommerce },
    ]
  }

  function createBusinessModeSection(): List {
    const currentType = computed(() => workspaceStore.currentWorkspace?.workspaceType ?? WorkspaceType.Private)
    const selectedType = ref(currentType.value)

    watch(currentType, (type) => {
      selectedType.value = type
    })

    return {
      subtitle: $t('业务模式'),
      hide: () => !roleStore.isOwner,
      items: [
        {
          label: $t('工作区模式'),
          text: () => (
            <div class="w-88">
              {$t('切换后侧边栏菜单与默认页面将发生变化，仅影响当前工作区。')}
            </div>
          ),
          name: 'workspaceBusinessMode',
          value: selectedType.value,
          props: {
            options: getBusinessModeOptions(),
            optionLabel: 'label',
            optionValue: 'value',
            allowEmpty: false,
          },
          component: ({ item, ...props }: { item: any, props: any }) => (
            <SelectButton
              {...item.props}
              {...props}
              modelValue={selectedType.value}
              onUpdate:modelValue={(value: WorkspaceType) => {
                if (value === currentType.value)
                  return

                const targetLabel = isEcommerceWorkspace(value) ? $t('电商模式') : $t('普通模式')
                confirm.require({
                  header: $t('切换业务模式'),
                  message: $t('确认将当前工作区切换为「{mode}」？切换后菜单与路由将立即更新。', { mode: targetLabel }),
                  rejectProps: {
                    label: $t('取消'),
                    severity: 'secondary',
                    outlined: true,
                  },
                  acceptProps: {
                    label: $t('确认切换'),
                  },
                  accept: async () => {
                    await workspaceStore.switchWorkspaceType(value)
                    selectedType.value = value
                  },
                  reject: () => {
                    selectedType.value = currentType.value
                  },
                })
              }}
            />
          ),
        },
      ],
    }
  }

  return {
    createBusinessModeSection,
  }
}
