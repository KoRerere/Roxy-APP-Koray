import { SubLevelEnum } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user'
import { emitter } from '/@/utils/eventBus'
import { I18nT } from 'vue-i18n'
import { $t } from '/@/locales'
import { usePermission } from '/@/hooks/usePermission'
import { BUSINESS_CODE } from '/@/constants/business-code'
import { useWorkspaceStore } from '/@/stores/workspace'
import { Role } from '/@/enums'
import router from '/@/router'
import type { ToastMessageOptions } from 'primevue/toast'

export function toUpgradePlan() {
  const { userPayInfo } = useUserStore()
  const isFree = [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.subLevel as SubLevelEnum)
  const isExpired = userPayInfo.subLevel === SubLevelEnum.Expired

  if (isFree) {
    router.push({ name: 'subscribe-plan' })
  }
  else if (isExpired) {
    emitter.emit('showRenewalDialog')
  }
  else {
    router.push({ name: 'upgrade-plan' })
  }
}

export function hasWorkspaceBillingPermission() {
  const { check } = usePermission()
  return check('Cost_Center_all')
}

function buyMoreExpand(defaultType: 'workspace' | 'staff') {
  emitter.emit('showExpandDialog', { defaultType })
}

export function executeSomethingByBackToSelfWorkspace(next: (...args: any[]) => void) {
  return async (...args: any[]) => {
    const workspaceStore = useWorkspaceStore()
    if (workspaceStore.workspaceList.length === 0) {
      await workspaceStore.getWorkspaceList()
    }
    if (workspaceStore.currentWorkspace?.role === Role.OWNER) {
      next(...args)
      return
    }
    const ownerWorkspace = workspaceStore.workspaceList.find(item => item.workspaceDefault && item.role === Role.OWNER)
    if (ownerWorkspace) {
      workspaceStore.setCurrentWorkspace(ownerWorkspace.id!).finally(() => {
        setTimeout(() => {
          next(...args)
        }, 1500)
      })
    }
  }
}

export function executeSomethingByTargetWorkspace(next: (...args: any[]) => void) {
  return async (targetWorkspaceId: number, ...args: any[]) => {
    const workspaceStore = useWorkspaceStore()
    if (workspaceStore.workspaceList.length === 0) {
      await workspaceStore.getWorkspaceList()
    }

    if (targetWorkspaceId === workspaceStore.currentWorkspace?.id) {
      next(...args)
      return
    }

    const targetWorkspace = workspaceStore.workspaceList.find(item => item.id === targetWorkspaceId)

    if (targetWorkspace) {
      workspaceStore.setCurrentWorkspace(targetWorkspace.id!).finally(() => {
        setTimeout(() => {
          next(...args)
        }, 1500)
      })
    }
  }
}

export const switchWorkspaceAndToUpgradePlan = executeSomethingByBackToSelfWorkspace(toUpgradePlan)

/** 空间权益：有费用中心权限时在当前空间直接跳转升级/付费页 */
export function navigateToWorkspaceUpgrade() {
  if (hasWorkspaceBillingPermission()) {
    toUpgradePlan()
  }
}

/** 个人权益：切回自有空间后跳转升级（窗口模板、窗口转移、窗口同步） */
export const navigateToPersonalUpgrade = switchWorkspaceAndToUpgradePlan

export const showToast = (options: ToastMessageOptions) => emitter.emit('showToast', options)

export function useHandleBusinessCode() {
  const { userPayInfo } = storeToRefs(useUserStore())
  const { check } = usePermission()

  async function handleBusinessCode(code: number, next?: () => void) {
    const privateMoreExpand = check('Cost_Center_all') ? buyMoreExpand : executeSomethingByBackToSelfWorkspace(buyMoreExpand)

    // 团队数量超出
    if (code === BUSINESS_CODE.WORKSPACE_MAX_LIMIT) {
      showToast({
        severity: 'warn',
        summary: $t('团队用量不足'),
        detail: (
          <I18nT keypath={$t('您已达到最大团队创建限制，可通过删除不再使用的团队或 {link}', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={() => privateMoreExpand('workspace')}>{$t('购买更多')}</a> }}
          </I18nT>
        ),
        life: 5000,
      })
    }
    else if (code === BUSINESS_CODE.MEMBER_MAX_LIMIT) {
      if (!check('Cost_Center_all')) {
        return showToast({
          severity: 'warn',
          summary: $t('团队成员用量不足'),
          detail: $t('当前团队下的团队成员数量已到达上限，请删除不再活跃的团队成员或者联系团队的拥有者进行升级。'),
          life: 5000,
        })
      }
      showToast({
        severity: 'warn',
        summary: $t('团队成员用量不足'),
        detail: (
          <I18nT keypath={$t('您已达到最大团队成员添加限制，可通过删除不再活跃的团队成员或 {link}', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={() => privateMoreExpand('staff')}>{$t('购买更多')}</a> }}
          </I18nT>
        ),
        life: 5000,
      })
    }
    else if (code === BUSINESS_CODE.WINDOW_MAX_LIMIT) {
      if (!check('Cost_Center_all')) {
        return showToast({
          severity: 'warn',
          summary: $t('窗口用量不足'),
          detail: $t('当前团队下的可创建窗口数量已到达上限，请删除不需要的窗口或者联系团队的拥有者进行升级。'),
          life: 5000,
        })
      }

      // 免费用户，创建额度不足
      if (userPayInfo.value.subLevel === SubLevelEnum.Free) {
        emitter.emit('showUpgradePlanDialog', 'windowLimitReached')
      }
      // 订阅到期用户，创建额度不足
      else if (userPayInfo.value.subLevel === SubLevelEnum.Expired) {
        emitter.emit('showUpgradePlanDialog', 'subscriptionExpired')
      }
      else {
        showToast({
          severity: 'warn',
          summary: $t('窗口用量不足'),
          detail: (
            <I18nT keypath={$t('您已达到最大窗口创建限制，可通过删除不再使用的窗口或{link}。', { count: userPayInfo.value.maxWindowCount, link: '{link}' })}>
              {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('购买更多')}</a> }}
            </I18nT>
          ),
          life: 5000,
        })
      }
    }
    else if (code === BUSINESS_CODE.PROJECT_MAX_LIMIT) {
      if (!check('Cost_Center_all')) {
        return showToast({
          severity: 'warn',
          summary: $t('项目用量不足'),
          detail: $t('当前团队下的项目数量已到达上限，请删除不再使用的项目或者联系团队的拥有者进行升级。'),
          life: 5000,
        })
      }
      showToast({
        severity: 'warn',
        summary: $t('项目用量不足'),
        detail: (
          <I18nT keypath={$t('您已达到最大项目创建限制，可通过删除不再使用的项目或{link}', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('单击此处升级')}</a> }}
          </I18nT>
        ),
        life: 5000,
      })
    }
    else if (code === BUSINESS_CODE.DAILY_OPEN_LIMIT) {
      if (!check('Cost_Center_all')) {
        return showToast({
          severity: 'warn',
          summary: $t('窗口打开次数不足'),
          detail: $t('当前团队下的窗口打开次数已到达上限，请删除不再使用的窗口或者联系团队的拥有者进行升级。'),
          life: 5000,
        })
      }
      showToast({
        severity: 'warn',
        summary: $t('窗口打开次数不足'),
        detail: (
          <I18nT keypath={$t('您已达到最大窗口打开次数限制，{link}', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('单击此处升级')}</a> }}
          </I18nT>
        ),
        life: 5000,
      })
    }
    else if (code === BUSINESS_CODE.WINDOW_TEMPLATE_MAX_LIMIT) {
      showToast({
        severity: 'warn',
        summary: $t('请升级您的套餐'),
        detail: (
          <I18nT keypath={$t('模板功能仅限 Roxy 会员使用，{link}', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('单击此处升级')}</a> }}
          </I18nT>
        ),
        life: 5000,
      })
    }
    else {
      await next?.()
    }
  }

  return {
    handleBusinessCode,
  }
}
