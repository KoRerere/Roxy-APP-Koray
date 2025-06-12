import type { ToastMessageOptions } from "primevue/toast"
import { SubLevelEnum } from "/@/enums/pay"
import router from "/@/router"
import { useUserStore } from "/@/stores/user"
import { emitter } from "/@/utils/eventBus"
import { $t } from "/@/locales"
import { I18nT } from "vue-i18n"
import { BUSINESS_CODE } from "/@/constants/business-code"
import { useRoleStore } from "/@/stores/role"
import { useWorkspaceStore } from "/@/stores/workspace"
import { Role } from '/@/enums';

export const toUpgradePlan = () => {
  const { userPayInfo } = useUserStore()
  const isFree = [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.subLevel as SubLevelEnum)
  if (isFree) {
    router.push({ name: 'subscribe-plan' })
  } else if (!userPayInfo?.isAuto && !isFree) {
    emitter.emit('showRenewalDialog')
  }
}

export const switchWorkspaceAndToUpgradePlan = async () => {
  const workspaceStore = useWorkspaceStore()
  if (workspaceStore.workspaceList.length === 0) {
    await workspaceStore.getWorkspaceList()
  }
  const ownerWorkspace = workspaceStore.workspaceList.find(item => item.workspaceDefault && item.role === Role.OWNER)
  if (ownerWorkspace) {
    workspaceStore.setCurrentWorkspace(ownerWorkspace.id!).finally(() => {
      setTimeout(() => {
        toUpgradePlan()
      }, 1500)
    })
  }
}

export const showToast = (options: ToastMessageOptions) => emitter.emit('showToast', options)

export function useHandleBusinessCode() {
  const { userPayInfo } = storeToRefs(useUserStore())
  const { isOwner } = storeToRefs(useRoleStore())

  async function handleBusinessCode(code: number, next?: () => void) {
    const privateUpgrade = isOwner.value ? toUpgradePlan : switchWorkspaceAndToUpgradePlan
    // 空间数量超出
    if (code === BUSINESS_CODE.WORKSPACE_MAX_LIMIT) {
      showToast({
        severity: 'warn',
        summary: $t('工作空间用量不足'),
        detail: <I18nT keypath={$t('您已达到最大工作空间创建限制，可通过删除不再使用的工作空间或 {link}', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={() => emitter.emit('showExpandDialog', { defaultType: 'workspace' })}>{$t('购买更多')}</a> }}
        </I18nT>,
        life: 5000
      })
    } else if (code === BUSINESS_CODE.MEMBER_MAX_LIMIT) {
      if (!isOwner.value) {
        return showToast({
          severity: 'warn',
          summary: $t('团队成员用量不足'),
          detail: $t('当前空间下的团队成员数量已到达上限，请删除不再活跃的团队成员或者联系空间的拥有者进行升级。'),
          life: 5000
        })
      }

      showToast({
        severity: 'warn',
        summary: $t('团队成员用量不足'),
        detail: <I18nT keypath={$t('您已达到最大团队成员添加限制，可通过删除不再活跃的团队成员或 {link}', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={() => emitter.emit('showExpandDialog', { defaultType: 'staff' })}>{$t('购买更多')}</a> }}
        </I18nT>,
        life: 5000
      })
    } else if (code === BUSINESS_CODE.WINDOW_MAX_LIMIT) {
      if (!isOwner.value) {
        return showToast({
          severity: 'warn',
          summary: $t('窗口用量不足'),
          detail: $t('当前空间下的可创建窗口数量已到达上限，请删除不需要的窗口或者联系空间的拥有者进行升级。'),
          life: 5000
        })
      }

      // 免费用户，创建额度不足
      if (userPayInfo.value.subLevel === SubLevelEnum.Free) {
        emitter.emit('showUpgradePlanDialog', 'windowLimitReached')
      }
      // 订阅到期用户，创建额度不足
      else if (userPayInfo.value.subLevel === SubLevelEnum.Expired) {
        emitter.emit('showUpgradePlanDialog', 'subscriptionExpired')
      } else {
        showToast({
          severity: 'warn',
          summary: $t('窗口用量不足'),
          detail: <I18nT keypath={$t('您已达到最大窗口创建限制，可通过删除不再使用的窗口或{link}。', { count: userPayInfo.value.maxWindowCount, link: '{link}' })} >
            {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('购买更多')}</a> }}
          </I18nT>,
          life: 5000
        })
      }
    } else if (code === BUSINESS_CODE.PROJECT_MAX_LIMIT) {
      if (!isOwner.value) {
        return showToast({
          severity: 'warn',
          summary: $t('项目用量不足'),
          detail: $t('当前空间下的项目数量已到达上限，请删除不再使用的项目或者联系空间的拥有者进行升级。'),
          life: 5000
        })
      }

      showToast({
        severity: 'warn',
        summary: $t('项目用量不足'),
        detail: <I18nT keypath={$t('您已达到最大项目创建限制，可通过删除不再使用的项目或{link}', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('单击此处升级')}</a> }}
        </I18nT>,
        life: 5000
      })
    } else if (code === BUSINESS_CODE.DAILY_OPEN_LIMIT) {
      if (!isOwner.value) {
        return showToast({
          severity: 'warn',
          summary: $t('窗口打开次数不足'),
          detail: $t('当前空间下的窗口打开次数已到达上限，请删除不再使用的窗口或者联系空间的拥有者进行升级。'),
          life: 5000
        })
      }


      showToast({
        severity: 'warn',
        summary: $t('窗口打开次数不足'),
        detail: <I18nT keypath={$t('您已达到最大窗口打开次数限制，{link}', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('单击此处升级')}</a> }}
        </I18nT>,
        life: 5000
      })
      // !todo
      // showToast({
      //   severity: 'warn',
      //   summary: $t('窗口创建次数不足'),
      //   detail: <I18nT keypath={$t('您已达到最大窗口创建次数限制，{link}', { link: '{link}' })} >
      //     {{ link: () => <a class="cursor-pointer" onClick={toUpgradePlan}>{$t('单击此处升级')}</a> }}
      //   </I18nT>,
      //   life: 5000
      // })
    } else if (code === BUSINESS_CODE.WINDOW_TEMPLATE_MAX_LIMIT) {
      showToast({
        severity: 'warn',
        summary: $t('请升级您的套餐'),
        detail: <I18nT keypath={$t('模板功能仅限 Roxy 会员使用，{link}', { link: '{link}' })} >
          {{ link: () => <a class="cursor-pointer" onClick={privateUpgrade}>{$t('单击此处升级')}</a> }}
        </I18nT>,
        life: 5000
      })
    } else {
      await next?.()
    }
  }

  return {
    handleBusinessCode,
  }
}
