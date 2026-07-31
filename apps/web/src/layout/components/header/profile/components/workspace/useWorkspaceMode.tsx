import RxButton from '/@/components/rx-button'
import { useDialog } from '/@/hooks/useDialog'
import { WorkspaceType } from '/@/enums'
import { isEcommerceWorkspace } from '/@/utils/workspace-mode'

/** 工作区模式选项 */
export function getWorkspaceModeOptions() {
  return [
    { label: $t('通用模式'), value: WorkspaceType.Private },
    { label: $t('电商模式'), value: WorkspaceType.ECommerce },
  ]
}

/** 根据模式返回说明文案 */
export function getWorkspaceModeDescription(type: WorkspaceType) {
  if (isEcommerceWorkspace(type)) {
    return $t('专注跨境电商场景，以账号、设备与店铺为核心的轻量化业务管理界面。')
  }
  return $t('完整专业版界面，含独立窗口、代理 IP、高级指纹等全部功能。')
}

interface SwitchWorkspaceModeCallbacks {
  /** 当前工作区模式，用于弹窗内展示当前模式说明 */
  currentType: WorkspaceType
  onConfirm: () => void | boolean | Promise<void | boolean>
  onCancel?: () => void
}

/** 获取切换后的目标模式 */
export function getTargetWorkspaceType(currentType: WorkspaceType) {
  return isEcommerceWorkspace(currentType) ? WorkspaceType.Private : WorkspaceType.ECommerce
}

/** 根据当前模式返回切换按钮文案 */
export function getSwitchModeButtonLabel(currentType: WorkspaceType) {
  return isEcommerceWorkspace(currentType)
    ? $t('切换通用模式')
    : $t('切换电商模式')
}

/** 工作区模式切换确认弹窗 */
export function useWorkspaceModeSwitchConfirm() {
  const [showModal] = useDialog()

  function confirmSwitchWorkspaceMode(
    callbacks: SwitchWorkspaceModeCallbacks,
  ) {
    const modeOptions = getWorkspaceModeOptions()
    const currentLabel = modeOptions.find(option => option.value === callbacks.currentType)?.label ?? ''
    const currentDescription = getWorkspaceModeDescription(callbacks.currentType)
    const switchButtonLabel = getSwitchModeButtonLabel(callbacks.currentType)

    showModal({
      header: $t('提示'),
      class: 'w-114',
      cancelText: '',
      slots: {
        footer: undefined,
        default: ({ handleCancel, hideModal }) => {
          async function handleSwitch() {
            const result = await callbacks.onConfirm()
            if (result === false)
              return

            hideModal()
          }

          function handleCancelClick() {
            handleCancel()
          }

          return (
            <div class="flex flex-col gap-4">
              <div class="tt-primary text-3.5 leading-5 font-500">
                {$t('当前为「{mode}」：{description}', { mode: currentLabel, description: currentDescription })}
              </div>
              <div class="tt-tertiary text-3 leading-4.5">
                {$t('请注意，切换后将适用新模式的规则：')}
              </div>
              <ul class="list-disc pl-4 tt-tertiary text-3 leading-4.5 flex flex-col gap-1">
                <li>{$t('交互变更：页面布局与操作路径有所调整')}</li>
                <li>{$t('计费变更：扣费/计费逻辑将按新模式执行')}</li>
              </ul>
              <div class="flex flex-col gap-2 pt-2">
                <RxButton
                  class="w-full"
                  icon="base/rx_ic_customer_support"
                  label={$t('在线客服')}
                  onClick={showLiveChat}
                />
                <RxButton
                  class="w-full"
                  outlined
                  severity="secondary"
                  icon="base/rx_ic_transfer"
                  label={switchButtonLabel}
                  onClick={handleSwitch}
                />
                <RxButton
                  class="w-full"
                  text
                  severity="secondary"
                  label={$t('取消')}
                  onClick={handleCancelClick}
                />
              </div>
            </div>
          )
        },
      },
      handleCancel: () => {
        callbacks.onCancel?.()
      },
    })
  }

  return {
    confirmSwitchWorkspaceMode,
  }
}
